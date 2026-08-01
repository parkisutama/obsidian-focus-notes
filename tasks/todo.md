# Tasks: Minimal Mobile Event and Task Modal

## Task 1: Use public mobile detection and a deterministic sheet lifecycle

**Description:** Use `Platform.isMobile` plus a narrow viewport preview fallback. Make opening and closing the custom screen idempotent and ensure registered handlers and DOM are removed.

**Acceptance criteria:**

- [x] Actual Obsidian mobile uses `Platform.isMobile`.
- [x] Desktop responsive preview remains possible at widths up to 640px.
- [x] Closing twice is safe and leaves no sheet class, DOM node, or global handler.

**Verification:**

- [x] Add focused tests for the extracted renderer-selection helper where practical.
- [x] Run `pnpm test` and `pnpm run typecheck`.
- [x] Inspect the close path and listener cleanup once after implementation.

**Dependencies:** None.

**Files likely touched:**

- `src/EventTaskModal.ts`
- `test/event-task-mobile.test.ts`

**Estimated scope:** Small, 1–2 files.

## Task 2: Build the compact capture-first mobile composition

**Description:** Keep persistent actions, title, type, primary scheduling fields, and description in the visible mobile flow. Put Related note, Detail note, and Save to inside one collapsed `More options` container without unmounting their state.

**Acceptance criteria:**

- [x] Title, type, primary date/time, description, and Save form the initial visible flow.
- [x] `More options` is collapsed initially and contains all three existing optional sections.
- [x] `Save to` exposes a compact resolved-destination summary while collapsed.

**Verification:**

- [x] No additional state helper was needed; disclosure DOM remains mounted natively.
- [x] Run `pnpm test` and `pnpm run typecheck`.
- [x] Inspect both Event and Task DOM paths for complete field coverage.

**Dependencies:** Task 1.

**Files likely touched:**

- `src/EventTaskModal.ts`
- `test/event-task-mobile.test.ts`

**Estimated scope:** Small, 1–2 files.

## Task 3: Make mobile interaction state accessible

**Description:** Add explicit labels and accessible selected/pressed state to tabs, toggle rows, top-bar actions, and disclosure summaries while retaining native keyboard behavior.

**Acceptance criteria:**

- [x] Event/Task controls expose their role and selected state.
- [x] Toggle rows expose checked state beyond icon and color.
- [x] Every input has a visible label or explicit accessible name.

**Verification:**

- [x] Typecheck the resulting DOM attribute usage.
- [ ] Keyboard-review Tab, Enter, Space, Escape, and disclosure behavior in runtime acceptance.

**Dependencies:** Task 2.

**Files likely touched:**

- `src/EventTaskModal.ts`
- `test/event-task-mobile.test.ts`

**Estimated scope:** Small, 1–2 files.

## Task 4: Consolidate and refine adaptive mobile styling

**Description:** Keep one scoped editor-sheet source of truth. Implement compact rows, 44px touch targets, workspace/system-bar clearance, safe areas, and visual-viewport scrolling without changing desktop styling.

**Acceptance criteria:**

- [x] All redesigned selectors are scoped below `.fn-mobile-event-screen`.
- [ ] Controls have at least 44px touch targets and no horizontal overflow at 360px width.
- [x] The screen remains top-anchored and resizes only its scrollable body when the keyboard opens.

**Verification:**

- [x] Run `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, and `OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run build`.
- [x] Run `git diff --check`.
- [x] Compare mobile and desktop selector reach before removing duplicated CSS.

**Dependencies:** Tasks 2 and 3.

**Files likely touched:**

- `styles.css`
- `src/EventTaskModal.ts` only if a layout class is required.

**Estimated scope:** Small, 1–2 files.

## Task 5: Complete real Obsidian mobile acceptance

**Description:** Exercise the final screen in Obsidian at approximately 390x844 and 360x640, including software-keyboard behavior and every optional workflow. Record automated evidence separately from user/operator acceptance.

**Acceptance criteria:**

- [ ] Event and Task creation succeed at both target sizes.
- [ ] Focused fields, Save, and Cancel remain reachable with the keyboard open.
- [ ] No new console errors occur and desktop behavior remains intact.

**Verification:**

- [ ] Capture viewport evidence for both sizes.
- [ ] Verify Related note, Detail note, Save to, suggesters, dismissal, and state retention.
- [ ] Obtain explicit user acceptance before merging to `main`.

**Dependencies:** Task 4.

**Files likely touched:**

- No production source changes unless acceptance reveals a defect.
- Optional evidence note under `docs/` if requested.

**Estimated scope:** Small, verification only.
