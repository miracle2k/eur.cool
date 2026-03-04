import { EUR_STABLECOIN_REGISTRY } from "@/data/eurStablecoinRegistry";
import { chainName, isEvmAddress, isEvmChain } from "@/lib/chains";
import { computeIntervalChanges, appendSnapshot } from "@/lib/history";
import { fetchEvmTotalSupply } from "@/lib/rpc";
import { fetchNonEvmTotalSupply } from "@/lib/nonEvm";
import {
  appendSnapshotToTurso,
  createRefreshRun,
  failRefreshRun,
  finalizeRefreshRun,
  insertContractObservations,
  isTursoEnabled,
  LatestContractValue,
  ObservationRow,
  readHistoryFromTurso,
  readLatestSnapshotContractValues,
  SnapshotContractRow,
} from "@/lib/turso-store";
import {
  ChainAggregate,
  ContractSupply,
  IssuanceResponse,
  IssuanceSnapshot,
  StablecoinIssuance,
  StablecoinRegistryEntry,
} from "@/lib/types";

type RpcJob = {
  token: StablecoinRegistryEntry;
  chainId: string;
  address: string;
};

type RpcJobResult = {
  key: string;
  supply: number | null;
  decimals: number | null;
  status: "ok" | "error";
  error?: string;
};

type NonEvmJobResult = {
  key: string;
  supply: number | null;
  decimals: number | null;
  status: "ok" | "error" | "unsupported";
  method: string;
  error?: string;
};

