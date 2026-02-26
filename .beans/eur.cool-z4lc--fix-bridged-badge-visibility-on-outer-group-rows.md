---
# eur.cool-z4lc
title: Fix bridged badge visibility on outer group rows
status: completed
type: bug
priority: normal
created_at: 2026-02-26T10:27:43Z
updated_at: 2026-02-26T10:29:29Z
---

Adjust homepage row badge logic for Include bridged mode.

Reported issues:
- In By stablecoin mode with Include bridged enabled, the badge appears on every row even for coins with no bridged issuance.
- In By chain mode, no bridged badge appears on outer rows even when the chain includes bridged issuance.

Expected behavior:
- Show the bridged indicator only for rows whose aggregate includes bridged supply.
- Apply this consistently in both By stablecoin and By chain modes (when Include bridged is enabled).

## Checklist
- [x] Add per-row bridged-presence flag in grouped row model
- [x] Set flag correctly for stablecoin and chain group builders
- [x] Update render condition so badge appears only when includeBridged && row has bridged data
- [x] Validate behavior manually and run lint