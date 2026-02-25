const EVM_TOKEN_EXPLORER_BASE: Record<string, string> = {
  ethereum: "https://etherscan.io/token",
  base: "https://basescan.org/token",
  avalanche: "https://snowtrace.io/token",
  "polygon-pos": "https://polygonscan.com/token",
  "arbitrum-one": "https://arbiscan.io/token",
  "optimistic-ethereum": "https://optimistic.etherscan.io/token",
  "binance-smart-chain": "https://bscscan.com/token",
  xdai: "https://gnosisscan.io/token",
  linea: "https://lineascan.build/token",
  scroll: "https://scrollscan.com/token",
  celo: "https://celoscan.io/token",
  "world-chain": "https://worldscan.org/token",
  fraxtal: "https://fraxscan.com/token",
  "q-mainnet": "https://explorer.q.org/address",
  plasma: "https://plasmascan.to/token",
  evmos: "https://escan.live/token",
};

function parseXrplIssuer(address: string): string {
  if (address.includes(".")) {
    return address.split(".", 2)[1] ?? address;
  }

  if (address.includes("-")) {
    return address.split("-", 2)[1] ?? address;
  }

  return address;
}

function parseStellarAsset(address: string): { code: string | null; issuer: string } {
  if (address.includes("-")) {
    const [code, issuer] = address.split("-", 2);
    if (code && issuer) {
      return { code, issuer };
    }
  }

  return { code: null, issuer: address };
}

export function assetExplorerUrl(chainId: string, address: string): string | null {
  const evmBase = EVM_TOKEN_EXPLORER_BASE[chainId];
  if (evmBase) {
    return `${evmBase}/${address}`;
  }

  if (chainId === "solana") {
    return `https://solscan.io/token/${address}`;
  }

  if (chainId === "stellar") {
    const { code, issuer } = parseStellarAsset(address);
    if (code) {
      return `https://stellar.expert/explorer/public/asset/${encodeURIComponent(code)}-${issuer}`;
    }
    return `https://stellar.expert/explorer/public/account/${issuer}`;
  }

  if (chainId === "xrp") {
    return `https://livenet.xrpl.org/accounts/${parseXrplIssuer(address)}`;
  }

  if (chainId === "algorand") {
    return `https://explorer.perawallet.app/asset/${address}/`;
  }

  if (chainId === "osmosis") {
    return `https://www.mintscan.io/osmosis/assets/${encodeURIComponent(address)}`;
  }

  if (chainId === "terra-2") {
    return `https://www.mintscan.io/terra/assets/${encodeURIComponent(address)}`;
  }

  if (chainId === "tezos") {
    const [contract, tokenIdRaw] = address.split(":", 2);
    const tokenId = tokenIdRaw ?? "0";
    return `https://tzkt.io/${contract}/tokens/${tokenId}`;
  }

  if (chainId === "internet-computer") {
    return `https://dashboard.internetcomputer.org/canister/${address}`;
  }

  return null;
}
