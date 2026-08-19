# Implementation Plan: Object Source matching toggles, Task date-links, backlink positions

Full design/rationale: `C:\Users\parki\.claude\plans\elegant-strolling-riddle.md`.

## Checklist

- [x] 1. Object Source `matchByFolder` / `matchByProperty` toggles — `types.ts`, shared matching predicate
      (`contextSourceMatchesNote`/`matchesContextFilter` in `ContextSourceScope.ts`, replacing duplicated
      logic in `InboxSuggestions.ts` and `ContextLinkResolver.ts`), `ContextSourceSettings.ts`
      (`createContextSource`, `findSharedFolderConflicts` gated per toggle), Settings UI (two checkboxes in
      `renderContextSource`, folders/property fields disabled — not cleared — when their toggle is off).
      Dropped the `folders.length > 0` coercion on `enabled` (confirmed with user). Updated 9 test files'
      `ContextSourceSettings` fixtures plus added toggle-matrix tests to `context-source-settings.test.ts`,
      `inbox-suggestions.test.ts`, `context-link-resolver.test.ts`. `pnpm run check` (format/lint/typecheck/
      test — 260/260) green via `fnm use`.
- [x] 2. Object Source backlink insert position — `relatedPosition` on `ContextSourceSettings` (default
      `"start"`), threaded through `ContextDestination` in `ContextLinkResolver.ts` and consumed at all 3
      write-building call sites (`EventTaskSubmission.ts`'s `buildEventTaskContextWrites`/
      `buildInboxContextWrites`, `ScheduledItemCreateRelated.ts`, `ScheduledItemEditSubmission.ts`) instead
      of the previous hardcoded `"end"`. Settings UI: "Log position" dropdown per Object Source. `pnpm run
      check` (format/lint/typecheck/test — 260/260) green via `fnm use`.
- [x] 3. Moment→profile backlink independent position — `MomentBacklinkSettings.position` (default
      `"start"`), decoupled from `captureMoment.position` in `resolveMomentBacklinkTarget`
      (`EventTaskModal.ts`/`EventTaskMobileScreen.ts`, previously accidentally reused the Moment's own
      target position). Settings UI: "Backlink position" dropdown. `pnpm run check` (format/lint/typecheck/
      test — 261/261) green via `fnm use`.
- [x] 4. Task date fields as relative Markdown links — creation path. `EventTaskMarkdown.ts`'s
      `formatTaskLine`/`formatEventTaskEntry` gained optional `targetFilePath`/`resolveDailyPath` params
      (reusing `formatRelativeMarkdownLink` from `InboxMarkdown.ts`, not a new formatter); all existing
      no-arg calls keep producing identical plain-text output. `EventTaskWriter`'s constructor gained an
      optional `getFocusSettings` callback, exposed via a new `resolveDailyLinkPath()` method that builds a
      `TargetResolver` per call; `write()` now threads it through. Updated all 16 `new EventTaskWriter(...)`
      call sites across 6 files. `EventTaskSubmission.ts`'s hub-note-copy write (bypasses `writer.write()`)
      gained its own `resolveDailyLinkPath` dependency, targeting the hub note's own path for the relative
      link (not the primary target). Read side: new `unwrapMarkdownLinkLabel()` in `InboxMarkdown.ts`
      (semantic inverse of `formatRelativeMarkdownLink`) applied in `ScheduledItemParser.ts`'s Task
      field-parsing loop only (`due`/`remind`/`start`/`end` — Event's own date parsing untouched); plain
      unlinked dates still parse. Caught and fixed a real regex bug in `unwrapMarkdownLinkLabel` before it
      shipped: `[^\]]*` excluded every `]` including escaped ones, so a label containing `\[...\]` couldn't
      round-trip — fixed via `(?:\\.|[^\]\\])*`. `pnpm run check` (format/lint/typecheck/test — 266/266) and
      `pnpm run build`/`verify:artifacts` all green via `fnm use`.
- [ ] 5. Task date fields as relative Markdown links — edit path (`TaskLineEditor.ts`,
      `ScheduledItemFormAdapter.ts`, `ScheduledItemEditSubmission.ts`, both Edit modals).

Each phase = one atomic commit, own test updates, in that order per the plan file.
