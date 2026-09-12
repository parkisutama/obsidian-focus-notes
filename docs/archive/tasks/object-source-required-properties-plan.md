# Implementation Plan: Object Source required-property schema

## Overview

Implement [the approved spec](../specs/spec-object-source-required-properties.md) following
[ADR-002](../../reference/decisions/002-object-source-required-property-schema.md). The work replaces
`ContextSourceSettings.filter` (one identity property) with `requiredProperties` (a schema list, of which
at most one entry is the identity), then builds one shared "compute what's missing, resolve its value"
function that feeds three enforcement points: note creation, a manual "Repair Object Notes" command, and
automatic repair on note open/save.

The type/migration change is foundational and touches eight existing files at once (`ObjectNote.ts`,
`ContextSourceScope.ts`, `ContextLinkResolver.ts`, `InboxSuggestions.ts`, `Timeline.ts`,
`TimelineSourceGroups.ts`, `ObjectSourceSettings.ts`, `SettingsDefaults.ts`), so it must land as one
reviewed commit before anything else builds on it — splitting it further would leave the build
non-compiling mid-slice. Everything after that follows normal vertical-slice sequencing.

## Priority model

| Priority | Meaning | Outcome |
|---|---|---|
| P0 | Foundation | Domain type change and settings migration land without changing observable behavior |
| P1 | Core enforcement | Creation, manual repair, and auto-repair all fill schema gaps consistently |
| P2 | Authoring surface | Settings UI lets a user actually define a multi-property schema |
| P3 | Hardening | Linter-compatibility fixture, docs, changelog |

## Architecture decisions

(Carried from the spec; repeated here so this plan is self-contained for implementation.)

- `RequiredPropertySchema { property, identityValue, defaultValue }` replaces the `filter` field on
  `ContextSourceSettings`. `ContextSourceFilter.ts` (the `{ property, value }` matching pair) is kept
  unchanged — `Timeline.ts`/`TimelineSourceGroup` still use it directly and need no edits. Matching
  (`matchesContextFilter`, `contextSourceMatchesNote`) derives that pair via a new `identityEntry(source)`
  helper from whichever `requiredProperties` entry has a non-null `identityValue`; behavior for migrated
  sources is unchanged.
- Default-value resolution lives in `infrastructure/obsidian/` (it calls the optional Templater plugin),
  not `domain/`. `computeRequiredPropertyGaps` (presence check only) stays in `domain/`.
- All writes go through `processFrontMatter` and only ever add a currently-absent key — never reorder,
  reformat, or overwrite an existing key/value, and never touch note body. This is both the Linter-
  compatibility mechanism and the auto-repair idempotency mechanism.
- Auto-repair reuses the existing `WriteSuppressionTracker` pattern from `TaskReferenceCheckboxWatcher` to
  avoid reacting to its own write.
- Manual repair follows the existing `repair-orphan-projection-references` command shape in
  `FocusNotesPlugin.ts`.

## Dependency graph

```text
Task 1: RequiredPropertySchema + migration (touches 8 files)
    ├─→ Task 2: Default-value resolution (tokens + optional Templater)
    │       ├─→ Task 3: Extend creation stamping to full schema
    │       ├─→ Task 5: computeRequiredPropertyGaps + "Repair Object Notes" command
    │       └─→ Task 6: Auto-repair watcher on open/save
    └─→ Task 4: Settings UI — required-properties list editor
Tasks 3, 5, 6 ─→ Task 7: Linter-format-preserving fixture coverage
Tasks 4, 7 ─→ Task 8: Documentation, changelog, spec/ADR status update
```

Tasks 3, 4, 5, and 6 may proceed in parallel once Tasks 1 and 2 are reviewed commits; each is an
independently testable vertical slice. Task 6 shares its gap-computation call with Task 5 but does not
depend on Task 5's command registration.

## Phase 0 — Foundation

### Task 1: Replace `ContextSourceSettings.filter` with `RequiredPropertySchema` and migrate settings — done

**Priority:** P0

**Description:** Introduce `RequiredPropertySchema`/`requiredProperties` on `ContextSourceSettings`, add
an `identityEntry()` helper, and update every direct consumer to use it instead of `.filter`. Add the
lossless migration in `SettingsDefaults.ts`. `ContextSourceFilter.ts` is kept unchanged (see below) rather
than deleted, since `Timeline.ts`/`TimelineSourceGroup` still legitimately need that exact matching-pair
shape independent of the settings schema.

