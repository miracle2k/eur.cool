import { EUR_STABLECOIN_REGISTRY } from "@/data/eurStablecoinRegistry";
import type { AssetRetirement, ChainAggregate, IssuanceResponse, StablecoinIssuance } from "@/lib/types";

export function retirementFor(tokenId: string, asOf: string): AssetRetirement | undefined {
  const retirement = EUR_STABLECOIN_REGISTRY.find((token) => token.id === tokenId)?.retirement;
  return retirement && Date.parse(asOf) >= Date.parse(retirement.effectiveDate) ? retirement : undefined;
}

export function retiredContractKeys(asOf: string): Set<string> {
  return new Set(EUR_STABLECOIN_REGISTRY.flatMap((token) => retirementFor(token.id, asOf)
    ? token.contracts.map((contract) => `${token.id}::${contract.chainId}::${contract.address.toLowerCase()}`)
    : []));
}

export function aggregateChains(stablecoins: StablecoinIssuance[]): ChainAggregate[] {
  const chains = new Map<string, ChainAggregate & { tokenIds: Set<string> }>();
  for (const token of stablecoins) {
    for (const contract of token.contracts) {
      if (contract.supply === null) continue;
      const chain = chains.get(contract.chainId) ?? {
        chainId: contract.chainId, chainName: contract.chainName,
        nativeSupply: 0, bridgedSupply: 0, totalSupply: 0, tokenCount: 0, tokenIds: new Set<string>(),
      };
      if (contract.kind === "bridged") chain.bridgedSupply += contract.supply;
      else chain.nativeSupply += contract.supply;
      chain.totalSupply += contract.supply;
      chain.tokenIds.add(token.id);
      chains.set(contract.chainId, chain);
    }
  }
  return [...chains.values()].map(({ tokenIds, ...chain }) => ({ ...chain, tokenCount: tokenIds.size }))
    .sort((a, b) => b.totalSupply - a.totalSupply);
}

// Project legacy persisted payloads without changing any stored observations.
// Their interval changes cannot be corrected without the historical baselines;
// leave them unavailable until a refresh calculates comparable active supplies.
export function applyRetirementPolicy(data: IssuanceResponse): IssuanceResponse {
  if (!data.stablecoins.some((token) => retirementFor(token.id, data.generatedAt))) return data;

  const stablecoins = data.stablecoins.filter((token) => !retirementFor(token.id, data.generatedAt));
  const retiredStablecoins = [...(data.retiredStablecoins ?? []), ...data.stablecoins
    .filter((token) => retirementFor(token.id, data.generatedAt))
    .map((token): StablecoinIssuance => ({
      ...token,
      retirement: retirementFor(token.id, data.generatedAt),
      contracts: token.contracts.map((contract) => ({
        ...contract,
        source: contract.supply === null ? "unavailable" : "archived",
        status: "retired",
        error: undefined,
        observedAt: contract.observedAt ?? (contract.source === "rpc" ? data.generatedAt : null),
      })),
    }))];
  const contracts = stablecoins.flatMap((token) => token.contracts);
  return {
    ...data,
    stablecoins,
    retiredStablecoins,
    totals: stablecoins.reduce((totals, token) => ({
      native: totals.native + token.nativeSupply,
      withBridged: totals.withBridged + token.totalSupply,
    }), { native: 0, withBridged: 0 }),
    chains: aggregateChains(stablecoins),
    changes: data.changes.map((change) => ({ ...change, absChange: null, pctChange: null })),
    changesUnavailableReason: "Change figures will appear after the next data update.",
    sourceStats: {
      trackedTokens: stablecoins.length,
      trackedContracts: contracts.length,
      rpcSuccessContracts: contracts.filter((contract) => contract.source === "rpc" && contract.status === "ok").length,
      unsupportedContracts: contracts.filter((contract) => contract.status === "unsupported").length,
      failedContracts: contracts.filter((contract) => contract.status === "error" || contract.status === "stale").length,
      retiredTokens: retiredStablecoins.length,
      retiredContracts: retiredStablecoins.reduce((count, token) => count + token.contracts.length, 0),
    },
  };
}
