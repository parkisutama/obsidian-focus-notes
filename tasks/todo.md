# Tasks: Complete Source Organization

Unless narrowed below, every implementation task runs the standard gates from `tasks/plan.md`, updates the shrinking root inventory, and accepts no production-body change beyond import paths.

## Task 1: Strengthen architecture migration guards

**Description:** Add a checked root inventory plus permanent layer, shared, cycle, and legacy rules before moves begin.

**Acceptance criteria:**
- [x] New root modules, inward domain dependencies, feature imports from `shared/`, and production imports from `legacy/` fail tests.
- [x] The migration inventory can shrink per batch and has `main.ts` as its documented final state.
- [x] Each guard is proven by a focused RED test and classifier assertions for every prohibited dependency shape.

**Verification:** `node --test test/architecture-boundaries.test.ts`; then full CI.

**Dependencies:** None.
**Files likely touched:** `test/architecture-boundaries.test.ts`, optional architecture fixtures.
**Estimated scope:** Small, 1–2 files.

## Task 2: Quarantine proven-dead UI

**Description:** Move, but do not delete or modernize, the three proven zero-consumer modules.

**Acceptance criteria:**
- [x] `EventEditModal.ts`, `TaskEditModal.ts`, and `MoodPicker.ts` live under `src/legacy/`, with only relative imports adjusted for the new path.
- [x] No production/test import reaches them and their former root paths are absent.
- [x] Source bodies are unchanged apart from relative import specifiers.

**Verification:** Architecture test, explicit reference scan, typecheck, full tests, rename-similarity review.

**Dependencies:** Task 1.
**Files likely touched:** Three legacy modules and `test/architecture-boundaries.test.ts`.
**Estimated scope:** Medium, 4 files.

## Task 3: Place shared and periodical primitives

**Description:** Move foundational pure modules before their consumers.

**Acceptance criteria:**
- [x] `HeadingInsertion` is under `shared/markdown`; `DailyNotePath` and `PeriodicalNoteSettings` are under Periodical Notes domain.
- [x] Root `CaptureTarget` policy joins capture domain as `ActiveCaptureTarget`.
- [x] Signatures and output remain byte-compatible; no re-export shim is added.

**Verification:** Focused heading, Daily Note, periodical, and capture-target tests; standard gates.

**Dependencies:** Task 1.
**Files likely touched:** Four primary modules, direct consumers, corresponding tests.
**Estimated scope:** Medium, 4 primary moves.

## Checkpoint: Migration foundation

- [ ] Tasks 1–3 pass full CI and audit disposition is recorded.
- [x] No cycle, barrel, forwarding shim, or new root file exists.
- [x] Legacy is present but unreachable; root inventory is 61, below the 68-file baseline.

## Task 4: Finish Settings ownership

**Description:** Move Settings composition and storage to feature layers.

**Acceptance criteria:**
- [x] `SettingsTab`/`SettingsLayout` live in Settings UI and `StateStore` in Settings infrastructure.
- [x] Save ordering, defaults, migration, and malformed-data protection are unchanged.
- [x] Plugin composition imports the new canonical paths directly.

**Verification:** State-store, settings-layout/defaults, compatibility tests; full CI; desktop settings smoke test.

**Dependencies:** Task 3.
**Files likely touched:** Three primary modules, consumers, tests.
**Estimated scope:** Medium.

## Task 5: Finish Object Notes ownership

**Description:** Move remaining Object Notes domain, application, and UI modules.

**Acceptance criteria:**
- [x] `ContextSourceScope` is domain; `ObjectNote` is application; modal/suggester are UI.
- [x] Capture-specific logic is not relabeled as Object Notes logic.
- [x] Creation paths, property enforcement, and suggestions are unchanged.

**Verification:** Context-source, object-note, object-reference, suggestion tests; standard gates.

**Dependencies:** Task 3.
**Files likely touched:** Four primary modules, consumers, tests.
**Estimated scope:** Medium.

## Task 6: Finish Reflection ownership

**Description:** Move active CBT/reference APIs and UI without splitting data yet.

**Acceptance criteria:**
- [x] Cognitive/reference modules are Reflection domain; active picker/modal are Reflection UI.
- [x] Legacy `MoodPicker` remains quarantined.
- [x] Labels and writer output are unchanged.

**Verification:** Reflection, wellbeing, writer/formatting tests; standard gates.

**Dependencies:** Task 2.
**Files likely touched:** Four primary modules, consumers, tests.
**Estimated scope:** Medium.

## Checkpoint: Supporting features

- [x] Tasks 4–6 pass full CI (302 tests, production build, artifacts, and docs).
- [x] Settings, Object Notes, and Reflection have no active root modules.

## Task 7: Place Focus Session application and adapters

**Description:** Give recent-entry reading, note writing, and target resolution evidence-based application/infrastructure owners.

**Acceptance criteria:**
- [x] Consumer/import evidence placed `RecentEntriesReader` in Obsidian Focus Session infrastructure.
- [x] `NoteWriter` is under Obsidian Focus Session infrastructure; `TargetResolver` under shared capture infrastructure.
- [x] No vault read/write, scan frequency, or path behavior changes.

**Verification:** Recent-entry, writer, target, related-log tests; standard gates.

**Dependencies:** Tasks 3 and 6.
**Files likely touched:** Three primary modules, consumers, tests.
**Estimated scope:** Medium.

## Task 8: Place the Focus Session view shell

**Description:** Move the thin Timer ItemView shell beside its UI collaborators.

**Acceptance criteria:**
- [x] `TimerView` lives in Focus Session UI.
- [x] View ID, lifecycle cleanup, engine ownership, and logging remain unchanged.
- [x] Only composition code imports the view entry point.

**Verification:** Timer/writer/compatibility tests; full CI; open/reopen/completion smoke test.

**Dependencies:** Task 7.
**Files likely touched:** `TimerView`, `main.ts`, path-sensitive compatibility test.
**Estimated scope:** Small/Medium.

## Task 9: Place Timeline domain modules

**Description:** Move pure layout, source grouping/alignment, and modal read model into Timeline domain.

**Acceptance criteria:**
- [x] Four modules live in Timeline domain and remain Obsidian/DOM-free.
- [x] Layout, ranges, classification, and modal models are unchanged.
- [x] Scheduled Item rules are consumed, not duplicated.

**Verification:** Timeline layout/source/alignment/modal tests; standard gates.

