# Implementation Plan: Persona-Rooted Contextual Activity System

## Overview

Implement the smallest reliable loop from Daily Notes capture to contextual retrieval:

```text
capture Inbox, Event, or Task
    → insert portable contextual links
    → write distinct Markdown under Activities & Tasks
    → append self-contained historical logs
    → render the temporal record in Focus Timeline
    → open stable details and the source note
```

The work deliberately starts with submission and persistence safety. The current `writeToHubNote` path already performs a related-note write after the primary target write. The feature generalizes that existing path from one optional related note using the same heading into multiple contextual notes using source-specific headings. Doing so before typed partial outcomes, concurrency guards, and writer coverage would make retries capable of duplicating the primary entry or historical logs. The plan therefore closes the directly blocking quality findings before extending existing behavior.

The product direction is defined in [`docs/ideas/persona-rooted-contextual-activity-system.md`](../docs/ideas/persona-rooted-contextual-activity-system.md). This plan does not replace the implementation specifications required for each behavioral slice.

## Priority model

| Priority | Meaning | Outcome |
|---|---|---|
| P0 | Reliability prerequisite | Existing capture is safe enough to generalize related-note writes and migrate settings |
| P1 | Core contextual capture | Inbox, Event, and Task can use extensible context suggestions and append historical logs |
| P2 | Temporal retrieval | Output is reliably visible and inspectable in Focus Timeline |
| P3 | Product hardening | Performance, migration, documentation, and real-device acceptance are release-ready |

## Architecture decisions

- `Persona` is the vault-facing term for a stable life responsibility and physical ownership root.
- Event and Task share the default `Activities & Tasks` heading but keep distinct Markdown formats, parser semantics, visual treatment, and lifecycle rules.
- Context sources are data-driven settings, not hardcoded People/Place branches. People, Places, and Activities are initial defaults.
- Folder scope is required for a context source; a frontmatter property filter such as `type: activity` is optional.
- One suggestion index serves Inbox, Event, and Task and is built from Obsidian metadata rather than per-keystroke file reads.
- Related logs are self-contained, physical, enabled by default, and append-only. They link to the source Daily Note but do not require block IDs.
- Related-log delivery generalizes `writeToHubNote` and the existing heading-aware `EventTaskWriter`; it does not introduce a parallel persistence subsystem.
- Explicit Related note and contextual mentions remain distinct contracts inside that shared orchestration: explicit link/create keeps its current opt-in write behavior, while configured contextual mentions receive append-only logs by default under source-specific headings.
- Ordinary links that do not resolve to an enabled configured context source remain ordinary links and do not receive physical logs.
- The primary Daily Note write is the submission commit boundary. Related-log failures produce typed partial success and never invite a blind full retry.
- Focus Timeline remains a projection over Markdown. It does not become the canonical data store.
- Note Composer remains responsible for manual fleeting-to-promoted extraction. Promotion automation and two-way synchronization are outside this plan.

## Dependency graph

```text
typed outcomes ──→ submission guard ────────────────────────────────┐
                                                                  │
date validation ───→ writer/parser contract ───────────────┐       │
                                                          │       │
settings safety ───┬─→ Activities & Tasks migration       │       │
                   └─→ context-source settings ──┐         │       │
                                                ▼         ▼       │
                                  metadata suggestion index        │
                                                │                  │
                                                ▼                  │
                                     generic Markdown controller   │
                                         ┌──────┴──────┐           │
                                         ▼             ▼           │
                                  desktop details  mobile details  │
                                         └──────┬──────┘           │
                                                │                  │
context settings + writer contract ──→ destination extraction     │
                                                │                  │
                                                └────────┬─────────┘
                                                         ▼
                          generalized existing related-note writes

writer/parser contract + target migration ──→ Timeline source alignment
                                                         │
                                                         ▼
                                               stable detail modal

suggestion index + Timeline alignment ──→ performance and acceptance
```

## Execution lanes

The dependency graph, not the phase label alone, determines what may begin. The following chains must remain sequential:

```text
typed outcomes → submission guard → generalized related-note delivery
settings safety → context-source schema → suggestion index → generic controller
date validation → writer/parser contract → related-log contract
settings safety → daily-heading migration → Timeline source alignment → detail modal
```

