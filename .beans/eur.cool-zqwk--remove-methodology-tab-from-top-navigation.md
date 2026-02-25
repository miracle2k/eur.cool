---
# eur.cool-zqwk
title: Remove Methodology tab from top navigation
status: completed
type: task
priority: normal
created_at: 2026-02-25T15:56:14Z
updated_at: 2026-02-25T23:49:47Z
blocking:
    - eur.cool-f5cp
---

Remove the Methodology tab from primary navigation across the app.

Scope:
- Update all top-nav instances to hide/remove Methodology.
- Preserve route behavior for direct deep links if needed (decision documented in PR/commit).

Decision:
- `/methodology` route remains directly accessible for deep links, but is removed from primary top navigation.

## Checklist
- [x] Remove Methodology from nav on Home
- [x] Remove Methodology from nav on Sources (and other pages)
- [x] Decide whether /methodology route remains accessible directly
- [x] Verify no broken nav states