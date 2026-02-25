---
# eur.cool-qqnd
title: Add Stellar asset-supply adapter (no fallback)
status: completed
type: feature
priority: normal
created_at: 2026-02-25T15:55:30Z
updated_at: 2026-02-25T23:38:11Z
blocking:
    - eur.cool-f5cp
---

Replace unresolved Stellar-issued EUR assets with direct ledger-derived supply.

Scope:
- Derive issued supply for tracked Stellar assets from Stellar RPC/Horizon data.
- Attribute per-token Stellar supply on-chain in source table.

Non-negotiable policy:
- On-chain/ledger query only. CoinGecko/API fallback is unacceptable for this ticket.
- If a robust Stellar method cannot be guaranteed, leave the ticket incomplete instead of introducing a workaround.

Implementation notes:
- Query path: Horizon `/assets` endpoint on `https://horizon.stellar.org`.
- Supply derivation: `balances.{authorized,authorized_to_maintain_liabilities,unauthorized}` plus `claimable_balances_amount`, `liquidity_pools_amount`, and `contracts_amount`.
- Address parsing supports both `CODE-ISSUER` format and issuer-only entries (with symbol fallback).

## Checklist
- [x] Select authoritative Stellar query path for issued asset amounts
- [x] Implement Stellar adapter for tracked asset codes/issuers
- [x] Validate against EURC, EURCV, VEUR Stellar entries
- [x] Ensure Stellar amounts no longer land in "Other / Unattributed"
- [x] Add docs/tests for edge cases (asset precision, issuer changes)