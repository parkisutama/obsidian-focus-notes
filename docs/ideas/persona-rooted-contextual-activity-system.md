# Persona-Rooted Contextual Activity System

## Status

Refined product direction. This document defines the intended model and MVP boundary; it is not yet an implementation specification.

Prioritized delivery is tracked in the [Persona-rooted implementation plan](../../tasks/persona-contextual-activity-plan.md).

## Date

2026-08-02

## Problem statement

How can a Daily Notes user capture Inbox items, activities, tasks, and focus sessions without making structural decisions too early, while still being able to retrieve, promote, physically place, archive, and view that information through life Personas and contextual objects such as People, Places, Activities, and Books?

The system must preserve plain Markdown and properties, remain useful outside Obsidian, support project-level archival snapshots, and avoid forcing every fleeting thought to become a structured file.

## Recommended direction

Focus Notes becomes the capture, contextual-linking, physical-placement, and temporal-presentation layer for a persona-rooted personal knowledge system.

Daily Notes provide a cognitive boundary for one day. They collect what was planned, what happened, what remains pending, focus sessions, and reflective material. They are not the universal owner of every object in the vault. Information may remain a fleeting bullet or later be promoted to a typed Markdown note when its volume, fan-out, lifecycle, or relevance beyond the current day justifies the additional structure.

Obsidian Objects owns object schemas and helps generate Bases. Bases owns list, kanban, timeline, card, filtering, and aggregation presentations. The core Note Composer plugin owns the manual extraction of a fleeting entry into a promoted note. Focus Notes should connect these native capabilities instead of recreating them.

## Design principles

1. **Capture before structure.** A user can record something without selecting its final Persona, Project, Activity, or object type.
2. **Promote on evidence.** Volume, fan-out, lifecycle, or relevance beyond today triggers promotion; capture alone does not.
3. **One data model, many presentations.** Markdown, properties, and links remain canonical while Bases and Focus Timeline provide different views.
4. **Time and context are complementary.** Daily Notes answer _when_; contextual objects answer _who_, _where_, and _what activity_.
5. **Physical ownership follows real-life responsibility.** Stable Personas own Projects and contextual work objects.
6. **Links enrich records but do not make them intelligible.** Historical logs remain meaningful even when an archived snapshot no longer contains the linked Daily Note.
7. **Portability outranks permanent synchronization.** Plain Markdown and independently useful archives are preferred over hidden databases and two-way sync machinery.

## Physical object model

Personas are stable top-level life responsibilities, typically five to eight, inspired by the responsibility-centered model in _The 7 Habits of Highly Effective People_.

```text
Personas/
├── Employee/
├── Freelancer/
├── Individual/
└── Family/
```

Goals and Clients are flat reference notes below a Persona. They are related through properties and links, not used as physical container folders.

A Project is the primary physical archival unit. It may be copied or zipped with its own `.obsidian` configuration as a standalone snapshot.

```text
Personas/Employee/Project A/
├── Project A.md
├── Activities/
├── Blocks/
├── Sites/
├── Tasks/
├── Issues/
├── Logs/
└── .obsidian/
```

An Activity object may have a parent Project when the Project provides necessary context:

```text
Personas/Employee/Project A/Activities/Data Review.md
```

An Activity that does not need a Project belongs directly to a Persona:

```text
Personas/Individual/Activities/Cycling.md
```

People and Places are global-flat objects. Future global-flat object types may include Books, Foundations, or Calendars. These objects are referenced across Personas and Projects; they do not physically own work objects.

## Daily Note as cognitive workspace

A default Daily Note separates quick capture from the combined temporal ledger:

```md
## Inbox

## Activities & Tasks

## Focus Sessions

## Journal / CBT
```

`Activities & Tasks` is one storage heading because activities and tasks compete for the same finite time. Their proximity helps the user balance planned commitments, actual activity, and pending work. Sharing a heading does not make them the same record type.

The default target is the Daily Note, but Inbox, Event, and Task targets and headings remain configurable for users who use another note as their daily workspace.

## Distinct temporal record contracts

### Event or activity occurrence

An occurrence occupies time and has no completion checkbox:

```md
- 2026-08-02 09:00 - 10:00 Meet [Andi](../People/Andi.md) at [Head Office](../Places/Head%20Office.md)
```

It may represent a one-off activity that requires no standalone object, or link to an Activity object that aggregates repeated occurrences:

