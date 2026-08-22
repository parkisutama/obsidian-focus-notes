# Spec: Task and Event Single-Line Semantics

## Status

Living contract with three maturity levels:

- **Implemented** describes Markdown currently written and parsed by Focus Notes.
- **Implemented; acceptance pending** describes runtime and automated verification that still lacks recorded real-device
  acceptance.
- **Proposed** describes an approved direction that still requires explicit implementation work before users can rely on it.

Examples marked Proposed are not runtime documentation. A proposal becomes Implemented only after the domain types, writer,
parser, views, compatibility fixtures, and user documentation agree.

## Objective

Define one canonical reference for Task and Event records stored in the `Activities & Tasks` Markdown ledger. The contract
keeps portable Markdown as the source of truth while allowing Focus Timeline and future list/card views to project the same
records without creating a second lifecycle database.

This specification covers the semantic record on the first line. Indented description and detail-link lines belong to the
record but are not metadata segments:

```markdown
- [ ] Review the proposal | due:2026-08-10 ^task-7k3m9x2pqw
    - Compare the revised budget.
    - detail: [Proposal review](../Tasks/Proposal%20review.md)
```

## Shared lexical rules

- A record begins with `- ` and occupies one primary Markdown line.
- The title is human-readable text and may contain Markdown links or Wikilinks.
- Metadata segments follow the title and are separated by the exact visual boundary ` | `.
- Metadata uses `key:value`; keys are interpreted case-insensitively and canonical writers emit lowercase keys.
- Dates use `YYYY-MM-DD`; local date-times use `YYYY-MM-DD HH:MM` in the user's Obsidian environment.
- A canonical record ends with a stable Obsidian block ID. Focus Notes writes `^task-<10 Base32 characters>` for Tasks and
  `^event-<10 Base32 characters>` for Events. The suffix carries 50 random bits and is structural syntax, not a
  ` | key:value` metadata segment.
- Historical `^fn-task-...` and `^fn-event-...` IDs remain valid and are never renamed automatically, because changing an
  existing ID would break references.
- The block ID is the stable runtime identity. Source file, ledger heading, and line number remain provenance and provide
  a compatibility fallback for legacy records that have not been migrated yet.
- Legacy records without a block ID remain readable. Saving one through Edit adds an ID; Manage's Format preview can add
  IDs to all eligible records in the selected scope without silently rewriting the note.
- A literal ` | ` in a title is outside the current writer contract because it is reserved as the metadata boundary.
- Frontmatter on a Project, Activity, Person, Place, or other Object note classifies that note. It does not replace the
  lifecycle or schedule stored on an individual ledger line.

## Task semantics — Implemented

A Task is a completable commitment. Checkbox state owns completion:

```markdown
- [ ] Open task ^task-7k3m9x2pqw
- [x] Completed task ^task-r4n8c2v6yz
```

Both lowercase and uppercase checked markers (`[x]` and `[X]`) parse as completed. Completion is independent of scheduling:
a completed Task may retain its original due date, timebox, and reminders as historical context.

### Implemented Task attributes

| Attribute | Value | Cardinality written by UI | Meaning |
|---|---|---:|---|
| checkbox | `[ ]`, `[x]` | exactly one | Open or completed state |
| `due` | date or date-time | zero or one | Deadline; a date-only value has no exact due time |
| `start` | date-time | zero or one | Beginning of an optional work timebox |
| `end` | date-time | zero or one | End of the optional work timebox |
| `remind` | date-time | zero or more | Reminder points associated with the Task |

Canonical examples:

```markdown
- [ ] Unscheduled task ^task-b5h7j3s9wx
- [ ] Submit invoice | due:2026-08-10 ^task-c8m4q2t7vy
- [ ] Join submission call | due:2026-08-10 14:00 ^task-d6n9r3w5xz
- [ ] Draft report | start:2026-08-09 09:00 | end:2026-08-09 11:00 ^task-f2p8s4y6za
- [ ] Finalize report | due:2026-08-10 | start:2026-08-09 09:00 | end:2026-08-09 11:00 | remind:2026-08-09 08:30 ^task-g7q3t9x2bc
- [x] Submitted invoice | due:2026-08-10 ^task-h4r8v2z6de
```

### Implemented Task validation and projection