**Dependencies:** Task 3.
**Files likely touched:** `TimelineLayout`, `TimelineSourceAlignment`, `TimelineSourceGroups`, `TimelineItemModalModel`, consumers/tests.
**Estimated scope:** Medium, 4 primary moves.

## Task 10: Place Timeline query and index modules

**Description:** Move query/index orchestration according to actual Obsidian reachability.

**Acceptance criteria:**
- [x] `ScheduledItemQuery` is Timeline application.
- [x] Concrete `ScheduledItemIndexer` is Timeline Obsidian infrastructure.
- [x] `ScheduledItemMentionIndex` is Scheduled Item application.

**Verification:** Index/query/mention/refresh tests; standard gates; verify frequency and ambiguity behavior.

**Dependencies:** Task 9.
**Files likely touched:** Three primary modules, consumers, tests.
**Estimated scope:** Medium.

## Task 11: Place Timeline UI

**Description:** Move the view shell, grid, sidebar, and item modal into Timeline UI.

**Acceptance criteria:**
- [x] All four modules live in Timeline UI.
- [x] View ID/state, navigation, filters, listeners, refresh, and edit launch remain unchanged.
- [x] Existing callback boundaries remain narrow.

**Verification:** All Timeline/compatibility tests; full CI; live navigation/filter/edit smoke test.

**Dependencies:** Task 10.
**Files likely touched:** Four primary UI modules, consumers, tests.
**Estimated scope:** Medium.

## Checkpoint: Focus Session and Timeline

- [x] Tasks 7–11 pass full CI (302 tests, build, artifacts, and docs).
- [x] Both features have no active root modules.
- [ ] Runtime view checks pass or have explicit human-approved residual risk.

## Task 12: Place Active Note and formatting modules

**Description:** Move Active Note read models/application and manager/formatting UI to Scheduled Item.

**Acceptance criteria:**
- [x] Ledger scan/model are application; manager launcher/modal and format preview are UI.
- [x] Scope ordering, formatting, and command behavior remain unchanged.
- [x] Feature logic does not return to plugin composition.

**Verification:** Active-note, task-format, parser, compatibility tests; standard gates.

**Dependencies:** Task 10.
**Files likely touched:** Five primary modules, consumers, tests.
**Estimated scope:** Medium.

## Task 13: Place Scheduled Item desktop UI

**Description:** Move desktop form/model/create/edit as one renderer slice.

**Acceptance criteria:**
- [x] Four modules live under `scheduled-item/ui/desktop`.
- [x] Create/edit composition, validation, detail recovery, and no-op behavior remain unchanged.
- [x] Desktop does not import mobile UI.

**Verification:** Desktop composition/model/submission/detail/edit tests; standard gates.

**Dependencies:** Task 12.
**Files likely touched:** Four primary modules, consumers, tests.
**Estimated scope:** Medium.

## Task 14: Place mobile form foundation

**Description:** Move mobile form/model/policy/viewport helpers together.

**Acceptance criteria:**
- [x] Four modules live under `scheduled-item/ui/mobile`.
- [x] Mobile lifecycle/viewport stays independent from desktop DOM.
- [x] Accessibility, busy, recovery, and keyboard behavior remain covered.

**Verification:** Mobile form/model/viewport/accessibility/composition tests; standard gates.

**Dependencies:** Task 13.
**Files likely touched:** Four primary modules, consumers, tests.
**Estimated scope:** Medium.

## Task 15: Place mobile screens and launcher

**Description:** Move create/edit screens and mobile create launcher after their foundation.

**Acceptance criteria:**
- [x] Screens and launcher have canonical mobile UI paths.
- [x] Create/edit/retry and renderer selection remain unchanged.
- [x] No forwarding root module remains.

**Verification:** Mobile create/edit/composition/recovery/lifecycle tests; full CI; real-mobile acceptance.

**Dependencies:** Task 14.
**Files likely touched:** Three primary modules, consumers, tests.
**Estimated scope:** Medium.

## Checkpoint: Scheduled Item

- [x] Tasks 12–15 pass full CI (302 tests, build, artifacts, and docs).
- [x] Scheduled Item UI and Active Note management have no active root modules.
- [ ] Golden/no-op automated coverage passes; desktop/real-mobile runtime acceptance remains pending.

## Task 16: Place Moment domain text and target modules

**Description:** Move pure Moment text, Markdown, target, and folder normalization.

**Acceptance criteria:**
- [x] Four modules live in Moment domain and remain Obsidian/DOM-free.
- [x] Timestamps, links, folders, and targets are unchanged.
- [x] No cross-feature private import is introduced.

**Verification:** Inbox text/link/folder/target/submission tests; standard gates; output comparison.

**Dependencies:** Tasks 3 and 7.
**Files likely touched:** Four primary modules, consumers, tests.
**Estimated scope:** Medium.

## Task 17: Place Moment suggestions and submission policy

**Description:** Move rich-text, suggestion, controller, input-selection, and concurrency policy to correct Moment layers without decomposing them.

**Acceptance criteria:**
- [x] Pure rich text is domain; orchestration is application; Obsidian input/controller code is UI.
- [x] `SubmissionPolicy` is Moment application.
- [x] Caching, mentions, object creation, input events, and idempotency are unchanged.

**Verification:** Rich-text/suggestion/mention/selection/submission tests; standard gates; no extra scan/index rebuild.

**Dependencies:** Tasks 5, 10, 16.
**Files likely touched:** Five primary modules, consumers, tests.
**Estimated scope:** Medium.

## Task 18: Place Moment desktop UI

**Description:** Move desktop form and modal shell without renaming `EventTask*` symbols.

**Acceptance criteria:**
- [x] Both modules live in Moment desktop UI.
- [x] Moment submission and Event/Task tab delegation remain unchanged.
- [x] Removed legacy Event/Task form paths stay unreachable.

**Verification:** Inbox/desktop/legacy-retirement/submission tests; full CI; desktop smoke test.

**Dependencies:** Task 17.
**Files likely touched:** `InboxDesktopForm`, `EventTaskModal`, consumers/tests.
**Estimated scope:** Small/Medium.

## Task 19: Place Moment mobile UI

**Description:** Move mobile form and screen while retaining independent lifecycle.

**Acceptance criteria:**
- [x] Both modules live in Moment mobile UI.
- [x] Mount/cleanup, keyboard behavior, and delegation remain unchanged.
- [x] Mobile imports no desktop UI.

**Verification:** Mobile Moment/viewport/composition/lifecycle/submission tests; full CI; real-mobile smoke test.

