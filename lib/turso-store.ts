import { createClient, type Client, type InStatement, type Transaction } from "@libsql/client";
import { IssuanceResponse, IssuanceSnapshot } from "@/lib/types";

type RunKind = "full" | "partial" | "manual";
type ObservationStatus = "ok" | "error" | "unsupported";
type ObservationSource = "rpc" | "unavailable";

type SnapshotValueState = "fresh" | "carried" | "missing";

export type SnapshotContractRow = {
  contractKey: string;
  tokenId: string;
  tokenSymbol: string;
  tokenName: string;
  chainId: string;
  chainName: string;
  address: string;
  kind: "native" | "bridged";
  supply: number | null;
  decimals: number | null;
  source: "rpc" | "unavailable" | "carried";
  method: string;
  status: "ok" | "error" | "unsupported" | "stale";
  error?: string;
  valueState: SnapshotValueState;
  valueObservedAt: string | null;
};

export type ObservationRow = {
  contractKey: string;
  tokenId: string;
  tokenSymbol: string;
  tokenName: string;
  chainId: string;
  chainName: string;
  address: string;
  kind: "native" | "bridged";
  status: ObservationStatus;
  source: ObservationSource;
  method: string;
  supply: number | null;
  decimals: number | null;
  error?: string;
};

export type LatestContractValue = {
  supply: number;
  decimals: number | null;
  method: string;
  valueObservedAt: string | null;
};

const SNAPSHOT_RETAIN_DAYS = 120;
const OPERATIONAL_RETAIN_DAYS = 180;

let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

function asIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(String(value)).toISOString();
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function tursoUrl(): string {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error("TURSO_DATABASE_URL is not set");
  }

  return url;
}

export function isTursoEnabled(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL);
}

function getClient(): Client {
  if (!client) {
    client = createClient({
      url: tursoUrl(),
      authToken: process.env.TURSO_AUTH_TOKEN,
      intMode: "number",
    });
  }

  return client;
}

