# Implementation Plan: Complete Source Organization

## Overview

Complete the physical reorganization left after the domain-structure refactor. Move every root source module to an explicit feature/layer, Obsidian adapter, shared primitive, or quarantined legacy owner while preserving behavior, persistent identifiers, settings, Markdown bytes, and desktop/mobile lifecycle contracts.

The final invariant is: `src/main.ts` is the only TypeScript file directly under `src/`. Path moves happen before renames or behavioral cleanup. Oversized modules are decomposed only after the tree is stable and characterization coverage exists.

This supersedes the completed mobile-modal plan formerly stored here. Historical evidence remains in `tasks/code-restructuring-*` and `docs/code-architecture-baseline.md`.

## Definition of Done

- `src/main.ts` is the only root TypeScript module.
- Every module has a visible feature and layer owner.
- Domain code imports no Obsidian, DOM, UI, plugin, infrastructure, or private cross-feature module.
- `shared/` contains only proven cross-feature primitives and imports no feature.
- `src/legacy/` contains only quarantined zero-consumer modules; production cannot import it.
- No barrel, forwarding shim, cycle, empty speculative directory, or undocumented dependency remains.
- Persistent IDs, settings schema, Markdown output, view state, and renderer selection are unchanged.
- Full CI, artifact verification, advisory disposition, runtime acceptance, and five-axis review pass.

## Architecture Decisions

1. Organize by feature ownership: Capture, Timeline, Focus Session, Object Notes, Reflection, Settings, and Periodical Notes.
2. Keep one root entry point. Plugin composition goes under `plugin/`; feature logic never does.
3. Move `EventEditModal.ts`, `TaskEditModal.ts`, and `MoodPicker.ts` unchanged to `src/legacy/`; do not delete them.
4. Separate path moves, renames, behavior changes, dependency upgrades, and formatting sweeps.
5. Do not add permanent barrels or compatibility re-exports. Update direct consumers atomically.
6. Move at most about five primary modules per task. Mechanical consumer import updates may be wider but contain no logic edits.
7. Add architecture guards first. A checked root inventory shrinks after every batch and ends with only `main.ts`.
8. Treat Obsidian as an outer boundary: imports belong in feature UI, plugin composition, or `infrastructure/obsidian`.

## Target Structure

```text
src/
├── main.ts
├── plugin/
├── features/
│   ├── capture/
│   │   ├── {domain,application,ui}/
│   │   ├── moment/{domain,application,ui/{desktop,mobile}}/
│   │   └── scheduled-item/{domain,application,ui/{desktop,mobile}}/
│   ├── focus-session/{domain,application,ui}/
│   ├── timeline/{domain,application,ui}/
│   ├── object-notes/{domain,application,ui}/
│   ├── reflection/{domain,ui}/
│   ├── settings/{domain,infrastructure,ui}/
│   └── periodical-notes/{domain,application}/
├── infrastructure/obsidian/{capture,focus-session,suggestions,vault}/
├── shared/{markdown,ui}/
└── legacy/{EventEditModal,TaskEditModal,MoodPicker}.ts
```

Create directories only when a real module first moves into them.

## Dependency Order

```text
architecture guard
  -> legacy + shared/periodical foundations
  -> settings/object-notes/reflection
  -> focus-session -> timeline
  -> scheduled-item -> moment/shared capture
  -> infrastructure -> plugin composition
  -> root-only-main gate
  -> hotspot decomposition -> runtime acceptance
```

## Ordered Task Index

Detailed acceptance criteria are in `tasks/todo.md`.

### Phase 0: Safety and foundations

1. Strengthen architecture migration guards.
2. Quarantine proven-dead UI under `legacy/`.
3. Place shared Markdown, capture-target, and periodical primitives.

### Phase 1: Supporting features

4. Finish Settings ownership.
5. Finish Object Notes ownership.
6. Finish Reflection ownership.
7. Place Focus Session application and adapters.
8. Place the Focus Session view shell.

### Phase 2: Timeline

9. Place Timeline domain modules.
10. Place Timeline query/index modules.
11. Place Timeline UI modules.

### Phase 3: Scheduled Item

12. Place Active Note and formatting modules.
13. Place desktop Scheduled Item UI.
14. Place mobile form foundation.
15. Place mobile screens and launcher.

### Phase 4: Moment and capture composition

16. Place Moment domain text/target modules.
17. Place Moment suggestions and submission policy.
18. Place Moment desktop UI.
19. Place Moment mobile UI.
20. Place shared capture routing and form state.

### Phase 5: Boundaries and completion

21. Finish remaining Obsidian adapter ownership.
22. Move plugin composition behind `main.ts`.
23. Enforce final root and dependency invariants.

### Phase 6: Quality remediation

24. Split Reflection reference data from its API.
25. Decompose the Moment suggestion controller.
26. Decompose the desktop Scheduled Item form.
27. Decompose the mobile Scheduled Item form.
28. Complete final review, docs, audit disposition, and runtime acceptance.

## Verification Cadence

Every task:

```powershell
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm test
git diff --check
```

Every phase checkpoint:

```powershell
$env:OBSIDIAN_VAULT_PLUGIN_PATH = ""
pnpm run check:ci
pnpm audit --audit-level=moderate
```

For path-only tasks, inspect `git diff --summary` and `git diff --find-renames`; production bodies may not change apart from import specifiers. Test count may not decrease. A discovered defect becomes a separate RED-GREEN-REFACTOR task.

## Quality Gates

- **Correctness:** compatibility, settings, Markdown/no-op, desktop/mobile, error and retry behavior stay covered.
- **Readability:** no dumping grounds or pass-through wrappers; files above ~400 lines require a decomposition decision; files above 1,000 lines block approval unless isolated static data.
- **Architecture:** automate root allowlist, cycles, domain purity, shared independence, legacy isolation, and dependency direction.
- **Security:** preserve validation of vault content, paths, frontmatter, settings, and user text; dependency changes stay separate.
- **Performance:** no extra vault scan/write, listener, index rebuild, debounce, or render loop from a path move.

## Commit Strategy

- Prefer one task per commit with an ownership-specific imperative subject.
- Never mix moves with dependency upgrades, renames, behavior fixes, or formatting sweeps.
- Resolve or isolate the existing `package.json`/`pnpm-lock.yaml` changes before implementation begins.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Import-only diff hides logic edits | High | ≤5 primary moves, rename-similarity inspection, full tests |
| Temporary root state becomes permanent | High | Shrinking checked inventory; final allowlist is `main.ts` |
| Cross-feature cycles | High | Cycle and layer tests after every task |
| Legacy becomes reachable | Medium | Production-import prohibition plus zero-consumer check |
| Live Obsidian UI regresses | High | Desktop and real-mobile final acceptance |
| `shared/` becomes a monolith | Medium | Require two feature consumers and forbid feature imports |
| Current dependency diff contaminates commits | High | Resolve it separately before moves |

## Human Decisions

- Approve `src/legacy/` as unreachable quarantine rather than deletion.
- Decide after relocation whether legacy `EventTask*` names get an isolated rename.
- This plan recommends making desktop and real-mobile acceptance mandatory for final approval.
