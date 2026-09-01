# Capability Map: Flat Capture, Focus, and Reflection

## Objective

Make Moment, Event, Task, Timebox, Focus Session, and Reflection readable as portable Markdown and easy to extract into
tabular data. Planned Timeboxes and actual Focus Sessions are sibling records under a Task. Reflection metadata and
optional reflection notes belong directly to Moment, Event, Task, or Focus Session.

## Modules

| Module id | Responsibility | Depends on |
| --- | --- | --- |
| `flat-block-grammar` | Canonical keyed child-line grammar, ordering, identity, parsing, formatting, and explicit development-data formatting | — |
| `focus-owner-model` | Direct Event/Task ownership for actual Focus Sessions without a Task timebox requirement | `flat-block-grammar` |
| `reflection-capture` | Optional wellbeing and reflection notes for Moment, Event, Task, and Focus Session | `flat-block-grammar` |
| `capture-management` | Shared create/edit/manage contracts with separate desktop/mobile UI and an explicit formatter flow | `focus-owner-model`, `reflection-capture` |
| `timeline-actual-time` | Planned and actual Timeline segments plus derived owner-level time summaries | `focus-owner-model`, `capture-management` |

Build order:

```text
flat-block-grammar
    ├─ focus-owner-model
    └─ reflection-capture
              ↓
      capture-management
              ↓
      timeline-actual-time
```

## Initiative-wide decisions

- `description:`, `timebox:`, `focus-session:`, `reflection:`, `reflection-notes:`, and `detail:` are the canonical child-line prefixes.
- Canonical indentation is four spaces per ownership level.
- Timebox and Focus Session are siblings under Task; a Focus Session never owns or references a Timebox.
- Event and Task may own Focus Sessions. Moment may not.
- `reflection:` and `reflection-notes:` are optional sibling children of the same owner and are independently optional.
- Each owner has at most one `reflection:` and at most one `reflection-notes:` line.
- Description and reflection-notes values are stored on one physical Markdown line; form newlines normalize to spaces.
- Focus logging appends to the selected canonical Event/Task. It never silently creates an owner or Timebox.
- Quick-create Task remains an explicit action, but creates no required Timebox.
- Timeline summaries are derived read models and are never persisted back into Markdown.
- The plugin is unreleased: no permanent dual-read compatibility layer or automatic background migration is required.
- Existing development data is converted only through an explicit preview/apply formatter that preserves stable IDs.

## Specs

- `SPEC-flat-block-grammar.md`
- `SPEC-focus-owner-model.md`
- `SPEC-reflection-capture.md`
- `SPEC-capture-management.md`
- `SPEC-timeline-actual-time.md`
