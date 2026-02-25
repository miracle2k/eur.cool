import { Contract, JsonRpcProvider, formatUnits } from "ethers";
import { EVM_RPC_URLS } from "@/lib/chains";

const ERC20_ABI = [
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const providerCache = new Map<string, JsonRpcProvider>();

function getProvider(url: string): JsonRpcProvider {
  const cached = providerCache.get(url);
  if (cached) {
    return cached;
  }

  const provider = new JsonRpcProvider(url, undefined, { staticNetwork: true });
  providerCache.set(url, provider);
  return provider;
}

export type RpcSupplyResult =
  | {
      ok: true;
      decimals: number;
      supply: number;
      rpcUrl: string;
    }
  | {
      ok: false;
      error: string;
    };

export async function fetchEvmTotalSupply(
  chainId: string,
  contractAddress: string,
  alchemyKey?: string,
): Promise<RpcSupplyResult> {
  const resolver = EVM_RPC_URLS[chainId];

  if (!resolver) {
    return {
      ok: false,
      error: `Unsupported EVM chain: ${chainId}`,
    };
  }

  const rpcUrls = resolver(alchemyKey).filter(Boolean);
  if (!rpcUrls.length) {
    return {
      ok: false,
      error: `No RPC endpoint configured for ${chainId}`,
    };
  }

  const errors: string[] = [];

  for (const rpcUrl of rpcUrls) {
    try {
      const provider = getProvider(rpcUrl);
      const token = new Contract(contractAddress, ERC20_ABI, provider);

      const [decimalsResult, totalSupplyRaw] = await Promise.all([
        token.decimals().catch(() => 18),
        token.totalSupply(),
      ]);

      const decimals = Number(decimalsResult);
      if (!Number.isFinite(decimals)) {
        throw new Error("Invalid decimals response");
      }

      const supply = Number(formatUnits(totalSupplyRaw, decimals));
      if (!Number.isFinite(supply)) {
        throw new Error("Invalid totalSupply response");
      }

      return {
        ok: true,
        decimals,
        supply,
        rpcUrl,
      };
    } catch (error) {
      errors.push(`${rpcUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    ok: false,
    error: errors.join(" | ").slice(0, 900),
  };
}