**Dependencies:** Task 18.
**Files likely touched:** `InboxMobileForm`, `EventTaskMobileScreen`, consumers/tests.
**Estimated scope:** Small/Medium.

## Task 20: Place shared capture routing and form state

**Description:** Move cross-kind state and launch/editor orchestration after renderer paths stabilize.

**Acceptance criteria:**
- [x] `EventTaskFormState` is capture domain.
- [x] `EventTaskCaptureLauncher` and `ScheduledItemEditor` have capture UI/orchestration ownership.
- [x] No launcher/renderer cycle; every command, Timeline, and Active Note route resolves.

**Verification:** Form-state/launcher/mobile-selection/editor tests; standard gates.

**Dependencies:** Tasks 15 and 19.
**Files likely touched:** Three primary modules, consumers, tests.
**Estimated scope:** Medium.

## Checkpoint: Capture ownership

- [x] Tasks 16–20 pass full CI.
- [x] Moment/shared capture has no active root modules.
- [x] Renderer lifecycle, primary writes, retries, and Markdown remain unchanged.

## Task 21: Finish remaining Obsidian adapter ownership

**Description:** Place every remaining root adapter under capability-based Obsidian infrastructure in multiple small commits.

**Acceptance criteria:**
- [x] All root adapters have explicit capture/focus/suggestion/vault ownership.
- [x] Domain/application code reaches concrete Obsidian only through intended boundaries.
- [x] No generic `utils`, `services`, or root adapter appears.

**Verification:** Writer/resolver/vault/suggestion tests; standard gates; security review of paths/untrusted input.

**Dependencies:** Tasks 7, 17, 20.
**Files likely touched:** Migration-inventory adapters, ≤5 primary moves per commit, consumers/tests.
**Estimated scope:** Multiple Small/Medium commits.

## Task 22: Move plugin composition behind main

**Description:** Leave `main.ts` as stable entry and place plugin class/registration under `plugin/`.

**Acceptance criteria:**
- [x] `main.ts` only loads/exports the plugin entry.
- [x] Commands, ribbons, views, settings, lifecycle, and IDs are unchanged.
- [x] Plugin depends on feature entry points; features never depend on plugin.

**Verification:** Compatibility/architecture tests, full CI, artifact inspection, desktop command/ribbon/view smoke test.

**Dependencies:** Task 21.
**Files likely touched:** `main.ts`, `plugin/FocusNotesPlugin.ts`, up to two registration modules, compatibility test.
**Estimated scope:** Medium, 3–5 primary files.

## Task 23: Enforce final root and dependency invariants

**Description:** Close the migration ledger and make temporary rules permanent.

**Acceptance criteria:**
- [x] `main.ts` is the only root TypeScript file.
- [x] Legacy isolation, domain purity, shared independence, direction, and no-cycle rules pass.
- [x] No shim, empty directory, dead production import, or undocumented inter-feature edge remains.

**Verification:** Architecture mutation checks, unused/dead scan, full CI, audit, `git diff --check`.

**Dependencies:** Task 22.
**Files likely touched:** Architecture test and baseline documentation.
**Estimated scope:** Small.

## Checkpoint: Physical organization complete

- [x] Tasks 21–23 pass full CI; root contains only `main.ts`.
- [ ] Tests enforce the actual tree and human approves the ownership map.

## Task 24: Split Reflection reference data from its API

**Description:** Characterize then split the 1,238-line Mood reference module into cohesive static datasets and a small typed API.

**Acceptance criteria:**
- [x] Representative, boundary, and unknown values have characterization coverage first.
- [x] Data modules are cohesive; lookup API and serialized labels remain unchanged.
- [x] No duplicate dataset, runtime work, or shim remains.

**Verification:** Focused RED/GREEN evidence, Reflection/writer tests, full CI, output comparison.

**Dependencies:** Tasks 6 and 23.
**Files likely touched:** Mood API, up to three data modules, focused test.
**Estimated scope:** Medium, 3–5 files.

## Task 25: Decompose the Moment suggestion controller

**Description:** Separate candidate orchestration, rendering, and input lifecycle from the 554-line controller.

**Acceptance criteria:**
- [x] Missing boundaries receive failing characterization tests before extraction.
- [x] Controller retains only Obsidian lifecycle/composition with narrow collaborators.
- [x] Caching, mentions, creation, and input behavior stay unchanged without extra scans.

**Verification:** Suggestion/mention/object/selection tests, full CI, performance inspection.

**Dependencies:** Tasks 17 and 23.
**Files likely touched:** Controller, up to three collaborators, focused tests.
**Estimated scope:** Medium batches, each 3–5 files.

## Task 26: Decompose desktop Scheduled Item form

**Description:** Extract cohesive desktop sections behind characterization coverage.

**Acceptance criteria:**
- [x] Shell owns composition/state; sections receive narrow inputs/callbacks.
- [x] Create/edit parity, disclosure, validation, and accessibility remain unchanged.
- [x] No mobile DOM or persistence enters presentation modules.

**Verification:** Focused RED tests, desktop/model/validation/submission tests, full CI, desktop smoke test.

**Dependencies:** Tasks 13 and 23.
**Files likely touched:** Desktop form, up to three section modules, focused tests.
**Estimated scope:** Medium batches.

## Task 27: Decompose mobile Scheduled Item form

**Description:** Extract cohesive mobile sections while preserving independent lifecycle and viewport behavior.

**Acceptance criteria:**
- [x] Shell owns lifecycle/composition; sections use narrow state/callback contracts.
- [x] Busy/recovery/accessibility/suggestions/viewport behavior remains unchanged.
- [x] Mobile has no desktop DOM dependency.

**Verification:** Focused RED tests, mobile/lifecycle/viewport/recovery tests, full CI, keyboard-open/closed acceptance.

**Dependencies:** Tasks 15 and 23.
**Files likely touched:** Mobile form, up to three section modules, focused tests.
**Estimated scope:** Medium batches.

## Task 28: Final review, documentation, and acceptance

**Description:** Close correctness, readability, architecture, security, performance, documentation, audit, and runtime evidence.

**Acceptance criteria:**
- [x] No Critical/Required finding remains; optional findings have owners/disposition.
- [x] Architecture, legacy rationale, dependency advisory disposition, and test evidence are current.
- [x] Desktop/mobile acceptance is completed or explicitly waived with retained risk (waived by user on 2026-08-30;
      desktop Event targeting defect and untested real-mobile paths remain recorded).

