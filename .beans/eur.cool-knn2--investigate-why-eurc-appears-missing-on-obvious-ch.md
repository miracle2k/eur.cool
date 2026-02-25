---
# eur.cool-knn2
title: Investigate why EURC appears missing on obvious chains (e.g. Ethereum mainnet)
status: completed
type: bug
priority: normal
created_at: 2026-02-25T15:56:21Z
updated_at: 2026-02-25T23:33:07Z
blocking:
    - eur.cool-f5cp
---

Investigate report that EURC does not appear on obvious expected chains in the product output (example: Ethereum mainnet), despite registry entries.

Scope:
- Reproduce the issue in UI and API outputs.
- Verify token registry, chain filtering, grouping logic, and display ordering.
- Identify whether the issue is data, attribution, or presentation.

Policy:
- Root-cause first; do not apply cosmetic workarounds that hide missing on-chain data.

Findings:
- Root cause was upstream RPC endpoint reliability, not UI grouping logic. Ethereum calls were falling back to Cloudflare RPC, which repeatedly failed `totalSupply()` reads in this workload.
- A related reliability issue existed on Polygon (`polygon-rpc.com` unauthorized), which caused additional missing EVM rows.
- Fix: add resilient public fallback RPC endpoints for Ethereum/Base/Polygon so EURC Ethereum and other obvious EVM rows resolve again.

## Checklist
- [x] Reproduce with fresh snapshot + include/exclude bridged toggles
- [x] Verify EURC contract rows and supply values in API
- [x] Trace grouping/expand logic to find omission conditions
- [x] Propose and implement fix if confirmed bug exists
- [x] Add regression check