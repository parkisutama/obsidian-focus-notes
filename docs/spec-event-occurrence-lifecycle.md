# Spec: Event Occurrence Lifecycle

## Status

Implemented with automated verification; repeatable real Obsidian desktop/mobile acceptance remains open. The approved
grammar is canonical for new writes, while legacy timed Event lines remain compatible without file mutation.

## Objective

Represent the lifecycle of an Event occurrence in portable Markdown without weakening the existing distinction between Event and Task.

The lifecycle must support:

- a planned occurrence;
- an occurrence completed according to plan;
- an occurrence completed at a different actual time;
- a cancelled occurrence;
- old Event lines written before this lifecycle existed.

The same parsed record will feed Focus Timeline and the future Activity & Tasks Card/List View. Markdown remains canonical; neither view owns a separate database.

## Terminology

- **Planned time**: the start and end already present in the Event line.
- **Actual time**: optional observed start and end, written only when materially different from the plan.
- **Event status**: `planned`, `completed`, or `cancelled`.
- **Task completion**: represented only by Markdown checkbox state and never by Event status metadata.

## Canonical Markdown grammar

### Planned timed Event

The existing format remains canonical. Omitted status means `planned`:

```markdown
- 2026-08-03 09:00 - 10:00 Review proposal
```

The explicit form is accepted but the writer does not need to emit it:

```markdown
- 2026-08-03 09:00 - 10:00 Review proposal | status:planned
```

### Completed according to plan

```markdown
- 2026-08-03 09:00 - 10:00 Review proposal | status:completed
```

Absence of actual fields means the planned interval is also the actual interval.

### Completed at a different actual time

```markdown
- 2026-08-03 09:00 - 10:00 Review proposal | status:completed | actual-start:2026-08-03 09:12 | actual-end:2026-08-03 10:18
```

`actual-start` and `actual-end` form one optional pair. A partial pair is invalid and must not silently fall back to planned time.

### Cancelled

```markdown
- 2026-08-03 09:00 - 10:00 Review proposal | status:cancelled
```

A cancelled Event cannot carry actual time.

### All-day Event

The old writer format is visually ambiguous with an ordinary dated bullet:

```markdown
- 2026-08-03 Company holiday
```

New all-day Events therefore require an explicit marker:

```markdown
- 2026-08-03 Company holiday | type:event | all-day:true
```

Status may follow the same rules:

```markdown
- 2026-08-03 Company holiday | type:event | all-day:true | status:cancelled
```

Old ambiguous all-day lines remain readable Markdown but cannot be automatically classified as Events without risking false positives. They are not rewritten automatically.

## Reserved Event metadata

Metadata segments appear after the title and are separated with ` | `.

| Key | Values | Rule |
|---|---|---|
| `type` | `event` | Required only for the new all-day grammar |
| `all-day` | `true` | Valid only with `type:event` |
| `status` | `planned`, `completed`, `cancelled` | Omitted means `planned` |
| `actual-start` | `YYYY-MM-DD HH:MM` | Requires `actual-end` and `status:completed` |
| `actual-end` | `YYYY-MM-DD HH:MM` | Must be later than `actual-start` |

Metadata keys are case-insensitive when parsed and emitted in lowercase by the writer. Unknown metadata remains preserved text until a later grammar explicitly owns it.

Titles containing a literal pipe are outside the v1 writer contract because the current Task grammar already reserves ` | ` as the metadata boundary. Markdown links continue to work as titles.

## Domain model

The parsed Event adds fields equivalent to:

```ts
type EventOccurrenceStatus = "planned" | "completed" | "cancelled";

interface EventOccurrence {
    status: EventOccurrenceStatus;
    plannedStart: Date;
    plannedEnd: Date;
    actualStart: Date | null;
    actualEnd: Date | null;
    allDay: boolean;
}
```

Existing `ScheduledItem.start` and `end` remain the planned interval during the compatibility transition. Actual fields do not replace them.

## View semantics

### Focus Timeline

