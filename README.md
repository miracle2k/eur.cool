# eur.cool

EUR stablecoin issuance tracker inspired by usdc.cool.

## What it does

- Tracks a curated list of EUR stablecoins and their chain contracts
- Reads supply from chain-native methods (EVM `totalSupply()`, Solana mint supply, Stellar issued balances, XRPL obligations, Algorand ASA state, Cosmos denom supply, Tezos token totals, IC ledger metrics)
- Separates **native** vs **bridged** supply
- Enforces strict on-chain attribution (no off-chain market-data remainder)
- Computes interval changes (1h/24h/7d/30d) from overlap-only per-contract history
- Exposes:
  - `GET /api/stablecoins` (serves latest persisted snapshot)
  - `POST /api/stablecoins/refresh` (force a new on-chain refresh)

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

# optional cache/auth
ISSUANCE_CACHE_TTL_MS=300000
REFRESH_SECRET=optional-refresh-secret

# optional persistence (recommended)
TURSO_DATABASE_URL=libsql://<db>-<org>.turso.io
TURSO_AUTH_TOKEN=your-token

# optional stale carry-forward window for failed reads
CARRY_FORWARD_MAX_HOURS=48
```

If `REFRESH_SECRET` is set, call refresh with:

```bash
curl -X POST http://localhost:3000/api/stablecoins/refresh \
  -H "x-refresh-secret: $REFRESH_SECRET"
```

## Persistence

- With `TURSO_DATABASE_URL` set:
  - snapshots, per-contract snapshot rows, refresh runs, and observations are stored in Turso
  - required tables are auto-created on first write
  - `GET /api/stablecoins` returns the latest persisted snapshot immediately and refreshes in background when stale
- Without `TURSO_DATABASE_URL`:
  - history is stored in `data/issuance-history.json`

## Data files

- Token/contract registry: `data/eurStablecoinRegistry.ts`
- Local fallback snapshot history (when Turso disabled): `data/issuance-history.json`