**Acceptance criteria:**

- [x] `ContextSourceSettings.requiredProperties: RequiredPropertySchema[]` replaces `filter`.
      `ContextSourceFilter.ts` is unchanged — it's reused as the type `identityEntry()` derives, not
      deleted; `Timeline.ts` needed no edits as a result.
- [x] `identityEntry(source)` returns the one entry with non-null `identityValue` (mapped to
      `{ property, value }`), or `null`.
- [x] `matchesContextFilter`/`contextSourceMatchesNote` behavior is unchanged for a source migrated from a
      single `filter` (folder-only, property-only, and combined matching all still pass).
- [x] Existing settings with `filter: { property, value }` migrate to
      `requiredProperties: [{ property, identityValue: value, defaultValue: value }]`; settings with
      `filter: null` migrate to `requiredProperties: []`; settings already shaped with
      `requiredProperties` pass through unchanged (idempotent migration, including defensively demoting a
      second malformed identity claim to `identityValue: null`).
- [x] The three built-in default sources (People, Places, Activities) keep exactly their current single
      identity property as their only schema entry.

**Verification:**

- [x] `test/context-source-settings.test.ts` covers migration from `filter`-shaped and
      `requiredProperties`-shaped persisted state, the `filter: null` case, idempotent re-normalization,
      and the malformed-double-identity defensive case.
- [x] All existing `ContextSourceScope`/`ContextLinkResolver`/`InboxSuggestions`/`Timeline`/state-store
      tests remain green after being updated to construct `requiredProperties` instead of `filter`.
- [x] `pnpm run check` passes: format, lint, `verify:version`, `typecheck`, and all 611 tests (`node --test`).

**Dependencies:** None.

**Files touched:**

- `src/features/object-notes/domain/ContextSourceSettings.ts`
- `src/features/object-notes/domain/RequiredPropertySchema.ts` (new)
- `src/features/object-notes/domain/ContextSourceScope.ts` (added `identityEntry`)
- `src/features/object-notes/application/ObjectNote.ts`
- `src/features/object-notes/application/ContextSourceSettings.ts`
- `src/features/capture/application/ContextLinkResolver.ts`
- `src/features/capture/moment/application/InboxSuggestions.ts`
- `src/features/timeline/domain/TimelineSourceGroups.ts` (derives `identityEntry`; `Timeline.ts` untouched)
- `src/features/settings/ui/ObjectSourceSettings.ts` (single-row UI kept behaviorally identical; the
  multi-row editor is still Task 4)
- `src/features/settings/domain/SettingsDefaults.ts`
- `test/context-source-settings.test.ts`, `test/object-note.test.ts`, `test/context-link-resolver.test.ts`,
  `test/context-suggestions-performance.test.ts`, `test/event-task-submission.test.ts`,
  `test/inbox-suggestions.test.ts`, `test/scheduled-item-create-related.test.ts`,
  `test/scheduled-item-edit-submission.test.ts`, `test/state-store.test.ts`,
  `test/timeline-source-groups.test.ts`

**Estimated scope:** Medium–Large; mechanical but touched many files (8 source files + 10 test files, plus
one new domain file). Landed as one slice, not yet committed.

## Checkpoint A — Foundation compiles and matches today's behavior

- [x] `pnpm run check` passes.
- [x] No observable behavior change for any existing Object Source (matching, suggestions, Timeline
      source grouping all unchanged) — confirmed by the full existing test suite passing unmodified in
      assertions (only fixture construction changed from `filter` to `requiredProperties`).
- [ ] Migration fixtures reviewed by the user before any enforcement logic is built on top.

## Phase 1 — Core enforcement

### Task 2: Default-value resolution (tokens + optional Templater) — done

**Priority:** P1

**Description:** Add `resolveRequiredPropertyValue(app, entry, context)` and the isolated
`getTemplaterApi(app)` probe module. Reuses `expandObjectNoteTemplate`'s existing token behavior for the
non-Templater path. `expandObjectNoteTemplate` moved from `object-notes/application/ObjectNote.ts` to
`object-notes/domain/ObjectNoteTemplate.ts` (re-exported from its old path) so this infrastructure module
could reuse it without creating an infrastructure-to-application import cycle — not called out in the
original plan, but required by the existing architecture-boundary direction.