After their prerequisites land as reviewed commits, these tasks may proceed independently:

- Tasks 3 and 4 may proceed alongside the Task 1–2 submission chain.
- Tasks 6 and 7 may proceed in parallel after Task 4.
- Tasks 10 and 11 may proceed in parallel after Task 9 because desktop and mobile renderers remain independent.
- Task 12 may proceed alongside Tasks 10 and 11 after Tasks 5 and 7.
- Task 14 may proceed after Tasks 5 and 6 without waiting for related-log delivery.
- Task 16 may begin after Task 5 because it is a grammar decision, not a Timeline UI dependency.

Parallelizable does not mean one mixed commit. Each numbered task remains an independently reviewed, verified save point. A checkpoint blocks downstream mutation even when another lane's code is technically available.

## Phase 0 — Reliability prerequisites

### Task 1: Introduce typed submission outcomes

**Priority:** P0

**Description:** Establish the primary-write commit boundary by distinguishing complete success, partial success, and total failure around the existing target and related-note writes.

**Acceptance criteria:**

- [ ] Submission returns typed `success`, `partial`, or `failure` outcomes.
- [ ] Outcomes identify created hub/detail notes and distinguish primary failure from primary success followed by existing related-note failure.
- [ ] A `partial` outcome carries an ephemeral recovery receipt containing completed paths, failed paths, and the immutable failed-write payload; it is not a signal to rerun the full submission.
- [ ] Existing successful Event, Task, and Inbox Markdown remains byte-for-byte unchanged.

**Verification:**

- [ ] Tests cover optional-note creation followed by primary failure, primary success followed by related-note failure, and complete success.
- [ ] Desktop and mobile render each typed outcome consistently.
- [ ] `pnpm test` and `pnpm run build` pass.

**Dependencies:** None.

**Files likely touched:**

- `src/EventTaskSubmission.ts`
- `src/EventTaskModal.ts`
- `src/EventTaskMobileScreen.ts`
- `test/event-task-submission.test.ts`

**Estimated scope:** Medium.

### Task 2: Share one in-flight submission policy

**Priority:** P0

**Description:** Prevent duplicate Inbox, Event, and Task submissions from concurrent Save button and keyboard signals, using the typed outcome to decide whether the form completes or permits retry.

**Acceptance criteria:**

- [ ] A renderer-independent guard permits only one active submission per form.
- [ ] Failure before the primary commit permits one subsequent full retry; success or partial success completes the form exactly once.
- [ ] Recovery from `partial` is a separate action and cannot invoke the primary submission path.
- [ ] Desktop and mobile consume the same policy without recombining their layouts.

**Verification:**

- [ ] Focused `node:test` coverage proves concurrent Save and keyboard signals create one submission.
- [ ] `pnpm run typecheck` and `pnpm test` pass.
- [ ] Manual Obsidian desktop and mobile checks confirm Save state is visible and recoverable.

**Dependencies:** Task 1.

**Files likely touched:**

- `src/EventTaskSubmission.ts`
- `src/EventTaskModal.ts`
- `src/EventTaskMobileScreen.ts`
- `test/event-task-submission.test.ts`

**Estimated scope:** Medium.

## Checkpoint A1 — Submission lifecycle

- [ ] Typed outcomes and the one-in-flight guard pass focused tests.
- [ ] Existing explicit Related note link/create/write behavior is unchanged on success.
- [ ] Desktop and mobile distinguish retryable failure from completed partial success.

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

**Dependencies:** Task 3. Typed submission outcomes are not required to test final Markdown compatibility.

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

### Task 6: Migrate the shared daily heading and disclosure copy

**Priority:** P1

**Description:** Adopt the combined daily ledger default and consistent disclosure label without silently overriding existing user choices.

**Acceptance criteria:**

- [ ] New installations default Event and Task to `Activities & Tasks`.
- [ ] Existing non-empty custom headings are preserved; an existing explicit empty value continues to mean “follow the active target” rather than being silently replaced.
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

**Description:** Replace hardcoded People/Place folder pairs with an extensible typed source model while preserving existing settings through a recoverable migration.

