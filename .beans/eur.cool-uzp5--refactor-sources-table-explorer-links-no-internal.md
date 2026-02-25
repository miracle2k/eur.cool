---
# eur.cool-uzp5
title: 'Refactor Sources table: explorer links + no internal chain IDs'
status: completed
type: feature
priority: normal
created_at: 2026-02-25T15:56:08Z
updated_at: 2026-02-25T23:48:53Z
blocking:
    - eur.cool-f5cp
---

Refactor the Sources page table so it is external-user readable and explicit about on-chain methods.

Requirements from product direction:
- Do not expose internal chain IDs in the visible UI.
- Contract/asset cells should link to the appropriate explorer when possible.
- Source column should show the exact on-chain function/mechanism called (e.g. ERC20 totalSupply, Solana mint supply, XRPL issued balance method), not generic "rpc".

Implementation notes:
- Added contract-level `method` metadata to API responses so UI can render concrete on-chain mechanisms.
- Added chain-aware explorer URL builder for EVM + Solana/Stellar/XRPL/Algorand/Cosmos/Tezos/ICP references.
- Internal chain IDs are now hidden from visible table cells and retained via tooltips (`title`) for technical detail access.

## Checklist
- [x] Remove internal chain IDs from visible columns
- [x] Add chain-aware explorer links for EVM + non-EVM asset references
- [x] Replace generic source labels with concrete query-method labels
- [x] Keep full technical identifiers available via tooltip/details if needed
- [x] Validate accessibility and responsive behavior