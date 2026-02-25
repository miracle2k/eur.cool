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

const COSMOS_REST_BY_CHAIN: Record<string, string> = {
  osmosis: "https://rest.cosmos.directory/osmosis",
  "terra-2": "https://rest.cosmos.directory/terra2",
};

const COSMOS_DENOM_DECIMALS: Record<string, number> = {
  "ibc/92AE2F53284505223A1BB80D132F859A00E190C6A738772F0B3EF65E20BA484F": 6,
  "ibc/8D52B251B447B7160421ACFBD50F6B0ABE5F98D2C404B03701130F12044439A1": 6,
  "ibc/5973C068568365FFF40DEDCF1A1CB7582B6116B731CD31A12231AE25E20B871F": 6,
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

function decimalPlaces(value: string): number {
  const [, fraction = ""] = value.split(".", 2);
  return fraction.length;
}

function bigintToDecimal(raw: bigint, decimals: number): number {
  if (decimals <= 0) {
    return Number(raw);
  }

  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = raw % scale;
  const value = `${whole.toString()}.${fraction.toString().padStart(decimals, "0")}`;
  return Number(value);
}

function solanaRpcUrls(): string[] {
  return unique([
    ...envList("SOLANA_RPC_URLS"),
    ...(process.env.SOLANA_RPC_URL ? [process.env.SOLANA_RPC_URL] : []),
    "https://solana-rpc.publicnode.com",
  ]);
}

function xrplRpcUrls(): string[] {
  return unique([
    ...envList("XRPL_RPC_URLS"),
    ...(process.env.XRPL_RPC_URL ? [process.env.XRPL_RPC_URL] : []),
    "https://s1.ripple.com:51234",
  ]);
}

function algorandIndexerUrls(): string[] {
  return unique([
    ...envList("ALGORAND_INDEXER_URLS"),
    ...(process.env.ALGORAND_INDEXER_URL ? [process.env.ALGORAND_INDEXER_URL] : []),
    "https://mainnet-idx.algonode.cloud",
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

async function fetchAlgorandAsaSupply(assetIdRaw: string): Promise<NonEvmSupplyResult> {
  const assetId = Number(assetIdRaw);
  if (!Number.isInteger(assetId) || assetId <= 0) {
    return {
      ok: false,
      status: "error",
      error: `Invalid Algorand ASA id: ${assetIdRaw}`,
      method: "algorand:indexer-assets",
    };
  }

  const errors: string[] = [];

  for (const endpoint of algorandIndexerUrls()) {
    try {
      const assetUrl = `${endpoint}/v2/assets/${assetId}`;
      const assetRes = await fetch(assetUrl, {
        headers: { accept: "application/json" },
        cache: "no-store",
      });

      if (!assetRes.ok) {
        throw new Error(`Asset lookup HTTP ${assetRes.status}`);
      }

      const assetText = await assetRes.text();
      const assetPayload = JSON.parse(assetText) as {
        asset?: {
          params?: {
            decimals?: number;
            reserve?: string;
          };
        };
      };

      const decimals = Number(assetPayload.asset?.params?.decimals ?? 0);
      if (!Number.isFinite(decimals) || decimals < 0) {
        throw new Error("Invalid Algorand decimals");
      }

      const totalMatch = assetText.match(/"total"\s*:\s*([0-9]+)/);
      if (!totalMatch) {
        throw new Error("Missing Algorand total field");
      }
      const totalRaw = BigInt(totalMatch[1]);

      let reserveRaw = 0n;
      const reserve = assetPayload.asset?.params?.reserve;
      if (reserve) {
        const accountUrl = `${endpoint}/v2/accounts/${reserve}`;
        const accountRes = await fetch(accountUrl, {
          headers: { accept: "application/json" },
          cache: "no-store",
        });

        if (accountRes.ok) {
          const accountText = await accountRes.text();
          const amountRegex = new RegExp(
            `\\{[^{}]*"amount"\\s*:\\s*([0-9]+)[^{}]*"asset-id"\\s*:\\s*${assetId}[^{}]*\\}`,
          );
          const amountMatch = accountText.match(amountRegex);
          if (amountMatch) {
            reserveRaw = BigInt(amountMatch[1]);
          }
        }
      }

      const issuedRaw = totalRaw > reserveRaw ? totalRaw - reserveRaw : totalRaw;
      const supply = bigintToDecimal(issuedRaw, decimals);

      if (!Number.isFinite(supply)) {
        throw new Error("Invalid Algorand supply");
      }

      return {
        ok: true,
        supply,
        decimals,
        method: "algorand:indexer-total-minus-reserve",
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
    method: "algorand:indexer-assets",
  };
}

async function fetchCosmosIbcDenomSupply(chainId: string, denom: string): Promise<NonEvmSupplyResult> {
  const endpoint = COSMOS_REST_BY_CHAIN[chainId];
  if (!endpoint) {
    return {
      ok: false,
      status: "unsupported",
      error: `Unsupported Cosmos chain for denom lookup: ${chainId}`,
      method: "cosmos:bank-supply-by-denom",
    };
  }

  try {
    const url = `${endpoint}/cosmos/bank/v1beta1/supply/by_denom?denom=${encodeURIComponent(denom)}`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const payload = (await res.json()) as {
      amount?: {
        amount?: string;
      };
    };

    const rawAmount = payload.amount?.amount;
    if (!rawAmount) {
      throw new Error("Missing Cosmos denom amount");
    }

    const decimals = COSMOS_DENOM_DECIMALS[denom] ?? 6;
    const supply = bigintToDecimal(BigInt(rawAmount), decimals);
    if (!Number.isFinite(supply)) {
      throw new Error("Invalid Cosmos supply value");
    }

    return {
      ok: true,
      supply,
      decimals,
      method: "cosmos:bank-supply-by-denom",
      endpoint,
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      error: `${endpoint}: ${asErrorMessage(error)}`.slice(0, 900),
      method: "cosmos:bank-supply-by-denom",
    };
  }
}

function encodeXrplCurrencyHex(currency: string): string {
  const upper = currency.toUpperCase();
  if (/^[A-F0-9]{40}$/.test(upper)) {
    return upper;
  }

  const ascii = upper.slice(0, 20);
  const hex = Buffer.from(ascii, "ascii").toString("hex").toUpperCase();
  return hex.padEnd(40, "0");
}

function decodeXrplCurrencyHex(hex: string): string {
  if (!/^[A-F0-9]{40}$/.test(hex)) return "";

  const out = Buffer.from(hex, "hex")
    .toString("ascii")
    .replace(/\0+$/g, "")
    .trim();

  return out.toUpperCase();
}

function parseXrplAssetReference(address: string, fallbackSymbol: string): { currency: string; issuer: string } {
  if (address.includes(".")) {
    const [currency, issuer] = address.split(".", 2);
    if (currency && issuer) {
      return { currency: currency.toUpperCase(), issuer };
    }
  }

  if (address.includes("-")) {
    const [currency, issuer] = address.split("-", 2);
    if (currency && issuer) {
      return { currency: currency.toUpperCase(), issuer };
    }
  }

  return {
    currency: sanitizeSymbol(fallbackSymbol),
    issuer: address,
  };
}

async function fetchXrplIssuedSupply(address: string, symbol: string): Promise<NonEvmSupplyResult> {
  const { currency, issuer } = parseXrplAssetReference(address, symbol);
  const desiredHex = encodeXrplCurrencyHex(currency);
  const desiredText = sanitizeSymbol(currency);
  const errors: string[] = [];

  for (const endpoint of xrplRpcUrls()) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          method: "gateway_balances",
          params: [{ account: issuer, ledger_index: "validated" }],
        }),
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const payload = (await res.json()) as {
        result?: {
          obligations?: Record<string, string>;
          result?: {
            obligations?: Record<string, string>;
          };
        };
      };

      const obligations = payload.result?.obligations ?? payload.result?.result?.obligations ?? {};
      const entries = Object.entries(obligations);
      if (!entries.length) {
        throw new Error("No XRPL obligations found for issuer");
      }

      const match = entries.find(([key]) => {
        const normalized = key.toUpperCase();
        if (normalized === desiredText || normalized === desiredHex) {
          return true;
        }

        if (/^[A-F0-9]{40}$/.test(normalized)) {
          const decoded = decodeXrplCurrencyHex(normalized);
          return decoded === desiredText;
        }

        return false;
      });

      if (!match) {
        throw new Error(`No XRPL obligation for currency ${currency}`);
      }

      const rawAmount = match[1];
      const supply = Number(rawAmount);
      if (!Number.isFinite(supply)) {
        throw new Error(`Invalid XRPL amount: ${rawAmount}`);
      }

      return {
        ok: true,
        supply,
        decimals: Math.min(decimalPlaces(rawAmount), 18),
        method: "xrpl:gateway_balances",
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
    method: "xrpl:gateway_balances",
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

  if (params.chainId === "xrp") {
    return fetchXrplIssuedSupply(params.address, params.symbol);
  }

  if (params.chainId === "algorand") {
    return fetchAlgorandAsaSupply(params.address);
  }

  if (params.chainId === "osmosis" || params.chainId === "terra-2") {
    return fetchCosmosIbcDenomSupply(params.chainId, params.address);
  }

  return {
    ok: false,
    status: "unsupported",
    error: `Unsupported non-EVM chain: ${params.chainId}`,
    method: "unsupported",
  };
}