- An enabled timebox requires valid `start` and `end` values, with `end` later than `start`.
- UI-created reminders require valid dates and times.
- A Task is eligible for Focus Timeline only when it is under an accepted ledger heading and has at least one recognized
  schedule attribute: `due`, `start`, `end`, or `remind`.
- An unscheduled checkbox remains valid Markdown but is not a Timeline item.
- Completed Tasks can be included or excluded by the Timeline completed-item filter.
- Pending/overdue evaluation uses the first available anchor in this order: `due`, `end`, `start`, then `remind`.
- A timeboxed Task may render as a time block, but remains a Task; it does not become an Event.
- Although the writer can emit multiple `remind` segments, the current `ScheduledItem` projection retains only the last
  successfully parsed reminder. Multiple-reminder UI data is therefore preserved in Markdown but not fully represented by
  Timeline.
- For repeated recognized keys, the current parser also retains the last successfully parsed value. This is compatibility
  behavior, not approval of duplicate keys for new records.
- Malformed recognized values become absent fields in the parsed projection; the parser does not currently surface a
  line-level diagnostic.

The current parser ignores unrecognized metadata segments rather than storing their semantics. Writers and integrations
must not rely on an ignored segment until it becomes part of this contract.

## Task priority — Implemented; acceptance pending

Priority is an attribute orthogonal to checkbox completion and schedule. The canonical grammar is:

```markdown
- [ ] Resolve production regression | priority:high ^task-j3s7w5b9fg
- [ ] Review migration notes | priority:medium | due:2026-08-10 ^task-k6t2x8c4hm
- [ ] Organize references | priority:low ^task-m9v3y7d5jn
```

Implemented values:

| Value | Meaning |
|---|---|
| `high` | Important and should receive attention before lower-priority comparable work |
| `medium` | Above the ordinary baseline but below high priority |
| `normal` | Default; no special priority treatment |
| `low` | Intentionally lower than ordinary work |

Implemented rules:

- Omitted `priority` means `normal`; the writer omits `priority:normal` for concise Markdown.
- Priority does not imply due date, completion, cancellation, blocking, or Event status.
- Historical priority remains on a completed Task unless a user explicitly edits the source line.
- Desktop and mobile Task forms accept only canonical values.
- A parser does not silently map an unknown value such as `urgent` to `high`; invalid or duplicate priority metadata safely
  projects as `normal` while the original Markdown remains untouched.
- Overdue/due-time ordering remains stronger than priority in pending views; priority breaks ties among comparable work.
- Timeline detail exposes the selected priority.
- When Task detail-note priority frontmatter is enabled, it uses the selected value instead of a hardcoded default.

Domain-model, parser, writer, desktop/mobile form, modal, pending-query, frontmatter, and round-trip tests are implemented.
Repeatable real Obsidian desktop/mobile acceptance remains open.

## Event semantics — Implemented

An Event is an occurrence that occupies time. It has no completion checkbox.

Canonical timed Event:

```markdown
- 2026-08-10 09:00 - 10:00 Review proposal ^event-7k3m9x2pqw
```

The end may include a full date for a cross-date interval accepted by the parser:

```markdown
- 2026-08-10 23:00 - 2026-08-11 00:30 Overnight maintenance ^event-r4n8c2v6yz
```

Implemented behavior:

- Start and end must parse as valid local date-times.
- End must be later than start.
- The interval is the planned occurrence rendered by Focus Timeline.
- Event status currently appears as `Scheduled`; there is no implemented completed or cancelled Event state.
- The current writer can emit an all-day-looking dated bullet, but the parser intentionally does not classify an arbitrary
  dated bullet as an Event because that would capture ordinary Markdown. This is a known compatibility boundary, not a
  reliable all-day lifecycle contract.

## Event occurrence lifecycle — Implemented; acceptance pending

The implemented Event lifecycle is intentionally separate from Task checkbox completion:

| Status | Meaning |
|---|---|
| `planned` | The occurrence is scheduled; omission of status remains backward-compatible with this state |
| `completed` | The occurrence happened; without actual fields it happened according to plan |
| `cancelled` | The occurrence did not happen and cannot carry actual time |

Canonical examples:

```markdown
- 2026-08-10 09:00 - 10:00 Review proposal | status:completed ^event-b5h7j3s9wx
- 2026-08-10 09:00 - 10:00 Review proposal | status:completed | actual-start:2026-08-10 09:12 | actual-end:2026-08-10 10:18 ^event-c8m4q2t7vy
- 2026-08-10 09:00 - 10:00 Review proposal | status:cancelled ^event-d6n9r3w5xz
- 2026-08-10 Company holiday | type:event | all-day:true ^event-f2p8s4y6za
```