**Acceptance criteria:**

- [ ] Each source supports ID, name, icon, folders, optional property/value filter, related heading, and enabled state.
- [ ] People, Places, and Activities are default sources; existing People and Place folders migrate without loss.
- [ ] Invalid or empty source configuration is normalized deterministically and never causes full-vault fallback.

**Verification:**

- [ ] Pure settings tests cover defaults, migration, normalization, duplicate IDs, invalid folders, and a custom Book source.
- [ ] `pnpm run typecheck` and `pnpm test` pass.

**Dependencies:** Task 4. It does not depend on the UI-copy or default-heading change in Task 6.

**Files likely touched:**

- `src/types.ts`
- `src/InboxFolderSettings.ts` or a generic replacement
- `src/StateStore.ts`
- `test/context-source-settings.test.ts`

**Estimated scope:** Medium.

### Task 8: Build a metadata-backed context suggestion index

**Priority:** P1

**Description:** Generalize the current Inbox suggestion snapshot into one reusable index filtered by configured folders and optional frontmatter properties.

**Acceptance criteria:**

- [ ] Candidate loading uses vault file lists and metadata cache, not content reads per query.
- [ ] Folder and property filters return deterministic alias-aware results capped at a configured limit.
- [ ] File create, metadata change, rename, and delete invalidate or update the index without restarting the plugin.

**Verification:**

- [ ] Pure tests cover folder scope, aliases, optional `type`, ranking, result limits, and invalidation.
- [ ] A representative large synthetic fixture records a latency baseline without claiming unmeasured real-vault performance.
- [ ] `pnpm test` and `pnpm run test:coverage` pass.

**Dependencies:** Task 7.

**Files likely touched:**

- `src/ObsidianInboxSuggestionSource.ts` or a generic replacement
- `src/InboxSuggestions.ts` or a generic replacement
- `src/main.ts`
- `test/context-suggestions.test.ts`

**Estimated scope:** Medium.

### Task 9: Generalize the Inbox Markdown controller without changing behavior

**Priority:** P1

**Description:** Extract a capture-kind-neutral contextual Markdown controller from `InboxNotesController` before either Event/Task renderer consumes it. This establishes one owner for trigger detection, relative-link serialization, page preview, and tag suggestions.

**Acceptance criteria:**

- [ ] Existing Inbox `@`, `#`, aliases, relative links, link activation, and mobile keyboard behavior remain unchanged.
- [ ] The controller accepts generic context sources and a current target path rather than People/Place-specific callbacks.
- [ ] The controller can be instantiated by another renderer without referencing Inbox form state.

**Verification:**

- [ ] Existing Inbox tests remain green and new generic-controller tests cover source changes and target changes.
- [ ] A manual Inbox desktop/mobile smoke check passes before Event/Task integration begins.
- [ ] `pnpm test` and `pnpm run build` pass.

**Dependencies:** Task 8.

**Files likely touched:**

- `src/InboxNotesController.ts` or a generic replacement
- `src/InboxNotesText.ts` only if names are generalized
- `test/inbox-notes-controller.test.ts`
- `test/context-notes-controller.test.ts`

**Estimated scope:** Medium.

## Checkpoint B1 — Generic context foundation

- [ ] Existing settings migrate without losing People or Place folders.
- [ ] Generic folder/property filtering and cache invalidation pass focused tests.
- [ ] Inbox behavior and real mobile `@` suggestions remain accepted before adding new consumers.

### Task 10: Integrate contextual Markdown into desktop Event and Task details

**Priority:** P1

**Description:** Replace the desktop description textarea with the proven shared contextual Markdown controller while preserving Event/Task form-state and submission contracts.

**Acceptance criteria:**

- [ ] Desktop Event and Task details support identical `@` and `#` semantics to Inbox.
- [ ] Selection inserts a relative Markdown link based on the resolved primary target file.
- [ ] Switching kind, target, or disclosure state preserves serialized Markdown and cursor-safe editing.

**Verification:**

- [ ] Focused orchestration tests cover initial value, target change, kind switch, and form-state updates.
- [ ] Real Obsidian desktop acceptance covers typing, suggestion selection, page preview, and Save.
- [ ] `pnpm test` and `pnpm run build` pass.

