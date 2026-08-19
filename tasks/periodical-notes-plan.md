# Implementation Plan: Periodical Notes registry + per-capture-kind targeting

Full design/rationale: `C:\Users\parki\.claude\plans\elegant-strolling-riddle.md`.

## Checklist

- [ ] 1. Periodical Notes registry — `types.ts`, `TargetResolver.getPeriodicalTarget`/`getProfileFolder`,
      new Settings tab section + `SettingsLayout` entry. Purely additive.
- [ ] 2. Focus session + Event move onto profiles — remove `useDailyNotesAsDefault`/`defaultTarget`, update
      every read-site (`TimelineView.ts`, `SettingsTab.ts` alignment helper, `EventTaskModal.ts`/
      `ScheduledItemMobileCreateLauncher.ts`). Settings UI: Focus + Event sections in Capture tab.
- [ ] 3. Task's own settings + object-scoped picker — `TaskCaptureSettings`, `ObjectNoteSuggest.ts`,
      launcher updates, Task section in Capture tab.
- [ ] 4. Moment moves onto profiles — remove weekly-specific `InboxSettings` fields, restructure
      `InboxTarget.ts`, simplify backlink, delete `getDailyNoteTarget`/`getWeeklyNoteTarget`. Moment
      section in Capture tab.
- [ ] 5. Capture tab layout polish + doc pass.

Each phase = one atomic commit, own test updates, in that order per the plan file.
