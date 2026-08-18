# Implementation Plan: Moment (Inbox) default → ISO weekly note, Task off Daily Notes

## Overview

Reposition Inbox as "Moment" in UI copy only (no internal rename). Add a new `weekly-note` Inbox target
mode that defaults new installs to an ISO-weekly note (manual folder/format settings, no community-plugin
config reading), with a per-day H2 heading matching `dailyNoteFormat`, plus an auto-inserted backlink line
in that day's Daily Note. Separately, stop Task from inheriting Event's Daily-Notes-derived default target;
Task now defaults to empty (falling back only to whatever note is currently active in the workspace),
forcing an explicit "Save to" pick when nothing is active. Event is unchanged.

Full design/rationale lives in the plan file this task doc summarizes into checkable steps:
`C:\Users\parki\.claude\plans\elegant-strolling-riddle.md`.

## Checklist

- [x] 1. `src/types.ts` — `InboxTargetMode` third value, `InboxSettings` new fields, `DEFAULT_SETTINGS`,
      `mergeSettingsWithDefaults`.
- [x] 2. `src/TargetResolver.ts` — `getWeeklyNoteTarget()`.
- [x] 3. `src/InboxTarget.ts` — third mode branch preserving per-day heading.
- [x] 4. `EventTaskModal.ts` / `EventTaskMobileScreen.ts` constructors — thread `weeklyNoteTarget` **and**
      seed `form.inboxHeading` from the resolved target's per-day heading (added `inboxHeading` override to
      `EventTaskFormDefaults` in `EventTaskFormState.ts` — without it the per-day heading was computed but
      then discarded, since the form always re-derived its heading from `settings.inbox.heading`).
- [x] 5. `EventTaskSubmission.ts` — `resolveDailyBacklinkTarget` + `buildDailyBacklinkWrite`; wire in both
      modals' `submit()`.
- [x] 6. Task empty default target — exported/adjusted `openDesktopScheduledItemCreate`, adjusted
      `openMobileScheduledItemCreate`, fixed `activate()` / `openScheduledItemCreate()` forwarding (both
      were forwarding the stale shared `this.form.targetFile` to both kinds — this was today's actual
      Task-inherits-Daily-Notes bug).
- [x] 7. `SettingsTab.ts` — new fields, third dropdown option, section rename. Also fixed
      `SettingsLayout.ts`'s `settingsTabForSection` string match (would have silently misrouted the
      renamed section into the wrong settings tab).
- [x] 8. UI-copy rename pass ("Inbox" → "Moment" in user-facing strings only).
- [x] 9. Tests added: `test/inbox-target.test.ts` (weekly-note mode + heading-preservation branch),
      `test/event-task-submission.test.ts` (backlink fires/omitted, Task empty-target validation),
      `test/state-store.test.ts` (new inbox fields merge, existing installs' `defaultTargetMode`
      preserved), `test/settings-layout.test.ts` (updated for renamed section). No direct `TargetResolver`
      test added — the `obsidian` package is types-only (`"main": ""`), so importing it as a value (for
      `moment`) doesn't work under plain `node --test`; no existing test in this repo does that either.
- [ ] 10. `pnpm run typecheck && pnpm run lint && pnpm test` — **not run**. `node` is not on PATH in this
      tool session (confirmed: `pnpm` itself works but every script that shells out to `node`/`tsc` fails
      with "'node' is not recognized"). Please run `pnpm run check` locally before merging.

## Round 2 — follow-up from user testing

Research (fetched `srg-kostyrko/obsidian-journal` README + `package.json`, `johansan/notebook-navigator`
README):

- **Journals plugin already documents Moment.js format tokens** for its `{{date:format}}` variables
  (`"format is string using Moment.js format rules"`), and its own `package.json` has no date-fns/luxon
  dependency. So the existing Moment.js approach in `TargetResolver` is already the right interop choice —
  no library swap needed, and no new dependency was added.
- Journals resolves week-note `{{date}}` to the week's *representative day* (Thursday under ISO-8601
  config) specifically so plain `YYYY` names the right year at a year boundary. This repo's resolver
  doesn't do that day-shift trick; it uses Moment's native ISO week-year token `GGGG` instead (paired with
  `WW`), which handles the same boundary case without needing to move the reference date. Settings copy
  now explicitly warns against typing `YYYY` (use `GGGG`).
- Notebook Navigator's "folder note" is a note named after its containing folder (`Convert to folder note`
  moves a file into a same-named folder). `weeklyNoteFolder` already supports embedding a `{{date:FORMAT}}`
  token, so repeating the weekly format there (e.g. `Weekly/{{date:GGGG-[W]WW}}`) already produces that
  exact nested shape — confirmed no code change was needed for this.

Implemented from this round:

- [x] Dedicated `inbox.weeklyHeadingFormat` setting — the per-day heading inside the weekly note no longer
      reuses `dailyNoteFormat`; it has its own Moment.js format field (default `YYYY-MM-DD`), per user
      request ("konfigurasi heading sendiri juga seharusnya ada untuk format dinamis").
- [x] `formatInboxEntry()` gained a `timeOnly` option: weekly-note-mode captures now write `- 15:40 —
      Title` instead of `- 2026-08-01 15:40 — Title`, since the date is already carried by the per-day
      heading. Threaded through `EventTaskWriter.writeInbox` → `InboxSubmissionDependencies.weeklyNoteCapture`
      → both modals' `submit()`. Only applies when the global Inbox mode is `weekly-note`; daily-note/
      event-task-target output is untouched (byte-for-byte, per the original Inbox spec contract).
