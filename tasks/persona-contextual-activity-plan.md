# Implementation Plan: Persona-Rooted Contextual Activity System

## Overview

Implement the smallest reliable loop from Daily Notes capture to contextual retrieval:

```text
capture Event or Task
    → insert portable contextual links
    → write distinct Markdown under Activities & Tasks
    → append self-contained historical logs
    → render the temporal record in Focus Timeline
    → open stable details and the source note
```

The work deliberately starts with submission and persistence safety. Related logs introduce multiple file writes; adding them before typed partial outcomes, concurrency guards, and writer coverage would make retries capable of duplicating the primary entry or historical logs. The plan therefore closes the directly blocking quality findings before adding product behavior.

The product direction is defined in [`docs/ideas/persona-rooted-contextual-activity-system.md`](../docs/ideas/persona-rooted-contextual-activity-system.md). This plan does not replace the implementation specifications required for each behavioral slice.

## Priority model

| Priority | Meaning | Outcome |
|---|---|---|
| P0 | Reliability prerequisite | Existing capture is safe enough to extend with secondary writes and settings migration |
| P1 | Core contextual capture | Event and Task can use extensible context suggestions and append historical logs |
| P2 | Temporal retrieval | Output is reliably visible and inspectable in Focus Timeline |
| P3 | Product hardening | Performance, migration, documentation, and real-device acceptance are release-ready |

## Architecture decisions

- `Persona` is the vault-facing term for a stable life responsibility and physical ownership root.
- Event and Task share the default `Activities & Tasks` heading but keep distinct Markdown formats, parser semantics, visual treatment, and lifecycle rules.
- Context sources are data-driven settings, not hardcoded People/Place branches. People, Places, and Activities are initial defaults.
- Folder scope is required for a context source; a frontmatter property filter such as `type: activity` is optional.
- One suggestion index serves Inbox, Event, and Task and is built from Obsidian metadata rather than per-keystroke file reads.
- Related logs are self-contained, physical, enabled by default, and append-only. They link to the source Daily Note but do not require block IDs.
- The primary Daily Note write is the submission commit boundary. Related-log failures produce typed partial success and never invite a blind full retry.
- Focus Timeline remains a projection over Markdown. It does not become the canonical data store.
- Note Composer remains responsible for manual fleeting-to-promoted extraction. Promotion automation and two-way synchronization are outside this plan.

## Dependency graph

```text
P0 submission guard + typed outcomes ─────┐
P0 date validation ───────────────────────┼── writer/parser contract tests
P0 state persistence safety ──────────────┘              │
                                                         ▼
Activities & Tasks default + migration ─────── context-source settings model
                                                         │
                                                         ▼
                                      metadata-backed suggestion index
                                                │                 │
                                                ▼                 ▼
                                      Inbox integration   Event/Task integration
                                                └────────┬────────┘
                                                         ▼
                                            related-log pure contract
                                                         ▼
                                      append-only multi-file submission
                                                         ▼
                                      Timeline compatibility fixtures
                                                         ▼
                                        stable Timeline detail modal
                                                         ▼
                                  performance + desktop/mobile acceptance
```

## Phase 0 — Reliability prerequisites

### Task 1: Share one in-flight submission policy

**Priority:** P0

**Description:** Prevent duplicate Inbox, Event, and Task submissions from concurrent Save button and keyboard signals on desktop and mobile.

**Acceptance criteria:**

- [ ] A renderer-independent guard permits only one active submission per form.
- [ ] Failure permits one subsequent retry; success or partial success completes exactly once.
- [ ] Desktop and mobile consume the same policy without recombining their layouts.

**Verification:**

- [ ] Focused `node:test` coverage proves concurrent signals create one submission.
- [ ] `pnpm run typecheck` and `pnpm test` pass.
- [ ] Manual Obsidian desktop and mobile checks confirm Save state is visible and recoverable.

**Dependencies:** None.

**Files likely touched:**

- `src/EventTaskSubmission.ts`
- `src/EventTaskModal.ts`
- `src/EventTaskMobileScreen.ts`
- `test/event-task-submission.test.ts`

**Estimated scope:** Medium.

### Task 2: Introduce typed submission outcomes

**Priority:** P0

**Description:** Distinguish complete success, partial success, and total failure around the authoritative primary write and optional secondary writes.

**Acceptance criteria:**

