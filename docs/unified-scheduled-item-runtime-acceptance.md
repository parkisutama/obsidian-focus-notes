# Unified Scheduled Item Runtime Acceptance

## Snapshot

- Date: 2026-08-15
- Branch: `feature/persona-reliability-foundation`
- Automated implementation checkpoint: `6e7e94b`
- Runtime acceptance status: **pending**

This ledger deliberately separates repeatable automated evidence from observations inside Obsidian. A green build does not
prove modal layout, keyboard behavior, suggestion positioning, file navigation, or real-device safe areas.

## Automated evidence

`OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run check:ci` passed on 2026-08-15 with:

- formatting and lint;
- version metadata and TypeScript checks;
- 56 discovered test files with no failures or skipped tests;
- production build and artifact verification;
- VitePress documentation build.

`git diff --check` also passed. This run occurred in the active worktree. A user-owned untracked
`AUDIT-focus-notes.md` file remains outside the implementation scope, so this is not recorded as a literal clean-worktree
acceptance run.

## Desktop runtime

Status: **not run after the final shared-form and legacy-hub retirement changes**.

- [ ] Create Task and Event from the command palette.
- [ ] Edit Task and Event from the active-note manager and Timeline.
- [ ] Resolve `@` suggestions and verify vault-root `@{path.md}` text.
- [ ] Exercise Detail Note None, Link existing, Create new, and a recoverable attach failure.
- [ ] Confirm target file, heading, insertion position, validation, busy state, retry, Cancel, and Escape.
- [ ] Confirm legacy linked titles remain linked after editing title or schedule fields.
- [ ] Confirm the developer console has no new errors.

## Android runtime

Status: **not run after the final shared mobile renderer changes**.

- [ ] Repeat Create/Edit Task and Event with keyboard closed and open.
- [ ] Test a tall viewport near 390x844 and a shorter viewport near 360x640.
- [ ] Verify safe-area clearance, focused-field visibility, scrolling, Save, Cancel, and Escape/back behavior.
- [ ] Verify Object Reference and file/folder suggestion overlays remain above the workspace screen.
- [ ] Confirm the developer console has no new errors.

## iOS runtime

Status: **not run**.

- [ ] Repeat the Android flow on an iOS device or simulator with Obsidian.
- [ ] Verify visual viewport resizing, safe-area insets, focus scrolling, and suggestion overlays.
- [ ] Confirm the developer console has no new errors.

## Completion rule

Record device/app versions, pass/fail evidence, and any observed failure directly in this file. Do not mark Task 10 runtime
acceptance complete until the applicable desktop and mobile sections have actual results. Automated checks may be rerun as
regression evidence, but they cannot change a runtime item from pending to passed.