**Verification:** `$env:OBSIDIAN_VAULT_PLUGIN_PATH=""; pnpm run check:ci`; audit; record artifacts, runtime evidence, and human approval.

**Dependencies:** Tasks 23–27.
**Files likely touched:** Architecture/status docs, this plan/task list, optional evidence note.
**Estimated scope:** Medium, documentation/verification.

## Checkpoint: Complete

- [x] `src/main.ts` is the only root TypeScript module.
- [x] Tests pass with none skipped and no unexplained count decrease.
- [x] Build, artifacts, docs, advisory disposition, and runtime acceptance disposition are recorded; remaining runtime
      checks were explicitly waived rather than reported as passing.
- [x] No unowned shim, dead production import, empty directory, or Required finding remains.
- [x] Human approves the final structure and requested continuation to Task 29 on 2026-08-30.

## Checkpoint: Before Scheduled Item behavior work

- [x] Task 28 desktop/mobile runtime acceptance is complete or its waiver and risk are explicitly recorded.
- [x] Human approves `docs/spec-scheduled-item-timebox-focus-integration.md` and `tasks/scheduled-item-timebox-focus-plan.md`.
- [x] Existing Markdown/settings compatibility fixtures are green before changing any grammar.

## Task 29: Characterize identity, temporal, and legacy contracts

**Description:** Add failing-first contract coverage for canonical IDs, current Event/Task parsing, the legacy single Task timebox, and current free-text Focus logs before introducing the new model.

**Acceptance criteria:**
- [x] Initial fixtures preserve same-title Event/Task identity, one cross-day legacy Task timebox, free-text Focus purpose,
      canonical block ID, and local-time behavior.
- [x] New tests describe canonical/reference classification and separate item/timebox/session identities.
- [x] No production behavior or Markdown output changes in this characterization slice.

**Verification:** Focused parser/writer/index tests; `pnpm run check:ci`; `git diff --check`.

**Dependencies:** Task 28.
**Files likely touched:** Up to four focused test/fixture files and spec traceability notes.
**Estimated scope:** Medium, 3–5 files.

## Task 30: Establish canonical and reference identity lookup

**Description:** Introduce pure identity/reference contracts and an index that resolves Event/Task references to exactly one canonical block while excluding derived references from canonical counts.

**Acceptance criteria:**
- [x] Item, timebox, session, and reference block IDs cannot collide by construction.
- [x] References resolve by stable identity rather than title or current file path.
- [x] Duplicate or missing canonical identities produce explicit ambiguous/orphan results.

**Verification:** RED/GREEN identity and index tests; typecheck; full CI.

**Dependencies:** Task 29.
**Files likely touched:** Scheduled Item identity domain, mention/index application module, focused tests.
**Estimated scope:** Medium, 3–5 files.

## Task 31: Correct Event capture target semantics

**Description:** Make ordinary desktop/mobile Event Capture honor its configured Periodical profile, heading, and position, and keep Save to file synchronized with Planned Start until manually overridden.

**Acceptance criteria:**
- [x] Ambient active note never replaces the configured Event target; explicit contextual target still wins.
- [x] Event insert position always comes from Event Capture settings.
- [x] Planned Start recalculates automatic target while a manual target remains stable.

**Verification:** Focused target/state tests, desktop/mobile form contract tests, full CI, manual target preview check.

**Dependencies:** Tasks 29–30.
**Files likely touched:** Capture target policy, desktop/mobile launch/form adapters, focused tests.
**Estimated scope:** Medium batches, each no more than 5 files.

## Task 32: Project multi-day Events without canonical duplication

**Description:** Write one canonical Event and idempotent reference entries for every touched local day, then resolve edits from those references back to canonical state.

**Acceptance criteria:**
- [x] Same-day Event has one representation; cross-day Event has one canonical plus dated references with unique block IDs.
- [x] Date edits add/remove references without changing `itemId` or duplicating canonical records.
- [x] Partial reference failure retains canonical success and retries failed destinations only.

**Verification:** Projection boundary/DST tests, writer round trips, retry tests, full CI.

**Dependencies:** Tasks 30–31.
**Files likely touched:** Event projection domain/service, writer adapter, focused tests.
**Estimated scope:** Medium batches.

## Task 33: Introduce multiple Task timebox grammar and migration

**Description:** Add identified child-timebox parsing/formatting and lossless dual-read migration from the existing single-line `start`/`end` Task fields.

**Acceptance criteria:**
- [x] One Task supports zero or many independently identified timeboxes while retaining checkbox syntax.
- [x] Existing single-timebox Tasks parse unchanged and migrate idempotently to one child timebox.
- [x] Invalid/incomplete/duplicate timebox identities fail explicitly without corrupting the Task.

**Verification:** RED/GREEN grammar, validation, compatibility, and round-trip fixtures; full CI.

**Dependencies:** Tasks 29–30.
**Files likely touched:** Task/timebox domain grammar, migration module, focused tests.
**Estimated scope:** Medium, 3–5 files.

## Task 34: Implement canonical timebox operations

**Description:** Provide one application service for add, edit, complete, skip, cancel, and safe delete with canonical-first results suitable for every UI.

**Acceptance criteria:**
- [x] Editing dates preserves `timeboxId`; end-before-start is rejected.
- [x] Same-Task overlap and after-due cases return warnings without silent rewrites.
- [x] Completing a Task cancels future planned timeboxes and preserves historical sessions.

**Verification:** Pure service tests for every transition and failure; full CI.

**Dependencies:** Task 33.
**Files likely touched:** Timebox application/domain service and focused tests.
**Estimated scope:** Small/Medium, 2–4 files.

## Task 35: Add desktop Timebox Manager modal

**Description:** Deliver desktop list/editor flows over the Task 34 service, including direct selection when opened from a timebox context.

**Acceptance criteria:**
- [x] Users can list, add, edit, change status, and safely delete with clear validation/warnings.
- [~] Create/Edit Task, Timeline, Active Note Manager, and Task context can open the modal — Edit Task
      wired now; Timeline (Task 38) and Active Note Manager (Task 39) entry points land with those tasks.
- [x] UI performs no direct vault mutation and preserves IDs on edit.

**Verification:** Desktop presentation tests, focused manual modal acceptance, full CI.

**Dependencies:** Task 34.
**Files likely touched:** Desktop modal, presenter/section, composition entry, focused tests.
**Estimated scope:** Medium, 3–5 files.

## Task 36: Add mobile Timebox Manager screen

**Description:** Deliver an equivalent mobile full-screen list/editor flow using the same Task 34 service without depending on desktop DOM.