- [ ] Submission returns typed `success`, `partial`, or `failure` outcomes.
- [ ] A successful primary write followed by secondary failure reports what was completed and closes without encouraging a full retry.
- [ ] Existing successful Event, Task, and Inbox Markdown remains byte-for-byte unchanged.

**Verification:**

- [ ] Tests cover primary failure, secondary failure, and complete success.
- [ ] `pnpm test` and `pnpm run build` pass.

**Dependencies:** Task 1.

**Files likely touched:**

- `src/EventTaskSubmission.ts`
- `src/EventTaskModal.ts`
- `src/EventTaskMobileScreen.ts`
- `test/event-task-submission.test.ts`

**Estimated scope:** Medium.

### Task 3: Reject invalid temporal records

**Priority:** P0

**Description:** Replace silent current-time fallback with shared validation and preserve the semantic distinction between Event occurrence and Task timebox.

**Acceptance criteria:**

- [ ] Invalid dates and times cannot reach `EventTaskWriter`.
- [ ] Timed Events and enabled Task timeboxes require end later than start.
- [ ] Desktop and mobile display the same validation result.

**Verification:**

- [ ] Focused tests cover malformed values, zero/negative duration, all-day Events, and the 23:00 default boundary.
- [ ] `pnpm run typecheck` and `pnpm test` pass.

**Dependencies:** None; may proceed independently of Task 1, but must land before Task 5.

**Files likely touched:**

- `src/EventTaskFormState.ts`
- `src/EventTaskSubmission.ts`
- `test/event-task-form-state.test.ts`
- `test/event-task-submission.test.ts`

**Estimated scope:** Medium.

### Task 4: Make settings writes recoverable and ordered

**Priority:** P0

**Description:** Close the persistence risk before introducing context-source settings and their migration.

**Acceptance criteria:**

- [ ] Missing, unreadable, and malformed state files produce distinct states.
- [ ] An unreadable or malformed state file is never overwritten automatically.
- [ ] Concurrent saves complete in call order from immutable snapshots.

**Verification:**

- [ ] State tests cover first install, legacy migration, malformed JSON, transient read failure, and delayed concurrent writes.
- [ ] `pnpm test` and `pnpm run test:coverage` pass.

**Dependencies:** None.

**Files likely touched:**

- `src/StateStore.ts`
- `src/main.ts`
- `test/state-store.test.ts`
- `test/support/` fixtures if required

**Estimated scope:** Medium.

### Task 5: Lock writer and parser compatibility with direct tests

**Priority:** P0

**Description:** Establish final-Markdown tests proving that the Event and Task formats written by the modal are consumed correctly by Focus Timeline before changing headings or context content.

**Acceptance criteria:**

- [ ] Event, timeboxed Task, due-only Task, completed Task, and multiline descriptions have final-Markdown fixtures.
- [ ] Every supported writer fixture parses into the expected `ScheduledItem` kind and time fields.
- [ ] Related Markdown links do not corrupt titles or schedule metadata.

**Verification:**

- [ ] New focused writer/parser tests pass using a small fake vault or pure formatting seam.
- [ ] `pnpm test`, `pnpm run typecheck`, and `pnpm run build` pass.

**Dependencies:** Tasks 2 and 3.

**Files likely touched:**

- `src/EventTaskWriter.ts`
- `src/ScheduledItemParser.ts`
- `test/event-task-writer.test.ts`
- `test/scheduled-item-parser.test.ts`

**Estimated scope:** Medium.

## Checkpoint A — Safe extension point

- [ ] Tasks 1–5 are reviewed as independent commits.
- [ ] `OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run check:ci` passes.
- [ ] Existing Inbox/Event/Task desktop and mobile capture remains accepted.
- [ ] No context-source migration begins until settings recovery behavior is verified.

## Phase 1 — Core contextual capture

### Task 6: Adopt Persona terminology and shared daily heading defaults

**Priority:** P1

**Description:** Align user-facing terms and defaults without silently overriding existing user choices.

**Acceptance criteria:**

- [ ] New installations default Event and Task to `Activities & Tasks`.
- [ ] Existing non-empty custom headings are preserved during migration.
- [ ] Inbox disclosure is labelled `More options` on desktop and mobile, and help text no longer says `Advanced`.

**Verification:**

- [ ] Settings migration tests cover new, defaulted, and customized installations.
- [ ] Desktop/mobile manual checks verify labels and resolved target summaries.
- [ ] `pnpm test` and `pnpm run build` pass.

**Dependencies:** Task 4.

**Files likely touched:**

