# Implementation Plan: Code Restructuring

## Overview

Restructure the plugin incrementally around domain ownership while preserving every persistent identifier, settings shape, Markdown byte representation, and desktop/mobile interaction contract. The work starts with characterization and architecture guards, then removes the concrete type cycle, establishes capture boundaries, decomposes settings and views, and finally thins plugin composition.

This plan refines `docs/code-restructuring-handover.md`; behavioral specs remain authoritative.

## Observed Baseline (2026-08-22)

- `OBSIDIAN_VAULT_PLUGIN_PATH=""; pnpm run check:ci` passes: formatting, lint, version metadata, typecheck, 297 tests, production build, artifact verification, and docs build.
- The worktree contains an untracked handover document; it must be preserved.
- A direct cycle exists: `types.ts -> ScheduledItemTypes.ts -> types.ts` through `TimelineMode` and `ContextSourceFilter`.
- Primary size/coupling hotspots are `SettingsTab.ts`, `EventTaskModal.ts`, `EventTaskMobileScreen.ts`, `TimerView.ts`, `InboxNotesController.ts`, `types.ts`, and `TimelineView.ts`.
- `pnpm audit --audit-level=moderate` reports two high and three moderate transitive advisories through VitePress/Vite tooling. Runtime reachability has not been established; remediation must be a separate dependency-only change.

## Architecture Decisions

- Dependencies flow from plugin composition and Obsidian UI into application orchestration, domain semantics, and small pure primitives.
- Obsidian `App`, `Vault`, `Modal`, `ItemView`, DOM nodes, and `Notice` remain outside pure domain modules.
- Desktop and mobile share typed semantic state, validation, submission policy, and results, but retain separate DOM and lifecycle implementations.
- Vault content, settings JSON, frontmatter, Markdown links, and user-entered paths are untrusted boundary data. Parse and validate them before domain use or persistence.
- Vault writes remain behind explicit adapters/services, preserve conflict detection and atomic/no-op behavior, and never broaden a resolved path outside the vault.
- User-derived text is rendered through Obsidian text APIs (`text`/`textContent`), never HTML injection.
- `shared/` admits only primitives used by at least two domains and independent of Obsidian and feature-private types.
- Temporary compatibility re-exports are inventoried with an owner and removal task; no permanent barrel layer is introduced.
- Refactoring, behavioral fixes, dependency upgrades, and formatting-only work use separate commits.

## Dependency Direction

```text
plugin/main + registrations
    -> feature shells / launchers
        -> application use cases
            -> domain models, parsing, validation, policies
                -> shared pure primitives

feature application -> infrastructure/obsidian + persistence ports
infrastructure adapters -> Obsidian API / vault / plugin data
domain -X-> Obsidian, DOM, concrete vault adapters
```

## Phases and Ordered Task Index

Detailed acceptance criteria and verification live in `tasks/code-restructuring-todo.md`.

### Phase 0: Evidence and guardrails

1. Record entry points, identifiers, ownership, import edges, cycles, and active/legacy capture paths.
2. Add architecture and compatibility characterization tests where current coverage cannot detect drift.
3. Triage dependency advisories in a separate security record/change.

### Phase 1: Remove foundational coupling

4. Move `ContextSourceFilter` to its object/context-source owner and remove the `types.ts` / `ScheduledItemTypes.ts` cycle.
5. Split the remaining settings, timer, capture-target, and wellbeing types by owner in small batches.
6. Split `utils.ts` into proven date-time and Obsidian/vault operations without creating a generic replacement.

### Phase 2: Establish the Scheduled Item/capture boundary

7. Colocate the pure Scheduled Item contract, parser, adapters, validation, and submission policies.
8. Move vault persistence and Obsidian link/suggestion sources behind explicit application ports/adapters.
9. Cut desktop and mobile launchers over to the same application use cases while preserving renderer-specific lifecycle.
10. Prove all Moment, Event, and Task entry points use intended paths; retire legacy code in a deletion-only batch.

### Phase 3: Decompose settings vertically

