# Implementation Plan: Periodical Notes registry + per-capture-kind targeting

Full design/rationale: `C:\Users\parki\.claude\plans\elegant-strolling-riddle.md`.

## Checklist

- [x] 1. Periodical Notes registry — `types.ts`, `TargetResolver.getPeriodicalTarget`/`getProfileFolder`,
      new Settings tab section + `SettingsLayout` entry. Purely additive.
- [x] 2. Focus session + Event move onto profiles — removed `useDailyNotesAsDefault`/`defaultTarget`,
      updated every read-site (`TimelineView.ts`, `SettingsTab.ts` alignment helper, `EventTaskModal.ts`
      constructor + `openDesktopScheduledItemCreate`, `EventTaskMobileScreen.ts` constructor,
      `ScheduledItemMobileCreateLauncher.ts`). Also fixed a real bug found along the way: Event was
      incorrectly resolving through `getActiveTarget()`, which folds in `liveTarget` — a Focus-session-only
      sidebar override — so a live-overridden Focus target was silently leaking into new Events too. Event
      now resolves independently via `captureEvent.profileId`. `resolveDailyBacklinkTarget`'s fallback
      simplified to `getPeriodicalTarget("daily", ...)` directly (was falling back through
      `getDefaultTarget()`, which after this change means "Focus session's target" — wrong once Focus
      session points at a non-daily profile). Settings UI: Focus session capture + Event capture sections;
      Task's fields stay in a renamed "Task & shared note creation" section until Phase 3 gives it its own.
- [x] 3. Task's own settings + object-scoped picker — `TaskCaptureSettings` (allowedSourceIds, heading,
      position, hubNotesFolder), new `ObjectNoteSuggest.ts` (prioritizes notes from allowed Object Sources,
      falls back to full-vault `FileSuggest` behavior), wired into `DesktopScheduledItemForm.ts`/
      `MobileScheduledItemForm.ts`'s Save-to field for `kind === "task"`. `eventTask.hubNotesFolder`/
      `defaultSaveHeading` removed entirely (both Event and Task now have independent settings); every
      read-site fixed, including `timelineSourceHeadings()` widened to accept both capture headings instead
      of one. Settings UI: "Task capture" section (checklist of allowed Object Sources + heading + position
      + hub folder) and a separate "Shared note creation" section for the detail-note settings that
      genuinely remain shared. `pnpm run check`-equivalent (typecheck/lint/test, via `fnm use` to get a
      working `node`/`pnpm` in this session) all green — 252/252 tests pass.
- [ ] 4. Moment moves onto profiles — remove weekly-specific `InboxSettings` fields, restructure
      `InboxTarget.ts`, simplify backlink, delete `getDailyNoteTarget`/`getWeeklyNoteTarget`. Moment
      section in Capture tab.
- [ ] 5. Capture tab layout polish + doc pass.

Each phase = one atomic commit, own test updates, in that order per the plan file.