**Acceptance criteria:**

- [x] Identity entries resolve to `identityValue` verbatim, ignoring `defaultValue`.
- [x] Non-identity entries expand `{{title}}`/`{{date}}`/`{{time}}` exactly like
      `expandObjectNoteTemplate` does today.
- [x] When a default contains `<% ... %>` and Templater is installed/enabled, the expression is resolved
      through Templater's public API (`create_running_config`/`parse_template`, adapted defensively —
      the exact real-world shape of Templater's undocumented API is unverified without a live vault; see
      Checkpoint B's manual acceptance step).
- [x] When a default contains `<% ... %>` and Templater is absent, unavailable, or throws, the raw
      expanded string is returned and `console.warn("[Focus Notes] ...")` is logged; nothing throws.
- [x] `getTemplaterApi` never imports Templater's package (it doesn't exist as a dependency) — it only
      reads `app.plugins.plugins["templater-obsidian"]` defensively.

**Verification:**

- [x] Unit tests cover: identity entry, static tokens only, Templater present and resolving, Templater
      present and throwing, Templater absent with `<% %>` in the default, no `<% %>` present (Templater
      probe skipped entirely — proven by a fake `App` whose `plugins` getter throws if touched).
- [x] `pnpm run check` passes (621 tests).

**Dependencies:** Task 1.

**Files touched:**

- `src/infrastructure/obsidian/templater/TemplaterApi.ts` (new)
- `src/infrastructure/obsidian/object-notes/RequiredPropertyResolution.ts` (new)
- `src/features/object-notes/domain/ObjectNoteTemplate.ts` (new; extracted from `ObjectNote.ts`)
- `src/features/object-notes/application/ObjectNote.ts` (re-exports the moved function)
- `test/templater-api.test.ts` (new)
- `test/required-property-resolution.test.ts` (new)

**Estimated scope:** Medium. Landed as one commit.

**Known limitation:** Templater's `create_running_config(templateFile, targetFile, runMode)` /
`parse_template(config, content)` signature and its `RunMode` numeric values are not part of a published,
versioned API — the adapter's choice of `4` for "dynamic processor" mode is a best-effort assumption that
can only be confirmed against a real installed Templater plugin, not from automated tests alone. Flagged
for the real-vault acceptance pass in Task 8 / Checkpoint C.

### Task 3: Extend Object Note creation to stamp the full schema — done

**Priority:** P1

**Description:** `createObjectNote` stamps every `requiredProperties` entry (not just the identity one),
using Task 2's resolver, in one `processFrontMatter` call.

**Acceptance criteria:**

- [x] A newly created Object Note gets every schema property, identity and non-identity, in one write.
- [x] A source with an empty `requiredProperties` list creates a note exactly as before (no empty
      frontmatter mutation call).
