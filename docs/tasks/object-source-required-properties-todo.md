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
- [ ] Task 6: Auto-repair watcher on note open/save.

## P2 — Authoring surface

- [ ] Task 4: Settings UI — required-properties list editor with identity toggle and property-name
      autocomplete.
- [ ] Checkpoint B: Verify creation, manual repair, and auto-repair all converge to the same schema-complete
      frontmatter, and the settings UI round-trips a real multi-property schema.

## P3 — Hardening

- [ ] Task 7: Linter-format-preserving fixture coverage shared across all three enforcement paths.
- [ ] Task 8: Documentation, changelog, and spec/ADR closeout.
- [ ] Checkpoint C: `check:ci` green, real desktop acceptance, documentation and changelog current.

## Explicitly deferred

- Preview/dry-run mode for "Repair Object Notes".
- Property value type/shape validation beyond "exists with a resolved value".
- Automatic schema discovery from existing vault property usage.
- Conflict UI beyond the existing shared-folder warning when two sources require the same property with
  different defaults on overlapping folders.