- `src/types.ts`
- `src/StateStore.ts`
- `src/InboxDesktopForm.ts`
- `src/InboxMobileForm.ts`
- `src/SettingsTab.ts`

**Estimated scope:** Medium; split UI copy from migration if it exceeds one focused session.

### Task 7: Define configurable context-source settings

**Priority:** P1

**Description:** Replace hardcoded People/Place folder pairs with an extensible typed source model while preserving existing settings through migration.

**Acceptance criteria:**

- [ ] Each source supports ID, name, icon, folders, optional property/value filter, related heading, and enabled state.
- [ ] People, Places, and Activities are default sources; existing People and Place folders migrate without loss.
- [ ] Invalid or empty source configuration is normalized deterministically and never causes full-vault fallback.

**Verification:**

- [ ] Pure settings tests cover defaults, migration, normalization, and custom Book source configuration.
- [ ] `pnpm run typecheck` and `pnpm test` pass.

**Dependencies:** Tasks 4 and 6.

**Files likely touched:**

- `src/types.ts`
- `src/InboxFolderSettings.ts` or a renamed generic settings module
- `src/StateStore.ts`
- `test/context-source-settings.test.ts`

**Estimated scope:** Medium.

### Task 8: Build a metadata-backed context suggestion index

**Priority:** P1

**Description:** Generalize the current Inbox suggestion snapshot into one reusable index filtered by folders and optional frontmatter type.

**Acceptance criteria:**

- [ ] Candidate loading uses vault file lists and metadata cache, not content reads per query.
- [ ] Folder and property filters return deterministic alias-aware results capped at a configured limit.
- [ ] File create, metadata change, rename, and delete invalidate or update the index without restarting the plugin.

**Verification:**

- [ ] Pure tests cover folder scope, aliases, optional `type`, ranking, result limits, and invalidation.
- [ ] A representative large synthetic fixture records a latency baseline without imposing an arbitrary production claim.
- [ ] `pnpm test` and `pnpm run test:coverage` pass.

**Dependencies:** Task 7.

**Files likely touched:**

- `src/ObsidianInboxSuggestionSource.ts` or a generic replacement
- `src/InboxSuggestions.ts` or a generic replacement
- `src/main.ts`
- `test/context-suggestions.test.ts`

**Estimated scope:** Medium.

### Task 9: Reuse contextual suggestions in Event and Task details

**Priority:** P1

**Description:** Apply the proven Inbox `@` and tag interaction to Event and Task description/details through a shared controller contract.

**Acceptance criteria:**

- [ ] Inbox, Event, and Task support the same `@` and `#` trigger semantics.
- [ ] Selection inserts a normal relative Markdown link based on the active target file.
- [ ] Desktop and mobile preserve cursor behavior, link activation, keyboard handling, and suggestion layering.

**Verification:**

- [ ] Controller tests cover trigger detection, selection, target changes, serialization, and tags for every capture kind.
- [ ] Real Obsidian desktop and mobile acceptance covers keyboard-open suggestions and populated descriptions.
- [ ] `pnpm test` and `pnpm run build` pass.

**Dependencies:** Task 8.

**Files likely touched:**

- `src/InboxNotesController.ts` or a generic replacement
- `src/EventTaskModal.ts`
- `src/EventTaskMobileScreen.ts`
- `test/context-notes-controller.test.ts`

**Estimated scope:** Medium.

### Task 10: Define self-contained related-log formatting

**Priority:** P1

**Description:** Specify and implement a pure append-only log contract before any vault writes are added.

**Acceptance criteria:**

- [ ] A log includes source date/time, intelligible activity text, and an optional relative Daily Note link.
- [ ] Formatting differs appropriately for Event and Task while remaining meaningful when the link breaks.
- [ ] A normalized submission-local deduplication key can identify repeated writes without adding block IDs or permanent sync IDs.

**Verification:**

- [ ] Pure tests cover Event, Task, Activity Object, People, Place, missing time, encoded paths, and broken-link-readable output.
- [ ] Golden Markdown fixtures receive human approval before writer integration.

**Dependencies:** Tasks 5 and 7.

**Files likely touched:**

- `src/RelatedLog.ts`
- `src/InboxMarkdown.ts` only if a canonical relative-link helper is extracted
- `test/related-log.test.ts`

**Estimated scope:** Small.

### Task 11: Append related logs with partial-outcome safety

**Priority:** P1

**Description:** After a successful primary capture, append logs to each selected contextual note and report any secondary failure without retrying the primary write.

