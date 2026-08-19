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
- [x] 4. Moment moves onto profiles — `InboxSettings` shrunk to just `contextSources`; new
      `MomentCaptureSettings` (`useEventCaptureTarget`, `profileId`, `heading`, `position`,
      `backlink: {enabled, profileId, heading}`); `InboxTargetMode` enum removed entirely.
      `InboxTarget.ts`'s `selectInboxTarget` now 2-branch (event-capture-target vs periodical profile)
      instead of 3 string-mode branches. `resolveDailyBacklinkTarget` renamed `resolveMomentBacklinkTarget`
      and gated on `backlink.enabled` instead of a mode string; the old `weeklyNoteCapture` flag renamed
      `usesDatedHeading`, computed from whether the resolved profile actually has a `headingFormat`
      (generalizes beyond "weekly" to any dated-heading profile). Deleted `getDailyNoteTarget()`/
      `getWeeklyNoteTarget()` — fully superseded by `getPeriodicalTarget()`. `EventTaskFormDefaults.inbox`
      removed (was only ever used for the now-gone heading/position fallback); added an explicit
      `inboxPosition` override alongside the existing `inboxHeading` one. Settings UI: "Moment capture"
      section (reuse-Event-target toggle, profile picker, heading, position, backlink sub-section with its
      own profile+heading). Full verification this round: `pnpm run check`-equivalent (format, typecheck,
      lint, test — 252/252) **and** `pnpm run build`/`verify:artifacts` all green, via `fnm use` to get a
      working `node`/`pnpm` in this session.
- [x] 5. Capture tab layout polish + doc pass. Verified the four Capture-tab H3 sections
      ("Moment capture", "Event capture", "Task capture", "Shared note creation") match
      `SettingsLayout.ts`'s `CAPTURE_SECTIONS` exactly, and that no `src/` file still references a
      removed field/enum (`InboxTargetMode`, `defaultTargetMode`, `weeklyNoteFolder/Format`,
      `dailyBacklinkHeading`, `useDailyNotesAsDefault`, `defaultTarget`, `getDailyNoteTarget`/
      `getWeeklyNoteTarget`, `eventTask.hubNotesFolder`/`defaultSaveHeading`, `weeklyNoteCapture`) —
      grep across `src/` and `test/` came back clean. `docs/spec-inbox-quick-capture.md` and
      `tasks/moment-weekly-target-plan.md` still describe the pre-Periodical-Notes shape
      (`InboxTargetMode`, `peopleFolders`/`placeFolders`); left as-is since both are frozen,
      point-in-time approved specs/plans (same convention already applied to earlier superseded
      content in those files), not living documentation. `README.md` *is* living documentation and
      did have stale, actively-misleading content — the "Use Daily Notes plugin settings" /
      "Default file / heading / insert position" Settings bullets (described a toggle and fields
      that no longer exist) were replaced with a description of the new Periodical Notes tab and
      the four per-kind capture sections; the Architecture table's `TargetResolver` one-liner
      updated from "resolves Daily Notes default" to "resolves Periodical Notes profiles". Full
      verification: `pnpm run check` (format, lint, typecheck, test — 252/252) and
      `pnpm run build` + `pnpm run verify:artifacts` all green via `fnm use`.

Each phase = one atomic commit, own test updates, in that order per the plan file.

All 5 phases complete. Remaining: real Obsidian desktop/mobile acceptance testing (automated checks
don't substitute for it) — define a custom periodical profile, confirm Focus session/Event/Moment/Task
each resolve to their own independently configured destination, confirm Task's Save-to picker prioritizes
allowed Object Sources while still accepting a typed path, confirm the Moment backlink and dated-heading
behavior with `syncDailyFromCorePlugin` both on and off.
