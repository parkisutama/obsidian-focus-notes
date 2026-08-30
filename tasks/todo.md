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

- [ ] Tasks 16–20 pass full CI.
- [ ] Moment/shared capture has no active root modules.
- [ ] Renderer lifecycle, primary writes, retries, and Markdown remain unchanged.

## Task 21: Finish remaining Obsidian adapter ownership

**Description:** Place every remaining root adapter under capability-based Obsidian infrastructure in multiple small commits.

**Acceptance criteria:**
- [ ] All root adapters have explicit capture/focus/suggestion/vault ownership.
- [ ] Domain/application code reaches concrete Obsidian only through intended boundaries.
- [ ] No generic `utils`, `services`, or root adapter appears.

**Verification:** Writer/resolver/vault/suggestion tests; standard gates; security review of paths/untrusted input.

**Dependencies:** Tasks 7, 17, 20.
**Files likely touched:** Migration-inventory adapters, ≤5 primary moves per commit, consumers/tests.
**Estimated scope:** Multiple Small/Medium commits.

## Task 22: Move plugin composition behind main

**Description:** Leave `main.ts` as stable entry and place plugin class/registration under `plugin/`.

**Acceptance criteria:**
- [ ] `main.ts` only loads/exports the plugin entry.
- [ ] Commands, ribbons, views, settings, lifecycle, and IDs are unchanged.
- [ ] Plugin depends on feature entry points; features never depend on plugin.

**Verification:** Compatibility/architecture tests, full CI, artifact inspection, desktop command/ribbon/view smoke test.

**Dependencies:** Task 21.
**Files likely touched:** `main.ts`, `plugin/FocusNotesPlugin.ts`, up to two registration modules, compatibility test.
**Estimated scope:** Medium, 3–5 primary files.

## Task 23: Enforce final root and dependency invariants

**Description:** Close the migration ledger and make temporary rules permanent.

**Acceptance criteria:**
- [ ] `main.ts` is the only root TypeScript file.
- [ ] Legacy isolation, domain purity, shared independence, direction, and no-cycle rules pass.
- [ ] No shim, empty directory, dead production import, or undocumented inter-feature edge remains.

**Verification:** Architecture mutation checks, unused/dead scan, full CI, audit, `git diff --check`.

**Dependencies:** Task 22.
**Files likely touched:** Architecture test and baseline documentation.
**Estimated scope:** Small.

## Checkpoint: Physical organization complete

- [ ] Tasks 21–23 pass full CI; root contains only `main.ts`.
- [ ] Tests enforce the actual tree and human approves the ownership map.

## Task 24: Split Reflection reference data from its API

**Description:** Characterize then split the 1,238-line Mood reference module into cohesive static datasets and a small typed API.

**Acceptance criteria:**
- [ ] Representative, boundary, and unknown values have characterization coverage first.
- [ ] Data modules are cohesive; lookup API and serialized labels remain unchanged.
- [ ] No duplicate dataset, runtime work, or shim remains.

**Verification:** Focused RED/GREEN evidence, Reflection/writer tests, full CI, output comparison.

**Dependencies:** Tasks 6 and 23.
**Files likely touched:** Mood API, up to three data modules, focused test.
**Estimated scope:** Medium, 3–5 files.

## Task 25: Decompose the Moment suggestion controller

**Description:** Separate candidate orchestration, rendering, and input lifecycle from the 554-line controller.

**Acceptance criteria:**
- [ ] Missing boundaries receive failing characterization tests before extraction.
- [ ] Controller retains only Obsidian lifecycle/composition with narrow collaborators.
- [ ] Caching, mentions, creation, and input behavior stay unchanged without extra scans.

**Verification:** Suggestion/mention/object/selection tests, full CI, performance inspection.

**Dependencies:** Tasks 17 and 23.
**Files likely touched:** Controller, up to three collaborators, focused tests.
**Estimated scope:** Medium batches, each 3–5 files.

## Task 26: Decompose desktop Scheduled Item form

**Description:** Extract cohesive desktop sections behind characterization coverage.

**Acceptance criteria:**
- [ ] Shell owns composition/state; sections receive narrow inputs/callbacks.
- [ ] Create/edit parity, disclosure, validation, and accessibility remain unchanged.
- [ ] No mobile DOM or persistence enters presentation modules.

**Verification:** Focused RED tests, desktop/model/validation/submission tests, full CI, desktop smoke test.

**Dependencies:** Tasks 13 and 23.
**Files likely touched:** Desktop form, up to three section modules, focused tests.
**Estimated scope:** Medium batches.

## Task 27: Decompose mobile Scheduled Item form

**Description:** Extract cohesive mobile sections while preserving independent lifecycle and viewport behavior.

**Acceptance criteria:**
- [ ] Shell owns lifecycle/composition; sections use narrow state/callback contracts.
- [ ] Busy/recovery/accessibility/suggestions/viewport behavior remains unchanged.
- [ ] Mobile has no desktop DOM dependency.

**Verification:** Focused RED tests, mobile/lifecycle/viewport/recovery tests, full CI, keyboard-open/closed acceptance.

**Dependencies:** Tasks 15 and 23.
**Files likely touched:** Mobile form, up to three section modules, focused tests.
**Estimated scope:** Medium batches.

## Task 28: Final review, documentation, and acceptance

**Description:** Close correctness, readability, architecture, security, performance, documentation, audit, and runtime evidence.

**Acceptance criteria:**
- [ ] No Critical/Required finding remains; optional findings have owners/disposition.
- [ ] Architecture, legacy rationale, dependency advisory disposition, and test evidence are current.
- [ ] Desktop/mobile acceptance covers settings, capture, Timer, Timeline, commands, ribbons, views, and retry.

**Verification:** `$env:OBSIDIAN_VAULT_PLUGIN_PATH=""; pnpm run check:ci`; audit; record artifacts, runtime evidence, and human approval.

**Dependencies:** Tasks 23–27.
**Files likely touched:** Architecture/status docs, this plan/task list, optional evidence note.
**Estimated scope:** Medium, documentation/verification.

## Checkpoint: Complete

- [ ] `src/main.ts` is the only root TypeScript module.
- [ ] Tests pass with none skipped and no unexplained count decrease.
- [ ] Build, artifacts, docs, advisory disposition, and runtime acceptance are complete.
- [ ] No unowned shim, dead production import, empty directory, or Required finding remains.
- [ ] Human approves the final structure.
