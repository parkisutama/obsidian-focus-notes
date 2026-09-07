# Spec: Timeline Actual Time

Module id: `timeline-actual-time`

## Objective

Show where planned time and actual focused time occurred without pretending that a Focus Session belongs to a specific
Timebox. Provide an owner-level summary for Event/Task while keeping Markdown as canonical input, not derived-summary storage.

## Commands and project structure

- Timeline domain/read models: `src/features/timeline/domain/`
- Timeline query/application: `src/features/timeline/application/`
- Timeline UI: `src/features/timeline/ui/`
- Tests: `test/timeline-*`, utilization and layout tests
- Verify: focused Timeline tests; `pnpm run check`; representative performance check; desktop/mobile runtime acceptance

## Canvas presentation

- Timeboxes render as planned segments using a visually lighter/outlined treatment.
- Focus Sessions render as independent actual segments at their recorded start/end using a solid treatment.
- Planned and actual segments share their owner Event/Task color but retain distinct styles and segment IDs.
- Temporal overlap never creates a persisted or inferred Timebox-to-session relation.
- Event planned time comes from the Event interval; Task planned time comes from its Timeboxes.
- Clicking either segment opens the same owner Timeline Item Modal with the selected segment context.

## Derived summary placement

- Canvas: visual planned and actual segments only; no verbose aggregate text.
- Hover tooltip: selected segment type, interval, duration, and compact Reflection context when present.
- Timeline Item Modal: complete owner-level planned/focused summary plus selected-segment details.
- Event/Task Manage modal: compact reuse of the same read model above the Timebox/Focus Session lists.
- Markdown: no summary fields are written.

Example modal summary:

```text
Time usage
Planned time       5h 30m · 3 timeboxes
Focused time       2h 28m · 3 focus sessions
Difference        -3h 02m
Focused / planned  45%
```

## Calculation rules

- Task planned seconds are the sum of its non-cancelled Timebox durations.
- Event planned seconds are its canonical planned interval duration.
- Focused seconds are the sum of canonical Focus Session `duration` values owned by the item.
- Counts are independent: `timeboxCount` and `sessionCount` never imply pairings.
- Difference is `focusedSeconds - plannedSeconds`.
- Percentage is `focusedSeconds / plannedSeconds`; absent/zero planned time displays `—`, not infinity.
- Summary covers the complete canonical owner block, while individual canvas segments remain clipped to the visible day/range.

## Code style

```ts
interface OwnerTimeSummary {
    plannedSeconds: number;
    focusedSeconds: number;
    timeboxCount: number;
    sessionCount: number;
}
```

## Testing strategy

- Summary tests for multiple sibling Timeboxes and sessions, sessions outside planned intervals, and zero planned time.
- Event summary tests using the Event interval.
- Layout tests proving actual segments appear at actual timestamps and retain session identity.
- Tooltip/modal presentation model tests.
- Tests proving no derived summary is persisted.
- Representative performance test for many sessions in Day and Weekly modes.

## Boundaries

- Always: derive from canonical records; preserve selected segment identity; distinguish planned and actual visually and textually.
- Ask first: add a global dashboard, daily rollup persistence, or inferred attribution between segments.
- Never: store summary fields in Markdown; hide sessions outside Timeboxes; treat utilization as Task/Event completion.

## Success criteria

- Every canonical Focus Session appears as an actual Timeline segment.
- Multiple Task Timeboxes and Focus Sessions display without parent-child attribution.
- Clicking a segment reveals owner-level totals and that segment's exact details.
- Tooltip, Timeline modal, and Manage modal agree because they consume one summary read model.
- Summary values update immediately when canonical Timeboxes or Focus Sessions change.

## Open questions

None. Summary placement and non-persistence were approved in conversation on 2026-09-01.
