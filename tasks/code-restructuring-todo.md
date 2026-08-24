# Tasks: Code Restructuring

## Task 1: Build the dependency and ownership map

**Description:** Trace runtime entry points and imports, classify every source file by owner/layer, identify cycles and high fan-in/fan-out modules, and distinguish active from legacy Moment/Event/Task paths.

**Acceptance criteria:**

- [x] Entry-point and compatibility-ID tables cover plugin load/unload, views, commands, ribbons, settings, desktop/mobile launchers, and persistence writers.
- [x] Every `src/*.ts` file has an evidence-backed owner/layer; cycles and compatibility shims are explicitly listed.
- [x] Create/edit paths for Moment, Event, and Task are traced from launcher to writer.

**Verification:**

- [x] Review imports and registrations against `main.ts` and `TimelineView.ts`.
- [x] Confirm the map changes no runtime source.

**Dependencies:** None.
**Estimated scope:** Medium, documentation only.

## Task 2: Add architecture and compatibility characterization guards

**Description:** Add the smallest tests needed to freeze identifier values, generated Markdown, settings load/save semantics, and prohibited inward dependencies before moves begin.

**Acceptance criteria:**

- [x] Tests fail if persistent IDs or golden Markdown change unexpectedly.
- [x] A lightweight import guard rejects Obsidian/DOM dependencies in designated pure modules and detects new cycles.
- [x] Existing behavioral assertions are preserved rather than renamed to match file moves.

**Verification:**

- [x] Run focused architecture/compatibility tests.
- [x] Run `pnpm run check:ci` with vault deployment disabled.

**Dependencies:** Task 1.
**Estimated scope:** Medium, 3–5 files.

## Task 3: Triage tooling dependency advisories

**Description:** Evaluate the five current transitive advisories by path and reachability, then prepare a separate minimal dependency-only remediation or a dated risk acceptance.

**Acceptance criteria:**

- [ ] Each advisory records severity, dependency path, affected workflow, reachability, fix version, and decision.
- [ ] Any upgrade changes only dependency metadata/lockfile and is not mixed with source restructuring.
- [ ] No forced audit fix or blanket lifecycle-script approval is used.

**Verification:**

- [ ] Run `pnpm why vite nanoid esbuild` and `pnpm audit --audit-level=moderate`.
- [ ] For an upgrade, run frozen install, full CI, docs dev/build smoke check, and inspect the lockfile diff.

**Dependencies:** None; execute independently before the next release.
**Estimated scope:** Small/Medium.

## Checkpoint: Audit approved

- [ ] Human approves the ownership map, active/legacy classification, Batch 1 files, and dependency-risk disposition.
- [ ] Baseline remains 297 passing tests or increases only through added characterization coverage.

## Task 4: Break the central type cycle

**Description:** Move `ContextSourceFilter` to a context-source-owned pure module so `types.ts` and `ScheduledItemTypes.ts` no longer import each other. Retain a documented temporary re-export only if consumers require it.

**Acceptance criteria:**

- [x] No cycle exists between `types.ts` and `ScheduledItemTypes.ts`.
- [x] Public type meaning and all runtime output remain unchanged.
- [x] Any compatibility re-export has an owner and removal task.

**Verification:**

- [x] Run the import-cycle guard, context-source tests, settings tests, typecheck, lint, and format check.
- [x] Run `git diff --check`; inspect that the diff contains no generated Markdown or identifier change.

**Dependencies:** Tasks 1–2.
**Files likely touched:** `src/types.ts`, `src/ScheduledItemTypes.ts`, one context-source type module, one focused test.
**Estimated scope:** Small, 3–4 files.

## Task 5: Split types by domain ownership

**Description:** In separate commits, move settings, focus-session, capture-target, periodical-note, and wellbeing types out of the central type file based on actual consumers.

**Acceptance criteria:**

- [ ] Each batch covers one owner and touches at most about five files.
- [x] Domain modules do not import Obsidian or UI types.
- [x] Temporary re-exports decrease after each consumer cutover.

**Verification:**

- [x] Run focused domain tests and standard per-batch gates.
- [x] Re-run the cycle/import guard after every batch.

**Dependencies:** Task 4.
**Estimated scope:** Multiple Small/Medium batches.

**Progress (2026-08-22):**

- [x] Scheduled Item contract moved and the compatibility shim removed.
- [x] Timer and Session Record contracts moved to Focus Session.
- [x] Wellbeing contracts moved to Reflection.
- [x] Periodical Note profile/settings contracts moved with direct consumer cutover.
- [x] Moment `InboxRecord`, capture form options, and Scheduled Item Event/Task records moved to feature-owned domains.
- [x] Event/Task record consumers cut over directly and the temporary `EventTaskWriter` type shim removed.
- [x] Capture target and capture settings moved to `features/capture/domain`; `InsertPosition` moved to the proven shared Markdown boundary, all consumers cut over directly, and central re-export shims removed.
- [x] Object Source settings and placement moved to `features/object-notes/domain`; production/tests cut over directly and central filter/settings/placement shims removed.
- [x] Timeline settings moved to `features/timeline/domain`; Settings UI cut over to canonical `TimelineMode` and central Timeline shims removed.
- [x] Event/Task detail settings moved to the Scheduled Item domain; the writer cut over directly and the central shim was removed.
- [x] Persisted Inbox/Object Source registry settings moved to the Object Notes domain and the central shim was removed.
- [x] Global settings composition, defaults, and migration merge moved to `features/settings/domain`; all consumers cut over and central `types.ts` was removed.