```md
- 2026-08-02 06:30 - 08:00 [Cycling](../Personas/Individual/Activities/Cycling.md)
```

An Activity object is a persistent context with its own note and historical logs. A one-off activity is merely an occurrence recorded in the Daily Note. Both remain event-format lines for Focus Timeline.

### Task

A Task is a completable commitment and retains its checkbox, due date, and optional timebox:

```md
- [ ] Send the audit report to [Andi](../People/Andi.md) | due:2026-08-04
- [ ] Review the proposal | start:2026-08-02 13:00 | end:2026-08-02 14:00
```

A timeboxed Task may appear as a block in Focus Timeline, but it remains a Task with a completion lifecycle. A due-only Task belongs in the pending summary rather than being coerced into an Event.

Event and Task must keep separate writer formats, parser behavior, visual treatment, and lifecycle rules even though they share `Activities & Tasks`.

## Fleeting and promoted modes

Every captured item starts with the option to remain fleeting:

```md
- [ ] Draft the audit approach based on the discussion with [Andi](../People/Andi.md)
```

When the item needs its own lifecycle or attributes, the user promotes it manually with the core Note Composer plugin. Note Composer moves the selected content and leaves a concise link at the original location:

```md
- [ ] [Draft the audit approach](../Personas/Employee/Project%20A/Tasks/Draft%20the%20audit%20approach.md)
```

The initial promoted Task Note may contain only a heading:

```md
# Draft the audit approach
```

Page preview can expose the linked note without requiring Focus Notes to build another preview system. Temporal metadata needed by Focus Timeline remains on the Daily Note projection so the Timeline does not need to open every promoted Task Note.

Focus Notes may later help suggest a destination based on Persona, Project, Activity, and object type, but it must not reimplement Note Composer extraction and replacement.

## Extensible contextual suggestions

`@` is an input trigger, not stored syntax. Selecting a suggestion inserts an ordinary relative Markdown link:

```text
@Andi
    ↓
[Andi](../People/Andi.md)
```

The same interaction should be available in:

- Inbox body;
- Event description or details;
- Task description or details;
- future contextual text fields that accept Markdown.

People, Places, and Activities are the initial context sources, not a permanent hardcoded boundary. A configurable source describes:

- display name and icon;
- one or more manually configured source folders;
- optional property filter, such as `type: activity`;
- related-log heading;
- enabled state.

Folder scope is the first filter. An optional property is the second filter. A future source can therefore add Books or another object type without adding a new capture mode.

### Efficiency contract

The suggester must remain responsive on desktop and mobile:

1. Build candidates from Obsidian's metadata cache rather than reading file contents on every keystroke.
2. Limit candidates to configured folders before fuzzy ranking.
3. Apply the configured property filter only when present.
4. Index file name, aliases, path, and declared type in memory.
5. Update incrementally on file create, metadata change, rename, and delete.
6. Limit the rendered result set, initially to approximately 20 candidates.
7. Reuse one suggestion engine across Inbox, Event, and Task.

Tag suggestions remain supported alongside contextual `@` suggestions.

## Append-only physical related logs

Physical related logs are enabled by default. When an Activity or Task mentions configured contextual objects, Focus Notes appends a self-contained historical line under the source-specific heading.

```md
# Andi

## Interactions

- 2026-08-02 09:00–10:00 — Discuss audit methodology at Head Office — [Daily Note](../Daily/2026-08-02.md)
```

```md
# Head Office

## Mentions

- 2026-08-02 09:00–10:00 — Discuss audit methodology with Andi — [Daily Note](../Daily/2026-08-02.md)
```

```md
# Cycling

## Logs

- 2026-08-02 06:30–08:00 — Morning cycling — [Daily Note](../../../Daily/2026-08-02.md)
```

The default heading may vary by source, for example:

| Source | Default related heading |
|---|---|
| People | `Interactions` |
| Places | `Mentions` |
| Activities | `Logs` |
| Books | `Reading Notes` |

The log is deliberately append-only:

- saving one capture must not append the same related log twice;
- later edits or deletion of the Daily Note entry do not update or delete an existing log;
- the related note's log is a historical record, not an editable projection of current source state;
- no block ID or deep link to the exact source bullet is required;
- a link opens the relevant Daily Note when it remains available.

A Project archive may be separated from the Daily Notes that originally supplied its context. A resulting broken link is an expected archival boundary, not data corruption. For this reason, every related log contains enough date, time, and activity text to remain understandable without resolving its link.