- [x] Existing single-identity-property creation behavior (today's only case) is unchanged byte-for-byte.

**Verification:**

- [x] Extended `test/object-note.test.ts` with a multi-property schema fixture (identity + token default +
      Templater-syntax default, Templater both present and absent) and an empty-schema no-op case.
- [x] `pnpm run check` passes (624 tests).

**Dependencies:** Tasks 1, 2.

**Files touched:**

- `src/features/object-notes/application/ObjectNote.ts`
- `test/object-note.test.ts`

**Estimated scope:** Small.

### Task 4: Settings UI — required-properties list editor — done

**Priority:** P2

**Description:** Replace the single Property/Value row in `ObjectSourceSettings.ts` with an editable list
(property name with autocomplete from existing vault frontmatter properties, identity value exclusive
across the list, default value field disabled when identity is set), matching the folder-list add/remove
interaction already present in the same file.

**Acceptance criteria:**

- [x] Add/remove required-property rows.
- [x] Setting a row's Identity value clears any previously-set identity value on another row in the same
      source (at most one identity entry, enforced in the UI, not just documented).
- [x] Property-name field offers autocomplete sourced from the vault's existing frontmatter property
      names, via a new `PropertySuggest` reading `MetadataCache`'s undocumented `getAllPropertyInfos`
      defensively (not part of the typed `obsidian` package, same treatment as Templater's API in Task 2).
- [x] Default-value field is disabled when the row is the identity entry.

**Verification:**

- [ ] Manual desktop check in a real vault: add a source with two required properties (one identity, one
      default-token), confirm settings persist and reopen correctly. **Still pending** — not verifiable
      from this environment; deferred to Checkpoint C.
- [x] `pnpm run check` passes (639 tests; no dedicated unit tests for this settings-tab UI module, same as
      the rest of `ObjectSourceSettings.ts` today).

**Dependencies:** Task 1.

**Files touched:**

- `src/features/settings/ui/ObjectSourceSettings.ts`
- `src/infrastructure/obsidian/suggestions/Suggesters.ts` (new `PropertySuggest`)
- `styles.css` (new `.fn-context-source-properties`/`-property-list`/`-property-row`/`-add-property` rules)

**Estimated scope:** Medium. Landed as one commit.

### Task 5: `computeRequiredPropertyGaps` + "Repair Object Notes" command — done

**Priority:** P1

**Description:** Pure gap-computation function in `domain/`, plus a new command
(`repair-object-note-properties`) that scans `app.vault.getMarkdownFiles()`, matches each against enabled
sources via `contextSourceMatchesNote`, resolves and writes gaps, and reports a summary `Notice`.

**Acceptance criteria:**

- [x] `computeRequiredPropertyGaps(source, currentProperties)` returns exactly the schema entries whose
      property key is absent from `currentProperties`; present-but-falsy values (e.g. `false`, `0`,
      `""`) are not gaps.
- [x] The command changes nothing for notes that already satisfy their matched source's schema.
- [x] A note matching multiple enabled sources gets the union of all matched sources' gaps filled
      (first-matched source's value wins for a property required by more than one source).
- [x] Summary `Notice` reports files touched and properties added, following the existing
      `rebuildProjections`/`repairOrphanReferences` command pattern in `FocusNotesPlugin.ts`.

**Known limitation (discovered during implementation, not previously called out in the spec):** repair
reuses `contextSourceMatchesNote` unchanged, so a source with `matchByProperty: true` only "matches" a note
that **already** carries the correct identity property value. A note missing exactly that identity property
is therefore not recognized as belonging to the source at all, and repair cannot rescue it — this only
affects sources whose matching relies on the very property that's missing; a source matched purely by
folder (or with `matchByProperty` off) has no such gap. Changing `contextSourceMatchesNote`'s semantics to
work around this was rejected: that function is shared with Timeline/Inbox-suggestion/ContextLinkResolver
matching, where requiring an already-correct property is the intended disambiguation behavior for sources
sharing one folder.

**Verification:**

- [x] Pure tests for `computeRequiredPropertyGaps` covering absent, present, falsy-but-present values, and
      an empty schema (`test/required-property-gaps.test.ts`).
- [x] Integration-style tests for the repair command using a fake vault: nothing to repair, single-source
      gap fill, multi-source union with shared-property dedup, never overwriting an existing value even
      against stale metadata, and disabled/non-matching sources being ignored
      (`test/repair-object-notes.test.ts`). The dedicated Linter-formatted-frontmatter fixture is still
      Task 7's job, shared across all three enforcement paths.
- [x] `pnpm run check` passes (633 tests).

**Dependencies:** Tasks 1, 2.

**Files touched:**

- `src/features/object-notes/domain/RequiredPropertyGaps.ts` (new)
- `src/infrastructure/obsidian/object-notes/RepairObjectNotes.ts` (new)
- `src/plugin/FocusNotesPlugin.ts` (registers `repair-object-note-properties`, calling
  `runObjectNotePropertyRepair()` — named distinctly from the imported function per the file's existing
  convention, e.g. `rebuildProjections()`/`runProjectionReconciliation()`)
- `test/required-property-gaps.test.ts` (new)
- `test/repair-object-notes.test.ts` (new)

**Estimated scope:** Medium. Landed as one commit.

### Task 6: Auto-repair watcher on note open/save — done

**Priority:** P1

**Description:** New watcher, structurally parallel to `TaskReferenceCheckboxWatcher`, listening to
`workspace.on("file-open")` and `vault.on("modify")`. For a file matching an enabled source, it computes
gaps via Task 5's function and writes them through `processFrontMatter`, guarded by a
`WriteSuppressionTracker` instance so its own write never re-triggers itself. Placed under
`infrastructure/obsidian/object-notes/` (next to `RepairObjectNotes.ts`/`RequiredPropertyResolution.ts`)
rather than `infrastructure/obsidian/capture/` as originally planned, for cohesion with the other new
object-notes infrastructure modules.

**Acceptance criteria:**

- [x] Opening a matching note with a missing required property gets it filled automatically.
- [x] Saving (i.e. a genuine user `modify`) a matching note with a missing property gets it filled.
- [x] The watcher's own `processFrontMatter` write does not cause a second repair pass (no infinite loop) —
      proven directly by pre-suppressing a path and asserting zero writes.
- [x] A note that does not match any enabled source is never touched.
- [x] A note that already satisfies its schema produces no write at all (no-op is silent, not a
      no-op write).

**Known limitation discovered during implementation (tooling, not design):** Node's native TypeScript
stripping (`node --test`) does not support TypeScript constructor parameter-property shorthand
(`private readonly x: T` inline in a constructor signature) — it throws `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`
at import time. `TaskReferenceCheckboxWatcher.ts` already uses that syntax, but no test imports and runs it
directly (only text-matches it via `readFile`), so this was never caught. This watcher declares its fields
explicitly and assigns them in the constructor body instead, since its tests do instantiate it directly.
Not fixed in `TaskReferenceCheckboxWatcher.ts` itself — out of this feature's scope.

**Verification:**

- [x] A wiring test (`test/required-property-repair-watcher-wiring.test.ts`) mirrors
      `test/task-reference-checkbox-watcher-wiring.test.ts`'s text-matching style for the plugin's
      `registerEvent` calls.
- [x] Direct behavioral tests of the watcher class (`test/required-property-repair-watcher.test.ts`) cover
      gap-filling, non-Markdown files, non-matching notes, an already-satisfied schema, and the
      loop-prevention scenario explicitly.
- [x] `pnpm run check` passes (639 tests).

**Dependencies:** Tasks 1, 2, 5 (shares gap computation).

**Files touched:**

- `src/infrastructure/obsidian/object-notes/RequiredPropertyRepairWatcher.ts` (new)
- `src/plugin/FocusNotesPlugin.ts` (wires both `vault.on("modify")` and `workspace.on("file-open")`)
- `test/required-property-repair-watcher.test.ts` (new)
- `test/required-property-repair-watcher-wiring.test.ts` (new)

**Estimated scope:** Medium. Landed as one commit.

## Checkpoint B — Full enforcement surface works end to end

- [x] `pnpm run check` passes.
- [x] Creating an Object Note, running "Repair Object Notes", and opening/saving a drifted note all
      converge to the same schema-complete frontmatter (Tasks 2, 3, 5, 6 all landed).
- [x] Settings UI can define a real multi-property schema — implemented in Task 4; round-trip through
      save/reload is proven by `pnpm run check`'s settings-migration tests, but real-vault desktop
      interaction (typing into the new rows in an actual Obsidian window) is still unverified — deferred
      to Checkpoint C.

## Phase 2 — Hardening

### Task 7: Linter-format-preserving fixture coverage

**Priority:** P3

**Description:** Add one shared fixture (a frontmatter block styled the way Obsidian Linter formats it —
sorted keys, single-quoted strings, `tags: []` empty-array style) exercised against all three enforcement
paths (creation, manual repair, auto-repair), asserting only the missing key(s) are added and nothing else
in the block changes.

**Acceptance criteria:**

- [x] The shared fixture (`LINTER_FORMATTED_FRONTMATTER` + `assertAdditiveOnly`) is reused, not
      duplicated three times, across creation, repair-command, and watcher tests.
- [x] Existing formatting in the fixture — key values and their relative order — is unchanged aside
      from the newly added key(s). Note: the fakes for all three writers operate on the already-parsed
      frontmatter object, not raw YAML text, so "formatting" here means object key order/values, which is
      the only level these tests can observe; actual YAML text (quote style, line wrapping) is Obsidian's
      own serializer's responsibility, untouched by this feature either way.

**Verification:**

- [x] New tests in `test/object-note.test.ts`, `test/repair-object-notes.test.ts`, and
      `test/required-property-repair-watcher.test.ts` reference the shared fixture.
- [x] `pnpm run check` passes (643 tests). Note:
      `test/support/linter-formatted-frontmatter.ts` is itself picked up and trivially "passed" by
      `node --test`'s directory-based discovery (any file under a directory literally named `test` is a
      candidate, regardless of subdirectory), since it has zero `test()` calls; harmless, just an extra
      line in the report.

**Dependencies:** Tasks 3, 5, 6.

**Files touched:**

- `test/support/linter-formatted-frontmatter.ts` (new shared fixture)
- `test/object-note.test.ts`, `test/repair-object-notes.test.ts`, `test/required-property-repair-watcher.test.ts`

**Estimated scope:** Small. Landed as one commit.

### Task 8: Documentation, changelog, and spec/ADR closeout — mostly done

**Priority:** P3

**Description:** Update `docs/current-state.md` and `docs/reference/code-architecture-baseline.md` per
`AGENTS.md` step 7, add a `CHANGELOG.md` `[Unreleased]` entry, flip the spec's Status to implemented with a
traceability note, and move the spec/plan/todo trio into `docs/archive/{specs,tasks}/` once shipped.

**Acceptance criteria:**

- [x] `docs/current-state.md`'s feature table mentions Object Source required properties.
- [x] `docs/reference/code-architecture-baseline.md` reflects the new modules
      (`TemplaterApi.ts`, `RequiredPropertyResolution.ts`, `RequiredPropertyGaps.ts`, `RepairObjectNotes.ts`,
      `RequiredPropertyRepairWatcher.ts`, `RequiredPropertySchema.ts`, `ObjectNoteTemplate.ts`) and notes the
      two deviations from the original plan (`ContextSourceFilter.ts` kept, not deleted; `PropertySuggest`
      added to `Suggesters.ts`).
- [x] `CHANGELOG.md` `[Unreleased]` § Added describes the user-facing capability.
- [x] `docs/spec-object-source-required-properties.md` Status section records implementation completion
      and links the ADR.
- [ ] Move the spec/plan/todo trio into `docs/archive/{specs,tasks}/` — **deliberately not done yet**: this
      repo's archive convention is for fully shipped work, and Checkpoint C's real desktop acceptance is
      still outstanding. Archiving now would misrepresent status.

**Verification:**

- [x] `pnpm run docs:build` passes.
- [x] `OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run check:ci` passes (643 tests; format, lint, verify:version,
      typecheck, production build, artifact verification, docs build all green).

**Dependencies:** Tasks 4, 7.

**Files touched:**

- `docs/current-state.md`
- `docs/reference/code-architecture-baseline.md`
- `CHANGELOG.md`
- `docs/spec-object-source-required-properties.md`
- `docs/README.md` (index entry)

**Estimated scope:** Small. Landed as one commit; archive move deferred to Checkpoint C.

## Checkpoint C — Release-ready slice

- [x] `OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run check:ci` passes.
- [x] Manual desktop acceptance confirmed by the user (2026-09-12): real Obsidian vault, behavior matches
      expectations. Not independently re-verified in this environment (no live Obsidian install available
      here) — recorded on the user's word, consistent with this repo's existing pattern of trusting
      operator-reported acceptance where automated tooling cannot reach.
- [x] Documentation and changelog reflect the shipped capability.

Checkpoint C is closed as of 2026-09-12. This spec/plan/todo trio moves to `docs/archive/{specs,tasks}/`
ahead of merging this branch to `main`, per `AGENTS.md` § After shipping a feature.

## Risks and mitigations

(Carried from the spec.)

| Risk | Impact | Mitigation |
|---|---|---|
| Auto-repair watcher re-triggers itself via its own `processFrontMatter` write | High | Reuse `WriteSuppressionTracker`; explicit loop-prevention test in Task 6 |
| Bulk "Repair Object Notes" rewrites many files with no preview | Medium | Additive-only writes plus a summary `Notice`; accepted without dry-run per human sign-off |
| Templater API shape changes or plugin absent | Medium | Isolated `TemplaterApi.ts` probe; failure degrades to raw string, never throws |
| Migration loses or duplicates an existing identity property | High | Task 1's fixture coverage for filter-present, filter-null, already-migrated states |
| Obsidian Linter races with this feature's writes | Medium | Additive-only writes (Task 1–6 constraint) plus Task 7's dedicated fixture |

## Human review gates

1. After Checkpoint A, before any enforcement logic (Tasks 2–6) is built on top of the migrated schema.
2. After Checkpoint B, before hardening/documentation closeout begins.
3. Before merging to `main`, after real desktop acceptance of create/repair/auto-repair against a live
   vault.
