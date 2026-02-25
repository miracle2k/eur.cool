---
# eur.cool-yo7q
title: Resolve Plasma chain support for EUROP via on-chain RPC (no fallback)
status: completed
type: bug
priority: normal
created_at: 2026-02-25T15:56:03Z
updated_at: 2026-02-25T23:34:23Z
blocking:
    - eur.cool-f5cp
---

EUROP has an unresolved Plasma contract row because no RPC endpoint is configured.

Scope:
- Identify authoritative Plasma RPC endpoint and confirm EVM compatibility (or chain-native equivalent query).
- Restore direct on-chain supply reads for the tracked EUROP Plasma contract.

Non-negotiable policy:
- On-chain query only. CoinGecko/API fallback is unacceptable for this ticket.
- If robust Plasma on-chain access cannot be guaranteed, leave ticket incomplete instead of workaround.

Operational notes:
- Using the public Plasma mainnet RPC endpoint `https://rpc.plasma.to` (no API key required at this time).
- Chain is EVM-compatible; existing ERC-20 `totalSupply()` reader works once endpoint is configured.
- If public RPC availability changes, supply attribution for this row will degrade to unavailable rather than fallback.

## Checklist
- [x] Confirm Plasma network endpoint and auth model
- [x] Integrate endpoint into chain resolver and retry policy
- [x] Validate EUROP Plasma totalSupply result
- [x] Ensure status is no longer "error"/"unavailable" for Plasma row
- [x] Document operational constraints