**Dependencies:** Task 9.

**Files likely touched:**

- `src/EventTaskModal.ts`
- shared contextual controller module
- `test/event-task-context-desktop.test.ts`

**Estimated scope:** Small to Medium.

### Task 11: Integrate contextual Markdown into mobile Event and Task details

**Priority:** P1

**Description:** Apply the same controller to the independent mobile renderer without sharing desktop DOM or reintroducing keyboard/layering regressions.

**Acceptance criteria:**

- [ ] Mobile Event and Task details support the same `@`, `#`, alias, and relative-link behavior.
- [ ] The suggestion layer remains above the mobile screen and reachable with the software keyboard open.
- [ ] Target changes and disclosure changes preserve serialized Markdown.

**Verification:**

- [ ] Focused mobile policy/controller tests remain green.
- [ ] Real Android and iOS acceptance covers keyboard-open selection, scrolling, dismissal, and Save.
- [ ] `pnpm test` and `pnpm run build` pass.

**Dependencies:** Task 9. It may proceed in parallel with Task 10 after the shared contract is committed.

**Files likely touched:**

- `src/EventTaskMobileScreen.ts`
- shared contextual controller module
- `test/event-task-context-mobile.test.ts`
- `styles.css` only if an existing scoped layer rule is insufficient

**Estimated scope:** Small to Medium.

### Task 12: Resolve contextual destinations and define historical-log Markdown

**Priority:** P1

**Description:** Build a pure contract that extracts ordinary Markdown links from a capture, resolves only those links that belong to enabled context sources, deduplicates by destination path, and formats a self-contained append-only line for each contextual destination. Existing explicit Related note selection remains a separate input to the shared write orchestration.

**Acceptance criteria:**

- [ ] Repeated mentions of one note yield one destination; unrelated Markdown links remain link-only and receive no physical log.
- [ ] Each destination carries its configured related heading and source type.
- [ ] Event, Task, and Inbox log text remains meaningful when the Daily Note link later breaks; no block ID is added.

**Verification:**

- [ ] Pure tests cover aliases, encoded relative paths, varying folder depth, repeated links, disabled sources, overlapping folders, property filters, Event, Task, and Inbox.
- [ ] Golden Markdown fixtures for People, Place, Activity Object, and Book receive human approval.

**Dependencies:** Tasks 5 and 7. UI integration is not required to prove this pure contract.

**Files likely touched:**

- `src/ContextLinkResolver.ts`
- `src/RelatedLog.ts`
- canonical relative-link helper if extracted
- `test/context-link-resolver.test.ts`
- `test/related-log.test.ts`

**Estimated scope:** Medium; split resolver and formatter into separate commits if they exceed five files together.

## Checkpoint B2 — Context input and log contract

- [ ] Desktop and mobile serialize the same contextual Markdown for equivalent input.
- [ ] Unrelated links remain link-only; enabled context sources resolve deterministically.
- [ ] Human review approves self-contained golden log fixtures before vault mutation is added.

### Task 13: Generalize existing related-note writes with partial-outcome safety

**Priority:** P1

**Description:** Extend the existing `writeToHubNote` orchestration and heading-aware writer from one optional related note to the deduplicated contextual destinations resolved in Task 12. Do not create a second persistence subsystem.

**Acceptance criteria:**

- [ ] The primary target is written once before contextual logs; existing explicit link/create-related-note behavior remains available.
- [ ] Each resolved destination receives one append-only log under its configured heading, including when the same note is mentioned more than once.
- [ ] Any contextual failure after primary success returns `partial` with a recovery receipt; the form is complete and cannot rerun the primary entry.
- [ ] `Retry failed related logs` consumes only the receipt's current failed paths and never re-attempts the primary path or a destination recorded as completed.
- [ ] After each targeted recovery, newly successful paths move to completed and only still-failed paths remain retryable; no permanent synchronization ID or block ID is written to Markdown.

**Verification:**