Process note: the mechanical `FocusNotesSettings` direct-import cutover touched 18 production consumers in one owner-only commit, so the approximately-five-file sizing target remains unmet even though the change was import-only and independently verified.

## Task 6: Split utilities by proven ownership

**Description:** Separate pure date/time operations from Obsidian file/folder guards and vault folder creation; colocate feature-private helpers with their owner.

**Acceptance criteria:**

- [x] No generic replacement `shared/utils.ts` is introduced.
- [x] Pure helpers have no Obsidian/DOM imports; vault mutation is isolated in its infrastructure adapter.
- [x] Existing path handling and folder creation behavior are characterized and retained without a behavior change.

**Verification:**

- [x] Run utility, daily-note, timeline layout/query, and writer tests.
- [x] Add boundary cases for root/traversal/empty paths if absent.

**Dependencies:** Task 4.
**Estimated scope:** Multiple Small batches.

**Progress (2026-08-22):**

- [x] Pure date/time helpers moved to `features/timeline/domain/TimelineDate.ts`; all Timeline/query consumers cut over directly and the central shims were removed.
- [x] Obsidian file/folder type guards moved to `infrastructure/obsidian/ObsidianFileTypes.ts`; all consumers cut over and the central shims were removed.
- [x] Vault folder creation moved to `infrastructure/obsidian/VaultFolders.ts`; all consumers cut over and `utils.ts` was removed.

## Checkpoint: Foundations

- [x] Full CI passes.
- [x] Foundational cycles are gone and no new cycle exists.
- [x] Central `types.ts` and `utils.ts` are removed after every consumer moved to a canonical owner.

## Task 7: Establish the pure Scheduled Item domain

**Description:** Colocate Scheduled Item models, form data, parsing, block editing, validation, identity, and semantic adapters without changing APIs and output.

**Acceptance criteria:**

- [x] Pure domain modules import neither Obsidian nor DOM/UI modules. Enforced by `test/architecture-boundaries.test.ts`, which asserts no `features/**/domain/*.ts` module imports `obsidian`, central `types`, or an outer (`ui`/`infrastructure`/`plugin`) layer; passing for all 12 files now in `features/capture/scheduled-item/domain/`.
- [x] Create and edit share one discriminated semantic contract. `ScheduledItemFormData` (`ScheduledTaskFormData | ScheduledEventFormData`) is produced by both the create path (`scheduledItemFormDataFromCreateState`) and the edit path (`scheduledTaskFormDataFromLineEdit`/`scheduledEventFormDataFromLineEdit` via `hydrateScheduledItemFormEdit`).
- [x] Parser accepts legacy inputs and no-op edits stay byte-identical. Covered by the existing Event/Task line and Markdown compatibility tests (below).

**Verification:**

- [x] Ran all `scheduled-item-*`, Event/Task line, lifecycle, and Markdown compatibility tests as part of the full 306-test suite after every batch in this task.
- [x] Golden fixture byte comparison covered by `event-task-markdown-compatibility.test.ts` and `legacy-hub-ui-retirement.test.ts`.

**Dependencies:** Tasks 5–6.
**Estimated scope:** Multiple Small/Medium batches.

**Progress (2026-08-22):**

- [x] Scheduled Item block identity moved to `features/capture/scheduled-item/domain/ScheduledItemBlockId.ts`; all parser, editor, writer, Timeline, and UI consumers cut over directly and the root shim was removed.
- [x] Event/Task Markdown rendering moved to `features/capture/scheduled-item/domain/EventTaskMarkdown.ts`; compatibility tests and all production consumers cut over directly and the root shim was removed.
- [x] `unwrapMarkdownLinkLabel` moved from Moment-owned `InboxMarkdown.ts` to `shared/markdown/MarkdownLink.ts`; Moment tests and both Scheduled Item consumers use the canonical primitive without a re-export.
- [x] `TaskLineEditor.ts` and `TaskLineLint.ts` moved to `features/capture/scheduled-item/domain/`; both test files and all production consumers cut over directly and the root shims were removed.
- [x] `EventLineEditor.ts` moved to `features/capture/scheduled-item/domain/`; the test file and all production consumers cut over directly and the root shim was removed.
- [x] `ScheduledItemParser.ts` moved to `features/capture/scheduled-item/domain/`; all 6 test files and 5 production consumers cut over directly and the root shim was removed.
- [x] `ScheduledItemBlockEditor.ts` moved to `features/capture/scheduled-item/domain/`; both test files and all 3 production consumers cut over directly and the root shim was removed. `LedgerRecordSource.ts` stays at the source root (12 consumers across Task/Event ledger editors; a separate, wider batch).
- [x] `ScheduledItemFormData.ts` moved to `features/capture/scheduled-item/domain/`; its direct test file and all consumers cut over per UI area (desktop, mobile, application) and the root shim was removed.
- [x] `ScheduledItemFormAdapter.ts` moved to `features/capture/scheduled-item/domain/`; both test files and all 6 production consumers cut over directly and the root shim was removed. `ScheduledItemEditSubmission.ts` and `ScheduledItemIdentityMigration.ts` are application/orchestration per the ownership map, not pure domain, and belong to Task 8 instead.
- [x] Decision: `EventTaskFormState.ts` and `SubmissionPolicy.ts` stay at the source root. Both are scoped to the legacy unified `EventTaskModal.ts`/`EventTaskMobileScreen.ts` capture path, which handles Moment, Event, and Task together through a `kind` discriminator (`"inbox" | "task" | "event"`) — they are not Scheduled-Item-only domain modules. Moving them now would mislabel ownership; they belong with Task 9's legacy-path retirement, where the unified modal is split or removed.
- [x] `LedgerRecordSource.ts` moved to `features/capture/scheduled-item/domain/`; all 9 production consumers (ledger editors, application, desktop/mobile UI) and 6 test files cut over directly and the root shim was removed.

