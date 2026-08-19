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
- [ ] 3. Moment→profile backlink independent position — `MomentBacklinkSettings.position`, decoupled from
      `captureMoment.position`.
- [ ] 4. Task date fields as relative Markdown links — creation path (`EventTaskMarkdown.ts`,
      `EventTaskWriter.ts`, all `new EventTaskWriter(...)` call sites, `ScheduledItemParser.ts` unwrap).
- [ ] 5. Task date fields as relative Markdown links — edit path (`TaskLineEditor.ts`,
      `ScheduledItemFormAdapter.ts`, `ScheduledItemEditSubmission.ts`, both Edit modals).

Each phase = one atomic commit, own test updates, in that order per the plan file.