**Acceptance criteria:**
- [x] Mobile exposes the same operations, validation, warnings, and selected-timebox behavior.
- [x] Keyboard/viewport lifecycle remains stable and cleanup is deterministic.
- [x] No desktop UI module is imported.

**Verification:** Mobile lifecycle/viewport tests, real-device acceptance, full CI.

**Dependencies:** Task 34.
**Files likely touched:** Mobile screen, sections, composition entry, focused tests.
**Estimated scope:** Medium, 3–5 files.

## Task 37: Project Task due dates and timeboxes into Daily Notes

**Description:** Create derived checkbox references for each Task due day and every local day touched by each timebox, with semantic-role deduplication.

**Acceptance criteria:**
- [x] Task without due/timebox has no projection; due-only Task has one due reference.
- [x] Each timebox day reference carries `taskId`, `timeboxId`, occurrence date, and unique reference block ID.
- [x] Due plus timebox on one day remains one Task in indexes while retaining both roles.

**Verification:** Projection calculation, Markdown classification, writer/retry, and local-boundary tests; full CI.

**Dependencies:** Tasks 30, 33–34.
**Files likely touched:** Task projection domain/service, writer adapter, focused tests.
**Estimated scope:** Medium batches.

## Task 38: Render Event and timebox intervals as Timeline segments

**Description:** Normalize canonical/projection data so Timeline expands cross-day Event/timebox intervals into per-day segments without duplicate items.

**Acceptance criteria:**
- [x] Segment identity is stable by `itemId` and optional `timeboxId` across every day.
- [x] Cross-midnight boundaries render correct local-day portions.
- [x] Clicking any segment retains canonical navigation and selected-timebox context.

Also fixed during this task: `ScheduledItemParser` was indexing Task 32/37's `event-ref-*`/`task-ref-*`
Daily reference lines as bogus second canonical items (their header intentionally mirrors the
canonical shape). Parser now classifies and skips reference block ids before parsing.

**Verification:** Timeline query/layout/navigation tests, representative performance check, full CI.

**Dependencies:** Tasks 32 and 37.
**Files likely touched:** Timeline projection/query modules, view adapter, focused tests.
**Estimated scope:** Medium, 3–5 files.

## Task 39: Manage Scheduled Items from canonical or reference notes

**Description:** Teach Active Note Manager to display references as their canonical Event/Task and route edit/navigation through stable identity.

**Acceptance criteria:**
- [x] Manager labels canonical versus referenced context without exposing duplicate editable records.
- [x] Save from any reference changes the canonical block then reconciles affected projections.
- [x] Orphan/ambiguous references are visible and cannot create accidental canonicals.

**Verification:** Manager scan/resolution/edit tests, desktop/mobile acceptance, full CI.

**Dependencies:** Tasks 30, 32, and 37.
**Files likely touched:** Active Note manager application/UI adapters and focused tests.
**Estimated scope:** Medium, 3–5 files.

## Task 40: Synchronize Task reference checkbox completion

**Description:** Treat a user checkbox change on a Task reference as a canonical completion command, then converge all references without watcher loops.

**Acceptance criteria:**
- [x] Canonical Task is written before projection status and partial failures remain retryable.
- [x] Plugin-authored writes cannot trigger an infinite propagation loop.
- [x] Concurrent stale/orphan reference changes produce deterministic visible outcomes.

**Verification:** RED/GREEN propagation, suppression, partial-failure, and convergence tests; full CI.

Note: the live `vault.on("modify")` watcher itself (`TaskReferenceCheckboxWatcher`) can only be
covered by source characterization tests in this repo's Obsidian-free `node:test` setup (any file
importing `EventTaskWriter` pulls in real Obsidian runtime values). Every pure decision (toggle
detection, canonical completion, suppression windowing, forced reference rewrite on completion
change) has direct behavioral tests. This is the one piece of this whole initiative that most
needs real desktop/mobile runtime verification before shipping.

**Dependencies:** Tasks 34, 37, and 39.
**Files likely touched:** Sync application service, vault watcher adapter, focused tests.
**Estimated scope:** Medium, 3–5 files.

## Task 41: Add owned Focus Session model with legacy compatibility

**Description:** Add stable `sessionId` and typed Event/Task ownership while continuing to parse existing free-text Focus logs as legacy/unassigned.

**Acceptance criteria:**
- [x] New Task sessions require `timeboxId`; Event sessions attach directly to `itemId`.
- [x] Planned timebox and actual Focus Session timestamps/durations remain separate.
- [x] Legacy logs remain readable and no ownership is guessed from title text.

Scoped to the model/grammar per this task's own file list: the legacy `SessionRecord`/`NoteWriter`/
`LogModal` write pipeline is untouched. Wiring the owned model into Timer's actual write path is
Tasks 42–43's job.

**Verification:** Session model/parser/migration tests, existing writer/reader fixtures, full CI.

**Dependencies:** Tasks 30 and 33.
**Files likely touched:** Focus Session domain model, parser/adapter, migration helper, focused tests.
**Estimated scope:** Medium, 3–5 files.

## Task 42: Require purpose selection before Timer starts

**Description:** Replace free-text-only Timer intent with a fast Event/Task selector, Task timebox selection, and explicit Quick-create Task/timebox flow.

**Acceptance criteria:**
- [x] New Timer session cannot start without a resolvable owner and, for Task, a timebox.
- [x] Missing Task timebox offers explicit creation; nothing is created silently.
- [x] Quick-create failure leaves Timer idle and cannot create an unowned session.

**Verification:** Timer workflow/state/UI tests, desktop/mobile selection acceptance, full CI.

**Dependencies:** Tasks 34–36 and 41.
**Files likely touched:** Timer controls/workflow, purpose selector, composition adapter, focused tests.
**Estimated scope:** Medium batches.

## Task 43: Store canonical Focus history and Daily projections

**Description:** Write actual Focus Sessions under their canonical Event or Task timebox and write the configured Focus timeline entry as a derived reference.

**Acceptance criteria:**
- [x] Multiple sessions may belong to one timebox with distinct `sessionId` values.
- [x] Pause/resume remains one session; later Timer runs create new sessions.
- [x] Daily log projection resolves to canonical context and partial failure retries without duplicating history.

**Verification:** Writer/parser round trips, Timer stop/log integration, retry tests, full CI.

**Dependencies:** Tasks 32, 37, 41–42.
**Files likely touched:** Focus history service, canonical/daily writer adapters, focused tests.
**Estimated scope:** Medium batches.

