# Persona-Rooted Contextual Activity System — Priority Checklist

See [the full implementation plan](persona-contextual-activity-plan.md) for dependencies, acceptance criteria, risks, and verification details.

## P0 — Reliability prerequisites

- [ ] Task 1: Share one in-flight submission policy.
- [ ] Task 2: Introduce typed success, partial, and failure outcomes.
- [ ] Task 3: Reject invalid Event and Task temporal records.
- [ ] Task 4: Make settings reads recoverable and writes ordered.
- [ ] Task 5: Lock Event/Task writer and Timeline parser compatibility with direct tests.
- [ ] Checkpoint A: Run full CI and desktop/mobile regression acceptance.

## P1 — Core contextual capture

- [ ] Task 6: Adopt Persona terminology, `Activities & Tasks`, and `More options` defaults without overwriting custom settings.
- [ ] Task 7: Define configurable context-source settings and migrate People/Place folders.
- [ ] Task 8: Build the metadata-backed, folder-scoped context suggestion index.
- [ ] Task 9: Reuse `@` and tag suggestions in Event and Task details.
- [ ] Task 10: Approve self-contained append-only related-log golden fixtures.
- [ ] Task 11: Append related logs with deduplication and typed partial outcomes.
- [ ] Checkpoint B: Verify the complete capture-to-context loop on desktop and mobile.

## P2 — Temporal retrieval

- [ ] Task 12: Align Daily Note capture targets with Focus Timeline sources.
- [ ] Task 13: Replace pending preview with a stable detail modal and source navigation.
- [ ] Task 14: Specify planned, actual, completed, and cancelled Event occurrence semantics.
- [ ] Checkpoint C: Verify distinct Event/Task behavior in Day and Week views.

## P3 — Hardening and release evidence

- [ ] Task 15: Measure and bound suggestion and Timeline indexing performance.
- [ ] Task 16: Complete user, developer, and desktop/mobile acceptance documentation.
- [ ] Checkpoint D: Full clean-checkout CI, policy review, code-quality review, and real-device acceptance.

## Explicitly deferred

- [ ] Persona-aware Note Composer destination assistance.
- [ ] Automatic promotion.
- [ ] Two-way Daily Note/promoted-note synchronization.
- [ ] Project archive creation or link rewriting.
- [ ] Additional built-in context sources beyond People, Places, and Activities.
