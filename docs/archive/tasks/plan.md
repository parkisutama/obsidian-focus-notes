# Implementation Plan: Flat Capture, Focus, and Reflection

## Overview

Implement the approved capability map and module specs at the repository root. Moment, Event, and Task gain deterministic
flat keyed child blocks. Timeboxes remain planned Task children; Focus Sessions become actual sibling children owned
directly by Event or Task. Optional Reflection wellbeing and notes attach to Moment/Event/Task/Focus Session. Timeline then
renders planned and actual intervals independently and derives owner-level summaries without persisting them.

The existing uncommitted Task Reflection work is treated as work-in-progress input, not as an accepted grammar. It must be
reconciled into the approved `reflection:`/`reflection-notes:` sibling contract rather than discarded or layered over.

## Approved sources

- `CAPABILITY-MAP-capture-focus-reflection.md`
- `SPEC-flat-block-grammar.md`
- `SPEC-focus-owner-model.md`
- `SPEC-reflection-capture.md`
- `SPEC-capture-management.md`
- `SPEC-timeline-actual-time.md`

## Architecture decisions

1. One canonical item block remains the source of truth; Daily/weekly entries remain derived references.
2. Four spaces represent one canonical ownership level.
3. Recognized child lines use lowercase keyed prefixes: `description:`, `timebox:`, `focus-session:`, `reflection:`, `reflection-notes:`, `detail:`.
4. Task Timeboxes and Focus Sessions are siblings. Temporal overlap never creates a relationship.
5. Focus owner identity is `{ kind, itemId }`; Task ownership has no `timeboxId`.
6. Reflection wellbeing and notes are independently optional singleton siblings under their owner.
7. Moment gains stable identity and canonical block management.
8. Explicit preview/apply formatting converts unreleased development syntax; no startup migration or permanent dual-read layer is added.
9. Timeline and Manage consume one derived time-summary read model; Markdown stores no summary.
10. Desktop and mobile share domain/application contracts, never DOM components.

## Dependency graph

```text
approved characterization
  → flat child-line primitives
    → timebox/focus keyed grammar
      → whole-block parser/editor ordering
        ├─ Moment canonical identity/block
        ├─ direct Focus owner model and append
        └─ Reflection semantic form contract
             → desktop/mobile capture management
             → explicit formatter
             → Timeline canonical read model
                  → actual segment layout
                  → tooltip/item-modal summary
                  → Manage summary reuse
                       → documentation and runtime acceptance
```

## Vertical phases

### Phase A: Freeze and build the canonical grammar

- Task 47 adds failing characterization for the approved examples and current WIP conflict points.
- Tasks 48–50 implement keyed line primitives, prefix changes, whole-block ownership, ordering, and no-op preservation.

Checkpoint: pure parsers and writers round-trip canonical Event/Task blocks; Focus Sessions are parsed as direct item
children; no UI or vault mutation is required yet.

### Phase B: Establish canonical Moment and Focus ownership

- Task 51 gives Moment stable identity and a managed flat block.
- Task 52 removes the Task-timebox purpose gate from the owner model and Timer selector.
- Task 53 appends/scans/edits Focus Sessions directly under Event/Task while retaining idempotent canonical-first writes.

Checkpoint: a selected Event or Task can own multiple actual sessions independent of every Timebox; Moment has a stable
canonical block contract.

### Phase C: Deliver Reflection capture and management

- Task 54 defines one shared Reflection semantic form contract.
- Tasks 55–56 deliver Event/Task desktop and mobile Reflection plus sibling Timebox/Focus Session management.
- Tasks 57–59 deliver Moment persistence and desktop/mobile Reflection management.

Checkpoint: Moment/Event/Task/Focus Session support none, wellbeing-only, notes-only, or both Reflection forms on desktop
and mobile without description contamination.

### Phase D: Explicit formatting and Timeline actual-time UX

- Task 60 extends preview/apply formatting for current development data and canonical order.
- Task 61 indexes sibling actual sessions and produces one owner summary read model.
- Task 62 renders planned and actual segments independently.
- Task 63 adds compact tooltips and selected-segment Timeline Item Modal summaries.
- Task 64 reuses the summary in Event/Task Manage.

Checkpoint: actual intervals are visible even outside planned intervals; all summary consumers agree; no derived value is
written to Markdown.

### Phase E: Closeout

- Task 65 updates public/developer documentation and records automated plus real desktop/mobile acceptance.

## Verification cadence

Each task runs its focused tests plus:

```powershell
pnpm run format:check
pnpm run lint
pnpm run typecheck
git diff --check
```

Every phase checkpoint runs:

```powershell
$env:OBSIDIAN_VAULT_PLUGIN_PATH = ""
pnpm run check:ci
```

Runtime deployment requires an explicitly verified vault target. Formatting current development notes requires a visible
preview and user-triggered apply action.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Current uncommitted Task Reflection implementation is accidentally lost | High | Reconcile field/UI intent into approved grammar; inspect diff before every grammar task |
| Reordering owned children moves unknown Markdown | High | Characterize unknown subtrees and preserve them byte-for-byte |
| Focus Session is left nested under a Timebox in one writer/scanner | High | Change owner type first; exhaustive search plus append/scan/index fixtures |
| Stable links break while formatting development data | High | Preserve every existing block ID and prove idempotency before UI apply |
| Description or reflection notes containing Markdown parse incorrectly | Medium | Prefix consumes remainder; one-line normalization; round-trip links/tags fixtures |
| Timeline double-counts or implies a false pairing | High | Aggregate by owner only; segment identities stay `timeboxId`/`sessionId`; no overlap inference |
| Desktop and mobile semantic behavior diverge | High | Shared form contract plus separate presentation-contract tests |
| Whole-owner summary becomes expensive | Medium | Parse once into indexed owner read model; benchmark representative weekly data |

## Parallelization

Implementation is dependency-sensitive through Task 54. After the Reflection form contract stabilizes, desktop Task 55 and
mobile Task 56 are independent presentation slices. Moment desktop Task 58 and mobile Task 59 may proceed independently
after Task 57. Timeline presentation Tasks 62–63 remain sequential because they share layout and selected-segment contracts.

## Change boundaries

- No new dependency, settings schema, recurring scheduling, Timeline drag/resize, or Moment-owned Focus Session.
- No automatic background migration and no permanent compatibility reader for unreleased block shapes.
- Quick-create Task remains explicit and does not create a Timebox.
- Focus Session actual timestamps and duration remain immutable through Reflection editing.
- Summary does not imply completion and is never persisted.

## Task list

Detailed Tasks 47–65 and checkpoints are tracked in `tasks/todo.md`.

## Human review gate

Implementation begins only after this plan and Tasks 47–65 are approved. Runtime acceptance remains a separate final gate;
a green automated suite is not device acceptance.