**Task 7 complete 2026-08-23.** Scheduled Item domain contract, Markdown rendering, detail-note settings, identity, parser, block editing, `LedgerRecordSource.ts`, form data, and form adapter/validation are all canonical in `features/capture/scheduled-item/domain/`, acyclic, and free of Obsidian/DOM imports. `ScheduledItemEditSubmission.ts` and `ScheduledItemIdentityMigration.ts` are application/orchestration per the ownership map and belong to Task 8. `EventTaskFormState.ts`/`SubmissionPolicy.ts` are legacy-scoped per the decision above and belong to Task 9.

## Task 8: Isolate capture persistence and external boundaries

**Description:** Define narrow application ports for vault reads/writes, target resolution, link resolution, suggestions, and related-log recovery; place Obsidian implementations in infrastructure.

**Acceptance criteria:**

- [x] Domain/application policies can be tested without `App`, `Vault`, `TFile`, `Notice`, or DOM. `ScheduledItemEditSubmission.ts`, `ScheduledItemCreateRelated.ts`, `DetailNotePromotion.ts` (application), and the shared `ContextLinkResolver.ts`/`RelatedWriteRecovery.ts`/`ObjectReference.ts`/`RelatedLog.ts` primitives are all Obsidian-free and dependency-injection based; only the `infrastructure/obsidian/` adapters (by design) touch `App`/`Vault`/`TFile`.
- [x] External Markdown/settings/path input is validated before persistence. Verified and one real gap fixed — see the Detail Note create-folder note below.
- [x] Primary-write receipt, stale-write conflict, no-op, and retry semantics remain unchanged — preserved through every move since these were mechanical relocations with no logic edits (the one behavioral fix was additive validation, not a change to existing write semantics).

**Verification:**

- [x] Ran block persistence, submission, related-write recovery, target, object-reference, and state-store tests as part of the full 307-test suite after every batch in this task.
- [x] Added abuse cases for malformed/traversal paths (Detail Note create-folder — see below). Stale/ambiguous source coverage already existed prior to this task (`scheduled-item-edit-submission.test.ts`, `ledger-record-source.test.ts`).

**Dependencies:** Task 7.
**Estimated scope:** Multiple Medium batches.

**Progress (2026-08-23):**

