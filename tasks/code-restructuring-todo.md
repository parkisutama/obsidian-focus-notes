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
- [x] Pure helpers have no Obsidian/DOM imports; vault mutation remains separate pending its infrastructure cutover.
- [ ] Path normalization and folder creation retain current safety and behavior.

**Verification:**

- [ ] Run utility, daily-note, timeline layout/query, and writer tests.
- [ ] Add boundary cases for root/traversal/empty paths if absent.

**Dependencies:** Task 4.
**Estimated scope:** Multiple Small batches.

**Progress (2026-08-22):**

- [x] Pure date/time helpers moved to `features/timeline/domain/TimelineDate.ts`; all Timeline/query consumers cut over directly and the central shims were removed.
- [x] Obsidian file/folder type guards moved to `infrastructure/obsidian/ObsidianFileTypes.ts`; all consumers cut over and the central shims were removed.
- [ ] Vault folder creation remains in `utils.ts` for a separate security-sensitive increment.

## Checkpoint: Foundations

- [ ] Full CI passes.
- [ ] Foundational cycles are gone and no new cycle exists.
- [x] Central `types.ts` is removed; every remaining `utils.ts` export has a documented target owner for Task 6.

## Task 7: Establish the pure Scheduled Item domain

**Description:** Colocate Scheduled Item models, form data, parsing, block editing, validation, identity, and semantic adapters without changing APIs and output.

**Acceptance criteria:**

- [ ] Pure domain modules import neither Obsidian nor DOM/UI modules.
- [ ] Create and edit share one discriminated semantic contract.
- [ ] Parser accepts legacy inputs and no-op edits stay byte-identical.

**Verification:**

- [ ] Run all `scheduled-item-*`, Event/Task line, lifecycle, and Markdown compatibility tests.
- [ ] Compare golden fixtures byte for byte.

**Dependencies:** Tasks 5–6.
**Estimated scope:** Multiple Small/Medium batches.

## Task 8: Isolate capture persistence and external boundaries

**Description:** Define narrow application ports for vault reads/writes, target resolution, link resolution, suggestions, and related-log recovery; place Obsidian implementations in infrastructure.

**Acceptance criteria:**

- [ ] Domain/application policies can be tested without `App`, `Vault`, `TFile`, `Notice`, or DOM.
- [ ] External Markdown/settings/path input is validated before persistence.
- [ ] Primary-write receipt, stale-write conflict, no-op, and retry semantics remain unchanged.

**Verification:**

- [ ] Run block persistence, submission, related-write recovery, target, object-reference, and state-store tests.
- [ ] Add abuse cases for malformed/traversal paths and stale/ambiguous sources where coverage is missing.

**Dependencies:** Task 7.
**Estimated scope:** Multiple Medium batches.

## Task 9: Cut renderers over and retire proven legacy paths

**Description:** Make desktop/mobile create and edit shells depend on the shared application boundary, then delete legacy implementations only after every launcher is proven migrated.

**Acceptance criteria:**

- [ ] Desktop and mobile retain separate DOM, focus, keyboard, and lifecycle code.
- [ ] Moment remains independent while Event/Task use the unified Scheduled Item path.
- [ ] Legacy deletion occurs in its own commit with zero runtime imports.

**Verification:**

- [ ] Run desktop/mobile composition and legacy-retirement tests.
- [ ] Perform desktop and real-mobile create/edit/retry acceptance.

**Dependencies:** Task 8.
**Estimated scope:** Multiple Medium batches.

## Checkpoint: Capture boundary

- [ ] Full CI and byte-for-byte fixture comparison pass.
- [ ] No duplicate primary writes; retry repeats only failed secondary writes.
- [ ] All launchers and legacy status are documented.

## Task 10: Decompose Settings by category

**Description:** Keep navigation/composition in a thin shell and extract Periodical Notes, Object Sources, Focus Session, Capture, and Timeline renderers one at a time with narrow inputs.

**Acceptance criteria:**

- [ ] Each renderer receives only required settings/services, not the whole plugin without justification.
- [ ] Category order, copy, visibility, defaults, and save behavior are unchanged.
- [ ] One serialized persistence path remains authoritative.

**Verification:**

- [ ] Run settings layout, context source, inbox folder, and state-store tests after every category.
- [ ] Smoke-test navigation and saving in desktop Obsidian.

**Dependencies:** Foundation checkpoint; may follow capture work where shared settings types overlap.
**Estimated scope:** Five Small/Medium batches.

## Task 11: Decompose Timer

**Description:** Separate ItemView lifecycle, controls/presentation, target editor, recent entries, and completion/log orchestration.

**Acceptance criteria:**

- [ ] ItemView owns only Obsidian lifecycle and composition.
- [ ] TimerEngine remains pure and state transitions are unchanged.
- [ ] View ID, restoration, log Markdown, and interaction behavior remain stable.

**Verification:**

- [ ] Run TimerEngine, writer, related-log, and target tests.
- [ ] Smoke-test open/close/reopen, countdown/stopwatch, pause/resume, and completion logging.

**Dependencies:** Tasks 5–6.
**Estimated scope:** Multiple Medium batches.

## Task 12: Decompose Timeline

**Description:** Separate ItemView lifecycle and range state from indexing/query orchestration, navigation/sidebar, grid rendering, and modal launching.

**Acceptance criteria:**

- [ ] Query/layout/index logic remains pure or behind narrow ports.
- [ ] View ID/state, source classification, date ranges, and edit launching are unchanged.
- [ ] Refresh listeners are owned and cleaned up by the shell.

**Verification:**

- [ ] Run all timeline, Scheduled Item query/index, and modal model tests.
- [ ] Smoke-test open/close/reopen, navigation, refresh, filtering, and item editing.

**Dependencies:** Tasks 7–9 for shared Scheduled Item contracts.
**Estimated scope:** Multiple Medium batches.

## Task 13: Thin plugin composition and remove shims

**Description:** Extract command/view registration, remove completed compatibility re-exports and dead legacy files, and document the final actual structure.

**Acceptance criteria:**

- [ ] `main.ts` orchestrates lifecycle and composition without feature business logic.
- [ ] All command, ribbon, view, manifest, CSS, and console identifiers retain their values.
- [ ] No unowned shim, dead runtime import, or speculative empty folder remains.

**Verification:**

- [ ] Run full CI, artifact verification, dependency audit, import guard, and unused-export inspection.
- [ ] Complete command/ribbon/view restoration desktop smoke tests and capture mobile acceptance.

**Dependencies:** Tasks 9–12.
**Estimated scope:** Multiple Small batches.

## Checkpoint: Complete

- [ ] All compatibility invariants in the handover pass.
- [ ] Review across correctness, readability, architecture, security, and performance has no required findings.
- [ ] Actual architecture docs, shim ledger, advisory disposition, and manual acceptance evidence are current.
- [ ] Human approves any legacy deletion and the final structure.
