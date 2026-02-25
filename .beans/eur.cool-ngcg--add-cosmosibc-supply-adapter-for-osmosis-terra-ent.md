---
# eur.cool-ngcg
title: Add Cosmos/IBC supply adapter for Osmosis + Terra entries (no fallback)
status: completed
type: feature
priority: normal
created_at: 2026-02-25T15:55:47Z
updated_at: 2026-02-25T23:42:53Z
blocking:
    - eur.cool-f5cp
---

Replace unresolved IBC-denom entries (Osmosis and Terra) with direct chain supply queries.

Scope:
- Resolve supply for tracked IBC denoms currently stored under osmosis and terra-2.
- Attribute per token (EURE and e-Money EUR) without CoinGecko remainder use for this scope.

Non-negotiable policy:
- On-chain query only. CoinGecko/API fallback is unacceptable for this ticket.
- If robust chain-native resolution is not possible, leave ticket incomplete instead of workaround.

Implementation notes:
- Query path: Cosmos bank module endpoint `/cosmos/bank/v1beta1/supply/by_denom` via `rest.cosmos.directory`.
- Supported chains: `osmosis`, `terra-2`.
- Denom normalization uses explicit tracked IBC-decimal mapping for EUR denoms currently in registry.

## Checklist
- [x] Define supply query path for osmosis and terra-2 denoms
- [x] Implement adapter(s) and denom normalization
- [x] Validate EURE/e-Money EUR IBC entries end-to-end
- [x] Remove Osmosis/Terra contribution from unattributed bucket
- [x] Add tests/docs covering IBC denom mapping