# Spec: Minimal Mobile Event and Task Modal

## Status

The first implementation failed real-mobile acceptance because the keyboard compressed the inherited bottom-sheet layout. Further layout work is paused while the shared form state and save boundaries are separated from the renderers.

## Objective

Redesign the custom mobile event/task sheet so the most common action can be completed quickly with one hand, while every existing field remains available. The desktop modal and the saved Markdown format must keep their current behavior.

The primary mobile flow is:

1. Enter a title.
2. Choose Event or Task.
3. Set the primary date/time.
4. Optionally add a short description.
5. Save.

Less-frequent fields remain available through compact disclosure rows and do not occupy vertical space until opened.

## Assumptions

- The current custom `EventTaskMobileSheet` is retained only during a behavior-preserving quality refactor. Its inheritance from `EventTaskModal` is not an approved final architecture.
- A single scrollable sheet is preferable to a multi-step wizard for fast capture.
- Event defaults remain date plus start/end time; Task defaults remain due date, with timebox and reminders optional.
- `Related note`, `Detail note`, and `Save to` remain supported. `Save to` starts collapsed because its defaults are already resolved.
- Existing writer behavior, settings, templates, and desktop modal are out of scope.
- UI copy remains English to match the current modal.

## Official Obsidian API Baseline

- The installed and locked development API is `obsidian` 1.12.3. Although `package.json` currently declares `latest`, implementation is checked against the locked API surface in `pnpm-lock.yaml` and `node_modules/obsidian/obsidian.d.ts`.
- Detect the actual Obsidian mobile UI with the public `Platform.isMobile` API. A viewport-width check may still select the responsive preview on desktop, but it must not replace platform detection.
- Build custom UI with Obsidian's `HTMLElement.createEl()` helpers and plugin-owned class names.
- Use Obsidian CSS variables for colors, borders, backgrounds, and typography compatibility across themes.
- Global and DOM listeners must be detached when the sheet closes. If the custom sheet is moved to a `Component`, use `registerDomEvent()`/`unload()`; otherwise keep one explicit, idempotent cleanup path.
- The official `Modal` API provides `open()`, `close()`, `onOpen()`, and `onClose()` and notes that mobile modals animate on screen. The current project-specific sheet bypasses that container because the prior Modal layout was not reliable with the software keyboard. This is an intentional exception, not an official Obsidian UI pattern, and therefore requires real mobile acceptance.
- Avoid hardcoded inline styling. Runtime-only viewport measurements may be passed through narrowly scoped CSS custom properties because their values cannot be known statically; all visual rules remain in `styles.css`.

## Mobile Information Architecture

### Persistent top bar

- Compact drag handle.
- `Cancel` action on the left.
- Context title (`New event` or `New task`) centered or visually grouped with the type selector.
- `Save` primary action on the right.
- Top bar remains visible while the body scrolls and respects the top safe area.

### Primary content

- Title input, visually prominent but no larger than needed.
- Event/Task segmented control with proper selected state.
- Event: date, start, end, and All day in a compact card/row.
- Task: due date with optional time; Timebox and Reminders remain opt-in.
- Description is a compact auto-growing textarea with a bounded maximum height.

### Optional content

- One `More options` section contains:
  - Related note.
  - Detail note.
  - Save to.
- Each subsection exposes its current summary when collapsed, such as the resolved target filename for `Save to`.
- Opening one subsection must not hide or discard values entered in another subsection.

### Keyboard behavior

- The focused field must remain visible above the software keyboard.
- The sheet uses the actual `visualViewport` inset when available and does not assume a fixed keyboard percentage.
- The scroll position must not jump when focus moves between fields.
- Save and Cancel remain reachable without requiring the keyboard to be dismissed manually.

## Accessibility and Interaction

- Interactive controls have a minimum 44 by 44 CSS-pixel touch target.
- Event/Task control exposes tab or pressed/selected semantics and can be operated by keyboard.
- Toggle rows expose their checked state through `aria-pressed` or a native input, not only through icon/color.
- Disclosure summaries use native `details/summary` semantics.
- Inputs have visible labels or an `aria-label`; placeholders are not the sole accessible label.
- Focus starts on Title, Escape closes where supported, and closing removes all global listeners and sheet DOM.
- Safe-area insets are honored at the top and bottom.