## Task 44: Show planned versus actual focus utilization

**Description:** Extend Timeline presentation to show planned Event/timebox intervals alongside actual Focus Sessions without conflating completion states.

**Acceptance criteria:**
- [x] Timeline can display multiple actual sessions within one timebox and calculate focused/planned duration.
- [x] Session, timebox, and Task completion remain distinct actions and labels.
- [x] Navigation from actual segment reaches session plus owning Scheduled Item context.

**Verification:** Timeline model/layout/action tests, performance check, desktop/mobile acceptance, full CI.

**Dependencies:** Tasks 38 and 43.
**Files likely touched:** Timeline utilization domain/presentation, action adapter, focused tests.
**Estimated scope:** Medium, 3–5 files.

## Task 45: Add projection reconciliation and recovery

**Description:** Provide idempotent rebuild, failed-write retry, orphan reporting, and stale-reference cleanup across Event, Task, timebox, and Focus projections.

**Acceptance criteria:**
- [x] Rebuild derives expected references exclusively from canonical records and never duplicates them.
- [x] Missing, stale, ambiguous, and orphan cases have explicit reports and safe repair actions.
- [x] Repeated retry/rebuild converges to the same Markdown state.

**Verification:** Fault-injection, idempotency, stale/orphan, and multi-file recovery tests; full CI.

**Dependencies:** Tasks 32, 37, 40, and 43.
**Files likely touched:** Reconciliation service, recovery command/adapter, report UI, focused tests.
**Estimated scope:** Medium batches.

## Task 46: Complete integrated documentation and acceptance

**Description:** Close spec traceability, migration/user/developer documentation, full automated evidence, and repeatable desktop/real-mobile runtime scenarios.

**Acceptance criteria:**
- [x] Every approved success criterion maps to automated or recorded runtime evidence. (Automated evidence complete and traced in the spec; real desktop/mobile device acceptance is explicitly flagged as not yet performed — see spec Traceability section.)
- [x] Migration, legacy/unassigned handling, recovery, and known limitations are documented.
- [x] No Critical/Required finding remains across correctness, architecture, security, performance, and UX review. (Self-review found and fixed one Critical correctness bug — nested focus-session lines could be misattributed or dropped when editing/reordering/deleting Task timeboxes — plus a related delete-confirmation gap; both fixed with regression tests. See commit history for detail.)

**Verification:** `$env:OBSIDIAN_VAULT_PLUGIN_PATH=""; pnpm run check:ci`; audit disposition; desktop/mobile acceptance record; human approval.

**Dependencies:** Tasks 29–45.
**Files likely touched:** Status/spec/user/developer docs and acceptance evidence.
**Estimated scope:** Medium documentation/verification batches.

## Checkpoint: Integrated planning and focus model complete

- [ ] One canonical source and all stable identity invariants hold.
- [ ] Event/Task settings, projections, management, and Timeline behavior match the approved spec.
- [ ] Multiple Task timeboxes and purposeful Focus Sessions work on desktop and mobile.
- [ ] Legacy content remains readable; migration and rebuild are idempotent.
- [ ] Human approves integrated runtime behavior.

---

# Initiative: Flat Capture, Focus, and Reflection

Approved sources: `CAPABILITY-MAP-capture-focus-reflection.md` and the five `SPEC-*.md` module specs at repository root.

## Task 47: Characterize the approved flat grammar

**Description:** Add failing-first fixtures for the approved Moment/Event/Task examples, singleton child cardinality,
canonical ordering, direct Task Focus Sessions, and the current WIP shapes that must be replaced.

**Acceptance criteria:**
- [x] Fixtures cover every approved keyed child prefix.
- [x] Tests distinguish Task sibling sessions from the former nested-under-timebox shape.
- [x] Unknown children, Markdown links, CRLF, stable IDs, and duplicate singleton failures are pinned.

**Verification:** Run focused new grammar tests and confirm failures are limited to not-yet-implemented behavior.

**Dependencies:** Approved specs.
**Files likely touched:** `test/flat-block-grammar.test.ts`, `test/scheduled-item-block-editor.test.ts`, up to two fixtures.
**Estimated scope:** Medium, 2–4 files.

## Task 48: Implement Description and Reflection line primitives

**Description:** Implement pure keyed line parsing/formatting and one-line normalization for Description, Reflection
wellbeing, and optional Reflection Notes.

**Acceptance criteria:**
- [x] Each prefix round-trips its canonical form and preserves inline Markdown.
- [x] Reflection and Reflection Notes are independently optional singleton values.
- [x] Invalid wellbeing values follow the approved tolerant contract.

**Verification:** Focused primitive tests; format, lint, and typecheck.

**Dependencies:** Task 47.
**Files likely touched:** `ReflectionBlockLine.ts`, one shared child-line module, and two focused tests.
**Estimated scope:** Medium, 3–4 files.

## Task 49: Convert Timebox and Focus Session keyed prefixes

**Description:** Change canonical single-line grammar from `timebox |`/`focus-session |` to
`timebox:`/`focus-session:` while preserving structured fields and stable IDs.

**Acceptance criteria:**
- [x] Writers emit approved prefixes and field order.
- [x] Parsers reject missing IDs and malformed structured fields explicitly.
- [x] Duration, mode, status, and local-time semantics remain unchanged.

**Verification:** Timebox/Focus line round-trip tests; typecheck; focused compatibility review.

**Dependencies:** Tasks 47–48.
**Files likely touched:** `TaskTimeboxLine.ts`, `FocusSessionLine.ts`, and their two test files.
**Estimated scope:** Medium, 4 files.

## Task 50: Rebuild Scheduled Item block ownership and ordering

**Description:** Make the whole-block parser/editor own keyed Description, Timeboxes, direct Focus Sessions, Reflection,
Reflection Notes, and Detail in canonical order without disturbing unknown subtrees.

**Acceptance criteria:**
- [x] Event and Task child order matches the spec after write/edit.
- [x] Task Focus Sessions are direct children and never Timebox descendants.
- [x] No-op, unknown-child, duplicate, CRLF, and stable-ID behavior remains deterministic.

**Verification:** Scheduled Item block/editor/persistence tests; full `pnpm run check` checkpoint.

**Dependencies:** Tasks 48–49.
**Files likely touched:** `ScheduledItemBlockEditor.ts`, form adapter, persistence result type, focused tests.
**Estimated scope:** Medium, 4–5 files.

## Checkpoint: Flat grammar foundation