async function withTransaction<T>(worker: (tx: Transaction) => Promise<T>): Promise<T> {
  const tx = await getClient().transaction("write");

  try {
    const result = await worker(tx);
    await tx.commit();
    return result;
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}

async function ensureSchema(): Promise<void> {
  if (!isTursoEnabled()) {
    return;
  }

  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getClient();

      await db.executeMultiple(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS refresh_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kind TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'running',
          started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          finalized_at TEXT,
          attempted_contracts INTEGER NOT NULL DEFAULT 0,
          ok_contracts INTEGER NOT NULL DEFAULT 0,
          error_contracts INTEGER NOT NULL DEFAULT 0,
          unsupported_contracts INTEGER NOT NULL DEFAULT 0,
          error TEXT
        );

        CREATE TABLE IF NOT EXISTS contract_observations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          refresh_run_id INTEGER REFERENCES refresh_runs(id) ON DELETE SET NULL,
          observed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          contract_key TEXT NOT NULL,
          token_id TEXT NOT NULL,
          token_symbol TEXT NOT NULL,
          token_name TEXT NOT NULL,
          chain_id TEXT NOT NULL,
          chain_name TEXT NOT NULL,
          address TEXT NOT NULL,
          kind TEXT NOT NULL,
          status TEXT NOT NULL,
          source TEXT NOT NULL,
          method TEXT NOT NULL,
          supply REAL,
          decimals INTEGER,
          error TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_contract_observations_contract_time
          ON contract_observations (contract_key, observed_at DESC);
        CREATE INDEX IF NOT EXISTS idx_contract_observations_run
          ON contract_observations (refresh_run_id);

        CREATE TABLE IF NOT EXISTS issuance_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          captured_at TEXT NOT NULL,
          native_total REAL NOT NULL,
          with_bridged_total REAL NOT NULL,
          tracked_tokens INTEGER NOT NULL,
          tracked_contracts INTEGER NOT NULL,
          rpc_success_contracts INTEGER NOT NULL,
          unsupported_contracts INTEGER NOT NULL,
          failed_contracts INTEGER NOT NULL,
          fresh_contracts INTEGER NOT NULL,
          carried_contracts INTEGER NOT NULL,
          missing_contracts INTEGER NOT NULL,
          payload TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_issuance_snapshots_captured_desc
          ON issuance_snapshots (captured_at DESC);

        CREATE TABLE IF NOT EXISTS issuance_snapshot_contracts (
          snapshot_id INTEGER NOT NULL REFERENCES issuance_snapshots(id) ON DELETE CASCADE,
          contract_key TEXT NOT NULL,
          token_id TEXT NOT NULL,
          token_symbol TEXT NOT NULL,
          token_name TEXT NOT NULL,
          chain_id TEXT NOT NULL,
          chain_name TEXT NOT NULL,
          address TEXT NOT NULL,
          kind TEXT NOT NULL,
          supply REAL,
          decimals INTEGER,
          source TEXT NOT NULL,
          method TEXT NOT NULL,
          status TEXT NOT NULL,
          error TEXT,
          value_state TEXT NOT NULL,
          value_observed_at TEXT,
          PRIMARY KEY (snapshot_id, contract_key)
        );

        CREATE INDEX IF NOT EXISTS idx_snapshot_contracts_contract_snapshot
          ON issuance_snapshot_contracts (contract_key, snapshot_id DESC);
        CREATE INDEX IF NOT EXISTS idx_snapshot_contracts_snapshot
          ON issuance_snapshot_contracts (snapshot_id);
      `);
    })();
  }

  await schemaReady;
}

export async function createRefreshRun(kind: RunKind): Promise<number | null> {
  if (!isTursoEnabled()) {
    return null;
  }

  await ensureSchema();

  const result = await getClient().execute({
    sql: `INSERT INTO refresh_runs (kind, status) VALUES (?, 'running')`,
    args: [kind],
  });

  const rowId = result.lastInsertRowid;
  if (rowId === undefined) {
    return null;
  }

  const id = parseNumber(rowId);
  return id;
}

export async function finalizeRefreshRun(
  runId: number,
  stats: {
    attemptedContracts: number;
    okContracts: number;
    errorContracts: number;
    unsupportedContracts: number;
  },
): Promise<void> {
  if (!isTursoEnabled()) {
    return;
  }

  await ensureSchema();

  await getClient().execute({
    sql: `
      UPDATE refresh_runs
      SET status = 'finalized',
          finalized_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          attempted_contracts = ?,
          ok_contracts = ?,
          error_contracts = ?,
          unsupported_contracts = ?,
          error = NULL
      WHERE id = ?
    `,
    args: [stats.attemptedContracts, stats.okContracts, stats.errorContracts, stats.unsupportedContracts, runId],
  });
}

export async function failRefreshRun(runId: number, errorMessage: string): Promise<void> {
  if (!isTursoEnabled()) {
    return;
  }

  await ensureSchema();

  await getClient().execute({
    sql: `
      UPDATE refresh_runs
      SET status = 'failed',
          finalized_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          error = ?
      WHERE id = ?
    `,
    args: [errorMessage.slice(0, 2000), runId],
  });
}

export async function insertContractObservations(runId: number | null, rows: ObservationRow[]): Promise<void> {
  if (!isTursoEnabled() || rows.length === 0) {
    return;
  }

  await ensureSchema();

  await withTransaction(async (tx) => {
    for (const row of rows) {
      await tx.execute({
        sql: `
          INSERT INTO contract_observations (
            refresh_run_id,
            contract_key,
            token_id,
            token_symbol,
            token_name,
            chain_id,
            chain_name,
            address,
            kind,
            status,
            source,
            method,
            supply,
            decimals,
            error
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          runId,
          row.contractKey,
          row.tokenId,
          row.tokenSymbol,
          row.tokenName,
          row.chainId,
          row.chainName,
          row.address,
          row.kind,
          row.status,
          row.source,
          row.method,
          row.supply,
          row.decimals,
          row.error ?? null,
        ],
      });
    }
  });
}

export async function readLatestIssuancePayload(): Promise<IssuanceResponse | null> {
  if (!isTursoEnabled()) {
    return null;
  }

  await ensureSchema();

  const result = await getClient().execute(`
    SELECT payload
    FROM issuance_snapshots
    ORDER BY captured_at DESC
    LIMIT 1
  `);

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  const payloadRaw = row.payload;
  if (typeof payloadRaw !== "string") {
    return null;
  }

  try {
    const payload = JSON.parse(payloadRaw) as unknown;
    if (!payload || typeof payload !== "object") {
      return null;
    }

    return payload as IssuanceResponse;
  } catch {
    return null;
  }
}

export async function readLatestSnapshotContractValues(): Promise<Map<string, LatestContractValue>> {
  const map = new Map<string, LatestContractValue>();

  if (!isTursoEnabled()) {
    return map;
  }

  await ensureSchema();

  const result = await getClient().execute(`
    SELECT contract_key, supply, decimals, method, value_observed_at
    FROM issuance_snapshot_contracts
    WHERE snapshot_id = (
      SELECT id
      FROM issuance_snapshots
      ORDER BY captured_at DESC
      LIMIT 1
    )
      AND supply IS NOT NULL
  `);

  for (const row of result.rows) {
    const contractKey = typeof row.contract_key === "string" ? row.contract_key : "";
    if (!contractKey) {
      continue;
    }

    const supply = parseNumber(row.supply);
    if (supply === null) {
      continue;
    }

    map.set(contractKey, {
      supply,
      decimals: parseNumber(row.decimals),
      method: typeof row.method === "string" ? row.method : "unknown",
      valueObservedAt: row.value_observed_at ? asIsoString(row.value_observed_at) : null,
    });
  }

  return map;
}

