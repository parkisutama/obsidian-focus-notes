# Spec: Scheduled Item, Daily Projection, Timebox, and Focus Session Integration

## Status

- Specification approved in conversation on 2026-08-30.
- Planning only; implementation starts after refactor Task 28 is closed.
- This spec supersedes the single-timebox portion of `spec-task-event-line-semantics.md` once its migration task ships. Existing Task/Event syntax remains compatible until then.

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

## Management and synchronization

- Active Note Manager resolves a reference to its canonical block and edits only the canonical record.
- Editing dates or canonical location reconciles all affected projections without changing stable IDs.
- Checking a Task reference is an intentional completion command: update canonical first, then reconcile every reference.
- Plugin-authored propagation must suppress watcher loops.
- Failed secondary writes produce a partial result and an idempotent retry receipt; they never roll back or duplicate a valid canonical write.
- Orphan references are reported and repairable, not silently promoted to new canonical items.

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

## Timeline semantics

- Events render their planned interval and attached actual Focus Sessions.
- Tasks render each timebox independently while retaining one `taskId`.
- Cross-day intervals split visually at local day boundaries without changing identity.
- Timeline may show planned and actual layers together and calculate utilization.
- Clicking a projection or actual session navigates through stable IDs to canonical context.
- Completing a session, timebox, and Task remain three distinct actions.

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

## Deferred scope

- Timeline drag/resize.
- Recurring timeboxes.
- Automatic Task completion from utilization.
- Automatic semantic matching of legacy free-text sessions.
- Collaborative multi-device conflict resolution beyond deterministic canonical-first reconciliation.
