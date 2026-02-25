import { EUR_STABLECOIN_REGISTRY } from "@/data/eurStablecoinRegistry";
import { chainName, isEvmAddress, isEvmChain } from "@/lib/chains";
import { fetchMarketDataByIds } from "@/lib/coingecko";
import { computeIntervalChanges, appendSnapshot, readHistory } from "@/lib/history";
import { fetchEvmTotalSupply } from "@/lib/rpc";
import {
  ChainAggregate,
  ContractSupply,
  IssuanceResponse,
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

export async function buildIssuanceSnapshot(): Promise<IssuanceResponse> {
  const tokenIds = EUR_STABLECOIN_REGISTRY.map((token) => token.id);
  const marketDataById = await fetchMarketDataByIds(tokenIds);

  const rpcJobs: RpcJob[] = [];
  for (const token of EUR_STABLECOIN_REGISTRY) {
    for (const contract of token.contracts) {
      if (!isEvmAddress(contract.address) || !isEvmChain(contract.chainId)) {
        continue;
      }
      rpcJobs.push({ token, chainId: contract.chainId, address: contract.address });
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

  const rpcByKey = new Map<string, RpcJobResult>();
  for (const result of rpcResults) {
    rpcByKey.set(result.key, result);
  }

  let rpcSuccessContracts = 0;
  let unsupportedContracts = 0;
  let failedContracts = 0;

  const stablecoins: StablecoinIssuance[] = EUR_STABLECOIN_REGISTRY.map((token) => {
    const marketData = marketDataById.get(token.id);
    const contracts: ContractSupply[] = [];

    let nativeSupply = 0;
    let bridgedSupply = 0;
    let rpcKnownSupply = 0;

    for (const contract of token.contracts) {
      const base: Omit<ContractSupply, "supply" | "decimals" | "source" | "status"> = {
        chainId: contract.chainId,
        chainName: chainName(contract.chainId),
        address: contract.address,
        kind: contract.kind,
      };

      if (!isEvmAddress(contract.address) || !isEvmChain(contract.chainId)) {
        unsupportedContracts += 1;
        contracts.push({
          ...base,
          supply: null,
          decimals: null,
          source: "unavailable",
          status: "unsupported",
        });
        continue;
      }

      const rpc = rpcByKey.get(keyFor(token.id, contract.chainId, contract.address));
      if (rpc?.status === "ok" && rpc.supply !== null && rpc.decimals !== null) {
        rpcSuccessContracts += 1;
        rpcKnownSupply += rpc.supply;
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
          status: "ok",
        });
      } else {
        failedContracts += 1;
        contracts.push({
          ...base,
          supply: null,
          decimals: null,
          source: "unavailable",
          status: "error",
          error: rpc?.error ?? "RPC lookup failed",
        });
      }
    }

    const circulatingSupply = marketData?.circulatingSupply ?? null;

    // If we can only resolve a subset on-chain, keep the remainder in an explicit bucket.
    if (circulatingSupply !== null && circulatingSupply > rpcKnownSupply + 0.0001) {
      const remainder = circulatingSupply - rpcKnownSupply;
      nativeSupply += remainder;
      contracts.push({
        chainId: "other",
        chainName: chainName("other"),
        address: "coingecko:unattributed-remainder",
        kind: "native",
        supply: remainder,
        decimals: null,
        source: "coingecko",
        status: "ok",
      });
    }

    return {
      id: token.id,
      symbol: token.symbol,
      name: token.name,
      marketCapEur: marketData?.marketCapEur ?? null,
      circulatingSupply,
      contracts,
      nativeSupply,
      bridgedSupply,
      totalSupply: nativeSupply + bridgedSupply,
    };
  }).sort((a, b) => b.totalSupply - a.totalSupply);

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

  const generatedAt = new Date().toISOString();
  await appendSnapshot({
    timestamp: generatedAt,
    native: totals.native,
    withBridged: totals.withBridged,
  });
  const history = await readHistory();

  return {
    generatedAt,
    totals,
    changes: computeIntervalChanges(history, totals.withBridged),
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
}