- [ ] Writer tests assert final Markdown, heading creation, existing related-note compatibility, multiple destinations, and failure at each write position.
- [ ] Submission tests cover Inbox, Event, Task, complete success, primary failure, partial success, one guarded full retry before primary commit, and repeated failed-path-only recovery after partial completion.
- [ ] A multi-destination regression proves that a destination succeeding before another fails is never appended again during recovery.
- [ ] `pnpm test`, `pnpm run typecheck`, and `pnpm run build` pass.

**Dependencies:** Tasks 1, 2, 10, 11, and 12.

**Files likely touched:**

- `src/EventTaskSubmission.ts`
- `src/EventTaskWriter.ts`
- `src/RelatedLog.ts`
- `test/event-task-submission.test.ts`
- `test/event-task-writer.test.ts`

**Estimated scope:** Medium. If Inbox and Event/Task orchestration cannot fit one stable contract, land Event/Task first and Inbox as the next vertical slice.

## Checkpoint B — Complete contextual loop

- [ ] People, Places, and Activity Object mentions work from Inbox, Event, and Task.
- [ ] One capture produces correct primary Markdown and append-only logs.
- [ ] A broken related-log link still leaves an intelligible historical line.
- [ ] Existing single related-note link/create/write behavior remains backward compatible.
- [ ] Settings migration is tested against a copy of representative existing state.
- [ ] Full CI gate and real desktop/mobile capture acceptance pass.

## Phase 2 — Temporal retrieval

### Task 14: Verify source-target alignment for Daily Notes

**Priority:** P2

**Description:** Make the default capture destination discoverable by Focus Timeline without forcing users to duplicate folder configuration.

**Acceptance criteria:**

- [x] A new-install Event or Task saved to the default Daily Note is indexed by Focus Timeline.
- [x] Custom target and source-folder settings surface a clear mismatch rather than silently hiding captured records.
- [x] Timeline indexing remains folder-scoped and does not default to whole-vault scanning.

**Verification:**

- [x] Integration fixtures cover Daily Notes default, manual target, source mismatch, Event, timeboxed Task, and due-only Task.
- [x] `pnpm test` and `pnpm run build` pass.

Implementation and automated verification are complete. Real Obsidian desktop/mobile acceptance remains tracked by
Checkpoint C and Task 18.

**Dependencies:** Tasks 5 and 6. Related-log delivery is not required for Timeline source alignment.

**Files likely touched:**

- `src/TargetResolver.ts`
- `src/ScheduledItemIndexer.ts`
- `src/SettingsTab.ts`
- `test/timeline-capture-integration.test.ts`

**Estimated scope:** Medium.

### Task 15: Replace pending preview with a stable detail modal

**Priority:** P2

**Description:** Replace viewport-positioned pending-task preview behavior with an Obsidian modal used consistently by Timeline cards.

**Acceptance criteria:**

- [x] Clicking a pending Task opens a modal that shows kind, status, schedule, source, and available contextual links.
- [x] `Open source note` navigates to the source line and closes or preserves the modal predictably.
- [ ] The modal remains usable from sidebar, full tab, desktop, and mobile layouts.

**Verification:**

- [x] Pure presentation-model tests cover Event, Task, missing metadata, and completed state.
- [ ] Manual desktop/sidebar and mobile acceptance verifies layering, focus, Escape/back behavior, and source navigation.
- [x] `pnpm test` and `pnpm run build` pass.

Implementation and pure-model verification are complete. Runtime interaction acceptance remains open.

**Dependencies:** Task 14.

**Files likely touched:**

- `src/TimelineItemModal.ts`
- `src/TimelineGrid.ts`
- `src/TimelineView.ts`
- `styles.css`
- `test/timeline-item-modal-model.test.ts`

**Estimated scope:** Medium.

### Task 14.1: Group Timeline sources and constrain ledger eligibility

**Priority:** P2

**Description:** Prevent ordinary Daily Note checkboxes and per-file Daily Note sources from overwhelming Focus Timeline while preserving exact source-note navigation.

**Acceptance criteria:**

