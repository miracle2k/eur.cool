---
# eur.cool-uwqq
title: Add Tezos token supply adapter (no fallback)
status: completed
type: feature
priority: normal
created_at: 2026-02-25T15:55:52Z
updated_at: 2026-02-25T23:43:54Z
blocking:
    - eur.cool-f5cp
---

Replace unresolved Tezos VEUR entry with direct on-chain token supply attribution.

Scope:
- Query Tezos contract/token supply for tracked VEUR Tezos address.
- Feed value into source table and totals without fallback.

Non-negotiable policy:
- On-chain query only. CoinGecko/API fallback is unacceptable for this ticket.
- If robust Tezos method cannot be guaranteed, leave ticket incomplete instead of workaround.

Implementation notes:
- Query path: TzKT token endpoint (`/v1/tokens`) for contract + token id.
- Default source: `https://api.tzkt.io` (override via `TEZOS_INDEXER_URL`).
- Supply derived from `totalSupply` normalized by token metadata decimals.

## Checklist
- [x] Select Tezos RPC/indexer strategy for token supply
- [x] Implement Tezos adapter and integrate pipeline hooks
- [x] Validate VEUR Tezos supply against explorer data
- [x] Eliminate Tezos-related unattributed remainder
- [x] Add test coverage/docs