**Acceptance criteria:**

- [ ] Related logs are enabled by default and use each source's configured heading.
- [ ] One submission writes at most one log per related note even when the same object is mentioned repeatedly.
- [ ] Primary success plus any related-log failure returns `partial` with completed and failed destinations; existing historical logs are never updated or deleted.

**Verification:**

- [ ] Writer tests assert final Markdown, heading creation, multiple related objects, deduplication, and partial failures.
- [ ] End-to-end submission tests prove a partial outcome cannot duplicate the Daily Note entry.
- [ ] `pnpm test`, `pnpm run typecheck`, and `pnpm run build` pass.

**Dependencies:** Tasks 2, 9, and 10.

**Files likely touched:**

- `src/EventTaskSubmission.ts`
- `src/EventTaskWriter.ts`
- `src/RelatedLog.ts`
- `test/event-task-submission.test.ts`
- `test/event-task-writer.test.ts`

**Estimated scope:** Medium.

## Checkpoint B — Complete contextual loop

- [ ] People, Places, and Activity Object mentions work from Inbox, Event, and Task.
- [ ] One capture produces correct primary Markdown and append-only logs.
- [ ] A broken related-log link still leaves an intelligible historical line.
- [ ] Settings migration is tested against a copy of representative existing state.
- [ ] Full CI gate and real desktop/mobile capture acceptance pass.

## Phase 2 — Temporal retrieval

### Task 12: Verify source-target alignment for Daily Notes

**Priority:** P2

**Description:** Make the default capture destination discoverable by Focus Timeline without forcing users to duplicate folder configuration.

**Acceptance criteria:**

- [ ] A new-install Event or Task saved to the default Daily Note is indexed by Focus Timeline.
- [ ] Custom target and source-folder settings surface a clear mismatch rather than silently hiding captured records.
- [ ] Timeline indexing remains folder-scoped and does not default to whole-vault scanning.

**Verification:**

- [ ] Integration fixtures cover Daily Notes default, manual target, source mismatch, Event, timeboxed Task, and due-only Task.
- [ ] `pnpm test` and `pnpm run build` pass.

**Dependencies:** Tasks 5, 6, and 11.

**Files likely touched:**

- `src/TargetResolver.ts`
- `src/ScheduledItemIndexer.ts`
- `src/SettingsTab.ts`
- `test/timeline-capture-integration.test.ts`

**Estimated scope:** Medium.

### Task 13: Replace pending preview with a stable detail modal

**Priority:** P2

**Description:** Replace viewport-positioned pending-task preview behavior with an Obsidian modal used consistently by Timeline cards.

**Acceptance criteria:**

- [ ] Clicking a pending Task opens a modal that shows kind, status, schedule, source, and available contextual links.
- [ ] `Open source note` navigates to the source line and closes or preserves the modal predictably.
- [ ] The modal remains usable from sidebar, full tab, desktop, and mobile layouts.

**Verification:**

- [ ] Pure presentation-model tests cover Event, Task, missing metadata, and completed state.
- [ ] Manual desktop/sidebar and mobile acceptance verifies layering, focus, Escape/back behavior, and source navigation.
- [ ] `pnpm test` and `pnpm run build` pass.

**Dependencies:** Task 12.

**Files likely touched:**

- `src/TimelineItemModal.ts`
- `src/TimelineGrid.ts`
- `src/TimelineView.ts`
- `styles.css`
- `test/timeline-item-modal-model.test.ts`

**Estimated scope:** Medium.

### Task 14: Confirm planned and actual occurrence semantics

**Priority:** P2

**Description:** Resolve the remaining product question before adding status to the Event grammar. Prefer the smallest representation that preserves portability and existing parser compatibility.

**Acceptance criteria:**

- [ ] A short implementation spec defines planned, completed, cancelled, and actual occurrence behavior.
- [ ] The chosen format remains readable Markdown and does not make Task checkbox semantics ambiguous.
- [ ] Migration and backward compatibility with existing Event lines are explicit.

**Verification:**

- [ ] Representative Markdown examples are approved by the user.
- [ ] Parser fixtures prove old and proposed formats before runtime implementation begins.

**Dependencies:** Task 12. This is a decision/spec task and may defer runtime changes to a subsequent plan.

**Files likely touched:**

- `docs/spec-event-occurrence-lifecycle.md`
- `test/scheduled-item-parser.test.ts` when the format is approved

