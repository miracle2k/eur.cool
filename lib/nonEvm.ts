type NonEvmSupplyResult =
  | {
      ok: true;
      supply: number;
      decimals: number;
      method: string;
      endpoint: string;
    }
  | {
      ok: false;
      status: "unsupported" | "error";
      error: string;
      method: string;
    };

function envList(name: string): string[] {
  const raw = process.env[name];
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function solanaRpcUrls(): string[] {
  return unique([
    ...envList("SOLANA_RPC_URLS"),
    ...(process.env.SOLANA_RPC_URL ? [process.env.SOLANA_RPC_URL] : []),
    "https://solana-rpc.publicnode.com",
  ]);
}

async function fetchSolanaMintSupply(mintAddress: string): Promise<NonEvmSupplyResult> {
  const errors: string[] = [];

  for (const endpoint of solanaRpcUrls()) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenSupply",
          params: [mintAddress],
        }),
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const payload = (await res.json()) as {
        error?: { message?: string };
        result?: {
          value?: {
            amount?: string;
            decimals?: number;
          };
        };
      };

      if (payload.error) {
        throw new Error(payload.error.message ?? "RPC returned error");
      }

      const amount = payload.result?.value?.amount;
      const decimals = Number(payload.result?.value?.decimals);
      if (!amount || !Number.isFinite(decimals)) {
        throw new Error("Missing Solana token supply fields");
      }

      const supply = Number(amount) / 10 ** decimals;
      if (!Number.isFinite(supply)) {
        throw new Error("Invalid Solana supply value");
      }

      return {
        ok: true,
        supply,
        decimals,
        method: "solana:getTokenSupply",
        endpoint,
      };
    } catch (error) {
      errors.push(`${endpoint}: ${asErrorMessage(error)}`);
    }
  }

  return {
    ok: false,
    status: "error",
    error: errors.join(" | ").slice(0, 900),
    method: "solana:getTokenSupply",
  };
}

export async function fetchNonEvmTotalSupply(params: {
  chainId: string;
  address: string;
}): Promise<NonEvmSupplyResult> {
  if (params.chainId === "solana") {
    return fetchSolanaMintSupply(params.address);
  }

  return {
    ok: false,
    status: "unsupported",
    error: `Unsupported non-EVM chain: ${params.chainId}`,
    method: "unsupported",
  };
}