- [x] Timeline records are accepted only below configured ledger headings; the active Event/Task capture heading is included automatically.
- [x] A Task requires `due`, `start`, `end`, or `remind`; ordinary checkboxes remain ordinary Markdown.
- [x] Sidebar visibility, color, and counts use a stable folder-level source group rather than individual Daily Note paths.
- [x] Daily Notes appear as one source group, overlapping configured folders use the most specific group, and exact file/heading/line provenance is retained.
- [x] Counts represent items in the active range plus pending items and do not double-count the same item.

**Dependencies:** Task 14. This correction lands before Task 16.

**Verification:**

- [x] Integration fixtures cover unrelated headings, unscheduled checkboxes, scheduled Tasks, Events, nested folders, and exact provenance.
- [x] Pure source-group tests cover Daily Notes aggregation, custom headings, range-aware counts, and deduplication.
- [ ] Real desktop and mobile acceptance confirms a large Daily Notes folder produces one sidebar source.

### Task 14.2: Derive temporal sources from Persona-rooted Object Sources

**Priority:** P2

**Description:** Remove the global `projects/` assumption by allowing opted-in Object Sources to feed Timeline through their existing folder and property filters.

**Acceptance criteria:**

- [x] Daily Notes remain an automatic Timeline source without duplicated configuration.
- [x] An Object Source can opt into Timeline indexing while People, Place, Book, and other non-temporal sources remain excluded by default.
- [x] Project and Activity sources may share `persona` and are classified through distinct `type` property values at arbitrary folder depth.
- [x] Exact file, heading, and line provenance remains available for source navigation.
- [x] Manual Timeline folders remain an optional unfiltered fallback for non-object hub notes.
- [x] New installs do not assume global `Journal`, `projects`, or `activities` folders.

**Dependencies:** Tasks 7, 14, and 14.1. This correction lands before Task 16 and Card/List View.

**Verification:**

- [x] Pure tests cover source migration, opt-in/opt-out, shared Persona roots, and multi-folder groups.
- [x] Integration fixtures classify nested Project and Activity notes by frontmatter property while preserving source paths.
- [ ] Real desktop/mobile acceptance confirms Object Source toggles, sidebar groups, and source navigation.

### Task 16: Confirm planned and actual occurrence semantics

**Priority:** P2

**Description:** Resolve the remaining product question before adding status to the Event grammar. Prefer the smallest representation that preserves portability and existing parser compatibility.

**Acceptance criteria:**

- [ ] A short implementation spec defines planned, completed, cancelled, and actual occurrence behavior.
- [ ] The chosen format remains readable Markdown and does not make Task checkbox semantics ambiguous.
- [ ] Migration and backward compatibility with existing Event lines are explicit.

**Verification:**

- [ ] Representative Markdown examples are approved by the user.
- [ ] Parser fixtures prove old and proposed formats before runtime implementation begins.

**Dependencies:** Task 5. This decision/spec task does not require related logs or the detail modal and may proceed once the existing grammar is locked by tests.

**Files likely touched:**

- `docs/spec-event-occurrence-lifecycle.md`
- `test/scheduled-item-parser.test.ts` when the format is approved

**Estimated scope:** Small.

### Task 16.1: Add orthogonal Task priority semantics

**Priority:** P2

**Description:** Add TickTick-style Task priority without coupling importance to checkbox completion, scheduling, or the
separate Event occurrence lifecycle. Markdown remains canonical and existing Task lines default to normal priority.

**Acceptance criteria:**

- [x] Task records support `high`, `medium`, `normal`, and `low`; omission means `normal` and the writer omits
      `priority:normal`.
- [x] Desktop and mobile Task forms select priority, while Event and Inbox records remain unchanged.
- [x] Timeline details expose Task priority and pending ordering uses due/overdue time before priority.
- [x] Detail-note frontmatter uses the selected Task priority instead of a hardcoded value when the field is enabled.

**Verification:**

- [x] Parser/writer round-trip fixtures cover priority emission, omission, invalid/duplicate values, and legacy Task
      compatibility.
- [x] Form-state, pending-query, modal-model, and detail-note tests prove the complete semantic path.
- [x] `pnpm run check:ci` passes; desktop and real-mobile interaction acceptance remain recorded separately.

**Dependencies:** Task 5 and the approved priority contract in `docs/spec-task-event-line-semantics.md`. It does not depend
on Event lifecycle implementation.