The archival process itself may later preserve, rewrite, or report cross-boundary links. That is a separate mechanism and is outside Focus Notes' initial scope.

## Focus Timeline

Focus Timeline is the temporal presentation of `Activities & Tasks`, not the owner of those records.

It should present:

- Event occurrences as time blocks;
- timeboxed Tasks as visually distinct time blocks;
- due-only and unscheduled Tasks in the pending summary;
- completed Tasks according to user settings;
- Day and Week views comparable to a calendar while preserving links to Markdown sources.

Clicking a card should open a stable detail modal rather than a floating page-preview-like card whose position is constrained by a sidebar. The modal can show record metadata, description, and contextual links, and provide an explicit `Open source note` action. Native page preview remains appropriate for links to promoted notes.

## Responsibility boundaries

| Concern | Owner |
|---|---|
| Object schema and generation of Bases | Obsidian Objects |
| List, kanban, table, card, filtering, and general aggregation | Bases |
| Fleeting-to-promoted extraction | Core Note Composer plugin |
| Daily temporal workspace | Daily Notes |
| Capture, target routing, contextual suggestions, and related-log writing | Focus Notes |
| Day and Week temporal visualization | Focus Timeline |
| Portable relationships | Markdown links and properties |
| Physical ownership and archive boundary | Persona and Project folders |

## Key assumptions to validate

- [ ] Daily Notes users understand one mixed heading when Event and Task retain visibly different formats.
- [ ] Opening the related Daily Note provides sufficient retrieval without linking to an exact bullet.
- [ ] Self-contained append-only related logs remain useful after Project archival.
- [ ] Users can understand fleeting versus promoted modes without extensive onboarding.
- [ ] Manually configured folders plus optional `type` filters cover real object layouts without excessive setup.
- [ ] A shared in-memory suggestion index remains responsive in representative desktop and mobile vaults.
- [ ] Keeping temporal metadata on a promoted Task's Daily Note link is understandable and avoids conflicting canonical values.

## MVP scope

The MVP tests one complete job:

> Capture an Event or Task with contextual objects, save it under `Activities & Tasks`, see it correctly in Focus Timeline, and retrieve its historical context from the mentioned object notes.

Included:

- rename Inbox `Advanced` to `More options`;
- use `Activities & Tasks` as the default Event and Task heading;
- preserve distinct Event and Task Markdown contracts;
- make `@` and tag suggestions available in Inbox, Event, and Task contextual text;
- configure context sources by folders, optional `type`, icon, and related heading;
- ship People, Places, and Activities as initial source configurations;
- enable append-only physical related logs by default;
- prevent duplicate related-log writes from a single submission;
- support Activity Objects and one-off activity occurrences;
- verify capture output is consumed correctly by Focus Timeline;
- replace unstable pending-card preview behavior with a detail modal and `Open source note` action;
- retain configurable target notes and headings, with Daily Notes as the default workflow.

## Not doing in the MVP

- Automatic promotion of fleeting entries.
- A replacement for Note Composer.
- Two-way synchronization between promoted notes, Daily Notes, and related logs.
- Updating or deleting historical logs after their initial write.
- Block IDs or deep links to source bullets.
- An object schema editor or replacement for Obsidian Objects.
- A replacement for Bases.
- A graph database hidden behind Markdown.
- Every possible contextual object type as a built-in source.
- Automatic inference that an item must be promoted.
- Per-keystroke full-vault content scanning.
- Project archival, cross-boundary link rewriting, or archive restoration.

## Open questions before implementation specification

- How should planned, completed, cancelled, and actual Event occurrences be represented without weakening the existing Event grammar?
- What exact normalized content key prevents duplicate related-log writes during one submission without becoming a permanent synchronization ID?
- Which settings migration preserves existing Event/Task headings and Inbox suggestion folders when introducing configurable context sources?
- Should Activity Objects be inferred only through configured folders and `type: activity`, or also from other property values generated by Obsidian Objects?
- What representative vault size and device baseline defines acceptable suggester latency?

## Success signal

A user can move through the full loop without reorganizing information manually at capture time:

```text
capture in Daily Note
    → link contextual objects
    → write distinct Event or Task Markdown
    → view time in Focus Timeline
    → retrieve history from People, Place, or Activity logs
    → optionally promote with Note Composer
    → archive a Project while its Markdown remains understandable
```
