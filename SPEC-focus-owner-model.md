# Spec: Focus Owner Model

Module id: `focus-owner-model`

## Objective

Record actual Focus Sessions directly under the selected canonical Event or Task. A Task Focus Session no longer requires,
references, or nests under a Timebox. Timeboxes remain planned intervals; Focus Sessions remain actual intervals.

## Commands and project structure

- Domain: `src/features/focus-session/domain/`
- Focus UI/application: `src/features/focus-session/ui/`
- Obsidian writer: `src/infrastructure/obsidian/focus-session/`
- Tests: `test/*focus-session*`, `test/timer-purpose*`
- Verify: `pnpm run typecheck`; `pnpm test`; `pnpm run check`

## Ownership contract

```ts
type FocusSessionOwner =
    | { kind: "event"; itemId: string }
    | { kind: "task"; itemId: string };
```

- Selecting an existing Event or Task is sufficient to start Focus.
- Task readiness never depends on a selected or newly created Timebox.
- Quick-create Task remains explicit; it creates the Task owner and then selects it, without creating a Timebox.
- Stopping Focus appends one `focus-session:` direct child to the resolved canonical owner.
- Event and Task use the same item-ID anchor insertion rule.
- Session retry reuses its `sessionId` and remains idempotent.
- Focus logging never creates a missing owner or guesses a replacement when resolution is orphaned/ambiguous.

## Canonical examples

```markdown
- Event title ^event-abc
    - focus-session: start:2026-09-01 09:00 | end:2026-09-01 10:00 | duration:1h | mode:stopwatch ^focus-event-s1
```

```markdown
- [ ] Task title ^task-def
    - timebox: start:2026-09-01 08:00 | end:2026-09-01 09:00 | status:planned ^timebox-def-a1
    - focus-session: start:2026-09-01 09:12 | end:2026-09-01 09:37 | duration:25m | mode:pomodoro ^focus-task-s1
```

The Focus Session is a sibling of every Task Timebox, even if actual time overlaps a planned interval.

## Testing strategy

- Domain tests for owner construction and removal of `task-requires-timebox` behavior.
- Timer purpose tests proving Event and Task are ready without Timebox selection.
- Canonical append tests proving Event/Task direct-child placement and canonical ordering.
- Retry/orphan tests proving no owner or duplicate session is created.
- Parser/index tests proving Focus Sessions remain attributable to their containing item.

## Boundaries

- Always: resolve the canonical item before write; mint one session ID per Timer run; preserve actual timestamps.
- Ask first: permit Moment as a Focus owner or introduce a new Focus owner kind.
- Never: infer a Timebox relation from temporal overlap; create a Timebox silently; append to a Daily projection as canonical truth.

## Success criteria

- A Task Timer starts with only a resolvable Task selected.
- Stopping Focus writes beneath that Task, not beneath any Timebox.
- Multiple Focus Sessions and multiple Timeboxes coexist as siblings.
- Event-owned behavior remains direct and idempotent.
- Daily/weekly Focus logs continue to link to the canonical session.

## Open questions

None. Direct Event/Task ownership was approved in conversation on 2026-09-01.
