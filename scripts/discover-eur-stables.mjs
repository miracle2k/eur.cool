#!/usr/bin/env node

/**
 * Quick helper used to (re)discover EUR stablecoins from CoinGecko.
 *
 * Usage:
 *   node scripts/discover-eur-stables.mjs
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const EUR_REGEX = /(^|[^a-z])eur([^a-z]|$)|euro|ceur|eure|euri|eurs|eurt|eurc|eurcv|eurq|eurd|aeur|eur0|europ|deuro|jeur|seur|veur|eeur/i;

async function fetchJson(url, attempt = 1) {
  const res = await fetch(url, { headers: { accept: "application/json" } });

  if ((res.status === 429 || res.status >= 500) && attempt < 12) {
    const waitMs = Math.min(30_000, 1500 * attempt);
    await sleep(waitMs);
    return fetchJson(url, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`${res.status}: ${await res.text()}`);
  }

  return res.json();
}

async function main() {
  const markets = await fetchJson(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=eur&category=stablecoins&order=market_cap_desc&per_page=250&page=1&sparkline=false",
  );

  const candidates = markets
    .filter((coin) => EUR_REGEX.test(`${coin.id} ${coin.symbol} ${coin.name}`))
    .sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));

  const out = [];

  for (const coin of candidates) {
    const detail = await fetchJson(
      `https://api.coingecko.com/api/v3/coins/${coin.id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
    );

    out.push({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      marketCapEur: coin.market_cap,
      contracts: Object.entries(detail.platforms || {})
        .filter(([, address]) => address)
        .map(([chainId, address]) => ({ chainId, address })),
    });

    await sleep(1500);
  }

  console.log(JSON.stringify(out, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
