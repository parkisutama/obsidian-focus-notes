# Implementation Plan: Minimal Mobile Event and Task Modal

## Overview

Refine the independent mobile renderer into a compact, Google Calendar-inspired editor sheet after real-device testing exposed Android status-bar overlap and excessive card density.

## Architecture Decisions

- Share only form state, record construction, and submission orchestration between renderers.
- Keep `EventTaskModal extends Modal` for desktop and use `EventTaskMobileScreen extends Component` for mobile.
- Select the mobile renderer with Obsidian's public `Platform.isMobile` API, retaining the width check only for desktop responsive preview.
- Keep one scrollable mobile body instead of adding a wizard. Common fields stay visible; optional fields move under one collapsed `More options` disclosure.
- Mount inside the public workspace container, reserve system-bar clearance, and resize the body against `visualViewport`.
- Use a rounded sheet, X/Save header, title, compact type chips, and icon-led rows without large cards.
- Make listener cleanup idempotent and keep all dynamic viewport styling limited to CSS custom properties.
- Consolidate mobile-screen CSS into one authoritative scoped block and remove obsolete sheet selectors.
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

### Phase 1: Independent mobile screen

- [x] Replace the inherited bottom sheet with `EventTaskMobileScreen extends Component`.
- [x] Keep a fixed top header and one scrollable body anchored to `visualViewport`.
- [x] Preserve every event/task field, suggester, validation, and submission path.
- [x] Remove obsolete bottom-sheet and keyboard-compression rules.

### Phase 1B: Real-device visual correction

- [x] Move the sheet below Android system chrome with workspace measurement and a tested fallback.
- [x] Remove the duplicate centered header title that collided with system UI.
- [x] Replace large cards and full-width type tabs with compact Google Calendar-inspired rows and chips.
- [x] Reduce chip visual height and remove cumulative disclosure indentation after the second device review.
- [x] Align title, chips, and row icons to one leading edge and prevent SVG clipping after the third device review.
- [ ] Repeat real-device acceptance with keyboard closed and open.

### Phase 2: Foundation verification

- [x] Task 1: Align mobile selection and lifecycle with the public Obsidian API.

### Checkpoint: Foundation

- [x] Focused tests pass.
- [x] TypeScript compilation passes.
- [x] Desktop still selects the standard modal outside responsive preview.

### Phase 3: Capture-first mobile structure

- [x] Task 2: Restructure the mobile screen into persistent actions, primary capture fields, and one collapsed `More options` section.
- [x] Task 3: Expose accessible selected, pressed, and summary state for mobile controls.

### Checkpoint: Structure

- [ ] Event and Task values survive tab and disclosure changes.
- [ ] Every existing optional field remains reachable.
- [ ] Desktop renderer source remains behaviorally unchanged.

### Phase 4: Responsive layout

- [x] Task 4: Consolidate mobile-screen CSS and implement visual-viewport height, safe areas, compact spacing, and keyboard visibility.

### Checkpoint: Automated completion

- [x] `pnpm test` passes with no skipped tests.
- [x] `pnpm run typecheck` passes.
- [x] `pnpm run lint` passes.
- [x] `OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run build` succeeds.
- [x] `git diff --check` is clean.

### Phase 5: Runtime acceptance

- [ ] Task 5: Validate the mobile flow in real Obsidian at representative tall and short smartphone viewports.

### Checkpoint: Complete

- [ ] Event and Task flows pass with keyboard closed and open.
- [ ] Related note, Detail note, Save to, folder/file suggesters, Save, Cancel, and Escape are verified.
- [ ] Developer console has no new runtime errors.
- [ ] Operator acceptance is recorded separately from automated results.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Custom screen is outside the documented `Modal` rendering path | High | Own it with `Component`, use registered cleanup, and require real-mobile acceptance |
| Keyboard behavior differs between Android and iOS WebViews | High | Use `visualViewport` when available, CSS safe areas, a fallback without fixed keyboard percentages, and test a short viewport |
| Desktop behavior leaks into mobile | Medium | Keep the mobile renderer independent and scope its selectors below `.fn-mobile-event-screen` |
| CSS duplication causes specificity regressions | Medium | Establish one final authoritative mobile block and inspect removed selectors before deletion |
| Optional fields lose state when collapsed | Medium | Keep DOM mounted inside native `details`; test open/close cycles before save |
| Renderer files grow too large | Medium | Keep shared state and submission outside both renderer classes |

## Open Questions

- Real iOS and Android acceptance depends on an available Obsidian mobile environment; automated checks cannot substitute for it.