- [x] Settings copy updated to document that `weeklyNoteFolder`/`weeklyNoteFormat` already support
      `{{date:FORMAT}}` tokens for a dynamic year-scoped subfolder or a folder-note nested shape.

Open, waiting on user clarification:

- Whether "Save to still looks static" is an existing-install setting not yet switched to `weekly-note`
  mode (my working assumption — this repo's merge logic deliberately preserves an existing install's prior
  `defaultTargetMode`, only new installs default to `weekly-note`), or an actual bug — asked the user to
  confirm/reproduce.
- Whether the per-capture bullet structure should go further than "no repeated date" (e.g. one parent
  bullet per day with all captures nested under it) — asked the user; implemented the "no repeated date"
  reading they picked.

## Round 3 — Event/Task modal parity with Moment's chips

User request: the live Event/Task creation modal (`ScheduledItemDesktopCreateModal`/
`ScheduledItemMobileCreateScreen` — confirmed in round 1 research to be the actual UI used for Event/Task,
not the legacy sections inside `EventTaskModal`/`EventTaskMobileScreen`) had no way to switch kind without
closing and manually reopening. Moment already has this via its chip row.

Implemented: a Moment/Event/Task chip row, reusing the exact same CSS classes as the existing chips
(`fn-gcal-tabs`/`fn-gcal-tab` on desktop, `fn-mobile-event-kind`/`fn-mobile-event-kind-button` on mobile,
both already themed) so it looks identical to Moment's. Design choice: every switch (including Event↔Task)
closes the current modal/screen and opens a fresh one via the already-correct, already-tested launcher
functions (`openDesktopScheduledItemCreate`, `openMobileScheduledItemCreate`, `new EventTaskModal(...)`,
`new EventTaskMobileScreen(...)`) rather than mutating form state in place — this reuses 100% of the
kind-specific target-resolution logic from round 1 (Task's empty default, Event's Daily-Notes default)
with no risk of subtly duplicating/diverging it, at the cost of not preserving typed Title/Description
across a switch. Flagged as a deliberate scope call, not an oversight — if editable-field carryover across
kind switches turns out to matter in practice, that's a follow-up.

- `src/DesktopScheduledItemForm.ts` / `src/MobileScheduledItemForm.ts`: new `onSwitchKind?` option +
  `renderKindChips()`, rendered only in `mode: "create"`.
- `src/ScheduledItemDesktopCreateModal.ts` / `src/ScheduledItemMobileCreateScreen.ts`: store `anchorDate`/
  `kind` as fields (previously constructor-only params), new `switchKind()` method wired to the renderer.
- This introduces a deliberate circular import in each pair (`ScheduledItemDesktopCreateModal.ts` ↔
  `EventTaskModal.ts`, `ScheduledItemMobileCreateScreen.ts` ↔ `EventTaskMobileScreen.ts` via the mobile
  launcher) — safe here because every cross-reference is only used inside a method body invoked later at
  runtime, never at module-evaluation time, and the build is a single bundled CJS output
  (`esbuild.config.mjs`, `format: "cjs"`), which resolves circular `require`s the same way. Chip clicks are
  already covered by each form's existing busy/recovery field-locking sweep (generic `<button>` selector),
  so no extra guard was needed for mid-submission clicks.
- Test: extended `test/mobile-scheduled-item-create-composition.test.ts` with a source-text check
  (matching that file's existing lightweight pattern) confirming the wiring exists in all four files.
- Not verified visually — `.fn-gcal-tabs` has top padding/border-bottom styled for sitting at the very top
  of `.fn-gcal-content`; placed here just below the header/context label instead, so it may want a visual
  nudge once seen rendered in Obsidian. Please check.

## Round 4 — daily backlink silently not writing

User report: Moment saves succeed to the weekly note, but the Daily Note backlink never appears (no error
notice either, so the write was never attempted — not attempted-and-failed).

Root cause found: `resolveDailyBacklinkTarget()` (in both `EventTaskModal.ts` and `EventTaskMobileScreen.ts`)
used `TargetResolver.getDailyNoteTarget()`, which returns `null` outright whenever the CORE "daily-notes"
internal Obsidian plugin isn't enabled — by design, for its original caller (Inbox's own `"daily-note"`
target mode, where failing clearly beats guessing). The user's periodical notes are managed by the
**Journals** community plugin, per round 2's research — Journals' own docs recommend disabling core Daily
Notes in its favor. So `getDailyNoteTarget()` was always returning `null` for this user, and the backlink
silently no-op'd every time via `submitInbox`'s existing graceful-skip guard.

Fix: `resolveDailyBacklinkTarget()` now tries `getDailyNoteTarget()` first (core plugin, if actually
enabled) and falls back to `resolver.resolve(resolver.getDefaultTarget(), capturedAt)` — the same general
daily-target resolution Event's default and Focus session logging already depend on, which has its own
built-in fallback to the manually-configured `settings.defaultTarget.file` when the core plugin is
unavailable. No new setting needed; this reuses machinery the user's existing Event/Focus-logging usage
already implicitly validates works for their vault.

Not independently unit-tested — `TargetResolver` isn't unit-testable in this repo's `node --test` setup
(confirmed in round 1: the `obsidian` package is types-only, so importing its `moment` re-export doesn't
work outside the real Obsidian runtime), and `resolveDailyBacklinkTarget` is a private method on a
DOM-heavy modal class with no existing test harness. Verified by code reading only — please confirm in
your vault that the Daily Note backlink now appears after a weekly-note Moment capture.
