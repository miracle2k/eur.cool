---
# eur.cool-inzc
title: Explore robust change stats under contract-set drift
status: todo
type: task
created_at: 2026-02-26T09:39:05Z
updated_at: 2026-02-26T09:39:05Z
---

The current interval stats (1h/24h/7d/30d) compare aggregate totals between snapshots. This can become misleading when we add newly discovered/missing contracts: old snapshots did not include those contracts, so deltas can reflect coverage changes rather than real issuance changes.

We need a design that keeps comparisons correct when the tracked contract universe changes over time.

Key concerns to investigate:
- Adding contracts introduces structural breaks in time series if aggregates are compared naively.
- Some chains may allow historical backfills for newly added contracts, but others may not; relying on universal backfill may be infeasible.
- We likely need per-contract tracking and overlap-aware comparison windows (exclude contracts that are not present across both comparison points, or clearly segment/report them).

Expected outcomes:
- A concrete proposal for robust interval change semantics under registry drift.
- A migration/backfill strategy (or explicit non-backfill policy) per chain family.
- A test strategy proving stats remain correct when contract coverage changes.

## Checklist
- [ ] Audit current snapshot/change computation and identify failure modes under contract additions/removals
- [ ] Propose snapshot schema additions (e.g., per-contract series, coverage metadata, comparability flags)
- [ ] Evaluate chain-by-chain feasibility of historical backfill and document constraints
- [ ] Define comparison algorithm for overlap-safe deltas (and handling for non-comparable segments)
- [ ] Propose UI/API semantics for communicating coverage-adjusted vs raw changes
- [ ] Define migration plan for existing history and guardrails for future registry edits
- [ ] Add/plan regression tests that simulate adding missing contracts over time