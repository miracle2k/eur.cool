---
# eur.cool-f5cp
title: Enforce zero 'Other / Unattributed' and zero CoinGecko fallback in production output
status: completed
type: task
priority: normal
created_at: 2026-02-25T15:56:31Z
updated_at: 2026-02-25T23:54:31Z
---

Final quality gate after all adapter and cleanup work is complete.

Goal:
- No remaining "Other / Unattributed" rows for tracked supply.
- No CoinGecko-derived issuance fallback in production issuance totals.
- Every included amount must be derived from a chain-native on-chain query.

This bean must be completed last, after all prerequisite beans are done.

Validation notes:
- Removed CoinGecko remainder insertion path from issuance pipeline.
- Added strict runtime invariant in snapshot builder that throws on any `source=coingecko` or `chainId=other` contract row.
- Added executable guard script `npm run check:strict-onchain` to automate no-fallback policy checks.
- Updated Sources + Methodology copy to communicate strict on-chain attribution policy.

## Checklist
- [x] Verify all prerequisite beans are completed
- [x] Run full snapshot and confirm source=coingecko count is zero
- [x] Confirm no "other" chain attribution remains in totals
- [x] Add automated guard/CI check to fail on fallback reintroduction
- [x] Update methodology/sources copy to reflect strict on-chain policy