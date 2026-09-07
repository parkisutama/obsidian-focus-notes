# Implementation Plan: Scheduled Item, Timebox, and Focus Integration

## Overview

Implement the approved specification in `docs/spec-scheduled-item-timebox-focus-integration.md` after Task 28 closes the source-reorganization baseline. The work preserves Event and Task syntax differences, introduces stable derived projections, separates planned timeboxes from actual Focus Sessions, and keeps every mutation canonical-first and recoverable.

## Architecture decisions

- One canonical Event/Task block; all Daily entries outside the canonical location are derived references.
- Task timeboxes and Focus Sessions are child entities with independent stable IDs.
- Task checkbox propagation is a command routed to canonical state, not peer-to-peer synchronization.
- Timeline consumes normalized identities and expands intervals visually rather than scanning duplicate canonical blocks.
- Existing single-timebox Tasks and free-text Focus logs remain readable throughout migration.
- Desktop and mobile share domain/application contracts, not DOM components.

## Dependency graph

```text
Task 28 refactor acceptance
  -> 29 characterization and contracts
     -> 30 identity/reference index
        -> 31 capture targeting
        -> 32 Event projections
        -> 33 multi-timebox grammar/migration
           -> 34 timebox service
              -> 35 desktop manager
              -> 36 mobile manager
              -> 37 Task projections
                 -> 38 Timeline interval projection
                 -> 39 reference-aware manager
                    -> 40 checkbox synchronization
           -> 41 Focus ownership model
              -> 42 Timer purpose selection
              -> 43 canonical session history/projection
                 -> 44 planned-versus-actual Timeline
  -> 45 recovery and rebuild
  -> 46 documentation and runtime acceptance
```

## Vertical implementation phases

### Phase A: Safe foundations

- Task 29 freezes legacy behavior and new contracts with characterization tests.
- Task 30 establishes canonical/reference identity lookup.
- Task 31 fixes Event capture targeting as an isolated behavior slice.

Checkpoint: existing syntax remains green; desktop/mobile Event Capture shows the same settings-derived target.

### Phase B: Event projections

- Task 32 ships one complete Event path: canonical write, multi-day references, resolution, and retry-safe behavior.

Checkpoint: a cross-day Event appears on every relevant day but edits one canonical block.

### Phase C: Multiple Task timeboxes

- Tasks 33–34 introduce grammar/migration and application operations.
- Tasks 35–36 expose equivalent desktop/mobile management.
- Task 37 creates due/timebox Daily references.
- Tasks 38–40 connect Timeline, Active Note Manager, and checkbox synchronization.

Checkpoint: a promoted Task retains multiple sessions, appears correctly on Timeline, and completes from a Daily reference without duplication.

### Phase D: Purposeful Focus Sessions

- Task 41 introduces explicit ownership while retaining legacy logs.
- Task 42 requires purpose and explicit planning before Timer starts.
- Task 43 writes actual history under canonical context and Daily references.
- Task 44 renders planned-versus-actual utilization.

Checkpoint: multiple Focus Sessions can execute one timebox and remain navigable from Task, Daily Note, and Timeline.

### Phase E: Recovery and acceptance

- Task 45 adds reconciliation/rebuild and orphan handling.
- Task 46 closes documentation, automated gates, migration fixtures, and desktop/mobile runtime evidence.

## Verification cadence

Every task runs focused tests plus:

```powershell
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm test
git diff --check
```

Each phase checkpoint runs:

```powershell
$env:OBSIDIAN_VAULT_PLUGIN_PATH = ""
pnpm run check:ci
```

Runtime deployment is reserved for checkpoint acceptance and must use an explicitly verified vault target.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Old single-line Task syntax becomes unreadable | High | Characterize first; dual-read and explicit idempotent migration |
| Reference is indexed as another canonical item | High | Classify reference metadata first; unique reference block IDs |
| Checkbox propagation loops | High | Canonical-first operation plus plugin-write suppression and convergence tests |
| Partial multi-file writes duplicate data | High | Stable operation keys, receipts, failed-write-only retry, rebuildable projections |
| Focus logs lose user history | High | Preserve legacy/unassigned records; never infer owner from title |
| Cross-day boundaries shift by timezone | High | Pure local-calendar projection tests including DST-relevant cases |
| UI task exceeds reviewable scope | Medium | Desktop and mobile are separate slices over one service contract |
| Timer friction discourages use | Medium | Fast selector, recent/upcoming targets, and explicit Quick-create Task |
| Planned and actual completion become conflated | High | Separate commands/status and domain tests at every boundary |

## Parallelization

After Task 34 stabilizes its contracts, desktop Task 35 and mobile Task 36 can be implemented independently. Task 38 Timeline work and Task 39 manager resolution may proceed independently only after Task 37 projection format is frozen. Other work is dependency-sensitive and should remain sequential.

## Change boundaries

- Task 28 contains no new data model or behavioral feature work.
- Dependency upgrades and broad formatting remain outside this initiative.
- Drag/resize, recurrence, and automatic legacy ownership remain deferred.
- Any grammar change discovered during implementation updates the spec and receives human approval before code proceeds.

## Human review gate

Implementation may begin only after the user approves this plan and the detailed Task 29–46 entries in `tasks/todo.md`, and after Task 28 runtime acceptance is closed or explicitly waived with recorded rationale.
