---
# eur.cool-nf2t
title: Add explorer-link icons in By chain expanded rows
status: completed
type: feature
priority: normal
created_at: 2026-02-26T10:35:58Z
updated_at: 2026-02-26T10:37:08Z
---

Extend Home page expanded-row explorer-link behavior so it works in By chain mode as well, not only By stablecoin.

Requirements:
- In By chain tab expanded rows, show the external-link icon next to each stablecoin entry when a deterministic explorer URL is available.
- Reuse the same no-link behavior for unresolved/multi-address cases.
- Keep click behavior opening new tab without toggling row expansion.

## Checklist
- [x] Populate explorer URL metadata for By chain breakdown rows
- [x] Render icon in expanded rows regardless of tab when URL exists
- [x] Preserve no-icon behavior when URL cannot be determined
- [x] Run lint and verify no regressions