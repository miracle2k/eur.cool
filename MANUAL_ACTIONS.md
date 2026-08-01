# Manual action history

This file records deliberate production-state changes made outside the normal application flow.

## 2026-08-01 — Corrected historical EURD Algorand snapshots

After taking and verifying a Turso backup, corrected 276 affected `quantoz-eurd::algorand::1221682136` snapshot rows from `2026-07-20T19:00:04Z` through `2026-08-01T05:00:03Z`.

- Replaced the erroneous €10.55T ASA-total fallback with €0 reserve-excluded circulating supply.
- Recomputed the affected snapshot totals, payloads, and interval changes.
- Preserved 277 raw observations and added correction audit records rather than deleting evidence.
- Triggered and verified a fresh production refresh reporting EURD as €0.
