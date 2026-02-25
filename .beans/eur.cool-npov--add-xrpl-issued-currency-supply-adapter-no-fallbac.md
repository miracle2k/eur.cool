---
# eur.cool-npov
title: Add XRPL issued-currency supply adapter (no fallback)
status: completed
type: feature
priority: normal
created_at: 2026-02-25T15:55:35Z
updated_at: 2026-02-25T23:40:01Z
blocking:
    - eur.cool-f5cp
---

Replace unresolved XRP Ledger entries with direct XRPL-derived issued supply.

Scope:
- Query XRPL for issued EUR token balances/trustline totals for tracked issuer+currency tuples.
- Attribute supply per token where chainId = xrp.

Non-negotiable policy:
- On-chain/ledger query only. CoinGecko/API fallback is unacceptable for this ticket.
- If a robust XRPL method cannot be guaranteed, leave the ticket incomplete instead of introducing a workaround.

Implementation notes:
- Query path: XRPL `gateway_balances` RPC method on public rippled endpoint (`https://s1.ripple.com:51234`).
- Derivation: use `result.obligations` for issuer account and resolve currency via tuple parsing (`CURRENCY.ISSUER`, `CURRENCY-ISSUER`, issuer-only fallback).
- Supports both plain and 160-bit hex currency identifiers.

## Checklist
- [x] Choose XRPL RPC methods for total issued supply derivation
- [x] Implement XRPL adapter and normalize decimals/units
- [x] Validate for EURCV, EURQ, EUROP, VEUR XRPL entries
- [x] Remove XRPL impact from "Other / Unattributed"
- [x] Add tests/docs for issuer/currency tuple handling