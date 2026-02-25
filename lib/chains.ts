export const CHAIN_NAMES: Record<string, string> = {
  ethereum: "Ethereum",
  base: "Base",
  "avalanche": "Avalanche",
  "polygon-pos": "Polygon",
  "arbitrum-one": "Arbitrum",
  "optimistic-ethereum": "Optimism",
  "binance-smart-chain": "BNB Smart Chain",
  xdai: "Gnosis",
  linea: "Linea",
  scroll: "Scroll",
  celo: "Celo",
  "world-chain": "World Chain",
  fraxtal: "Fraxtal",
  "q-mainnet": "Q",
  plasma: "Plasma",
  evmos: "Evmos",
  solana: "Solana",
  stellar: "Stellar",
  xrp: "XRP Ledger",
  algorand: "Algorand",
  osmosis: "Osmosis",
  "terra-2": "Terra",
  tezos: "Tezos",
  "internet-computer": "Internet Computer",
  other: "Other / Unattributed",
};

type RpcResolver = (alchemyKey?: string) => string[];

export const EVM_RPC_URLS: Record<string, RpcResolver> = {
  ethereum: (alchemyKey) => [
    ...(alchemyKey ? [`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`] : []),
    "https://ethereum-rpc.publicnode.com",
    "https://eth.llamarpc.com",
    "https://cloudflare-eth.com",
  ],
  base: (alchemyKey) => [
    ...(alchemyKey ? [`https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`] : []),
    "https://base-rpc.publicnode.com",
    "https://1rpc.io/base",
    "https://mainnet.base.org",
  ],
  avalanche: (alchemyKey) => [
    ...(alchemyKey ? [`https://avax-mainnet.g.alchemy.com/v2/${alchemyKey}`] : []),
    "https://api.avax.network/ext/bc/C/rpc",
  ],
  "polygon-pos": (alchemyKey) => [
    ...(alchemyKey ? [`https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`] : []),
    "https://polygon-bor-rpc.publicnode.com",
    "https://1rpc.io/matic",
    "https://polygon-rpc.com",
  ],
  "arbitrum-one": (alchemyKey) => [
    ...(alchemyKey ? [`https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`] : []),
    "https://arb1.arbitrum.io/rpc",
  ],
  "optimistic-ethereum": (alchemyKey) => [
    ...(alchemyKey ? [`https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`] : []),
    "https://mainnet.optimism.io",
  ],
  "binance-smart-chain": () => ["https://bsc-dataseed.binance.org"],
  xdai: () => ["https://rpc.gnosischain.com"],
  linea: (alchemyKey) => [
    ...(alchemyKey ? [`https://linea-mainnet.g.alchemy.com/v2/${alchemyKey}`] : []),
    "https://rpc.linea.build",
  ],
  scroll: (alchemyKey) => [
    ...(alchemyKey ? [`https://scroll-mainnet.g.alchemy.com/v2/${alchemyKey}`] : []),
    "https://rpc.scroll.io",
  ],
  celo: (alchemyKey) => [
    ...(alchemyKey ? [`https://celo-mainnet.g.alchemy.com/v2/${alchemyKey}`] : []),
    "https://forno.celo.org",
  ],
  "world-chain": (alchemyKey) => [
    ...(alchemyKey ? [`https://worldchain-mainnet.g.alchemy.com/v2/${alchemyKey}`] : []),
    "https://worldchain-mainnet.g.alchemy.com/public",
  ],
  fraxtal: () => ["https://rpc.frax.com"],
  "q-mainnet": () => ["https://rpc.q.org"],
  plasma: () => ["https://rpc.plasma.to"],
  evmos: () => ["https://evmos-evm.publicnode.com"],
};

export function chainName(chainId: string): string {
  return CHAIN_NAMES[chainId] ?? chainId;
}

export function isEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isEvmChain(chainId: string): boolean {
  return chainId in EVM_RPC_URLS;
}
