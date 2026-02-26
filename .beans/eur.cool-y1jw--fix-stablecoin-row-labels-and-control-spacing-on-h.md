---
# eur.cool-y1jw
title: Fix stablecoin row labels and control spacing on home list
status: completed
type: bug
priority: normal
created_at: 2026-02-26T09:59:31Z
updated_at: 2026-02-26T10:01:06Z
---

Follow-up UI correction after recent homepage refinements.

User feedback:
- Stablecoin rows lost their descriptive token name subtitle (e.g., Euro Tether for EURT). We should restore token-name subtitles for the By stablecoin mode.
- The By stablecoin/By chain tabs + Include bridged control are too tightly attached to the hero summary card. We should restore clearer vertical spacing.

Scope:
- Restore readable stablecoin subtitles only where appropriate.
- Keep chain/internal IDs hidden in row subtitles (do not reintroduce chain-id subtitles).
- Adjust spacing between summary card and group toolbar to match intended visual rhythm.

## Checklist
- [x] Restore stablecoin name subtitle on By stablecoin rows
- [x] Keep By chain rows without internal-id subtitle
- [x] Increase spacing between summary card and group controls
- [x] Validate layout and lint