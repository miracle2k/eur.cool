---
# eur.cool-y08a
title: Add Algorand ASA supply adapter (no fallback)
status: completed
type: feature
priority: normal
created_at: 2026-02-25T15:55:42Z
updated_at: 2026-02-25T23:41:43Z
blocking:
    - eur.cool-f5cp
---

Replace unresolved Algorand rows with direct ASA on-chain/indexer supply queries.

Scope:
- Read total/issued supply for tracked ASA IDs (e.g. EURQ/EURD entries).
- Integrate results into issuance attribution pipeline.

Non-negotiable policy:
- On-chain query only. CoinGecko/API fallback is unacceptable for this ticket.
- If a robust Algorand method cannot be guaranteed, leave the ticket incomplete instead of introducing a workaround.

Implementation notes:
- Query path: Algorand Indexer (`/v2/assets/{id}` and reserve account holdings via `/v2/accounts/{reserve}`).
- Supply derivation: `issued = total - reserve_balance_for_asset` with decimal normalization from ASA params.
- Default endpoint: `https://mainnet-idx.algonode.cloud` (overridable by `ALGORAND_INDEXER_URL` / `ALGORAND_INDEXER_URLS`).

## Checklist
- [x] Define authoritative Algorand RPC/indexer call(s)
- [x] Implement Algorand adapter for ASA IDs
- [x] Validate with EURQ and EURD contracts in registry
- [x] Remove Algorand-related unattributed remainder
- [x] Document endpoint dependencies and failure policy