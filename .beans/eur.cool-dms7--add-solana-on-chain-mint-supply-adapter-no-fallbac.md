---
# eur.cool-dms7
title: Add Solana on-chain mint-supply adapter (no fallback)
status: completed
type: feature
priority: normal
created_at: 2026-02-25T15:55:24Z
updated_at: 2026-02-25T23:36:49Z
blocking:
    - eur.cool-f5cp
---

Replace current unresolved Solana rows with direct on-chain supply reads.

Scope:
- Query canonical mint supply directly from Solana RPC for tracked EUR stablecoin mints.
- Attribute supply per (stablecoin, chain, native/bridged) without CoinGecko remainder usage for Solana-held supply.

Non-negotiable policy:
- On-chain query only. CoinGecko/API fallback is unacceptable for this ticket.
- If a robust Solana on-chain method cannot be guaranteed, leave the ticket incomplete instead of introducing a workaround.

Implementation notes:
- Method: Solana JSON-RPC `getTokenSupply` against canonical mint addresses.
- Default endpoint: `https://solana-rpc.publicnode.com` (with optional `SOLANA_RPC_URL` / `SOLANA_RPC_URLS` overrides).
- Strategy: retry across configured endpoints; parse `result.value.amount` + `decimals` to normalized supply.
- Added fixture validation script for EURC/EURCV/VEUR mints: `npm run check:solana`.

## Checklist
- [x] Define Solana RPC method(s) and mint account parsing strategy
- [x] Implement Solana adapter and integrate into issuance pipeline
- [x] Add tests/fixtures for at least EURC, EURCV, VEUR Solana entries
- [x] Remove Solana contribution from "Other / Unattributed" bucket
- [x] Document operational requirements (RPC endpoints, limits, retries)