- [ ] Canonical Event/Task examples round-trip byte-identically.
- [ ] Direct Task Focus Session ownership parses independently of Timeboxes.
- [ ] `$env:OBSIDIAN_VAULT_PLUGIN_PATH=""; pnpm run check:ci` passes.
- [ ] Human reviews representative formatted Markdown.

## Task 51: Give Moment canonical identity and a flat block

**Description:** Add stable `moment-*` identity and parse/format a Moment block containing optional Description and
Reflection sibling lines.

**Acceptance criteria:**
- [x] Newly captured Moments receive stable unique block IDs.
- [x] Moment blocks parse Description/Reflection without Event/Task classification.
- [x] Formatting preserves timestamp, title, inline links, and canonical order.

**Verification:** Moment identity, Markdown round-trip, writer, and classification tests.

**Dependencies:** Task 50.
**Files likely touched:** Moment record/Markdown modules, block-ID classifier, writer adapter, focused test.
**Estimated scope:** Medium, 4–5 files.

## Task 52: Remove the Task Timebox requirement from Focus ownership

**Description:** Simplify Focus ownership to Event/Task item identity and make an existing Task immediately ready in the
Timer purpose selector without selecting or creating a Timebox.

**Acceptance criteria:**
- [x] `FocusSessionOwner` contains kind and itemId only.
- [x] Event and Task selections satisfy the Timer start gate directly.
- [ ] Explicit Quick-create Task creates/selects an owner without creating a Timebox.

**Verification:** Owner-model, purpose-gate, purpose-selection, and Quick-create tests.

**Dependencies:** Task 50.
**Files likely touched:** owner domain, Timer purpose domain/controller, Timer controls UI, focused tests.
**Estimated scope:** Medium, 4–5 files.

## Task 53: Append and scan Focus Sessions directly under canonical items

**Description:** Update canonical append/edit/scan and Obsidian persistence so Event and Task use itemId as the session
anchor, preserving retry idempotency and daily/weekly canonical links.

**Acceptance criteria:**
- [x] Event and Task append `focus-session:` as a direct child in the correct region.
- [x] Multiple sessions retain owner item and independent session IDs.
- [x] Retry, orphan, and edit behavior never duplicates or changes actual timing.

**Verification:** Canonical append/edit/scan/writer and Timer logging integration tests; full checkpoint gate.

**Dependencies:** Tasks 49–52.
**Files likely touched:** canonical append, block scan, canonical writer, Timer log workflow, focused tests.
**Estimated scope:** Medium, 5 files plus mechanical test updates.

## Checkpoint: Canonical Moment and direct Focus ownership

- [ ] Moment has stable canonical identity.
- [ ] Existing Event or Task can start and record Focus without a Timebox.
- [ ] Multiple Timeboxes and Focus Sessions coexist as siblings.
- [ ] `$env:OBSIDIAN_VAULT_PLUGIN_PATH=""; pnpm run check:ci` passes.

## Task 54: Establish the shared Reflection form contract

**Description:** Replace Task-only WIP fields with one semantic Reflection value shared by Moment/Event/Task/Focus Session
adapters while keeping Description and Reflection Notes independent.

**Acceptance criteria:**
- [x] Form data represents none, wellbeing-only, notes-only, and both.
- [x] Hydration/submission maps to sibling keyed lines without owner-line metadata.
- [x] Clearing either component preserves the other.

**Verification:** Form-data/adapter tests and pure Reflection round trips.

**Dependencies:** Tasks 48, 50–53.
**Files likely touched:** Reflection form type, Scheduled Item form data/adapter, Focus edit adapter, focused tests.
**Estimated scope:** Medium, 4–5 files.

## Task 55: Integrate desktop Event and Task management

**Description:** Render owner Reflection, separate Timeboxes and Focus Sessions, and canonical ordering in desktop Create/Edit
and Manage flows using Task 54.

**Acceptance criteria:**
- [x] Event and Task create, hydrate, edit, and clear Reflection independently of Description.
- [x] Task presents separate planned Timebox and actual Focus Session sections.
- [x] Event presents actual Focus Sessions and owner Reflection; Detail remains last.

**Verification:** Desktop structure/composition tests and manual modal smoke test.

**Dependencies:** Task 54.
**Files likely touched:** desktop form shell, Reflection section, Focus section, edit modal, focused test.
**Estimated scope:** Medium, 4–5 files.

## Task 56: Integrate mobile Event and Task management

**Description:** Deliver Task 55 semantics in the independent mobile renderer without desktop DOM dependencies.

**Acceptance criteria:**
- [x] Mobile exposes equivalent owner Reflection and separate planned/actual sections.
- [x] Keyboard, scrolling, busy state, and cleanup remain stable.
- [x] No desktop UI module is imported.

**Verification:** Mobile structure/lifecycle/viewport tests and manual keyboard-open/closed smoke test.

**Dependencies:** Task 54.
**Files likely touched:** mobile form shell, Reflection section, Focus section, screen composition, focused test.
**Estimated scope:** Medium, 4–5 files.

## Task 57: Add canonical Moment persistence and editing

**Description:** Capture, locate, snapshot, and conflict-safely edit one stable Moment block using the shared Reflection
contract without routing it through Scheduled Item semantics.

**Acceptance criteria:**
- [x] Moment create and edit persist approved keyed lines and stable identity.
- [x] Exact block resolution rejects orphan/ambiguous IDs.
- [x] No-op and unknown-child content remain unchanged.

**Verification:** Moment writer/resolver/editor integration tests.

**Dependencies:** Tasks 51 and 54.
**Files likely touched:** Moment writer, resolver/editor service, persistence adapter, focused tests.
**Estimated scope:** Medium, 4–5 files.

## Task 58: Add desktop Moment Reflection management

**Description:** Extend desktop Moment Capture/Edit with independent Description, wellbeing, and Reflection Notes fields over
Task 57 persistence.

**Acceptance criteria:**
- [ ] Desktop captures and edits all four Reflection states.
- [ ] Description and Reflection Notes have separate controllers and cleanup.
- [ ] Edit resolves the exact Moment block and surfaces conflicts.

**Verification:** Desktop Moment form/composition tests and manual edit smoke test.

**Dependencies:** Task 57.
**Files likely touched:** desktop Moment form/modal, Reflection section reuse, launcher/edit route, focused test.
**Estimated scope:** Medium, 4–5 files.

## Task 59: Add mobile Moment Reflection management

**Description:** Extend mobile Moment Capture/Edit with Task 58 semantics using mobile-specific layout and lifecycle.

