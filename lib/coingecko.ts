const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export type CoinGeckoMarketData = {
  id: string;
  marketCapEur: number | null;
  circulatingSupply: number | null;
};

async function fetchJsonWithRetry<T>(url: string, attempt = 1): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if ((res.status === 429 || res.status >= 500) && attempt < 6) {
    const waitMs = attempt * 1200;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return fetchJsonWithRetry<T>(url, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`CoinGecko request failed (${res.status}): ${await res.text()}`);
  }

  return (await res.json()) as T;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export async function fetchMarketDataByIds(ids: string[]): Promise<Map<string, CoinGeckoMarketData>> {
  const marketMap = new Map<string, CoinGeckoMarketData>();

  for (const idChunk of chunk(ids, 70)) {
    const url = `${COINGECKO_BASE}/coins/markets?vs_currency=eur&ids=${encodeURIComponent(
      idChunk.join(","),
    )}&order=market_cap_desc&per_page=250&page=1&sparkline=false`;

    const data = await fetchJsonWithRetry<
      Array<{ id: string; market_cap: number | null; circulating_supply: number | null }>
    >(url);

    for (const coin of data) {
      marketMap.set(coin.id, {
        id: coin.id,
        marketCapEur: coin.market_cap,
        circulatingSupply: coin.circulating_supply,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return marketMap;
}