- [x] `ScheduledItemEditSubmission.ts` and `ScheduledItemCreateRelated.ts` moved to `features/capture/scheduled-item/application/`. Both were already dependency-injection based (`writePrimary`, `writeRelated`, `resolveLinkDestination` passed in) and imported no Obsidian/DOM before the move, so this batch was purely organizational — it establishes the intended `application/` layer alongside `domain/`. All 4 production UI consumers (`ScheduledItemDesktopEditModal.ts`, `ScheduledItemMobileEditScreen.ts`, `ScheduledItemDesktopCreateModal.ts`, `ScheduledItemMobileCreateScreen.ts`) and their test files were cut over directly and the root shims were removed.
- [x] `ObjectReference.ts` and `RelatedLog.ts` (pure, no injected I/O) moved to `features/capture/domain/`; `ContextLinkResolver.ts` and `RelatedWriteRecovery.ts` (orchestrate an injected resolver/writer that perform real I/O in production) moved to `features/capture/application/`. This corrects the Phase 0 ownership map, which had guessed `ObjectReference.ts` → Object Notes domain and `ContextLinkResolver.ts` → Object Notes application; consumer evidence showed `ObjectNote.ts` never imports either, while both are used across Moment (`InboxNotesController.ts`, `InboxRichText.ts`), Scheduled Item, and the legacy `EventTaskSubmission.ts`. ~20 production consumers across all four files cut over directly, all four root shims removed.
- [x] `EventTaskSubmission.ts` itself is legacy-scoped (only consumed by `EventTaskModal.ts`/`EventTaskMobileScreen.ts`/`SubmissionPolicy.ts`), matching the `EventTaskFormState.ts`/`SubmissionPolicy.ts` decision from Task 7 — it belongs to Task 9, not Task 8, despite the ownership map originally listing it under "Scheduled Item application". Left at the source root.
- [x] `ScheduledItemBlockPersistence.ts` (`saveScheduledItemBlock`), `EventTaskWriter.ts`, `ObsidianLinkResolver.ts`, `ObsidianInboxSuggestionSource.ts`, and `ObsidianScheduledItemMentionSource.ts` moved to `infrastructure/obsidian/`, following the existing plain-async-function adapter pattern (`VaultFolders.ts`) rather than introducing a port/interface abstraction. All 8 production consumers (desktop/mobile create/edit screens plus the legacy `EventTaskModal.ts`/`EventTaskMobileScreen.ts`) and related test files cut over directly and the root shims were removed.
- [x] Acceptance criterion 2 verification found and fixed a real gap: `validateScheduledItemFormData` guarded a "link" mode Detail Note path against `../` traversal (`normalizeObjectReferencePath`) but not the "create" mode's freehand-typed `folder` field, which flows into `EventTaskWriter.resolveNotePath` and Vault folder/file creation unguarded. Added `isSafeVaultFolderPath` and abuse-case tests (leading slash, `..` segments, empty/root, nested — see `test/scheduled-item-form-adapter.test.ts`). Other path inputs (Periodical Notes / Object Source / Inbox folder settings) are vault-owner-configured settings, not per-item form data, and were not in scope for this pass.
- [x] `TaskFormatWriter.ts` split: pure parts (`TaskFormatChange`, `applyTaskFormatChanges`) moved to `features/capture/scheduled-item/domain/`, the Obsidian-touching `saveTaskFormatChanges` moved to `infrastructure/obsidian/`. `ScheduledItemIdentityMigration.ts` turned out to be pure (13 lines, only a type-only dependency on `TaskFormatChange`) rather than genuine orchestration, and moved to `features/capture/scheduled-item/domain/` alongside it. All consumers (`ActiveNoteManagerModal.ts`, `TaskFormatPreviewModal.ts`) and test files cut over directly and both root shims were removed.
- [x] `Suggesters.ts` (`FileSuggest`, `FolderSuggest`, `HeadingSuggest`, all extending Obsidian's `AbstractInputSuggest`) moved to `infrastructure/obsidian/`. 10 production consumers cut over directly, root shim removed.
- [x] `EventLedgerEditor.ts`/`TaskLedgerEditor.ts` turned out to be entirely Obsidian-touching (every export takes `App` and calls `app.vault` directly; the pure line-edit/capture logic they use was already extracted to domain in earlier batches) — moved wholesale to `infrastructure/obsidian/`, matching `EventTaskWriter.ts`. 5 production consumers cut over directly, both root shims removed.

**Task 8 complete 2026-08-23.** All three acceptance criteria verified and closed. Capture persistence and external boundaries — application layer, Obsidian adapters, shared primitives — are canonical with zero root shims remaining for anything in scope. `EventTaskFormState.ts`, `SubmissionPolicy.ts`, and `EventTaskSubmission.ts` remain at the source root, deliberately deferred to Task 9 (legacy `EventTaskModal.ts`/`EventTaskMobileScreen.ts` retirement).

## Task 9: Cut renderers over and retire proven legacy paths

**Description:** Make desktop/mobile create and edit shells depend on the shared application boundary, then delete legacy implementations only after every launcher is proven migrated.

**Acceptance criteria:**

- [x] Desktop and mobile retain separate DOM, focus, keyboard, and lifecycle code.
- [x] Moment remains independent while Event/Task use the unified Scheduled Item path.
- [x] Legacy deletion occurs in its own commit with zero runtime imports.

**Verification:**

- [x] Run desktop/mobile composition and legacy-retirement tests.
- [ ] Perform desktop and real-mobile create/edit/retry acceptance. Explicitly skipped by user decision 2026-08-24 (see Progress log below) — residual risk accepted, not an oversight.

**Dependencies:** Task 8.
**Estimated scope:** Multiple Medium batches.

**Progress (2026-08-24):**

- [x] Traced every call site of `openEventTaskForm` (`EventTaskModal.ts`) and confirmed `EventTaskMobileScreen.ts`'s identical pattern. Exactly 3 real call sites: `main.ts`'s `create-event-task` command, `TimelineView.ts`'s "+" button, and `ActiveNoteManagerModal.ts`'s create callback (via `main.ts`). Finding: `openEventTaskForm`/`openMobileScheduledItemCreate ` already intercept `options.initialKind === "task" | "event"` **before** constructing `EventTaskModal`/`EventTaskMobileScreen`, routing straight to `ScheduledItemDesktopCreateModal.ts`/`ScheduledItemMobileCreateScreen.ts` (the canonical Scheduled Item create path) instead. `EventTaskModal`/`EventTaskMobileScreen` are only ever constructed with `kind: "inbox"` (the default when no options are passed), and inside the modal, clicking the Event/Task tab immediately closes the modal and redirects to the canonical create modal via `activate()`/its mobile equivalent — the user can never actually submit through the legacy modal's own Event/Task rendering or its `submitEventTask` call.
- [x] This makes `EventTaskModal.renderEventSection`/`renderTaskSection`/their sub-renderers, the `submitEventTask` branch of `submit()`, `resolveTargetFile`, and the matching methods in `EventTaskMobileScreen.ts` **provably dead code at runtime** — reachable only via direct unit-test construction with a synthetic `initialKind`, never through any real command/ribbon/launcher. Moment (`kind: "inbox"`) is the only path a user can actually complete through these two files.
- [x] User approved proceeding with the dead-code strip. `EventTaskModal.ts` trimmed 887→418 lines: removed `renderEventSection`/`renderTaskSection`/their sub-renderers, `renderDescription`/`renderDetailNote`/`renderSaveTo` (Event/Task-exclusive — Moment has its own fields via `InboxDesktopForm`), the `submitEventTask` branch of `submit()`, `resolveTargetFile`, `makeChipGroup`, and the DOM helpers (`makeRow`/`makeDateInput`/`makeTimeInput`/`makeCheckboxRow`) only those removed methods called. `EventTaskMobileScreen.ts` trimmed 764→371 lines with the equivalent mobile-only methods (`renderEventFields`/`renderEventLifecycleFields`/`renderTaskDueFields`/`renderTaskPriorityFields`/`renderTaskTimebox`/`renderReminders`/`renderReminderRow`/`renderDetailNote`/`renderSaveTarget`/`renderDescription`, `resolveTargetFile`, plus their exclusive helpers). Both files verified with the full 307-test suite passing (unchanged) after each step — nothing exercised the removed paths directly, confirming they were truly dead.
- [x] Investigated `EventTaskFormState.ts` before touching it: found it's still actively used by `ScheduledItemDesktopCreateModal.ts`/`ScheduledItemMobileCreateScreen.ts` as a default-value seed via `scheduledItemFormDataFromCreateState` — **not** dead, left untouched. Same for `SubmissionPolicy.ts` (still used by both trimmed shells for Moment submission).
- [x] With both shells no longer calling `submitEventTask`, confirmed zero remaining production callers and removed it from `EventTaskSubmission.ts`, along with `EventTaskSubmissionWriter`, `EventTaskSubmissionDependencies`, `NoteFile`, and `buildEventTaskContextWrites`. `retryRelatedSubmission`'s writer parameter now references `InboxSubmissionWriter` (identical `writeRelated` shape) instead of the removed `EventTaskSubmissionWriter`. `submitInbox`, `retryRelatedSubmission`, and the shared `EventTaskSubmissionResult`/`PartialSubmissionResult` types are untouched.
- [x] Updated `event-task-submission.test.ts`: removed the 6 tests calling `submitEventTask` directly plus the Event/Task half of one mixed test, keeping full Inbox and generic-retry coverage. Verified no other test file references any removed identifier. 299 tests pass (down from 307, matching the 8 removed cases).
- [x] **User decision (2026-08-24):** manual desktop/real-mobile acceptance testing (Moment capture end-to-end, Event/Task tab redirect) was explicitly skipped by the user, accepting the residual risk based on the code-level tracing evidence and the passing test suite — not an oversight. Recorded here so it isn't mistaken for incomplete work later.
- [x] Evaluated renaming `EventTaskModal.ts`/`EventTaskMobileScreen.ts` and decided against it: both still export cross-kind routing functions (`openEventTaskForm`, `openDesktopScheduledItemCreate`) that decide where *any* capture (Moment, Event, or Task) opens — not Moment-exclusive. Renaming now would mislabel the file. A future rename would first need the routing functions extracted into their own module (candidate: alongside `ScheduledItemEditor.ts` under "Capture launch/orchestration").
- [x] `EventTaskSubmission.ts` (`submitInbox`, `retryRelatedSubmission`, shared result types) was confirmed Moment-exclusive after `submitEventTask`'s removal and moved to `features/capture/moment/application/EventTaskSubmission.ts`, keeping the filename and exported symbol names unchanged (consistent with this session's move-without-rename pattern). All 5 consumers (`EventTaskModal.ts`, `EventTaskMobileScreen.ts`, `SubmissionPolicy.ts`, 2 test files) cut over directly and the root shim was removed.
- [x] Resolved the rename blocker noted above. `EventTaskMobileScreen.ts` already received its "switch to Event/Task" action as an injected constructor callback (`openScheduledItem`) rather than importing the launcher itself; `EventTaskModal.ts` (desktop) did not follow that pattern — its `renderTabs()`/`activate()` imported and called `openDesktopScheduledItemCreate` directly, which would have created a two-file import cycle if that function were ever extracted (launcher needs the class to construct it; the class needed the launcher's routing function). Applied the same constructor-injection pattern already proven on mobile: `EventTaskModal` now takes `openScheduledItem: (kind: "task" | "event") => void` and calls it from `activate()` instead of importing `openDesktopScheduledItemCreate`. This removed the only cycle risk without any interface/DI redesign — same shape already used by `EventTaskMobileScreen.ts`.
- [x] With the cycle risk gone, extracted `openEventTaskForm` and `openDesktopScheduledItemCreate` out of `EventTaskModal.ts` into a new root file `EventTaskCaptureLauncher.ts`, matching the existing "Capture launch/orchestration" shape (`ScheduledItemEditor.ts`, `ScheduledItemMobileCreateLauncher.ts`): a thin exported entry function plus one platform-specific helper, importing the render classes rather than being imported by them. `EventTaskModal.ts` now exports only the `EventTaskModal` class. All 3 real consumers (`main.ts`, `TimelineView.ts`; `ActiveNoteManagerModal.ts` routes through `main.ts`) repointed at `./EventTaskCaptureLauncher`. Updated `test/mobile-scheduled-item-create-composition.test.ts`'s first test to read the new launcher file instead of `EventTaskModal.ts`. Full CI (format, lint, typecheck, 299 tests, production build, artifact verification, docs build) passes with zero import cycles.
- [x] Rename of `EventTaskModal.ts`/`EventTaskMobileScreen.ts` to a Moment-specific name is now unblocked but deliberately left undone — it would be cosmetic only (both class names still accurately describe what they render) and isn't required by any Task 9 acceptance criterion. Left as an optional future polish item, not tracked as open work.

## Checkpoint: Capture boundary

- [x] Full CI and byte-for-byte fixture comparison pass.
- [x] No duplicate primary writes; retry repeats only failed secondary writes.
- [x] All launchers and legacy status are documented.

**Task 9 complete 2026-08-24.** All acceptance criteria closed; the one skipped verification item (real desktop/mobile manual acceptance testing) was a deliberate, documented user decision, not an oversight. Phase 2 (Capture domain restructuring) is now closed. Next: Task 10 (Settings decomposition) or reprioritize per user direction.

## Task 10: Decompose Settings by category

**Description:** Keep navigation/composition in a thin shell and extract Periodical Notes, Object Sources, Focus Session, Capture, and Timeline renderers one at a time with narrow inputs.

**Acceptance criteria:**

- [x] Each renderer receives only required settings/services, not the whole plugin without justification.
- [x] Category order, copy, visibility, defaults, and save behavior are unchanged.
- [x] One serialized persistence path remains authoritative.

**Verification:**

- [x] Run settings layout, context source, inbox folder, and state-store tests after every category.
- [ ] Smoke-test navigation and saving in desktop Obsidian. Not performed — `SettingsTab.ts` and the extracted category renderers depend on live Obsidian classes (`PluginSettingTab`, `Setting`, `ToggleComponent`) that aren't mockable under `node:test`, so there is no automated coverage of the actual UI wiring for this category either (same limitation noted for Task 9). Every extraction was pure code motion (methods moved verbatim to module functions, `this.plugin.settings`/`this.plugin.saveSettings()` mechanically renamed to `ctx.settings`/`ctx.saveSettings()`) verified by diff review and full CI, not by running the settings tab. Flagged here as a real gap, not silently dropped.

**Dependencies:** Foundation checkpoint; may follow capture work where shared settings types overlap.
**Estimated scope:** Five Small/Medium batches.

**Progress (2026-08-24):**

- [x] Batch 1 — Periodical Notes: introduced `features/settings/ui/SettingsRenderContext.ts` (narrow ctx: app/settings/saveSettings/redisplay) and `SettingsFormFields.ts` (`contextTextField`/`contextSelectField`, moved verbatim). Extracted `renderPeriodicalNotes`/`renderPeriodicalProfile` to `features/settings/ui/PeriodicalNotesSettings.ts`. `SettingsTab.ts`: 1355→1218 lines.
- [x] Batch 2 — Object Sources: extracted `renderObjectsList`/`renderObjectSourceRow`/`renderObjectSourceEdit`/`renderContextSource`/`renderContextSourceFolders` to `features/settings/ui/ObjectSourceSettings.ts`, adding a narrow `ObjectSourceNavigation` (`toList`/`toSource`) callback pair for the list↔edit navigation this category needs beyond the shared context. Dropped the redundant `saveContextSources()` wrapper (it only forwarded to `plugin.saveSettings()`). `SettingsTab.ts`: 1218→948 lines.
- [x] Batch 3 — Focus Session: extracted `renderDefaultDurations`/`renderFocusSessionCapture`/`renderDateGrouping`/`renderLogEntryFormat`/`renderBehavior` to `features/settings/ui/FocusSessionSettings.ts` behind one `renderFocusSession()` entry point. Moved the shared `renderProfilePicker` helper into `SettingsFormFields.ts` since this category needed it first (Moment/Event capture kept using the private copy until batch 4, avoiding speculative early moves). `SettingsTab.ts`: 948→715 lines.
- [x] Batch 4 — Capture: extracted `renderMomentCapture`/`renderEventCapture`/`renderTaskCapture`/`renderSharedNoteCreation`/`renderTaskAllowedSources` to `features/settings/ui/CaptureSettings.ts`, reusing the shared `renderProfilePicker`. Removed the now-fully-redundant private `renderProfilePicker` copy from `SettingsTab.ts`. `SettingsTab.ts`: 715→330 lines.
- [x] Batch 5 (final) — Timeline: extracted `renderFocusTimeline`/`renderTimelineAlignmentStatus` to `features/settings/ui/TimelineSettings.ts`. `SettingsTab.ts`: 330→169 lines, now a pure navigation shell (`display()`/`navigateTo()`/`renderRoot()`/`renderBackBar()`/`renderCategoryRow()`/`settingsContext()`) with zero per-category rendering logic remaining.
- [x] Full CI (format, lint, typecheck, 299 tests, production build, artifact verification, docs build) verified after every batch; zero import cycles introduced.

**Task 10 complete 2026-08-24.** All acceptance criteria closed. The one unchecked verification item (manual desktop smoke test) is an inherent gap shared with Task 9 — this UI layer has no automated coverage — not an oversight specific to this task.

## Task 11: Decompose Timer

**Description:** Separate ItemView lifecycle, controls/presentation, target editor, recent entries, and completion/log orchestration.

**Acceptance criteria:**

- [x] ItemView owns only Obsidian lifecycle and composition.
- [x] TimerEngine remains pure and state transitions are unchanged.
- [x] View ID, restoration, log Markdown, and interaction behavior remain stable.

**Verification:**

- [x] Run TimerEngine, writer, related-log, and target tests. No TimerEngine-specific unit tests existed before or after this task (only `toEngineMode` in `Timer.ts` is tested) — this is a pre-existing gap, not something this task introduced or was asked to backfill.
- [ ] Smoke-test open/close/reopen, countdown/stopwatch, pause/resume, and completion logging. Not performed — same limitation as Task 9/10: `TimerView.ts` and the extracted UI classes depend on live Obsidian classes (`ItemView`, `Menu`, `Modal`) not mockable under `node:test`. Verified instead by diff review (every extraction was pure code motion — method bodies moved verbatim, `this.x` renamed to `this.options.x`/`ctx.x`) plus full CI after every batch. Flagged here as a real gap, not silently dropped.

**Dependencies:** Tasks 5–6.
**Estimated scope:** Multiple Medium batches.

**Progress (2026-08-24):**

- [x] Batch 1: `TimerEngine.ts` moved to `features/focus-session/domain/TimerEngine.ts` — it was already pure (zero Obsidian imports, only `window.setInterval`/`window.clearInterval`), so this was a relocation, not a purification. `CircularDisplay.ts` and `LogModal.ts` moved to `features/focus-session/ui/` — both already self-contained. Filenames/exported symbols unchanged; only import paths adjusted. `TimerView.ts` (the only consumer of all three) repointed.
- [x] Batch 2: The "Log target" collapsible section extracted to `features/focus-session/ui/TimerTargetEditor.ts`, taking app/getSettings/saveSettings/buildResolver plus a narrow `onTargetChanged` callback and a `registerEvent` callback (mirrors `Component.registerEvent`) instead of holding a reference to the whole ItemView. `TimerView.ts`: 700→537 lines.
- [x] Batch 3: The "Recent in section" collapsible panel extracted to `features/focus-session/ui/TimerRecentEntries.ts`, taking app/getSettings/buildResolver/buildReader plus the owning ItemView as a `Component` (only needed to tie `MarkdownRenderer`'s cleanup to the view's lifecycle). `TimerView.ts`: 537→482 lines.
- [x] Batch 4: `handleStopAndLog`/`handleComplete`/`openLogModal`/`beep` extracted to `features/focus-session/ui/TimerLogWorkflow.ts`, taking an options object (app/engine/getSettings/buildWriter/buildResolver plus narrow accessor callbacks for currentMode, focus input value, planned minutes, and two change-notification callbacks). `TimerView.ts`: 482→388 lines.
- [x] Batch 5 (final): Mode selector, focus-on input, circular display, duration row, and action buttons extracted to `features/focus-session/ui/TimerControls.ts`, owning `currentMode` and the shared `TimerEngine` reference, exposing narrow accessors/refresh methods that `TimerLogWorkflow`'s callbacks call into. `TimerView.ts`: 388→114 lines — now a pure ItemView shell composing all four extracted classes around one shared `TimerEngine`.
- [x] Full CI (format, lint, typecheck, 299 tests, production build, artifact verification, docs build) verified after every batch; zero import cycles introduced.

**Task 11 complete 2026-08-24.** All acceptance criteria closed. The one unchecked verification item (manual desktop smoke test) is the same inherent gap noted for Tasks 9/10 — this UI layer has no automated coverage — not an oversight specific to this task.

## Task 12: Decompose Timeline

**Description:** Separate ItemView lifecycle and range state from indexing/query orchestration, navigation/sidebar, grid rendering, and modal launching.

**Acceptance criteria:**

- [x] Query/layout/index logic remains pure or behind narrow ports.
- [x] View ID/state, source classification, date ranges, and edit launching are unchanged.
- [x] Refresh listeners are owned and cleaned up by the shell.

**Verification:**

- [x] Run all timeline, Scheduled Item query/index, and modal model tests. All pre-existing timeline/query/index/modal-model tests pass unchanged (pure code motion, no logic touched).
- [ ] Smoke-test open/close/reopen, navigation, refresh, filtering, and item editing. Not performed — same limitation as Task 9/10/11: `TimelineView.ts` and the extracted UI classes depend on live Obsidian classes (`ItemView`, modals) not mockable under `node:test`. Verified instead by diff review (every extraction was pure code motion) plus full CI after every batch. Flagged here as a real gap, not silently dropped.

**Dependencies:** Tasks 7–9 for shared Scheduled Item contracts.
**Estimated scope:** Multiple Medium batches.

**Progress (2026-08-24):**

- [x] Batch 1: `items`/`parser`/`indexRefreshTimer`/`refreshIndex`/`scheduleIndexRefresh`/`ensureSourceSettings`/`colorFor`/`isInSourceScope`/`getEffectiveSourceGroups`/`Folders`/`Headings` extracted to `features/timeline/ui/TimelineIndex.ts`. `refreshIndex()` now returns a disabled/empty/ok/error result instead of directly calling render methods, so TimelineView decides what to draw. Exposes `dispose()` for the pending debounce timer, wired through `Component.register()`. `TimelineView.ts`: 442→379 lines.
- [x] Batch 2: `openItemDetails`/`openItemEditor`/`openPendingItems`/`openSourceItem` extracted to `features/timeline/ui/TimelineModalLauncher.ts`, taking app/getSettings plus a narrow `onRefreshNeeded` callback. `TimelineView.ts`: 379→345 lines.
- [x] Batch 3: The header bar (title, add button, source-sidebar toggle, week label, prev/today/next, weekly-open button, mode select, refresh) extracted to `features/timeline/ui/TimelineHeader.ts`, taking callbacks for each action instead of holding an ItemView reference, with no settings-mutation logic of its own. Exposes `syncControls()` and `setMode()`. `VIEW_TYPE_FOCUS_TIMELINE` passed via options rather than imported, to avoid a cycle with `TimelineView.ts`. `TimelineView.ts`: 345→273 lines.
- [x] Batch 4 (final): `renderContent`/`renderDisabled`/`buildSourceSummaries` extracted to `features/timeline/ui/TimelineContentRenderer.ts`, composing `TimelineIndex`/`TimelineHeader`/`TimelineModalLauncher` by reference with its own `ScheduledItemQuery`/`TimelineLayout` instances. `TimelineView.ts`: 273→196 lines — now a pure ItemView shell (lifecycle plus mode/anchorDate range state and `currentRange()`/`shift()`) composing all four extracted classes.
- [x] Full CI (format, lint, typecheck, 299 tests, production build, artifact verification, docs build) verified after every batch; zero import cycles introduced.

**Task 12 complete 2026-08-24.** All acceptance criteria closed. The one unchecked verification item (manual desktop smoke test) is the same inherent gap noted for Tasks 9/10/11 — this UI layer has no automated coverage — not an oversight specific to this task.

## Task 13: Thin plugin composition and remove shims

**Description:** Extract command/view registration, remove completed compatibility re-exports and dead legacy files, and document the final actual structure.

**Acceptance criteria:**

- [x] `main.ts` orchestrates lifecycle and composition without feature business logic.
- [x] All command, ribbon, view, manifest, CSS, and console identifiers retain their values.
- [x] No unowned shim, dead runtime import, or speculative empty folder remains. (3 proven-dead files remain by explicit user choice, not oversight — see Progress below.)

**Verification:**

- [x] Run full CI, artifact verification, dependency audit, import guard, and unused-export inspection. `test/architecture-boundaries.test.ts` is the automated import-guard/cycle check (scans all of src/ dynamically, no hardcoded file list — already covers every file created this session). Dead-file audit was manual (heuristic script + grep), documented below.
- [ ] Complete command/ribbon/view restoration desktop smoke tests and capture mobile acceptance. Not performed — same limitation as Tasks 9–12: no automated coverage for live-Obsidian UI, and manual testing was out of scope this session (mirrors the Task 9 decision). Flagged here as a real gap, not silently dropped.

**Dependencies:** Tasks 9–12.
**Estimated scope:** Multiple Small batches.

**Progress (2026-08-24):**

- [x] Extracted `openActiveNoteManager` (the only feature business logic remaining in `main.ts`: reading file content, scanning the active note's ledger/checklist scopes, wiring `ActiveNoteManagerModal` callbacks) to a new root file `ActiveNoteManagerLauncher.ts`, matching the existing launch/orchestration pattern. `main.ts`: 181→147 lines.
- [x] Audited for unowned shims: no empty directories under `features/`; no leftover re-export-only files; `biome lint` clean repo-wide.
- [x] Heuristic scan for files with zero import references anywhere in `src/` found 3: `EventEditModal.ts`, `TaskEditModal.ts` (both already flagged in the architecture baseline as legacy candidates awaiting proof — now proven), and `MoodPicker.ts` (superseded by `EmotionalWellbeingPicker.ts`, both read from `MoodReference.ts` which stays live via other consumers). Verified with direct grep (case-insensitive, across `src/` and `test/`) — zero references beyond the files' own definitions. A separate historical planning doc (`tasks/backlink-and-task-links-plan.md`) independently corroborates `TaskEditModal.ts` as dead code.
- [x] **User decision (2026-08-24):** asked whether to delete the 3 proven-dead files; user chose "Leave all 3 alone." Not deleted. Recorded in the ownership map (`docs/code-architecture-baseline.md`) so this isn't silently revisited or mistaken for an oversight later.
- [x] Full CI (format, lint, typecheck, 299 tests, production build, artifact verification, docs build) verified; `test/compatibility-identifiers.test.ts` confirms all command/ribbon/view/manifest identifiers unchanged.

**Task 13 complete 2026-08-24.** All acceptance criteria closed (the dead-file deletions were offered and explicitly declined by the user, not missed). The one unchecked verification item (manual desktop/mobile smoke test) is the same inherent gap noted for Tasks 9–12.

## Checkpoint: Complete

- [ ] All compatibility invariants in the handover pass.
- [ ] Review across correctness, readability, architecture, security, and performance has no required findings.
- [ ] Actual architecture docs, shim ledger, advisory disposition, and manual acceptance evidence are current.
- [ ] Human approves any legacy deletion and the final structure.