**Acceptance criteria:**
- [ ] Mobile captures and edits all four Reflection states.
- [ ] Keyboard and viewport behavior remain stable.
- [ ] Mobile imports no desktop Moment UI.

**Verification:** Mobile Moment structure/lifecycle tests and real-device acceptance scenario.

**Dependencies:** Task 57.
**Files likely touched:** mobile Moment form/screen, Reflection section, launcher/edit route, focused test.
**Estimated scope:** Medium, 4–5 files.

## Checkpoint: Reflection capture and management

- [ ] Moment/Event/Task/Focus Session support none, wellbeing-only, notes-only, and both.
- [ ] Desktop and mobile produce equivalent canonical blocks.
- [ ] Description never includes Reflection or Focus history.
- [ ] `$env:OBSIDIAN_VAULT_PLUGIN_PATH=""; pnpm run check:ci` passes.

## Task 60: Extend explicit preview/apply formatting

**Description:** Convert current unreleased development shapes to keyed prefixes, direct Task Focus Sessions, and canonical
order through the existing explicit formatter.

**Acceptance criteria:**
- [ ] Preview shows every proposed block change before apply.
- [ ] Apply preserves stable IDs and converts nested Task sessions to siblings.
- [ ] A second format pass proposes no changes.

**Verification:** Formatter classification, golden output, ID-preservation, conflict, and idempotency tests.

**Dependencies:** Tasks 50–59.
**Files likely touched:** format classifier/preview, application service, manager UI wiring, golden fixture, test.
**Estimated scope:** Medium, 4–5 files.

## Task 61: Build the sibling-session Timeline read model

**Description:** Index direct Event/Task Focus Sessions independently from Timeboxes and derive one owner-level planned versus
focused summary without pairings.

**Acceptance criteria:**
- [ ] Sessions retain sessionId, owner itemId, actual interval, duration, and Reflection context.
- [ ] Task planned totals use non-cancelled Timeboxes; Event planned total uses its interval.
- [ ] Focus totals/counts are owner aggregates and work with zero planned time.

**Verification:** Index/query/summary tests for multiple, outside-plan, cancelled, and zero-plan cases.

**Dependencies:** Tasks 53 and 60.
**Files likely touched:** index projection, Timeline query/read model, summary domain module, focused tests.
**Estimated scope:** Medium, 4–5 files.

## Task 62: Render independent planned and actual Timeline segments

**Description:** Add actual Focus Session segments at recorded timestamps while retaining Timebox/Event planned segments and
distinct visual/interaction identities.

**Acceptance criteria:**
- [ ] Planned segments use planned styling and sessions use solid actual styling.
- [ ] Sessions outside or overlapping Timeboxes remain visible without inferred attribution.
- [ ] Cross-day clipping preserves timeboxId/sessionId identity.

**Verification:** Timeline layout/grid/style tests and representative Day/Weekly rendering smoke test.

**Dependencies:** Task 61.
**Files likely touched:** Timeline layout, grid renderer, styles, action contract, focused tests.
**Estimated scope:** Medium, 4–5 files.

## Task 63: Add Timeline tooltip and item-modal summaries

**Description:** Show compact selected-segment data on hover and complete owner summary plus selected segment details in
Timeline Item Modal.

**Acceptance criteria:**
- [ ] Timebox and Focus Session tooltips clearly say Planned or Focused.
- [ ] Clicking either opens the same owner modal with exact segment detail.
- [ ] Planned, focused, difference, percentage, and counts follow Task 61 rules.

**Verification:** Tooltip, modal model/UI, zero-plan, and action-route tests.

**Dependencies:** Task 62.
**Files likely touched:** tooltip/model, item modal model/UI, view wiring, focused tests.
**Estimated scope:** Medium, 4–5 files.

## Task 64: Reuse Timeline time summary in Manage

**Description:** Present Task 61 summary compactly above Event/Task management without creating a second calculation path.

**Acceptance criteria:**
- [ ] Event/Task Manage consumes the shared summary model.
- [ ] Summary updates after Timebox/session changes and agrees with Timeline.
- [ ] No summary value is written into canonical Markdown.

**Verification:** Manage summary wiring/presentation tests and canonical no-write assertion.

**Dependencies:** Tasks 55–56 and 61–63.
**Files likely touched:** summary presenter, desktop/mobile Manage sections, edit shell wiring, focused tests.
**Estimated scope:** Medium, 4–5 files.

## Checkpoint: Formatting and Timeline actual time

- [ ] Formatter converges and preserves IDs.
- [ ] Planned and actual segments remain independent and navigable.
- [ ] Timeline and Manage summaries agree and never persist.
- [ ] `$env:OBSIDIAN_VAULT_PLUGIN_PATH=""; pnpm run check:ci` passes.

## Pre-Task-65 gate: Fix Task creation regression

**Description:** Reproduce and repair the reported Task creation bug after Tasks 51–64, before documentation and runtime acceptance are closed.

**Acceptance criteria:**
- [ ] The user-reported Task creation path has a failing regression test before the fix.
- [ ] Desktop and mobile Task creation succeed without regressing canonical flat blocks.
- [ ] The fix passes the full automated checkpoint and targeted runtime reproduction.

**Dependencies:** Tasks 51–64 and concrete reproduction details.

## Task 65: Complete documentation and runtime acceptance

**Description:** Update user/developer documentation and record repeatable desktop/mobile evidence for flat capture,
Reflection, direct Focus ownership, explicit formatting, and Timeline summaries.

**Acceptance criteria:**
- [ ] Docs contain final syntax and remove the superseded timebox-owned session model.
- [ ] Automated evidence maps to every module success criterion.
- [ ] Desktop and real-mobile scenarios are recorded or explicitly waived with risk.

**Verification:** `pnpm run check:ci`; docs links; runtime record; final diff review.

**Dependencies:** Tasks 47–64.
**Files likely touched:** public/developer docs, status/acceptance docs, task/spec traceability.
**Estimated scope:** Medium documentation batch.

## Checkpoint: Flat capture, Focus, and Reflection complete

- [ ] Canonical grammar and stable identity invariants hold.
- [ ] Timeboxes and Focus Sessions are siblings everywhere.
- [ ] Reflection works for Moment/Event/Task/Focus Session on desktop and mobile.
- [ ] Actual Timeline segments and all derived summaries match canonical data.
- [ ] Explicit formatting is idempotent and no background migration exists.
- [ ] Human approves integrated runtime behavior.