11. Introduce a thin settings shell with narrow dependencies and unchanged navigation state.
12. Extract one category per batch: Periodical Notes, Object Sources, Focus Session, Capture, then Timeline.

### Phase 4: Decompose views

13. Separate Timer ItemView lifecycle, presentation, editor panels, and completion/log orchestration.
14. Separate Timeline ItemView lifecycle, query/index orchestration, navigation/sidebar, grid, and modal launch.

### Phase 5: Thin plugin composition and remove shims

15. Extract command and view registration while freezing all compatibility identifiers.
16. Remove proven-unused compatibility re-exports and legacy files.
17. Update architecture documentation to the structure that actually exists.

## Batch 1 Recommendation

Break the concrete type cycle only. Move `ContextSourceFilter` to a context-source-owned pure module, make both `types.ts` and `ScheduledItemTypes.ts` import it from that owner, and keep any necessary compatibility re-export from `types.ts`. Do not move `TimelineMode`, rename concepts, or reorganize directories in this batch.

Expected files: one new type module, `types.ts`, `ScheduledItemTypes.ts`, direct context-source consumers as needed, and a focused architecture/import test. Rollback is a single commit revert; no data, Markdown, IDs, or runtime registration are touched.

## Quality and Security Gates

Every batch must pass:

```powershell
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm test
git diff --check
```

Every phase checkpoint must additionally pass:

```powershell
$env:OBSIDIAN_VAULT_PLUGIN_PATH = ""
pnpm run check:ci
pnpm audit --audit-level=moderate
```

An audit finding is triaged by severity, dependency path, runtime/build/dev reachability, available fix, and review date. Do not use forced audit remediation. High findings reachable in release or developer-server paths block the relevant release workflow until fixed or explicitly accepted.

Review each change across correctness, readability, architecture, security, and performance. Target roughly 100 changed lines; split changes approaching 300 lines unless they are mechanical moves with independently verified behavior.

## Checkpoints

- After Phase 0: human approves ownership map, active/legacy path classification, and Batch 1 file list before source moves.
- After each Phase 1 batch: no import cycle is added, focused tests and full typecheck pass, and compatibility re-exports are tracked.
- After capture cutover: golden Markdown is byte-identical, primary writes are not duplicated, retries only repeat failed related writes, and desktop/mobile acceptance passes.
- After each settings/view extraction: behavior tests plus an Obsidian lifecycle smoke test pass.
- Final: full CI, artifact verification, desktop and real-mobile acceptance, dependency audit disposition, and zero unowned shims/legacy imports.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Moving by filename instead of ownership | Coupling is merely relocated | Require consumer/import evidence in the ownership table |
| Parser/writer drift | User Markdown or links change | Golden byte assertions and no-op round trips |
| Unsafe or stale vault path reaches a writer | Wrong file creation/modification | Normalize and validate at adapter boundaries; retain stale-source conflict checks |
| Renderer consolidation regresses mobile behavior | Keyboard/lifecycle failures | Share semantics only; retain distinct renderers and real-device acceptance |
| Settings extraction changes persistence timing | Lost or overwritten configuration | Preserve one serialized save path and malformed-data protection tests |
| `shared/` becomes a new monolith | Hidden cross-domain coupling | Enforce admission rule and import guard |
| Dependency upgrade obscures refactor review | Regression source becomes ambiguous | Dependency-only PR/commit with clean install, CI, and audit evidence |
| Compatibility shim remains indefinitely | Boundary never becomes real | Maintain shim ledger with owner and removal checkpoint |

## Decisions Requiring Approval

- Any plugin/command/view ID, settings schema/key, Markdown/frontmatter format, UX/copy, dependency, or framework change.
- Deletion of a legacy implementation without runtime-import evidence and regression coverage.
- A mass source move or an architecture decision that is expensive to reverse; record the latter as an ADR.

## Open Questions

- Whether the VitePress/Vite advisories are accepted temporarily as local docs-tooling exposure or fixed by a compatible isolated upgrade.
- Which context-source module name should become canonical after the ownership map confirms all consumers.
- Which legacy Event/Task launchers remain runtime-active after tracing every command, ribbon, Timeline, Inbox, desktop, and mobile path.
