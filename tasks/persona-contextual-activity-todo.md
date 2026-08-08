# Persona-Rooted Contextual Activity System — Priority Checklist

See [the full implementation plan](persona-contextual-activity-plan.md) for dependencies, acceptance criteria, risks, and verification details.

Status in this checklist closes only when every acceptance criterion is complete. An item may therefore have its
implementation and automated verification complete while remaining unchecked for real Obsidian desktop/mobile or
operator acceptance.

## P0 — Reliability prerequisites

- [x] Task 1: Introduce typed success, partial, and failure outcomes.
- [x] Task 2: Share one in-flight submission policy that consumes those outcomes.
- [x] Checkpoint A1: Verify submission lifecycle and existing Related note compatibility.
- [x] Task 3: Reject invalid Event and Task temporal records.
- [x] Task 4: Make settings reads recoverable and writes ordered.
- [x] Task 5: Lock Event/Task writer and Timeline parser compatibility with direct tests.
- [x] Checkpoint A: Run full CI and desktop/mobile regression acceptance.

## P1 — Core contextual capture

- [x] Task 6: Migrate the `Activities & Tasks` default and `More options` copy without overwriting custom settings.
- [x] Task 7: Define configurable context-source settings and migrate People/Place folders.
- [x] Task 8: Build the metadata-backed, folder-scoped context suggestion index.
- [x] Task 9: Generalize the Inbox Markdown controller without changing behavior.
- [x] Checkpoint B1: Verify settings migration, index invalidation, and unchanged Inbox behavior.
- [x] Task 10: Integrate contextual Markdown into desktop Event and Task details.
- [x] Task 11: Integrate contextual Markdown into mobile Event and Task details.
- [x] Task 12: Resolve configured contextual links and approve historical-log golden fixtures.
- [x] Checkpoint B2: Approve renderer parity and the pure related-log contract.
- [x] Task 13: Generalize existing related-note writes with deduplication and failed-destination-only partial recovery.
- [ ] Checkpoint B: Verify the complete capture-to-context loop on desktop and mobile. Automated coverage is green;
      repeatable desktop/mobile acceptance and representative migrated-state evidence remain open.

## P2 — Temporal retrieval

- [ ] Task 14: Align Daily Note capture targets with Focus Timeline sources. Implementation and automated verification
      are complete; real Obsidian acceptance remains open.
- [ ] Task 14.1: Group Timeline sources and constrain ledger eligibility. Implementation and automated verification are
      complete; large-vault desktop/mobile acceptance remains open.
- [ ] Task 14.2: Derive temporal sources from Persona-rooted Object Sources. Implementation, automated verification, and
      the mobile metadata-index refresh fix are complete; synced-build desktop/mobile acceptance remains open.
- [ ] Task 15: Replace pending preview with a stable detail modal and source navigation. Implementation and pure model
      tests are complete; sidebar, full-tab, layering, focus, Escape/back, and source-navigation acceptance remain open.
- [ ] Task 16: Specify planned, actual, completed, and cancelled Event occurrence semantics. A committed draft exists and
      awaits architecture/grammar approval; lifecycle parser, writer, UI, fixtures, and migration work have not started.
- [ ] Checkpoint C: Verify distinct Event/Task behavior in Day and Week views.

## P3 — Hardening and release evidence

- [ ] Task 17: Confirm and bound suggestion and Timeline indexing performance after the Task 8 fail-fast baseline. The
      synthetic suggestion baseline exists; representative-vault Timeline benchmarks and Obsidian profiling remain open.
- [ ] Task 18: Complete user, developer, and desktop/mobile acceptance documentation. Initial user/developer pages build
      successfully; complete workflow, release, dogfooding, and repeatable acceptance records remain open.
- [ ] Checkpoint D: Full clean-checkout CI, policy review, code-quality review, real-device acceptance, and recorded Daily Notes dogfooding.

## Explicitly deferred

- [ ] Persona-aware Note Composer destination assistance.
- [ ] Automatic promotion.
- [ ] Two-way Daily Note/promoted-note synchronization.
- [ ] Project archive creation or link rewriting.
- [ ] Additional built-in context sources beyond People, Places, and Activities.
