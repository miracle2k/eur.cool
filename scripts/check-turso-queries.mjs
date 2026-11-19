#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const directory = await mkdtemp(path.join(tmpdir(), "eurcool-query-check-"));
const url = `file:${path.join(directory, "history.db")}`;
const previousUrl = process.env.TURSO_DATABASE_URL;
process.env.TURSO_DATABASE_URL = url;
const clients = [];
const statements = [];

// Execute the application modules against a real, isolated libSQL database.
// Capture their statements so the query-plan checks exercise the actual SQL.
function instrument(client) {
  return new Proxy(client, {
    get(target, property) {
      if (property === "execute") return (statement) => {
        statements.push(statement);
        return target.execute(statement);
      };
      if (property === "batch") return (batch, mode) => {
        statements.push(...batch);
        return target.batch(batch, mode);
      };
      if (property === "transaction") return async (mode) => instrument(await target.transaction(mode));
      const value = target[property];
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

const modules = new Map();
async function loadModule(relativePath) {
  if (modules.has(relativePath)) return modules.get(relativePath);
  const source = await readFile(path.join(root, relativePath), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const history = relativePath === "lib/turso-store.ts" ? await loadModule("lib/history.ts") : null;
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)((specifier) => {
    if (specifier === "@/lib/history") return history;
    if (specifier === "@libsql/client") return { createClient: () => {
      const client = createClient({ url });
      clients.push(client);
      return instrument(client);
    } };
    return require(specifier);
  }, module, module.exports);
  modules.set(relativePath, module.exports);
  return module.exports;
}

const db = createClient({ url });
try {
  const { readIntervalBaselinesFromTurso, appendSnapshotToTurso, readLatestSnapshotContractValues } = await loadModule("lib/turso-store.ts");
  const { computeIntervalChanges } = await loadModule("lib/history.ts");
  const hour = 60 * 60 * 1000;
  const now = Math.floor(Date.now() / hour) * hour;
  const capturedAt = new Date(now).toISOString();
  const timestamp = (hoursAgo) => new Date(now - hoursAgo * hour).toISOString();
  assert.deepEqual(await readIntervalBaselinesFromTurso(capturedAt), []);

  // 130 days of hourly history, including added, removed, and unavailable contracts.
  await db.execute({
    sql: `WITH RECURSIVE hours(n) AS (
      SELECT 0 UNION ALL SELECT n + 1 FROM hours WHERE n < 3119
    ) INSERT INTO issuance_snapshots (
      captured_at, native_total, with_bridged_total, tracked_tokens, tracked_contracts,
      rpc_success_contracts, unsupported_contracts, failed_contracts,
      fresh_contracts, carried_contracts, missing_contracts, payload
    ) SELECT strftime('%Y-%m-%dT%H:%M:%fZ', ?, '+' || n || ' hours'),
      1000 + n, 1000 + n, 1, 4, 3, 0, 1, 3, 0, 1, '{}' FROM hours`,
    args: [timestamp(130 * 24)],
  });
  await db.execute(`INSERT INTO issuance_snapshot_contracts (
    snapshot_id, contract_key, token_id, token_symbol, token_name, chain_id, chain_name,
    address, kind, supply, decimals, source, method, status, value_state, value_observed_at
  ) SELECT s.id, c.key, 'sample', 'SAMPLE', 'Sample', 'sample', 'Sample', c.key, 'native',
    CASE c.key WHEN 'common' THEN 999 + s.id WHEN 'new' THEN 200
      WHEN 'gone' THEN 100 ELSE NULL END,
    6, 'rpc', 'test', 'ok', 'fresh', s.captured_at
    FROM issuance_snapshots s CROSS JOIN (
      SELECT 'common' AS key UNION ALL SELECT 'new' UNION ALL SELECT 'gone' UNION ALL SELECT 'unavailable'
    ) c WHERE c.key NOT IN ('new', 'gone')
      OR (c.key = 'new' AND s.id > 3048) OR (c.key = 'gone' AND s.id <= 3048)`);

  const baselines = await readIntervalBaselinesFromTurso(capturedAt);
  assert.equal(baselines.length, 4);
  assert.ok(baselines.every((snapshot) => Object.keys(snapshot.contractSupplies).length <= 2));
  const current = { timestamp: capturedAt, native: 5333, withBridged: 5333, contractSupplies: { common: 5000, new: 333 } };
  const fullHistory = Array.from({ length: 2880 }, (_, offset) => {
    const n = offset + 240;
    return {
      timestamp: timestamp(3120 - n), native: 1000 + n, withBridged: 1000 + n,
      contractSupplies: { common: 1000 + n, ...(n >= 3048 ? { new: 200 } : { gone: 100 }) },
    };
  });
  const changes = computeIntervalChanges([...baselines, current]);
  assert.deepEqual(changes, computeIntervalChanges([...fullHistory, current]));
  assert.deepEqual(changes.map((change) => change.absChange), [1600, 1048, 1037, 1014]);

  // Sparse history can use the same baseline for more than one interval.
  await db.execute("DELETE FROM issuance_snapshot_contracts WHERE snapshot_id != 1");
  await db.execute("DELETE FROM issuance_snapshots WHERE id != 1");
  assert.deepEqual(await readIntervalBaselinesFromTurso(capturedAt), []); // outside retention
  await db.execute({ sql: "UPDATE issuance_snapshots SET captured_at = ? WHERE id = 1", args: [timestamp(45 * 24)] });
  assert.equal((await readIntervalBaselinesFromTurso(capturedAt)).length, 1);
  await db.execute({ sql: "UPDATE issuance_snapshots SET captured_at = ? WHERE id = 1", args: [timestamp(2)] });
  const sparseChanges = computeIntervalChanges([...(await readIntervalBaselinesFromTurso(capturedAt)), current]);
  assert.deepEqual(sparseChanges.slice(0, 3).map((change) => change.absChange), [null, null, null]);

  // Retention must preserve newer evidence, including observations of an expired run.
  await db.execute({ sql: "UPDATE issuance_snapshots SET captured_at = ? WHERE id = 1", args: [timestamp(121 * 24)] });
  await db.execute({ sql: "INSERT INTO refresh_runs (id, kind, started_at) VALUES (1, 'full', ?), (2, 'full', ?)", args: [timestamp(181 * 24), timestamp(24)] });
  await db.execute({
    sql: `INSERT INTO contract_observations (
      refresh_run_id, observed_at, contract_key, token_id, token_symbol, token_name,
      chain_id, chain_name, address, kind, status, source, method
    ) VALUES (1, ?, 'expired', 'sample', 'SAMPLE', 'Sample', 'sample', 'Sample', 'sample', 'native', 'ok', 'rpc', 'test'),
      (1, ?, 'retained', 'sample', 'SAMPLE', 'Sample', 'sample', 'Sample', 'sample', 'native', 'ok', 'rpc', 'test')`,
    args: [timestamp(181 * 24), timestamp(179 * 24)],
  });
  await appendSnapshotToTurso({
    capturedAt, nativeTotal: 0, withBridgedTotal: 0,
    sourceStats: { trackedTokens: 0, trackedContracts: 0, rpcSuccessContracts: 0, unsupportedContracts: 0, failedContracts: 0 },
    freshContracts: 0, carriedContracts: 0, missingContracts: 0, payload: {}, contracts: [],
  });
  assert.deepEqual((await db.execute("SELECT captured_at FROM issuance_snapshots")).rows.map((r) => r.captured_at), [capturedAt]);
  assert.equal((await db.execute("SELECT COUNT(*) AS count FROM issuance_snapshot_contracts")).rows[0].count, 0);
  assert.deepEqual((await db.execute("SELECT contract_key, refresh_run_id FROM contract_observations")).rows.map((r) => ({ ...r })), [{ contract_key: "retained", refresh_run_id: null }]);
  assert.deepEqual((await db.execute("SELECT id FROM refresh_runs")).rows.map((r) => r.id), [2]);

  // Archival balances survive persistence without acquiring a new observation date.
  const observedAt = "2023-01-01T00:00:00.000Z";
  await appendSnapshotToTurso({
    capturedAt: new Date(now + 1000).toISOString(), nativeTotal: 0, withBridgedTotal: 0,
    sourceStats: { trackedTokens: 0, trackedContracts: 0, rpcSuccessContracts: 0, unsupportedContracts: 0, failedContracts: 0 },
    freshContracts: 0, carriedContracts: 1, missingContracts: 0, payload: {},
    contracts: [{
      contractKey: "retired", tokenId: "sample", tokenSymbol: "SAMPLE", tokenName: "Sample",
      chainId: "sample", chainName: "Sample", address: "retired", kind: "bridged",
      supply: 123, decimals: 6, source: "archived", method: "sample:on-chain", status: "retired",
      valueState: "archived", valueObservedAt: observedAt,
    }],
  });
  assert.deepEqual((await readLatestSnapshotContractValues()).get("retired"), {
    supply: 123, decimals: 6, method: "sample:on-chain", valueObservedAt: observedAt,
  });
  assert.deepEqual({ ...(await db.execute("SELECT supply, source, status, value_state, value_observed_at FROM issuance_snapshot_contracts WHERE contract_key = 'retired'")).rows[0] }, {
    supply: 123, source: "archived", status: "retired", value_state: "archived", value_observed_at: observedAt,
  });

  const queries = statements.filter((statement) => typeof statement === "object" && /SELECT id, captured_at|DELETE FROM/.test(statement.sql));
  const uniqueQueries = [...new Map(queries.map((query) => [query.sql, query])).values()];
  assert.equal(uniqueQueries.length, 4); // one baseline lookup and three retention statements
  for (const query of uniqueQueries) {
    const plan = await db.execute({ ...query, sql: `EXPLAIN QUERY PLAN ${query.sql}` });
    const details = plan.rows.map((row) => row.detail);
    assert.ok(details.some((detail) => detail.startsWith("SEARCH ")), details.join("\n"));
    assert.ok(!details.some((detail) => detail.startsWith("SCAN ")), details.join("\n"));
  }
  console.log("Turso query checks passed: bounded baselines, unchanged interval changes, sparse history, indexed retention, and preserved archival values and dates.");
} finally {
  db.close();
  for (const client of clients) client.close();
  if (previousUrl === undefined) delete process.env.TURSO_DATABASE_URL;
  else process.env.TURSO_DATABASE_URL = previousUrl;
  await rm(directory, { recursive: true, force: true });
}
