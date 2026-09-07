# Spec: Scheduled Item, Daily Projection, Timebox, and Focus Session Integration

## Status

- Specification approved in conversation on 2026-08-30.
- Tasks 29–45 are implemented and covered by automated tests; `OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run check:ci` is green (format, lint, typecheck, full test suite, production build, artifact verification, documentation build).
- Task 46 (this closeout) records spec traceability, migration/legacy documentation, and known limitations. Repeatable real desktop/mobile runtime acceptance and final human approval remain outside what an automated gate can certify — see [Traceability and acceptance evidence](#traceability-and-acceptance-evidence-task-46).
- This spec supersedes the single-timebox portion of `spec-task-event-line-semantics.md`; Task 33's migration made that transition lossless and idempotent (see Migration below). Existing Task/Event syntax remains compatible.

## Objective

Give every planned or actual focus activity one stable context. Events and Tasks remain distinct Scheduled Item kinds, while daily notes and Timeline show derived projections rather than duplicate canonical records. Tasks may contain multiple planned timeboxes, and each timebox may contain multiple actual Focus Sessions.

Success means a user can plan an Event or Task, see it on every relevant day, manage it from any Daily Note, focus against that context, and retain one unambiguous source of truth.

## Capability map

| Module id | Responsibility | Depends on |
| --- | --- | --- |
| `scheduled-item-identity` | Stable canonical identity and reference resolution | — |
| `capture-targeting` | Settings-driven canonical destinations | identity |
| `task-timebox` | Multiple planned sessions per Task | identity |
| `timebox-management` | Add, edit, status, cancel, and safe delete | task-timebox |
| `daily-projection` | Derived Event, Task due, and timebox references | identity, task-timebox |
| `timeline-projection` | Per-day visual segments without canonical duplication | daily-projection |
| `scheduled-item-management` | Edit canonical records from canonical/reference entries | identity, daily-projection |
| `projection-sync` | Task checkbox propagation and reconciliation | management, daily-projection |
| `focus-session-ownership` | Required Event/Task/timebox context for actual sessions | identity, task-timebox |
| `focus-session-capture` | Select or quick-create purpose before starting Timer | focus ownership, timebox management |
| `focus-session-history` | Canonical actual-session records and daily references | focus ownership, daily-projection |
| `timebox-utilization` | Planned-versus-actual Timeline presentation | timeline projection, focus history |
| `projection-recovery` | Idempotent retry, orphan detection, and rebuild | all projection producers |

Build order follows the dependency direction in the task plan.

## Approved domain model

```text
Scheduled Item
├─ Event (one planned interval)
│  └─ 0..n Focus Sessions (actual work)
└─ Task (canonical checkbox in a project/task-list note)
   ├─ optional due date
   └─ 0..n Timeboxes (planned work intervals)
      └─ 0..n Focus Sessions (actual work)
```

Identity levels are deliberately separate:

- `itemId`: global Event or Task identity; the canonical block is the source of truth.
- `timeboxId`: identity of one planned Task work interval.
- `sessionId`: identity of one actual Focus Session.
- `referenceBlockId`: identity of one derived Markdown projection.

References never reuse a canonical block ID. Duplicate full canonical records are forbidden.

## Canonical Markdown semantics

Event syntax remains Event syntax:

```markdown
- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc123
  - focus-session | start:2026-09-01 09:08 | end:2026-09-01 10:02 | duration:54m | mode:stopwatch ^focus-abc123-s1
```

Task syntax remains a Markdown checkbox. Multiple timeboxes become identified child entities rather than repeated owned fields on the Task line:

```markdown
- [ ] Menyusun laporan | due:2026-09-03 ^task-def456
  - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-def456-a1
    - focus-session | start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro ^focus-def456-s1
      - notes: Menyelesaikan bagian kesimpulan
```

Task timebox status is one of `planned`, `completed`, `skipped`, or `cancelled`. Completing a timebox does not complete its Task. Completing a Task cancels future planned timeboxes while preserving historical timeboxes and Focus Sessions.

The existing single-line `start`/`end` Task syntax remains readable and migrates losslessly to one child timebox. Migration must be explicit, idempotent, and covered by compatibility fixtures.

## Capture targeting

### Event

- Ordinary Event Capture uses the configured Periodical Notes profile, Event heading, and Event insert position.
- A coincidentally active Markdown note never overrides Event settings.
- An explicitly supplied contextual target remains authoritative.
- The automatic target is calculated from Planned Start and updates while the user has not manually edited `Save to file`.
- Manual target edits disable automatic path updates for that form instance.

### Task

- Task canonical location remains an explicitly selected project/task-list note.
- Task is never silently stored in a Daily Note.
- Promoting a Task to a Task Note moves canonical location without changing `itemId`, timebox IDs, session IDs, or references.

## Daily projections

- Projections are rebuildable derived records, not sources of truth.
- An Event receives a projection for every local calendar day touched by Planned Start/End; the start-day canonical block may serve as that day's representation.
- A Task timebox receives a projection for every local calendar day it touches.
- A Task with a due date receives a due projection even without a timebox.
- A Task without due date or timebox receives no automatic Daily projection.
- When due and timebox share a day, the index deduplicates the Task while preserving both semantic roles.
- Timeline expands one Event/timebox into per-day segments and deduplicates by `itemId` plus optional `timeboxId`.

Task references remain visually recognizable as checkbox Tasks and carry `task-ref`. Event references carry `event-ref` and do not use Task checkbox syntax. Parsers classify references before canonical entries.

### Event day reference grammar (decided during Task 32 implementation)

A reference mirrors the canonical Event line's date/title shape so it reads the same in a Daily Note, but carries an `event-ref-*` block id (never `event-*`) plus a `canonical:` field linking back to the source block. The `event-ref`/`task-ref` block-id namespace — not a different line shape — is what lets parsers classify a reference before a canonical entry:

```markdown
- 2026-09-02 09:00 - 12:00 Workshop | canonical:[[Projects/Team.md#^event-abc123]] ^event-ref-xxxxxxxxxx
- 2026-09-02 Conference | canonical:[[Projects/Team.md#^event-abc123]] ^event-ref-xxxxxxxxxx
```

The reference stores the Event's full start/end, not a per-day clipped interval; splitting a cross-midnight interval into the visible portion for one day is a Timeline rendering concern (Task 38), not a Markdown storage concern. Removal is self-describing: a reference is found by scanning for the line whose `canonical:` target matches, so no separate day→blockId index is required to keep it in sync. Task references (`task-ref`) will follow the same shape when Task 37 introduces Task due/timebox projections, preserving checkbox syntax per the rule above.

## Management and synchronization

- Active Note Manager resolves a reference to its canonical block and edits only the canonical record.
- Editing dates or canonical location reconciles all affected projections without changing stable IDs.
- Checking a Task reference is an intentional completion command: update canonical first, then reconcile every reference.
- Plugin-authored propagation must suppress watcher loops.
- Failed secondary writes produce a partial result and an idempotent retry receipt; they never roll back or duplicate a valid canonical write.
- Orphan references are reported and repairable, not silently promoted to new canonical items.

### Vault-wide rebuild and recovery (decided during Task 45 implementation)

Two commands cover full-vault recovery: **Rebuild Task/Event Daily projections** and **Repair orphaned Daily projection references**. Rebuild scans every canonical Task/Event block and every existing `task-ref`/`event-ref` line in the vault (via `scanVaultForProjectionReconciliation`, matched to Obsidian's block-id metadata cache the same way the mention index already does), then reconciles each *non-ambiguous* canonical item by calling the exact same `runTaskDayProjection`/`runEventDayProjection` functions an incremental edit uses — so a full rebuild and a single edit can never diverge in how they touch a Daily Note, and running rebuild twice in a row makes zero further changes (idempotent convergence).

A day-reference line doesn't encode its own day (a Task reference's grammar carries `due`/`timebox` roles but no date field); rather, the day is implicit in which dated Daily Note file the line lives in. `TargetResolver.resolveDailyFileDate` reverses the "daily" Periodical profile's folder/format to recover that day from the file path, so a reference found during a scan can still be compared against canonical truth.

Two vault-wide conditions an incremental edit never has to consider are classified separately:
- **Orphan** — an existing reference's `canonical:` target no longer matches any canonical block in the vault. Never auto-removed during rebuild; reported, then removed only by the explicit repair command, which deletes exactly the reported lines and nothing else.
- **Ambiguous** — the same canonical block id appears more than once in the vault. That target is skipped entirely (neither its creates nor its removes are applied) rather than guessing which copy is authoritative, mirroring how editing an ambiguous block is already refused elsewhere.

## Timebox Manager

Desktop provides a modal and mobile provides an equivalent full-screen flow using the same application service and validation.

The manager can list, add, edit, complete, skip, cancel, and safely delete timeboxes. Editing start/end preserves `timeboxId`. Planned timeboxes may be deleted with confirmation; historical deletion requires an explicit destructive action. End must be later than start. Cross-midnight timeboxes are valid. Same-Task overlap and after-due scheduling warn without silently rewriting user input.

Entry points include Create/Edit Task, Active Note Manager, Timeline, Task Note, and Daily Task reference. Opening from a Timeline segment selects that timebox.

## Focus Session ownership and capture

Focus Session is actual execution, not a Scheduled Item kind:

```ts
interface FocusSession {
    sessionId: string;
    ownerItemId: string;
    ownerKind: "task" | "event";
    timeboxId: string | null;
    actualStart: Date;
    actualEnd: Date;
    durationSeconds: number;
    plannedSeconds: number | null;
    mode: DisplayMode;
    notes: string;
    relatedNotes: string[];
    stressLevel: StressLevel | null;
    emotionCategory: EmotionCategory | null;
    moodKey: string | null;
}
```

- Every new Focus Session requires an Event or Task owner.
- A Task-owned session requires a timebox; if none exists, Timer offers explicit timebox creation and never creates one silently.
- An Event-owned session may attach directly because the Event already supplies the planned interval.
- One timebox may contain multiple Focus Sessions.
- Timer pause/resume remains one session; a later Pomodoro/Timer run creates another `sessionId`.
- Ending a Focus Session does not automatically complete its timebox or Task.
- Timer offers selection plus `Quick-create Task`; quick creation must write the Task and timebox successfully before Timer starts.

The canonical Focus Session is a child of its Task timebox or Event. The configured Focus Session Periodical target becomes a daily projection/log destination, not a second canonical source.

Legacy free-text Focus Session logs remain readable as `legacy/unassigned`. Migration never guesses ownership from a title; users may attach them manually.

### Canonical write and daily log resolution (decided during Task 43 implementation)

The canonical `focus-session` child line is appended — never replacing existing children — via a generic "insert as last child of an anchor block id" primitive shared with future nesting needs, so it works identically whether the anchor is an Event's own line or one of its Task's `timebox` lines. The write is idempotent by `sessionId`: retrying with the same id is a no-op rather than a duplicate, which is what makes automatic retry safe.

The existing free-text daily log template gains one new opt-in token, `{{canonicalLink}}` (`[[file#^sessionId]]`), left out of the default templates so existing users' logs render unchanged unless they add it themselves. If the canonical write fails because the owner's Task/Event can't currently be resolved (`orphan`), the daily log is still written with an empty `{{canonicalLink}}`, and a persistent Notice with a Retry button re-attempts only the canonical write, reusing the same `sessionId` minted for the first attempt.

## Timeline semantics

- Events render their planned interval and attached actual Focus Sessions.
- Tasks render each timebox independently while retaining one `taskId`.
- Cross-day intervals split visually at local day boundaries without changing identity.
- Timeline may show planned and actual layers together and calculate utilization.
- Clicking a projection or actual session navigates through stable IDs to canonical context.
- Completing a session, timebox, and Task remain three distinct actions.

### Utilization presentation (decided during Task 44 implementation)

`ScheduledItemIndexer` scans each Event's own line and each Task timebox's own line for nested `focus-session` children (via the Task 43 tree-walk in `scanFocusSessionsInBlock`) and attaches them to the matching `ScheduledItem`. `TimelineLayout` aggregates them into one `utilization: { plannedSeconds, focusedSeconds, sessionCount }` per block segment — `plannedSeconds` from the item's full interval, `focusedSeconds` the sum of every attached session's duration, so a timebox holding several sessions reports one combined total rather than requiring the caller to re-sum.

Timeline renders this as a thin actual/planned fill bar on the block (only once at least one session exists) plus a tooltip line ("Xm focused of Ym planned"); it never replaces the existing planned block or its click target. Clicking a Task-timebox segment still opens the Timebox Manager (Task 38's existing route), which now lists that timebox's actual Focus Sessions read-only beneath its controls — reaching both the session history and the owning Task/timebox context from one place, without adding session-level complete/edit actions that could be confused with timebox or Task completion.

## Commands

```powershell
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run check:ci
git diff --check
```

Runtime acceptance uses `pnpm run deploy:vault` only when the configured vault target is intentionally selected.

## Project structure

- Domain contracts: `src/features/capture/scheduled-item/domain/` and `src/features/focus-session/domain/`.
- Application orchestration: corresponding `application/` directories.
- Desktop/mobile presentation: existing feature `ui/desktop` and `ui/mobile` boundaries.
- Obsidian vault writers/readers: `src/infrastructure/obsidian/`.
- Unit/integration tests: `test/`; runtime evidence: `docs/`.

## Code style

Use discriminated unions and explicit IDs rather than nullable, title-based inference:

```ts
type FocusOwner =
    | { kind: "event"; itemId: string; timeboxId: null }
    | { kind: "task"; itemId: string; timeboxId: string };
```

Domain modules remain free of Obsidian and DOM imports. UI delegates mutation to application services. Writers receive validated operations rather than deciding domain policy.

## Testing strategy

- TDD for every task: failing behavior test, minimum implementation, refactor under green tests.
- Characterization fixtures protect current Event/Task and Focus log syntax before migration.
- Pure domain tests cover IDs, temporal validation, projection calculation, migration, and reconciliation.
- Integration tests cover parser/writer round trips, partial retries, watcher-loop suppression, Timeline deduplication, and canonical resolution.
- Desktop/mobile presentation contracts verify equivalent actions without sharing DOM code.
- Final runtime acceptance covers create/edit/promote, multi-day projection, checkbox propagation, timebox management, Timer selection, legacy logs, and recovery.

## Boundaries

### Always

- Preserve one canonical source and stable identities.
- Use local-calendar boundaries consistently.
- Write canonical changes before rebuildable projections.
- Preserve existing Markdown and settings until an explicit migration succeeds.

### Ask first

- Change the approved Markdown grammar or completion semantics.
- Add automatic ownership guesses for legacy sessions.
- Add drag/resize Timeline scheduling or recurring timeboxes.
- Delete historical timeboxes or Focus Sessions automatically.

### Never

- Store two editable canonical copies of one item.
- Reuse canonical block IDs for references.
- Start a new unowned Focus Session.
- Treat due date as a Task duration.
- Conflate Focus Session, timebox, and Task completion.

## Success criteria

- Settings-driven Event capture, manual override, and Event position work identically on desktop/mobile.
- Canonical Event/Task records are manageable from every derived Daily reference.
- Multi-day Event/timebox segments appear on every relevant Timeline day without duplicate identity.
- A Task supports multiple independently identified timeboxes and multiple actual sessions per timebox.
- Task reference completion updates canonical first and converges all projections without loops.
- Timer requires purpose, supports explicit quick planning, and records actual sessions under canonical context.
- Legacy Scheduled Items and Focus logs remain readable and migrate without data loss.
- Retry/rebuild repairs partial or orphaned projections idempotently.
- Full automated and recorded desktop/mobile acceptance gates pass.

## Traceability and acceptance evidence (Task 46)

Each success criterion above maps to automated coverage; the last one is intentionally split, since a local gate cannot certify real-device runtime behavior.

| Success criterion | Automated evidence |
| --- | --- |
| Settings-driven Event capture, manual override, and position work identically on desktop/mobile | `desktop-scheduled-item-form-structure.test.ts`, `mobile-scheduled-item-form-structure.test.ts`, `mobile-scheduled-item-form-composition.test.ts`, `scheduled-item-event-target-auto-sync.test.ts` |
| Canonical Event/Task records are manageable from every derived Daily reference | `active-note-manager-reference-wiring.test.ts`, `canonical-scheduled-item-resolver.test.ts`, `scheduled-item-editor-timebox-navigation.test.ts` |
| Multi-day Event/timebox segments appear on every relevant Timeline day without duplicate identity | `event-day-projection-edit-wiring.test.ts`, `timeline-layout.test.ts`, `timeline-capture-integration.test.ts` |
| A Task supports multiple independently identified timeboxes and multiple actual sessions per timebox | `task-timebox-line.test.ts`, `task-timebox-operations.test.ts`, `canonical-focus-session-append.test.ts`, `focus-session-block-scan.test.ts`, `scheduled-item-block-editor.test.ts` |
| Task reference completion updates canonical first and converges all projections without loops | `task-reference-completion-sync.test.ts`, `task-reference-checkbox-watcher-wiring.test.ts`, `write-suppression-tracker.test.ts` |
| Timer requires purpose, supports explicit quick planning, and records actual sessions under canonical context | `timer-purpose-gate.test.ts`, `timer-purpose-selection-wiring.test.ts`, `timer-canonical-focus-session-wiring.test.ts`, `canonical-focus-session-writer.test.ts` |
| Legacy Scheduled Items and Focus logs remain readable and migrate without data loss | `task-timebox-migration.test.ts`, `scheduled-item-migration-contract.test.ts`, `scheduled-item-identity-migration.test.ts`, `event-task-markdown-compatibility.test.ts`, `compatibility-identifiers.test.ts` |
| Retry/rebuild repairs partial or orphaned projections idempotently | `task-day-reference-reconciliation.test.ts`, `event-day-reference-reconciliation.test.ts`, `projection-reconciliation-scan.test.ts`, `projection-reconciliation-runner-wiring.test.ts` |
| Full automated and recorded desktop/mobile acceptance gates pass | Automated: `pnpm run check:ci` (all suites, build, docs). Recorded real-device desktop/mobile acceptance: **not yet performed** — this session has no live Obsidian environment; treat runtime behavior as code-reviewed and unit-tested, not device-verified, until a human runs `pnpm run deploy:vault` against a real vault on desktop and mobile. |

## Migration and legacy handling

- **Legacy single-line Task timebox → child timebox (Task 33).** The old inline `start`/`end` fields on a Task line migrate losslessly to one `planned` child timebox the first time the Task is touched; `migrateLegacyTaskTimebox` is idempotent, so re-running it against an already-migrated Task is a no-op (`task-timebox-migration.test.ts`).
- **Legacy free-text Focus Session logs.** Sessions logged before Task 41–43 (or any session started with no Task/Event purpose selected) stay exactly as `legacy/unassigned`: the daily log entry renders with today's templates, and `{{canonicalLink}}` is simply empty. Nothing retroactively guesses ownership from a title.
- **Daily projections.** `task-ref-*`/`event-ref-*` lines are always derived; deleting or hand-editing one is safe because the "Rebuild Task/Event Daily projections" command (Task 45) regenerates the expected set from canonical truth on demand.

## Known limitations

- **Ambiguous canonical block ids are skipped, not resolved.** If the same `task-*`/`event-*` block id exists more than once in the vault (hand-copied text, a merge artifact), every projection/reconciliation path refuses to touch that identity rather than guessing which copy is authoritative. The duplicate must be fixed manually (rename one block id) before its projections converge again.
- **Orphan reference repair is a manual two-step command.** "Rebuild Task/Event Daily projections" only reports orphaned references (a `canonical:` target that no longer resolves); "Repair orphaned Daily projection references" must be run afterward to actually delete them. This is deliberate — see Management and synchronization above — but means a rebuild alone does not shrink a vault with stale references.
- **Deleting a timebox deletes its Focus Session history.** A timebox and everything nested under it (its actual Focus Sessions, any notes) are one unit; deleting the timebox removes all of it. Confirmation is required whenever the timebox is historical *or* already has a logged Focus Session, specifically to guard against losing that history by accident (Task 46 hardening, `task-timebox-operations.test.ts`).
- **Event-owned Focus Sessions have no dedicated history list yet.** Timebox Manager lists a Task timebox's actual sessions read-only; the Event Edit form does not yet show the equivalent list for an Event-owned session. Timeline's tooltip and fill bar still show planned-vs-actual utilization for both kinds.
- **Rebuild scans the whole vault.** "Rebuild Task/Event Daily projections" reads every Markdown file's cached blocks with no batching or progress indicator; on very large vaults this may take a moment. It is a manual, on-demand command, never triggered automatically.

## Deferred scope

- Timeline drag/resize.
- Recurring timeboxes.
- Automatic Task completion from utilization.
- Automatic semantic matching of legacy free-text sessions.
- Collaborative multi-device conflict resolution beyond deterministic canonical-first reconciliation.
