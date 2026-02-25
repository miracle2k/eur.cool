# eur.cool

EUR stablecoin issuance tracker inspired by usdc.cool.

## What it does

- Tracks a curated list of EUR stablecoins and their chain contracts
- Reads supply from chain-native methods (EVM `totalSupply()`, Solana mint supply, Stellar issued balances, XRPL obligations, Algorand ASA state, Cosmos denom supply, Tezos token totals, IC ledger metrics)
- Separates **native** vs **bridged** supply
- Enforces strict on-chain attribution (no CoinGecko fallback remainder in production totals)
- Exposes:
  - `GET /api/stablecoins` (cached snapshot)
  - `POST /api/stablecoins/refresh` (force refresh)

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000

Validate strict no-fallback policy:

```bash
npm run check:strict-onchain
```

## Environment

```bash
ALCHEMY_API_KEY=your-key
# optional
ISSUANCE_CACHE_TTL_MS=300000
REFRESH_SECRET=optional-refresh-secret
```

If `REFRESH_SECRET` is set, call refresh with:

```bash
curl -X POST http://localhost:3000/api/stablecoins/refresh \
  -H "x-refresh-secret: $REFRESH_SECRET"
```

## Data files

- Token/contract registry: `data/eurStablecoinRegistry.ts`
- Snapshot history: `data/issuance-history.json`
