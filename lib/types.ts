export type ContractKind = "native" | "bridged";

export type ContractDefinition = {
  chainId: string;
  address: string;
  kind: ContractKind;
  observeAfterRetirement?: boolean;
};

export type AssetRetirement = {
  effectiveDate: string;
  reason: string;
  sourceUrl: string;
};

export type StablecoinRegistryEntry = {
  id: string;
  symbol: string;
  name: string;
  contracts: ContractDefinition[];
  retirement?: AssetRetirement;
};

export type ContractSupply = ContractDefinition & {
  chainName: string;
  supply: number | null;
  decimals: number | null;
  source: "rpc" | "unavailable" | "carried" | "archived";
  method: string;
  status: "ok" | "error" | "unsupported" | "stale" | "retired";
  error?: string;
  observedAt?: string | null;
};

export type StablecoinIssuance = {
  id: string;
  symbol: string;
  name: string;
  contracts: ContractSupply[];
  nativeSupply: number;
  bridgedSupply: number;
  totalSupply: number;
  retirement?: AssetRetirement;
};

export type ChainAggregate = {
  chainId: string;
  chainName: string;
  nativeSupply: number;
  bridgedSupply: number;
  totalSupply: number;
  tokenCount: number;
};

export type Interval = "hour" | "day" | "week" | "month";

export type IntervalChange = {
  interval: Interval;
  absChange: number | null;
  pctChange: number | null;
};

export type IssuanceSnapshot = {
  timestamp: string;
  native: number;
  withBridged: number;
  contractSupplies: Record<string, number>;
  contractObservedAt?: Record<string, string | null>;
};

export type IssuanceResponse = {
  generatedAt: string;
  totals: {
    native: number;
    withBridged: number;
  };
  changes: IntervalChange[];
  chains: ChainAggregate[];
  stablecoins: StablecoinIssuance[];
  retiredStablecoins?: StablecoinIssuance[];
  changesUnavailableReason?: string;
  sourceStats: {
    trackedTokens: number;
    trackedContracts: number;
    rpcSuccessContracts: number;
    unsupportedContracts: number;
    failedContracts: number;
    retiredTokens?: number;
    retiredContracts?: number;
  };
};