Reserved Event attributes are `type`, `all-day`, `status`, `actual-start`, and `actual-end`. Actual start/end must
appear as a valid ordered pair and only on a completed Event. Detailed validation, compatibility, migration, and open product
questions remain governed by [Event Occurrence Lifecycle](spec-event-occurrence-lifecycle.md).

The domain model, parser, writer, desktop/mobile creation forms, validation, all-day Timeline projection, lifecycle styling,
and actual-time detail presentation are implemented with automated verification. Editing an existing source occurrence and
repeatable real-device acceptance remain separate open work.

## Semantic separation

| Concern | Task | Event |
|---|---|---|
| Core meaning | Completable commitment | Time-bound occurrence |
| Primary state | Checkbox `[ ]` or `[x]` | `planned`, `completed`, `cancelled` |
| Planned time | Optional due/timebox/reminders | Required interval for implemented timed Events |
| Actual time | Not defined | Optional completed-occurrence pair |
| Priority | Independent `high`, `medium`, `normal`, `low` attribute | Not defined by this contract |
| Canonical authority | Markdown ledger line | Markdown ledger line |

Never infer one concept from another: a high-priority Task is not necessarily urgent, a timeboxed Task is not an Event, and
a completed Event is not a checked Task.

## References and navigation

A Task or Event may be mentioned outside its owning ledger without duplicating its lifecycle data. Use Obsidian's native
block link or embed syntax:

```markdown
[[Tasks.md#^task-7k3m9x2pqw|Submit invoice]]
![[Calendar.md#^event-r4n8c2v6yz]]
```

The ledger line remains the sole editable source. Native block links provide navigation and page preview. Focus Timeline
opens the block target when an ID exists and falls back to the recorded source line for a legacy record.

In Focus Notes rich Markdown fields, typing `@` first offers Task and Event categories alongside contextual Object Notes.
Choosing Task or Event enters a kind-scoped fuzzy search (`@task <query>` or `@event <query>`). Selection stores an
ordinary cross-file block link; the trigger text is never persisted. Only records with unique stable block IDs are offered.
The shared lazy index uses Obsidian's block metadata to read only files containing scheduled-item IDs, updates individual
file buckets after metadata/create/rename/delete events, and limits each rendered result set to 20 candidates.

Escape closes an active suggestion without closing its form. Backspace retains the existing cancellation behavior and
suppresses reopening at the same trigger position until a new trigger is typed.

## Extension rules

Before adding a Task or Event attribute:

1. Define which record kinds own it and whether omission has a deterministic meaning.
2. Define validation, duplicate-key behavior, unknown-value behavior, sorting/filtering effects, and source-line preservation.
3. Add representative legacy and candidate Markdown fixtures before changing the parser.
4. Update domain types, writer, parser, query/projection, detail presentation, desktop/mobile forms, and public documentation.
5. Prove writer/parser round trips and ensure old valid Markdown remains byte-for-byte compatible.
6. Record real Obsidian desktop/mobile acceptance separately from automated verification.

Potential future Task states such as `blocked`, `waiting`, `cancelled`, `deferred`, recurrence, progress percentage, and
delegation are deliberately undefined. They must not be inferred from title text, tags, priority, or Object-note frontmatter.

## Implementation map

| Concern | Current source |
|---|---|
| Task/Event record construction and validation | `src/EventTaskFormState.ts` |
| Canonical writer | `src/EventTaskMarkdown.ts` |
| Ledger parser | `src/ScheduledItemParser.ts` |
| Parsed projection type | `src/ScheduledItemTypes.ts` |
| Timeline eligibility and pending semantics | `src/ScheduledItemQuery.ts` and `src/ScheduledItemIndexer.ts` |
| Detail presentation | `src/TimelineItemModalModel.ts` |
| Writer/parser compatibility contract | `test/event-task-markdown-compatibility.test.ts` |
| Capture-to-Timeline integration | `test/timeline-capture-integration.test.ts` |

## Change gate

A semantic is **Implemented** only when all relevant code paths and compatibility tests exist and `pnpm run check:ci` passes.
A green automated gate does not replace desktop/mobile acceptance. Proposed syntax must not be advertised as available in
user-facing instructions until runtime implementation and acceptance are complete.
