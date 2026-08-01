# Implementation Plan: Minimal Mobile Event and Task Modal

## Overview

The first compact-sheet implementation failed real-mobile acceptance. Pause layout changes and first extract renderer-independent form state and record construction, preserving all desktop behavior and saved Markdown output.

## Architecture Decisions

- Move form data and record construction out of `EventTaskModal` before choosing the final mobile renderer.
- Keep submission behavior and both renderers unchanged during this refactor increment.
- Select the mobile renderer with Obsidian's public `Platform.isMobile` API, retaining the width check only for desktop responsive preview.
- Keep one scrollable sheet instead of adding a wizard. Common fields stay visible; optional fields move under one collapsed `More options` disclosure.
- Keep the existing custom sheet as a documented exception to Obsidian's standard `Modal` container because of prior software-keyboard failures.
- Make listener cleanup idempotent and keep all dynamic viewport styling limited to CSS custom properties.
- Consolidate the final mobile-sheet CSS into one authoritative block and remove only selectors proven redundant for this renderer.
- Do not change writer logic, settings, default values, or desktop layout.

## Dependency Graph

```text
Official mobile detection and lifecycle baseline
    |
    v
Compact mobile DOM and accessible state
    |
    v
Adaptive sheet CSS and keyboard layout
    |
    v
Automated gates and real Obsidian acceptance
```

## Task List

### Phase 0: Quality prerequisite after failed acceptance

- [x] Extract renderer-independent form state and record construction.
- [x] Cover event and task record construction with focused regression tests.
- [x] Extract and test renderer-independent submission orchestration.
- [x] Re-run all automated quality gates before resuming mobile layout decisions.

### Phase 1: Foundation

- [x] Task 1: Align mobile selection and lifecycle with the public Obsidian API.

### Checkpoint: Foundation

- [x] Focused tests pass.
- [x] TypeScript compilation passes.
- [x] Desktop still selects the standard modal outside responsive preview.

### Phase 2: Capture-first mobile structure

- [x] Task 2: Restructure the mobile sheet into persistent actions, primary capture fields, and one collapsed `More options` section.
- [x] Task 3: Expose accessible selected, pressed, and summary state for mobile controls.

### Checkpoint: Structure

- [ ] Event and Task values survive tab and disclosure changes.
- [ ] Every existing optional field remains reachable.
- [ ] Desktop renderer source remains behaviorally unchanged.

### Phase 3: Responsive layout

- [ ] Task 4: Consolidate mobile-sheet CSS and implement adaptive height, safe areas, compact spacing, and keyboard visibility.

### Checkpoint: Automated completion

- [x] `pnpm test` passes with no skipped tests.
- [x] `pnpm run typecheck` passes.
- [x] `pnpm run lint` passes.
- [x] `OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run build` succeeds.
- [x] `git diff --check` is clean.

### Phase 4: Runtime acceptance

- [ ] Task 5: Validate the mobile flow in real Obsidian at representative tall and short smartphone viewports.

### Checkpoint: Complete

- [ ] Event and Task flows pass with keyboard closed and open.
- [ ] Related note, Detail note, Save to, folder/file suggesters, Save, Cancel, backdrop dismissal, and Escape are verified.
- [ ] Developer console has no new runtime errors.
- [ ] Operator acceptance is recorded separately from automated results.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Custom sheet is outside the documented `Modal` rendering path | High | Use only public environment APIs, keep explicit cleanup, and require real-mobile acceptance |
| Keyboard behavior differs between Android and iOS WebViews | High | Use `visualViewport` when available, CSS safe areas, a fallback without fixed keyboard percentages, and test a short viewport |
| Shared render helpers leak desktop structure into mobile | Medium | Override only mobile composition and reuse field renderers; keep all mobile selectors under `.fn-mobile-sheet` |
| CSS duplication causes specificity regressions | Medium | Establish one final authoritative mobile block and inspect removed selectors before deletion |
| Optional fields lose state when collapsed | Medium | Keep DOM mounted inside native `details`; test open/close cycles before save |
| Existing modal file is already over 1,000 lines | Medium | Avoid unrelated refactoring; extract a focused helper only if required by testability or lifecycle clarity |

## Open Questions

- Real iOS and Android acceptance depends on an available Obsidian mobile environment; automated checks cannot substitute for it.
