---
# eur.cool-h1xq
title: Add Internet Computer token-supply adapter (no fallback)
status: completed
type: feature
priority: normal
created_at: 2026-02-25T15:55:58Z
updated_at: 2026-02-25T23:45:16Z
blocking:
    - eur.cool-f5cp
---

Replace unresolved Internet Computer VEUR entry with direct on-chain canister supply attribution.

Scope:
- Query tracked IC canister/asset supply and normalize units.
- Attribute VEUR ICP supply in source table.

Non-negotiable policy:
- On-chain query only. CoinGecko/API fallback is unacceptable for this ticket.
- If robust IC method cannot be guaranteed, leave ticket incomplete instead of workaround.

Implementation notes:
- Query path: direct canister metrics endpoint on raw gateway (`https://<canister>.raw.icp0.io/metrics`).
- Supply metric used: `ledger_total_supply` from on-chain ledger canister telemetry.
- Decimal normalization currently uses explicit canister mapping for tracked VEUR ledger canister.

## Checklist
- [x] Define IC query method for total token supply
- [x] Implement adapter and normalize decimals
- [x] Validate VEUR ICP entry end-to-end
- [x] Remove ICP-related unattributed remainder
- [x] Add tests/docs and endpoint requirements