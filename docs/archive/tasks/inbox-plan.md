# Implementation Plan: Inbox Quick Capture

## Overview

Implement the approved Inbox capture type as a tested vertical extension of the existing Event/Task creation flow. The work preserves Event/Task contracts, shares pure Inbox logic between desktop and mobile, and introduces inline `@` People/Place and `#` tag suggestions without adding dependencies.

The existing `tasks/plan.md` remains the acceptance record for the still-open mobile-modal work. This feature therefore uses `tasks/inbox-plan.md` and `tasks/inbox-todo.md` to avoid overwriting that evidence.

## Branch Strategy

- Create `feature/inbox-quick-capture` before implementation.
- Base it on the current mobile feature because Inbox needs the independent mobile renderer added there.
- Keep Inbox commits separate and atomic so the branch can be rebased onto `main` after the mobile branch is accepted and merged.
- Never stage the user-owned `.vscode/` directory.

## Architecture Decisions

- Preserve `EventTaskRecord = EventRecord | TaskRecord`; add `InboxRecord` and `CaptureRecord` so hub/detail-note code cannot treat Inbox as Task.
- Add a nested `inbox` settings object and merge its arrays defensively in `StateStore` for backward-compatible upgrades.
- Store immutable `capturedAt`, generated `defaultTitle`, body, and ephemeral target/source overrides in renderer-independent form state.
- Keep Inbox Markdown and relative-link formatting pure and separately tested.
- Reuse heading-aware insertion, but route Inbox through a dedicated submission branch that cannot create hub/detail notes.
- Build one contenteditable Notes controller shared by both renderers. It owns plain-text synchronization, trigger-range detection, selection restoration, and suggestion insertion; renderers only mount it and supply settings/state.
- Use public Obsidian metadata/tag/fuzzy APIs. Keep the existing isolated Daily Notes fallback inside target resolution rather than introducing new private API access.
- Render chips in the fixed order `Inbox`, `Event`, `Task` on both platforms.

## Dependency Graph

```text
Approved Markdown and settings contracts
    |
    +--> pure Inbox record/format/link helpers
    |        |
    |        +--> writer and submission route
    |
    +--> settings merge and target resolution
    |        |
    |        +--> Advanced destination/source overrides
    |
    +--> suggestion index and token controller
             |
             +--> desktop Inbox form
             +--> mobile Inbox form
                      |
                      +--> runtime acceptance
```

## Phases

### Phase 1: Domain and Markdown foundation

- Task 1 adds Inbox settings/state contracts and backward-compatible loading.
- Task 2 implements pure timestamp, entry, and relative Markdown-link formatting.

#### Checkpoint 1

- Focused state/settings/format tests pass.
- Existing Event/Task tests remain unchanged and pass.
- Typecheck and `git diff --check` pass.

### Phase 2: End-to-end write path

- Task 3 adds explicit Inbox target resolution and dedicated submission/writer routing.

#### Checkpoint 2

- Daily Note and Event/Task-target fixtures produce exact approved Markdown.
- Failure before a valid destination causes no vault write.
- Hub/detail-note writer methods are never called for Inbox.

### Phase 3: Inline context suggestions

- Task 4 implements People/Place and tag indexing/ranking.
- Task 5 implements cursor-safe inline trigger replacement in a contenteditable Notes control.

#### Checkpoint 3

- Filename, alias, duplicate-name, missing-folder, multi-root, and tag tests pass.
- Selecting a result replaces only the active token; unselected text remains unchanged.
- Plain-text state contains Markdown, never serialized HTML.

### Phase 4: Settings and desktop vertical slice

- Task 6 adds Inbox settings and source-folder list controls.
- Task 7 adds the desktop `Inbox`, `Event`, `Task` chips and complete Inbox/Advanced form.

#### Checkpoint 4

- Desktop can save to both destinations with mention links and tags.
- Per-capture overrides do not mutate settings.
- Event and Task desktop flows regress cleanly.

### Phase 5: Mobile vertical slice and verification

- Task 8 adds the equivalent minimal Inbox flow to the independent mobile renderer.
- Task 9 completes automated gates and records real desktop/mobile acceptance.

#### Checkpoint 5

- All automated commands pass.
- Mobile keyboard, suggestion popovers, cursor editing, and Advanced controls pass on a real device.
- Operator acceptance remains separate from technical validation.

## Verification Commands

```bash
pnpm test
pnpm run typecheck
pnpm run lint
OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run build
pnpm run verify:artifacts
git diff --check
```

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Contenteditable selection differs across mobile WebViews | High | Isolate range logic, test pure token detection, restore focus/range after selection, and require real-device acceptance |
| Adding Inbox to an existing union triggers Task fallback branches | High | Preserve `EventTaskRecord`; add a separate exhaustive `CaptureRecord` |
| Relative Markdown destinations break on nested paths or special characters | High | Pure path formatter with same/parent/nested/space/non-ASCII tests and click-through runtime checks |
| Daily Notes relies on a private core-plugin configuration | High | Reuse the existing isolated defensive resolver and fail clearly when unresolved |
| Vault-wide tag indexing becomes slow | Medium | Build a de-duplicated index, use public cache data, cap results, and avoid rescanning on every keystroke |
| Settings upgrade shares mutable default arrays | Medium | Clone Inbox arrays during merge and add migration regression tests |
| Desktop and mobile behavior drift | Medium | Share state, formatter, suggestion controller, and submission; keep only composition platform-specific |
| Current mobile branch is still awaiting acceptance | Medium | Use a stacked Inbox branch with atomic commits; rebase only after the mobile base is merged |

## Open Questions

None at product level. Runtime defects found during mobile acceptance return to the smallest affected task rather than changing the approved Markdown contract.
