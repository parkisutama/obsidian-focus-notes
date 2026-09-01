# Spec: Flat Block Grammar

Module id: `flat-block-grammar`

## Objective

Define one line-oriented Markdown grammar that is readable in Obsidian, deterministic for Focus Notes, and straightforward
to transform into tables with Python or similar tools. Named child prefixes replace ambiguous plain description bullets and
the partially implemented Task reflection fields on the owner line.

## Tech stack and commands

- TypeScript 5.9 domain modules under `src/features/**/domain`.
- Node 24 `node:test` tests under `test/`.
- Format: `pnpm run format:check`
- Lint: `pnpm run lint`
- Typecheck: `pnpm run typecheck`
- Test: `pnpm test`
- Full gate: `$env:OBSIDIAN_VAULT_PLUGIN_PATH=""; pnpm run check:ci`

## Canonical grammar

```markdown
- [ ] Task title | priority:high | due:2026-09-03 17:00 ^task-def456
    - description: One physical line of free text with inline [[Markdown links]].
    - timebox: start:2026-09-01 09:00 | end:2026-09-01 11:00 | status:completed ^timebox-def456-a1
    - focus-session: start:2026-09-01 09:12 | end:2026-09-01 09:37 | duration:25m | mode:pomodoro ^focus-def456-s1
        - reflection: stress:normal | emotion:pleasant | mood:focused
        - reflection-notes: One optional physical line of reflection text.
    - reflection: stress:normal | emotion:pleasant | mood:satisfied
    - reflection-notes: Optional Task-level reflection text.
    - detail: [Detail title](Details/Detail%20title.md)
```

Canonical prefix rules:

- `description:` consumes the remainder of its line as free text.
- `timebox:` owns only structured `start`, `end`, and `status` fields followed by a stable `timebox-*` block ID.
- `focus-session:` owns only structured `start`, `end`, `duration`, and `mode` fields followed by a stable `focus-*` block ID.
- `reflection:` owns zero or more of `stress`, `emotion`, and `mood` in that canonical order.
- `reflection-notes:` consumes the remainder of its line as free text.
- `detail:` retains the existing Markdown-link syntax and remains the final recognized direct child.
- Field names are case-insensitive on read and lowercase on write.
- Free-text form newlines and repeated whitespace normalize to one space; inline Markdown is preserved.
- Four spaces represent one parent-child level. Tabs are not emitted by canonical writers.

Canonical direct-child order:

- Moment: `description`, `reflection`, `reflection-notes`.
- Event: `description`, zero or more `focus-session`, `reflection`, `reflection-notes`, `detail`.
- Task: `description`, zero or more `timebox`, zero or more `focus-session`, `reflection`, `reflection-notes`, `detail`.
- Focus Session: `reflection`, `reflection-notes`.

## Identity and cardinality

- Event and Task retain their existing stable block IDs.
- Moment gains `^moment-<stable suffix>` identity so it can be managed and referenced deterministically.
- Timebox and Focus Session retain independent stable IDs.
- Reflection uses its owner's stable ID and tree position; it has no separate block ID.
- Each owner accepts at most one `description:`, one `reflection:`, one `reflection-notes:`, and one `detail:` where applicable.
- Duplicate owned singleton lines are invalid and must be surfaced rather than silently selecting one.
- Unknown children remain outside owned fields and survive a no-op or unrelated edit byte-for-byte.

## Explicit formatter

The existing Manage/Format preview flow is extended to preview and apply canonical ordering and prefixes. It may convert
current development shapes such as plain description bullets, `timebox |`, `focus-session |`, owner-line wellbeing fields,
and `- notes:`. It must preserve item, timebox, and session IDs. It is explicit, idempotent, and never runs at startup.

## Code style

```ts
type ParsedOwnedChild =
    | { kind: "description"; value: string }
    | { kind: "timebox"; value: TaskTimebox }
    | { kind: "focus-session"; value: ParsedFocusSessionLine }
    | { kind: "reflection"; value: ReflectionFields }
    | { kind: "reflection-notes"; value: string }
    | { kind: "detail"; value: ScheduledItemBlockDetail };
```

Parsers return discriminated results with explicit invalid reasons. Domain code imports neither Obsidian nor DOM APIs.

## Testing strategy

- Unit tests for every prefix parser/formatter and writer-parser round trip.
- Whole-block tests for canonical ordering, indentation, duplicate rejection, unknown-child preservation, and CRLF.
- Formatter tests proving preview/apply idempotency and stable-ID preservation.
- Fixtures showing direct extraction of Moment/Event/Task, Timebox, Focus Session, and Reflection rows.

## Boundaries

- Always: preserve stable IDs; classify references before canonical records; keep free text distinct from structured fields.
- Ask first: introduce another recognized prefix, cardinality, or ownership level.
- Never: infer ownership from titles; silently select duplicate singleton fields; write summary/derived values into canonical blocks.

## Success criteria

- All canonical examples parse and format byte-identically after one canonical write.
- Python-style line scanning can identify every owned child from its prefix and indentation.
- Description and reflection notes never leak into one another.
- Formatting twice produces no second change.
- Existing unknown Markdown nested in a canonical block is preserved.

## Open questions

None. Grammar and cardinality were approved in conversation on 2026-09-01.
