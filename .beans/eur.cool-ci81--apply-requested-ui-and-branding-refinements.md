---
# eur.cool-ci81
title: Apply requested UI and branding refinements
status: completed
type: task
priority: normal
created_at: 2026-02-26T09:47:36Z
updated_at: 2026-02-26T09:51:09Z
---

Implement the requested homepage/navigation/branding adjustments and related metadata/footer updates.

Scope includes: removing native labels/subtitles/internal IDs from primary list UI, moving controls, updating brand/title metadata, switching social link target, and adding inspiration footer link.

## Checklist
- [x] Remove native/bridged header label and replace with conditional includes-bridged badge near stablecoin code
- [x] Remove native badges in expanded rows (show bridged badge only when applicable)
- [x] Remove expanded-row subtitles/internal chain IDs and top-row subtitles/chain IDs in both grouping modes
- [x] Remove helper texts: expand hint and sources-page hint from homepage list area
- [x] Move Include bridged control next to By stablecoin/By chain tabs
- [x] Move Refresh now button to top-right near brand title
- [x] Update brand rendering to "€.cool" with all-black styling
- [x] Point social nav link to https://farcaster.xyz/nix on all pages
- [x] Update metadata title to explicitly say Eurostablecoin overview
- [x] Add footer attribution link to https://usdc.cool/ with spacing below table
- [x] Run lint/validation and verify UI compiles