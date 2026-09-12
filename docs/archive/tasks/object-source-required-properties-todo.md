# Object Source Required Properties — Priority Checklist

See [the full implementation plan](object-source-required-properties-plan.md) for dependencies,
acceptance criteria, risks, and verification details.

## P0 — Foundation

- [x] Task 1: Replace `ContextSourceSettings.filter` with `RequiredPropertySchema` and migrate settings.
      `pnpm run check` green (611 tests); not yet committed pending human review.
- [ ] Checkpoint A: Human review of migration fixtures before enforcement logic (Tasks 2–6) begins.

## P1 — Core enforcement

- [x] Task 2: Default-value resolution (tokens + optional Templater). `pnpm run check` green (621 tests).
      Templater's exact undocumented API shape is unverified without a real vault — flagged for Checkpoint C.
- [x] Task 3: Extend Object Note creation to stamp the full schema. `pnpm run check` green (624 tests).
- [x] Task 5: `computeRequiredPropertyGaps` + "Repair Object Notes" command. `pnpm run check` green
      (633 tests). Known limitation: can't repair a note missing exactly the property a
      `matchByProperty: true` source relies on for matching — see plan.
- [x] Task 6: Auto-repair watcher on note open/save. `pnpm run check` green (639 tests). Discovered that
      Node's native TS stripping rejects constructor parameter properties, unlike esbuild — worked around
      in this watcher; not fixed in the pre-existing `TaskReferenceCheckboxWatcher.ts`.

## P2 — Authoring surface

- [x] Task 4: Settings UI — required-properties list editor with identity value and property-name
      autocomplete. `pnpm run check` green (639 tests); real-desktop interaction unverified, deferred to
      Checkpoint C.
- [x] Checkpoint B: Creation, manual repair, and auto-repair all converge to the same schema-complete
      frontmatter; settings UI can author a real multi-property schema (data-layer round-trip proven by
      tests, real-vault interaction still pending).

## P3 — Hardening

- [x] Task 7: Linter-format-preserving fixture coverage shared across all three enforcement paths.
      `pnpm run check` green (643 tests).
- [x] Task 8: Documentation, changelog, and spec/ADR closeout. `check:ci` green (643 tests). Archive move
      to `docs/archive/` deliberately deferred until Checkpoint C's real desktop acceptance closes.
- [x] Checkpoint C: `check:ci` green; real desktop acceptance confirmed by the user (2026-09-12). Branch
      ready to merge to `main`.

## Explicitly deferred

- Preview/dry-run mode for "Repair Object Notes".
- Property value type/shape validation beyond "exists with a resolved value".
- Automatic schema discovery from existing vault property usage.
- Conflict UI beyond the existing shared-folder warning when two sources require the same property with
  different defaults on overlapping folders.