## Tech Stack and Project Structure

- TypeScript and the Obsidian API.
- Shared form state: `src/EventTaskFormState.ts`.
- Shared submission orchestration: `src/EventTaskSubmission.ts`.
- Desktop and temporary mobile renderers: `src/EventTaskModal.ts`.
- Shared styling: `styles.css`; mobile changes remain under `.fn-mobile-sheet` to avoid desktop regressions.
- Unit tests: `test/` using Node's built-in test runner.
- Design specification: `docs/spec-mobile-event-task-modal.md`.

## Code Style

Reuse the existing render-helper style and keep mobile-only behavior in `EventTaskMobileSheet`:

```ts
const summary = details.createEl("summary", {
    cls: "fn-mobile-disclosure-summary",
    attr: { "aria-label": label }
});
```

Prefer native controls, Obsidian theme variables, explicit class names, and lifecycle cleanup. Do not introduce a UI framework or dependency.

Use the documented platform API for environment detection:

```ts
import { Platform } from "obsidian";

const useMobileSheet = Platform.isMobile || window.innerWidth <= 640;
```

## Commands

```bash
pnpm test
pnpm run typecheck
pnpm run lint
OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run build
```

## Testing Strategy

- Unit-test any extracted state, summary, or responsive decision helpers.
- Run the complete lint, typecheck, test, and production build gates.
- Perform real Obsidian acceptance at approximately 390x844 and one shorter viewport near 360x640.
- On both sizes, test Event and Task, long title, keyboard-open description, each optional disclosure, folder/file suggesters, Save, Cancel, backdrop dismissal, and Escape where available.
- Confirm no runtime errors in the Obsidian developer console.
- Desktop behavior remains a separate regression check; static build success is not desktop acceptance.

## Boundaries

### Always

- Preserve all existing event/task data fields and Markdown output.
- Keep mobile DOM and event listeners fully removable on close.
- Use Obsidian theme variables and existing visual language.
- Verify at smartphone width with the keyboard both closed and open.

### Ask first

- Removing or renaming any field.
- Changing default values or save behavior.
- Replacing the single sheet with a stepper/wizard.
- Changing the desktop modal.
- Adding dependencies.

### Never

- Hide data loss or validation failures to simplify the UI.
- Depend only on hard-coded keyboard height.
- Make generated build artifacts the source of truth.
- Call static checks proof of mobile acceptance.
- Read undocumented Obsidian internals to determine mobile state or modal layout.

## Success Criteria

- At 390x844, title, type selector, primary date/time, description entry point, and Save are reachable without excessive scrolling.
- At 360x640 with the keyboard open, the active input remains visible and the body can scroll to every enabled field.
- Related note, Detail note, and Save to consume only summary-row height when collapsed.
- All existing optional fields remain editable and retain their values while sections open and close.
- All interactive mobile controls meet the 44px touch-target requirement and expose accessible state.
- No mobile rule changes the desktop modal.
- Tests, typecheck, lint, and production build pass.
- Real-device or Obsidian mobile acceptance is recorded separately from automated verification.

## Open Questions

1. Should `Save to` be collapsed by default as proposed, or remain open so the destination is always visible?
2. Should the mobile sheet keep its current 78vh bottom-sheet height, or expand close to fullscreen when content or keyboard requires it?

## Official References

- [Obsidian HTML elements](https://docs.obsidian.md/Plugins/User%20interface/HTML%20elements) — `createEl()`, plugin-owned classes, and container elements.
- [Obsidian styling guidance](https://docs.obsidian.md/Reference/CSS%20variables/About%20styling) — use Obsidian CSS variables for theme-compatible custom UI.
- [Obsidian events](https://docs.obsidian.md/Plugins/Events) — lifecycle registration and automatic event cleanup principles.
- [Obsidian plugin self-critique checklist](https://docs.obsidian.md/oo/plugin) — mobile compatibility, `Platform`, scoped styling, public APIs, and release-quality checks.
- [Obsidian TypeScript API declarations](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts) — authoritative signatures for `Modal`, `Platform`, and `Component` used by the locked 1.12.3 package.