- Planned Event: render at planned time using normal Event treatment.
- Completed Event: remain at planned position; expose actual time in the detail modal. A later, separately approved visualization may overlay variance.
- Cancelled Event: remain retrievable but use cancelled styling and may be hidden by a status filter.
- Task: continue using checkbox completion and existing timebox/due semantics.

### Activity & Tasks Card/List View

- List all ledger records across time, including unscheduled Tasks.
- Filter Event status separately from Task checkbox state.
- Default status groups: `Open`, `Completed`, and `Cancelled`.
- `Open` contains planned Events and unchecked Tasks.
- Clicking any record reuses the Timeline detail modal and exact source navigation.

## Compatibility and migration

- Existing valid timed Event lines parse as `planned` without file mutation.
- Existing Task lines retain checkbox semantics byte-for-byte.
- Existing Event titles and Markdown links remain valid when no reserved suffix exists.
- `status: scheduled` from promoted-note frontmatter may be interpreted as the legacy equivalent of `planned`, but new Event ledger lines emit `planned` only when an explicit status is needed.
- Existing ambiguous all-day lines cannot be migrated automatically. A future manual migration command may add `type:event | all-day:true` after user confirmation.
- No background process rewrites Daily Notes.

## Validation and failure behavior

- Unknown status: reject lifecycle metadata and surface the line as unsupported rather than inventing a status.
- Only one of each reserved key is allowed.
- Actual start and end must be present together, valid, and ordered.
- Actual fields require `status:completed`.
- Cancelled Events cannot carry actual fields.
- Invalid lifecycle metadata never falls back to the current date or time.

## Implementation boundary

### Always

- Keep old and canonical lines locked in parser fixtures before modifying runtime behavior.
- Keep Event status distinct from Task checkbox completion.
- Preserve planned time when actual time is recorded.
- Retain exact source file, heading, and line provenance.
- Run `pnpm run check:ci` before each implementation commit.

### Ask first

- Introduce another Event status.
- Visualize planned-versus-actual variance directly on Timeline.
- Add an automatic migration command for ambiguous all-day lines.
- Add editing of historical Event lines from the detail modal.

### Never

- Convert Event occurrences into checkbox Tasks.
- Rewrite existing Daily Notes during settings migration.
- Treat an arbitrary dated bullet as an all-day Event.
- Store lifecycle state only in an internal database.

## Project structure

| Concern | Location |
|---|---|
| Lifecycle specification | `docs/spec-event-occurrence-lifecycle.md` |
| Parsed types | `src/ScheduledItemTypes.ts` |
| Ledger parser | `src/ScheduledItemParser.ts` |
| Event writer | `src/EventTaskMarkdown.ts` |
| Detail presentation | `src/TimelineItemModalModel.ts` |
| Parser/writer compatibility tests | `test/event-task-markdown-compatibility.test.ts` |
| Lifecycle-specific fixtures | `test/event-occurrence-lifecycle.test.ts` |

## Commands

```bash
node --test test/event-occurrence-lifecycle.test.ts test/event-task-markdown-compatibility.test.ts
pnpm run typecheck
pnpm run check:ci
```

## Testing strategy

1. Parser fixtures establish backward compatibility and canonical lifecycle semantics.
2. Writer/parser round-trip tests prove emitted metadata is consumed without corrupting linked titles.
3. Query tests prove planned, completed, and cancelled Events can be filtered independently from Tasks.
4. Presentation-model tests cover planned/actual labels and missing optional actual time.
5. Manual Obsidian acceptance covers source navigation and readable raw Markdown.

## Success criteria

- Old timed Events parse as planned without modification.
- Planned, completed, actual-time, cancelled, and new all-day examples parse deterministically.
- Invalid actual pairs and status combinations are rejected explicitly.
- Task checkbox semantics do not change.
- Timeline and Card/List View can consume one lifecycle model without owning separate state.
- Representative Markdown examples receive explicit user approval before implementation.

## Approved decisions

1. `completed` is the canonical Event lifecycle term.
2. A completed Event without actual fields means that it occurred according to plan.
3. New all-day Events use the explicit `type:event | all-day:true` marker.
4. Cancelled Events remain visible by default in Timeline with distinct presentation.