**Files likely touched:**

- `src/EventTaskFormState.ts`
- `src/EventTaskMarkdown.ts`
- `src/ScheduledItemParser.ts`
- `src/ScheduledItemTypes.ts`
- `src/ScheduledItemQuery.ts`
- desktop/mobile form and Timeline modal files
- focused compatibility and presentation tests

**Estimated scope:** Medium, delivered as one tested vertical slice.

## Checkpoint C — Temporal experience

- [ ] Day and Week views render Event and Task semantics distinctly.
- [ ] Pending items open a stable modal and source navigation works.
- [ ] Default Daily Note capture appears without extra configuration on a new-install fixture.
- [ ] Planned/actual semantics are documented before implementation expands the grammar.

## Phase 3 — Hardening and release evidence

### Task 17: Confirm and bound suggestion/indexing performance

**Priority:** P3

**Description:** Confirm the Task 8 fail-fast synthetic baseline against representative real-vault sizes and prevent later regressions that introduce full-vault work on each keystroke or render. This is confirmation and regression bounding, not the first point of performance discovery.

**Acceptance criteria:**

- [ ] Bench fixtures document candidate counts, warm/cold query timing, and invalidation cost.
- [ ] Query paths perform no file-content reads per keystroke.
- [ ] Timeline and suggestion indexing have bounded, documented source scopes.

**Verification:**

- [ ] Repeatable benchmark command and results are recorded.
- [ ] Profiling or instrumentation confirms the intended cache path in Obsidian.

**Dependencies:** Tasks 8 and 14.

**Files likely touched:**

- `test/context-suggestions-performance.test.ts`
- `test/scheduled-item-indexer.test.ts`
- `docs/developer/` or the public developer reference when available

**Estimated scope:** Medium.

### Task 18: Complete user, developer, and acceptance documentation

**Priority:** P3

**Description:** Document the workflow, portable Markdown contracts, settings migration, archive boundary, and verified desktop/mobile behavior.

**Acceptance criteria:**

- [ ] User how-to covers Daily Notes, contextual mentions, related logs, Activity Objects, one-off activities, and Timeline retrieval.
- [ ] Developer reference covers context-source schema, submission commit boundary, append-only semantics, and parser contracts.
- [ ] Repeatable desktop and mobile acceptance evidence is recorded separately from automated tests.
- [ ] A representative Daily Notes workflow is dogfooded for mixed `Activities & Tasks`, fleeting versus promoted items, and retrieval through People, Place, and Activity logs; v1 may use the project owner as the initial real user, but the result and unresolved confusion are recorded.

**Verification:**

- [ ] `pnpm run docs:build` and internal link checks pass.
- [ ] `OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run check:ci` passes.
- [ ] Documentation examples match tested Markdown fixtures.

**Dependencies:** Tasks 13–17 as applicable.

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
- [ ] The seven design assumptions have recorded outcomes from their assigned technical checks or Daily Notes dogfooding; unresolved assumptions are explicitly deferred with rationale.
- [ ] Obsidian policy blockers recorded in `docs/development-status.md` are resolved before public release.
- [ ] Final code-quality review finds no required issues.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Generalized related-note failure causes duplicate primary entries on retry | High | Land typed partial outcomes and one in-flight guard before extending `writeToHubNote` |
| Partial recovery re-appends contextual logs that already succeeded | High | Persist completed and failed paths in an ephemeral partial receipt and retry only its current failed destinations |
| Context-source migration loses existing People/Place folders | High | Make migration pure, snapshot existing settings, and test customized fixtures |
| Mixed Event/Task heading erases semantic differences | High | Lock separate writer/parser golden fixtures before changing defaults |
| Append-only logs duplicate on repeated mentions or double-submit | High | Resolve only configured context links, deduplicate by destination path, and use one guarded submission |
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

1. After Checkpoint A, before settings migration and generalizing related-note writes.
2. After Task 12 golden log fixtures, before generalizing related-note writes.
3. After Checkpoint B, before changing Timeline interaction.
4. At Task 16, before extending Event lifecycle grammar.
5. After real mobile acceptance, before merging the complete feature line to `main`.