export async function readHistoryFromTurso(): Promise<IssuanceSnapshot[]> {
  if (!isTursoEnabled()) {
    return [];
  }

  await ensureSchema();
  const db = getClient();

  const snapshotsResult = await db.execute({
    sql: `
      SELECT id, captured_at, native_total, with_bridged_total
      FROM issuance_snapshots
      WHERE julianday(captured_at) >= julianday('now', ?)
      ORDER BY captured_at ASC
    `,
    args: [`-${SNAPSHOT_RETAIN_DAYS} day`],
  });

  if (snapshotsResult.rows.length === 0) {
    return [];
  }

  const snapshotIds: number[] = [];
  const byId = new Map<number, IssuanceSnapshot>();

  for (const row of snapshotsResult.rows) {
    const id = parseNumber(row.id);
    const native = parseNumber(row.native_total);
    const withBridged = parseNumber(row.with_bridged_total);
    const capturedAt = row.captured_at;

    if (id === null || native === null || withBridged === null || typeof capturedAt !== "string") {
      continue;
    }

    snapshotIds.push(id);
    byId.set(id, {
      timestamp: asIsoString(capturedAt),
      native,
      withBridged,
      contractSupplies: {},
    });
  }

  if (snapshotIds.length === 0) {
    return [];
  }

  const placeholders = snapshotIds.map(() => "?").join(", ");
  const contractsSql = `
    SELECT snapshot_id, contract_key, supply
    FROM issuance_snapshot_contracts
    WHERE snapshot_id IN (${placeholders})
      AND supply IS NOT NULL
  `;

  const contractRows = await db.execute({
    sql: contractsSql,
    args: snapshotIds,
  });

  for (const row of contractRows.rows) {
    const snapshotId = parseNumber(row.snapshot_id);
    const contractKey = typeof row.contract_key === "string" ? row.contract_key : "";
    const supply = parseNumber(row.supply);

    if (snapshotId === null || !contractKey || supply === null) {
      continue;
    }

    const snapshot = byId.get(snapshotId);
    if (!snapshot) {
      continue;
    }

    snapshot.contractSupplies[contractKey] = supply;
  }

  return [...byId.values()].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export async function appendSnapshotToTurso(params: {
  capturedAt: string;
  nativeTotal: number;
  withBridgedTotal: number;
  sourceStats: IssuanceResponse["sourceStats"];
  freshContracts: number;
  carriedContracts: number;
  missingContracts: number;
  payload: IssuanceResponse;
  contracts: SnapshotContractRow[];
}): Promise<void> {
  if (!isTursoEnabled()) {
    return;
  }

  await ensureSchema();

  await withTransaction(async (tx) => {
    const insertSnapshot = await tx.execute({
      sql: `
        INSERT INTO issuance_snapshots (
          captured_at,
          native_total,
          with_bridged_total,
          tracked_tokens,
          tracked_contracts,
          rpc_success_contracts,
          unsupported_contracts,
          failed_contracts,
          fresh_contracts,
          carried_contracts,
          missing_contracts,
          payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        params.capturedAt,
        params.nativeTotal,
        params.withBridgedTotal,
        params.sourceStats.trackedTokens,
        params.sourceStats.trackedContracts,
        params.sourceStats.rpcSuccessContracts,
        params.sourceStats.unsupportedContracts,
        params.sourceStats.failedContracts,
        params.freshContracts,
        params.carriedContracts,
        params.missingContracts,
        JSON.stringify(params.payload),
      ],
    });

    const snapshotId = parseNumber(insertSnapshot.lastInsertRowid);
    if (snapshotId === null) {
      throw new Error("Failed to insert issuance snapshot");
    }

    for (const row of params.contracts) {
      await tx.execute({
        sql: `
          INSERT INTO issuance_snapshot_contracts (
            snapshot_id,
            contract_key,
            token_id,
            token_symbol,
            token_name,
            chain_id,
            chain_name,
            address,
            kind,
            supply,
            decimals,
            source,
            method,
            status,
            error,
            value_state,
            value_observed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          snapshotId,
          row.contractKey,
          row.tokenId,
          row.tokenSymbol,
          row.tokenName,
          row.chainId,
          row.chainName,
          row.address,
          row.kind,
          row.supply,
          row.decimals,
          row.source,
          row.method,
          row.status,
          row.error ?? null,
          row.valueState,
          row.valueObservedAt,
        ],
      });
    }

    const retentionStatements: InStatement[] = [
      {
        sql: `
          DELETE FROM issuance_snapshots
          WHERE julianday(captured_at) < julianday('now', ?)
        `,
        args: [`-${SNAPSHOT_RETAIN_DAYS} day`],
      },
      {
        sql: `
          DELETE FROM contract_observations
          WHERE julianday(observed_at) < julianday('now', ?)
        `,
        args: [`-${OPERATIONAL_RETAIN_DAYS} day`],
      },
      {
        sql: `
          DELETE FROM refresh_runs
          WHERE julianday(started_at) < julianday('now', ?)
        `,
        args: [`-${OPERATIONAL_RETAIN_DAYS} day`],
      },
    ];

    await tx.batch(retentionStatements);
  });
}