**Estimated scope:** Small.

## Checkpoint C — Temporal experience

- [ ] Day and Week views render Event and Task semantics distinctly.
- [ ] Pending items open a stable modal and source navigation works.
- [ ] Default Daily Note capture appears without extra configuration on a new-install fixture.
- [ ] Planned/actual semantics are documented before implementation expands the grammar.

## Phase 3 — Hardening and release evidence

### Task 15: Measure and bound suggestion/indexing performance

**Priority:** P3

**Description:** Validate the efficient design against representative vault sizes and prevent accidental full-vault work on each keystroke or render.

**Acceptance criteria:**

- [ ] Bench fixtures document candidate counts, warm/cold query timing, and invalidation cost.
- [ ] Query paths perform no file-content reads per keystroke.
- [ ] Timeline and suggestion indexing have bounded, documented source scopes.

**Verification:**

- [ ] Repeatable benchmark command and results are recorded.
- [ ] Profiling or instrumentation confirms the intended cache path in Obsidian.

**Dependencies:** Tasks 8 and 12.

**Files likely touched:**

- `test/context-suggestions-performance.test.ts`
- `test/scheduled-item-indexer.test.ts`
- `docs/developer/` or the public developer reference when available

**Estimated scope:** Medium.

### Task 16: Complete user, developer, and acceptance documentation

**Priority:** P3

**Description:** Document the workflow, portable Markdown contracts, settings migration, archive boundary, and verified desktop/mobile behavior.

**Acceptance criteria:**

- [ ] User how-to covers Daily Notes, contextual mentions, related logs, Activity Objects, one-off activities, and Timeline retrieval.
- [ ] Developer reference covers context-source schema, submission commit boundary, append-only semantics, and parser contracts.
- [ ] Repeatable desktop and mobile acceptance evidence is recorded separately from automated tests.

**Verification:**

- [ ] `pnpm run docs:build` and internal link checks pass.
- [ ] `OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run check:ci` passes.
- [ ] Documentation examples match tested Markdown fixtures.

**Dependencies:** Tasks 11–15 as applicable.

**Files likely touched:**

- `docs/site/user/`
- `docs/site/developer/`
- `docs/development-status.md`
- acceptance evidence document

**Estimated scope:** Medium; split user, developer, and acceptance content into separate commits.

## Checkpoint D — Release candidate

- [ ] All P0–P3 acceptance criteria are closed or explicitly deferred with rationale.
- [ ] Full clean-checkout CI passes.
- [ ] Real Obsidian desktop and representative Android/iOS acceptance passes.
- [ ] Obsidian policy blockers recorded in `docs/development-status.md` are resolved before public release.
- [ ] Final code-quality review finds no required issues.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Secondary related-log failure causes duplicate primary entries on retry | High | Land typed partial outcomes and one in-flight guard before related logs |
| Context-source migration loses existing People/Place folders | High | Make migration pure, snapshot existing settings, and test customized fixtures |
| Mixed Event/Task heading erases semantic differences | High | Lock separate writer/parser golden fixtures before changing defaults |
| Append-only logs duplicate on repeated mentions or double-submit | High | Deduplicate per related-note path within one guarded submission |
| Full-vault suggestion scans degrade mobile input | High | Require folder scope, metadata cache, in-memory ranking, capped results, and performance fixtures |
| Daily target is outside Timeline source scope | Medium | Validate source-target alignment and provide a visible settings warning |
| Historical links break after Project archival | Low by design | Keep log text self-contained and document archive boundary semantics |
| Activity means both object and occurrence | Medium | Use `Activity Object` and `Event occurrence` consistently in types and docs |
| Scope expands into Objects, Bases, Note Composer, or archive tooling | High | Enforce the Not Doing list and create separate future specs |

## Deferred directions

- Persona-aware promotion destination suggestions.
- Automatic promotion based on volume or fan-out.
- Two-way synchronization between Daily Notes and promoted Task Notes.
- Project snapshot creation, restoration, and link rewriting.
- Built-in sources beyond People, Places, and Activities.
- Automatic object-schema discovery from Obsidian Objects.

## Human review gates

Implementation must pause for user review at these points:

1. After Checkpoint A, before settings migration and new secondary writes.
2. After Task 10 golden log fixtures, before append-only writer integration.
3. After Checkpoint B, before changing Timeline interaction.
4. At Task 14, before extending Event lifecycle grammar.
5. After real mobile acceptance, before merging the complete feature line to `main`.