function keyFor(id: string, chainId: string, address: string) {
  return `${id}::${chainId}::${address.toLowerCase()}`;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const result = new Array<R>(items.length);
  let nextIndex = 0;

  async function run() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      result[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return result;
}

const CARRY_FORWARD_MAX_HOURS = Number(process.env.CARRY_FORWARD_MAX_HOURS ?? 48);

function snapshotValueState(contract: ContractSupply): SnapshotContractRow["valueState"] {
  if (contract.supply === null) {
    return "missing";
  }

  if (contract.source === "carried") {
    return "carried";
  }

  return "fresh";
}

function canCarryForward(previous: LatestContractValue, nowMs: number): boolean {
  if (!previous.valueObservedAt) {
    return false;
  }

  if (!Number.isFinite(CARRY_FORWARD_MAX_HOURS) || CARRY_FORWARD_MAX_HOURS <= 0) {
    return false;
  }

  const observedAt = new Date(previous.valueObservedAt).getTime();
  if (Number.isNaN(observedAt)) {
    return false;
  }

  const maxAgeMs = CARRY_FORWARD_MAX_HOURS * 60 * 60 * 1000;
  return nowMs - observedAt <= maxAgeMs;
}

function toSnapshotContractRows(
  stablecoins: StablecoinIssuance[],
  generatedAt: string,
  previousValues: Map<string, LatestContractValue>,
): SnapshotContractRow[] {
  const rows: SnapshotContractRow[] = [];

  for (const token of stablecoins) {
    for (const contract of token.contracts) {
      const contractKey = keyFor(token.id, contract.chainId, contract.address);
      const previous = previousValues.get(contractKey);

      const valueObservedAt =
        contract.supply === null
          ? null
          : contract.source === "carried"
            ? (previous?.valueObservedAt ?? null)
            : generatedAt;

      rows.push({
        contractKey,
        tokenId: token.id,
        tokenSymbol: token.symbol,
        tokenName: token.name,
        chainId: contract.chainId,
        chainName: contract.chainName,
        address: contract.address,
        kind: contract.kind,
        supply: contract.supply,
        decimals: contract.decimals,
        source: contract.source,
        method: contract.method,
        status: contract.status,
        error: contract.error,
        valueState: snapshotValueState(contract),
        valueObservedAt,
      });
    }
  }

  return rows;
}

export async function buildIssuanceSnapshot(): Promise<IssuanceResponse> {
  const useTurso = isTursoEnabled();
  const refreshRunId = useTurso ? await createRefreshRun("full") : null;

  try {
    const refreshStartedAtMs = Date.now();
    const previousValues: Map<string, LatestContractValue> = useTurso
      ? await readLatestSnapshotContractValues()
      : new Map<string, LatestContractValue>();

    const rpcJobs: RpcJob[] = [];
    const nonEvmJobs: RpcJob[] = [];

    for (const token of EUR_STABLECOIN_REGISTRY) {
      for (const contract of token.contracts) {
        const job = { token, chainId: contract.chainId, address: contract.address };
        if (isEvmAddress(contract.address) && isEvmChain(contract.chainId)) {
          rpcJobs.push(job);
        } else {
          nonEvmJobs.push(job);
        }
      }
    }

    const alchemyKey = process.env.ALCHEMY_API_KEY;

    const rpcResults = await mapWithConcurrency(rpcJobs, 8, async (job): Promise<RpcJobResult> => {
      const result = await fetchEvmTotalSupply(job.chainId, job.address, alchemyKey);

      if (result.ok) {
        return {
          key: keyFor(job.token.id, job.chainId, job.address),
          supply: result.supply,
          decimals: result.decimals,
          status: "ok",
        };
      }

      return {
        key: keyFor(job.token.id, job.chainId, job.address),
        supply: null,
        decimals: null,
        status: "error",
        error: result.error,
      };
    });

    const nonEvmResults = await mapWithConcurrency(nonEvmJobs, 8, async (job): Promise<NonEvmJobResult> => {
      const result = await fetchNonEvmTotalSupply({
        chainId: job.chainId,
        address: job.address,
        symbol: job.token.symbol,
      });

      if (result.ok) {
        return {
          key: keyFor(job.token.id, job.chainId, job.address),
          supply: result.supply,
          decimals: result.decimals,
          status: "ok",
          method: result.method,
        };
      }

      return {
        key: keyFor(job.token.id, job.chainId, job.address),
        supply: null,
        decimals: null,
        status: result.status,
        method: result.method,
        error: result.error,
      };
    });

    const rpcByKey = new Map<string, RpcJobResult>();
    for (const result of rpcResults) {
      rpcByKey.set(result.key, result);
    }

    const nonEvmByKey = new Map<string, NonEvmJobResult>();
    for (const result of nonEvmResults) {
      nonEvmByKey.set(result.key, result);
    }

    const observations: ObservationRow[] = [];

    let rpcSuccessContracts = 0;
    let unsupportedContracts = 0;
    let failedContracts = 0;
    let freshContracts = 0;
    let carriedContracts = 0;
    let missingContracts = 0;

    const stablecoins: StablecoinIssuance[] = EUR_STABLECOIN_REGISTRY.map((token) => {
      const contracts: ContractSupply[] = [];

      let nativeSupply = 0;
      let bridgedSupply = 0;

      for (const contract of token.contracts) {
        const contractKey = keyFor(token.id, contract.chainId, contract.address);
        const previous = previousValues.get(contractKey);

        const base: Omit<ContractSupply, "supply" | "decimals" | "source" | "method" | "status"> = {
          chainId: contract.chainId,
          chainName: chainName(contract.chainId),
          address: contract.address,
          kind: contract.kind,
        };

        if (isEvmAddress(contract.address) && isEvmChain(contract.chainId)) {
          const rpc = rpcByKey.get(contractKey);

          if (rpc?.status === "ok" && rpc.supply !== null && rpc.decimals !== null) {
            rpcSuccessContracts += 1;
            freshContracts += 1;

            if (contract.kind === "bridged") {
              bridgedSupply += rpc.supply;
            } else {
              nativeSupply += rpc.supply;
            }

            contracts.push({
              ...base,
              supply: rpc.supply,
              decimals: rpc.decimals,
              source: "rpc",
              method: "evm:erc20-totalSupply",
              status: "ok",
            });

            observations.push({
              contractKey,
              tokenId: token.id,
              tokenSymbol: token.symbol,
              tokenName: token.name,
              chainId: contract.chainId,
              chainName: chainName(contract.chainId),
              address: contract.address,
              kind: contract.kind,
              status: "ok",
              source: "rpc",
              method: "evm:erc20-totalSupply",
              supply: rpc.supply,
              decimals: rpc.decimals,
            });
          } else {
            failedContracts += 1;

            observations.push({
              contractKey,
              tokenId: token.id,
              tokenSymbol: token.symbol,
              tokenName: token.name,
              chainId: contract.chainId,
              chainName: chainName(contract.chainId),
              address: contract.address,
              kind: contract.kind,
              status: "error",
              source: "unavailable",
              method: "evm:erc20-totalSupply",
              supply: null,
              decimals: null,
              error: rpc?.error ?? "RPC lookup failed",
            });

            if (previous && canCarryForward(previous, refreshStartedAtMs)) {
              carriedContracts += 1;

              if (contract.kind === "bridged") {
                bridgedSupply += previous.supply;
              } else {
                nativeSupply += previous.supply;
              }

              contracts.push({
                ...base,
                supply: previous.supply,
                decimals: previous.decimals,
                source: "carried",
                method: previous.method,
                status: "stale",
                error: rpc?.error ?? "RPC lookup failed",
              });
            } else {
              missingContracts += 1;

              contracts.push({
                ...base,
                supply: null,
                decimals: null,
                source: "unavailable",
                method: "evm:erc20-totalSupply",
                status: "error",
                error: rpc?.error ?? "RPC lookup failed",
              });
            }
          }

          continue;
        }

        const nonEvm = nonEvmByKey.get(contractKey);
        if (nonEvm?.status === "ok" && nonEvm.supply !== null && nonEvm.decimals !== null) {
          rpcSuccessContracts += 1;
          freshContracts += 1;

          if (contract.kind === "bridged") {
            bridgedSupply += nonEvm.supply;
          } else {
            nativeSupply += nonEvm.supply;
          }

          contracts.push({
            ...base,
            supply: nonEvm.supply,
            decimals: nonEvm.decimals,
            source: "rpc",
            method: nonEvm.method,
            status: "ok",
          });

          observations.push({
            contractKey,
            tokenId: token.id,
            tokenSymbol: token.symbol,
            tokenName: token.name,
            chainId: contract.chainId,
            chainName: chainName(contract.chainId),
            address: contract.address,
            kind: contract.kind,
            status: "ok",
            source: "rpc",
            method: nonEvm.method,
            supply: nonEvm.supply,
            decimals: nonEvm.decimals,
          });
        } else if (nonEvm?.status === "unsupported") {
          unsupportedContracts += 1;

          observations.push({
            contractKey,
            tokenId: token.id,
            tokenSymbol: token.symbol,
            tokenName: token.name,
            chainId: contract.chainId,
            chainName: chainName(contract.chainId),
            address: contract.address,
            kind: contract.kind,
            status: "unsupported",
            source: "unavailable",
            method: nonEvm.method,
            supply: null,
            decimals: null,
            error: nonEvm.error,
          });

          if (previous && canCarryForward(previous, refreshStartedAtMs)) {
            carriedContracts += 1;

            if (contract.kind === "bridged") {
              bridgedSupply += previous.supply;
            } else {
              nativeSupply += previous.supply;
            }

            contracts.push({
              ...base,
              supply: previous.supply,
              decimals: previous.decimals,
              source: "carried",
              method: previous.method,
              status: "stale",
              error: nonEvm.error,
            });
          } else {
            missingContracts += 1;

            contracts.push({
              ...base,
              supply: null,
              decimals: null,
              source: "unavailable",
              method: nonEvm.method,
              status: "unsupported",
              error: nonEvm.error,
            });
          }
        } else {
          failedContracts += 1;

          observations.push({
            contractKey,
            tokenId: token.id,
            tokenSymbol: token.symbol,
            tokenName: token.name,
            chainId: contract.chainId,
            chainName: chainName(contract.chainId),
            address: contract.address,
            kind: contract.kind,
            status: "error",
            source: "unavailable",
            method: nonEvm?.method ?? "non-evm:unknown",
            supply: null,
            decimals: null,
            error: nonEvm?.error ?? "Non-EVM lookup failed",
          });

          if (previous && canCarryForward(previous, refreshStartedAtMs)) {
            carriedContracts += 1;

            if (contract.kind === "bridged") {
              bridgedSupply += previous.supply;
            } else {
              nativeSupply += previous.supply;
            }

            contracts.push({
              ...base,
              supply: previous.supply,
              decimals: previous.decimals,
              source: "carried",
              method: previous.method,
              status: "stale",
              error: nonEvm?.error ?? "Non-EVM lookup failed",
            });
          } else {
            missingContracts += 1;

            contracts.push({
              ...base,
              supply: null,
              decimals: null,
              source: "unavailable",
              method: nonEvm?.method ?? "non-evm:unknown",
              status: "error",
              error: nonEvm?.error ?? "Non-EVM lookup failed",
            });
          }
        }
      }

      return {
        id: token.id,
        symbol: token.symbol,
        name: token.name,
        contracts,
        nativeSupply,
        bridgedSupply,
        totalSupply: nativeSupply + bridgedSupply,
      };
    }).sort((a, b) => b.totalSupply - a.totalSupply);

    const fallbackContracts = stablecoins
      .flatMap((token) => token.contracts)
      .filter((contract) => contract.chainId === "other");

    if (fallbackContracts.length > 0) {
      throw new Error(
        `Strict on-chain policy violation: found ${fallbackContracts.length} fallback contract rows (other).`,
      );
    }

    const chainMap = new Map<string, ChainAggregate>();
    const chainTokenSets = new Map<string, Set<string>>();

    for (const token of stablecoins) {
      for (const contract of token.contracts) {
        if (contract.supply === null) {
          continue;
        }

        const existing = chainMap.get(contract.chainId) ?? {
          chainId: contract.chainId,
          chainName: contract.chainName,
          nativeSupply: 0,
          bridgedSupply: 0,
          totalSupply: 0,
          tokenCount: 0,
        };

        if (contract.kind === "bridged") {
          existing.bridgedSupply += contract.supply;
        } else {
          existing.nativeSupply += contract.supply;
        }
        existing.totalSupply += contract.supply;
        chainMap.set(contract.chainId, existing);

        const set = chainTokenSets.get(contract.chainId) ?? new Set<string>();
        set.add(token.id);
        chainTokenSets.set(contract.chainId, set);
      }
    }

    const chains = [...chainMap.values()]
      .map((chain) => ({
        ...chain,
        tokenCount: chainTokenSets.get(chain.chainId)?.size ?? 0,
      }))
      .sort((a, b) => b.totalSupply - a.totalSupply);

    const totals = stablecoins.reduce(
      (acc, token) => {
        acc.native += token.nativeSupply;
        acc.withBridged += token.totalSupply;
        return acc;
      },
      { native: 0, withBridged: 0 },
    );

    const contractSupplies: Record<string, number> = {};
    for (const token of stablecoins) {
      for (const contract of token.contracts) {
        if (contract.supply === null) {
          continue;
        }

        contractSupplies[keyFor(token.id, contract.chainId, contract.address)] = contract.supply;
      }
    }

    const generatedAt = new Date().toISOString();
    const currentSnapshot: IssuanceSnapshot = {
      timestamp: generatedAt,
      native: totals.native,
      withBridged: totals.withBridged,
      contractSupplies,
    };

    let history: IssuanceSnapshot[] = [];

    if (useTurso) {
      history = await readHistoryFromTurso();
    } else {
      history = await appendSnapshot(currentSnapshot);
    }

    const historyForChanges = useTurso ? [...history, currentSnapshot] : history;
    const changes = computeIntervalChanges(historyForChanges);

    const response: IssuanceResponse = {
      generatedAt,
      totals,
      changes,
      chains,
      stablecoins,
      sourceStats: {
        trackedTokens: EUR_STABLECOIN_REGISTRY.length,
        trackedContracts: EUR_STABLECOIN_REGISTRY.reduce((sum, token) => sum + token.contracts.length, 0),
        rpcSuccessContracts,
        unsupportedContracts,
        failedContracts,
      },
    };

    if (useTurso) {
      await insertContractObservations(refreshRunId, observations);

      await appendSnapshotToTurso({
        capturedAt: generatedAt,
        nativeTotal: totals.native,
        withBridgedTotal: totals.withBridged,
        sourceStats: response.sourceStats,
        freshContracts,
        carriedContracts,
        missingContracts,
        payload: response,
        contracts: toSnapshotContractRows(stablecoins, generatedAt, previousValues),
      });

      if (refreshRunId !== null) {
        await finalizeRefreshRun(refreshRunId, {
          attemptedContracts: response.sourceStats.trackedContracts,
          okContracts: rpcSuccessContracts,
          errorContracts: failedContracts,
          unsupportedContracts,
        });
      }
    }

    return response;
  } catch (error) {
    if (refreshRunId !== null) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        await failRefreshRun(refreshRunId, message);
      } catch {
        // keep original refresh error as the surfaced failure
      }
    }

    throw error;
  }
}
