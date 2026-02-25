export type ContractKind = "native" | "bridged";

export type ContractDefinition = {
  chainId: string;
  address: string;
  kind: ContractKind;
};

export type StablecoinRegistryEntry = {
  id: string;
  symbol: string;
  name: string;
  contracts: ContractDefinition[];
};

export type ContractSupply = ContractDefinition & {
  chainName: string;
  supply: number | null;
  decimals: number | null;
  source: "rpc" | "coingecko" | "unavailable";
  status: "ok" | "error" | "unsupported";
  error?: string;
};

export type StablecoinIssuance = {
  id: string;
  symbol: string;
  name: string;
  marketCapEur: number | null;
  circulatingSupply: number | null;
  contracts: ContractSupply[];
  nativeSupply: number;
  bridgedSupply: number;
  totalSupply: number;
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
  sourceStats: {
    trackedTokens: number;
    trackedContracts: number;
    rpcSuccessContracts: number;
    unsupportedContracts: number;
    failedContracts: number;
  };
};
