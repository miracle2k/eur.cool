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

type StellarAssetRecord = {
  asset_code: string;
  asset_issuer: string;
  claimable_balances_amount?: string;
  liquidity_pools_amount?: string;
  contracts_amount?: string;
  balances?: {
    authorized?: string;
    authorized_to_maintain_liabilities?: string;
    unauthorized?: string;
  };
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

function sanitizeSymbol(symbol: string): string {
  const clean = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return clean || symbol.toUpperCase();
}

function toNumber(value: string | number | undefined): number {
  if (value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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

function parseStellarAssetReference(address: string, fallbackSymbol: string): { code: string; issuer: string } {
  if (address.includes("-")) {
    const [maybeCode, maybeIssuer] = address.split("-", 2);
    if (maybeCode && maybeIssuer) {
      return { code: maybeCode.toUpperCase(), issuer: maybeIssuer };
    }
  }

  return {
    code: sanitizeSymbol(fallbackSymbol),
    issuer: address,
  };
}

async function fetchStellarIssuedSupply(address: string, symbol: string): Promise<NonEvmSupplyResult> {
  const endpoint = "https://horizon.stellar.org";
  const { code, issuer } = parseStellarAssetReference(address, symbol);

  const errors: string[] = [];

  const queries = [
    `${endpoint}/assets?asset_code=${encodeURIComponent(code)}&asset_issuer=${encodeURIComponent(issuer)}&limit=1`,
    `${endpoint}/assets?asset_issuer=${encodeURIComponent(issuer)}&limit=10`,
  ];

  let record: StellarAssetRecord | null = null;

  for (const query of queries) {
    try {
      const res = await fetch(query, {
        headers: { accept: "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const payload = (await res.json()) as {
        _embedded?: {
          records?: StellarAssetRecord[];
        };
      };

      const records = payload._embedded?.records ?? [];
      if (!records.length) {
        continue;
      }

      const preferred = records.find((item) => item.asset_code.toUpperCase() === code.toUpperCase());
      record = preferred ?? records[0];
      break;
    } catch (error) {
      errors.push(`${query}: ${asErrorMessage(error)}`);
    }
  }

  if (!record) {
    return {
      ok: false,
      status: "error",
      error: errors.join(" | ").slice(0, 900) || `No Stellar asset record for ${issuer}/${code}`,
      method: "stellar:horizon-assets",
    };
  }

  const balances = record.balances ?? {};

  const supply =
    toNumber(balances.authorized) +
    toNumber(balances.authorized_to_maintain_liabilities) +
    toNumber(balances.unauthorized) +
    toNumber(record.claimable_balances_amount) +
    toNumber(record.liquidity_pools_amount) +
    toNumber(record.contracts_amount);

  if (!Number.isFinite(supply)) {
    return {
      ok: false,
      status: "error",
      error: `Invalid Stellar supply for ${record.asset_code}-${record.asset_issuer}`,
      method: "stellar:horizon-assets",
    };
  }

  return {
    ok: true,
    supply,
    decimals: 7,
    method: "stellar:horizon-assets",
    endpoint,
  };
}

export async function fetchNonEvmTotalSupply(params: {
  chainId: string;
  address: string;
  symbol: string;
}): Promise<NonEvmSupplyResult> {
  if (params.chainId === "solana") {
    return fetchSolanaMintSupply(params.address);
  }

  if (params.chainId === "stellar") {
    return fetchStellarIssuedSupply(params.address, params.symbol);
  }

  return {
    ok: false,
    status: "unsupported",
    error: `Unsupported non-EVM chain: ${params.chainId}`,
    method: "unsupported",
  };
}
