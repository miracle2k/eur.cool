---
# eur.cool-1rha
title: Add explorer links to stablecoin chain breakdown rows
status: completed
type: feature
priority: normal
created_at: 2026-02-26T10:33:06Z
updated_at: 2026-02-26T10:33:35Z
---

In Home > By stablecoin, make each expanded chain row linkable to its relevant explorer target when resolvable.

Requirements:
- Show a small external-link icon next to chain name in expanded breakdown rows.
- Clicking icon opens explorer URL for that chain/asset/address tuple.
- If no deterministic explorer URL can be generated, hide icon for that row.
- Keep behavior scoped to By stablecoin expanded rows.

## Checklist
- [x] Add explorer URL data to stablecoin breakdown row model
- [x] Render external-link icon beside chain name only when URL exists
- [x] Ensure click opens new tab and does not toggle row expansion
- [x] Add minimal styling for icon and run lint