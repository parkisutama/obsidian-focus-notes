# Spec: Inbox Quick Capture

## Status

Approved on 2026-08-01. Implementation is gated by review of the technical plan.

## Objective

Add `Inbox` as a third capture type beside `Event` and `Task`. Inbox is optimized for recording an idea or observation with enough context to retrieve it later, without requiring schedule, deadline, reminder, related-note, or detail-note fields.

The primary flow is:

1. Open the existing Event/Task creation surface.
2. Select the `Inbox` chip.
3. Optionally replace the timestamp-based title.
4. Write Notes, using `@` for People/Place links and `#` for vault tags.
5. Save the entry as a bullet under the configured Inbox heading.

Success means a mobile user can complete the common path from one compact screen while the capture time and selected context remain valid Markdown outside the plugin.

## Agreed Product Contract

### Capture type and visible fields

- `Inbox` is a peer of `Event` and `Task`, not a special event or task mode.
- The chip order is always `Inbox`, `Event`, then `Task` on desktop and mobile.
- The Inbox primary form contains only `Title`, `Notes`, and `Save`.
- People, Place, and tag discovery happen inline in Notes. There are no separate People/Place fields or chips.
- Event/task schedule fields and their `Related note` and `Detail note` controls are hidden in Inbox mode.
- `Advanced` contains destination and suggestion-source overrides only.

### Capture timestamp and title

- Opening a new Inbox capture records one immutable local `capturedAt` value.
- Title defaults to that value formatted as `YYYY-MM-DD HH:mm`.
- Changing capture type away from and back to Inbox must not silently change `capturedAt` during the same form session.
- If the trimmed Title still equals the generated default, write the timestamp once:

```md
- 2026-08-01 15:40
    - Notes body
```

- If Title is changed, retain the capture timestamp and append the title:

```md
- 2026-08-01 15:40 — Hubungi vendor
    - Notes body
```

- A blank edited Title is treated like the unchanged default and still produces a traceable timestamp-only entry.

### Notes and Markdown output

- Notes support plain text, multiple lines, multiple People/Place links, existing vault tags, and new tags.
- A non-empty single-line body is written as one indented child bullet.
- Each non-empty input line becomes an indented child bullet in its original order.
- Empty body lines do not produce empty bullets.
- User-authored Markdown other than selected mention substitutions is preserved.
- The writer does not add frontmatter, create a detail note, or create People/Place notes.

Example:

```md
## Inbox

- 2026-08-01 15:40 — Persiapan pertemuan
    - Diskusikan proposal dengan [Andi](../People/Andi.md) di [Kantor](../Place/Kantor.md) #follow-up
```

### `@` People and Place suggester

- `@` inside Notes is only a trigger; it is not retained after a suggestion is selected.
- Suggestions are gathered from the configured People and Place source folders.
- Results are visibly grouped or labelled as `People` and `Place`.
- Matching covers a note's filename and aliases from its frontmatter.
- Matching is case-insensitive and fuzzy/partial; for example, `@ndi` can match `Andi`.
- Multiple mentions can be selected in one Notes body.
- Selecting a filename result uses the filename without `.md` as link label.
- Selecting an alias uses that alias as link label and the actual note as destination.
- The stored link is ordinary Markdown using a path relative to the destination Inbox file, not a wikilink and not a vault-absolute path:

```md
[Andi](../People/Muhammad%20Andi.md)
```

- Markdown link destinations percent-encode characters that require URL encoding while preserving relative path segments.
- A typed `@value` that is not selected remains unchanged plain text.
- Duplicate display names remain separate results and show enough folder context to distinguish them.

### `#` tag suggester

- `#` inside Notes opens suggestions from tags already indexed in the vault.
- Matching is case-insensitive and fuzzy/partial.
- Selecting a suggestion inserts an ordinary Obsidian tag such as `#follow-up`.
- A tag typed without selecting a suggestion remains valid, allowing new tags to be created.
- Duplicate tags are de-duplicated in the suggestion list; selecting a suggestion does not alter other text.

### Destination

Inbox supports two destination modes:

1. `daily-note`: the resolved Daily Note for `capturedAt`.
2. `event-task-target`: the same active target file Event/Task would resolve for `capturedAt`.

Settings define the default mode. Advanced may override the mode for the current capture without changing global settings.

- The default heading is `Inbox` and is configurable globally.
- Advanced may override the heading for the current capture.
- Heading values are stored without leading `#`; when missing, the writer creates `## <heading>`.
- The configured insert position is `start` or `end` and can be overridden for the current capture.
- The Event/Task target option reuses the existing active target resolution, but replaces its heading with the Inbox heading.
- The Daily Note option resolves the core Daily Notes folder and date format when available. If it cannot resolve a usable path, submission fails with a clear message and does not silently write to another file.
- Advanced shows the resolved destination summary before saving.

### Suggestion source configuration

- Settings store lists of People and Place source folders to support one or many roots.
- Defaults are `People` and `Place` at vault root.
- Advanced can override each folder list for the current capture without mutating Settings.
- An empty override list means “use Settings”, not “search the entire vault”.
- Missing source folders produce no results for that group and do not create folders automatically.
- Folder scope includes Markdown files recursively below the configured folder.

## Assumptions

- UI copy remains English, matching the existing Event/Task form.
- Desktop and mobile use the same state, suggestion, target-resolution, and submission contracts, but keep their independent renderers.
- The user's phrase “normal Markdown link” means `[label](relative/path.md)`, not `[[wikilink]]`.
- Capture time uses the device's local timezone and is stored to minute precision in visible Markdown.
- Existing Event and Task Markdown behavior remains byte-for-byte unchanged for equivalent inputs.
- The first version does not edit an already-saved Inbox entry.

## Interface Contracts

Use an additive discriminated union so existing Event/Task consumers remain explicit:

```ts
export interface InboxRecord {
    kind: "inbox";
    capturedAt: Date;
    defaultTitle: string;
    title: string;
    body: string;
}

// Preserve the existing contract used by hub/detail-note workflows.
export type EventTaskRecord = EventRecord | TaskRecord;
export type CaptureRecord = EventTaskRecord | InboxRecord;
```

Destination and suggestion settings remain separate from the record because they control submission, not saved content:

```ts
export type InboxTargetMode = "daily-note" | "event-task-target";

export interface InboxSettings {
    defaultTargetMode: InboxTargetMode;
    heading: string;
    position: InsertPosition;
    peopleFolders: string[];
    placeFolders: string[];
}
```

Mention selection is represented structurally until the insertion is applied, preventing label/path ambiguity:

```ts
export interface MentionSuggestion {
    kind: "person" | "place";
    file: TFile;
    label: string;
    matchedBy: "filename" | "alias";
}
```

At the form boundary, validation must reject a missing destination and invalid target path before modifying a vault file. Suggestion lookup must never write to the vault.

## Official Obsidian API Baseline

- The locked development API is `obsidian` 1.12.3 from `pnpm-lock.yaml`; implementation is verified against `node_modules/obsidian/obsidian.d.ts`. The `latest` range in `package.json` is not treated as the runtime contract.
- Enumerate candidates with `Vault.getMarkdownFiles()` and scope them by vault-relative `TFile.path`.
- Read aliases through `MetadataCache.getFileCache(file)?.frontmatter` and the public `parseFrontMatterAliases()` helper.
- Gather tags with `getAllTags(cache)` across cached Markdown files so inline and frontmatter tags share Obsidian's parsing rules.
- Rank matching labels with `prepareFuzzySearch()` and impose a practical result limit; the API warns that fuzzy matching over thousands of values can be expensive.
- `AbstractInputSuggest` officially supports an `HTMLInputElement` or contenteditable `HTMLDivElement`, not a textarea. Inline token insertion therefore uses a contenteditable Notes control with explicit plain-text state synchronization and selection restoration. It must not serialize editor HTML into Markdown.
- `EditorSuggest` is for Obsidian editor instances registered by a plugin and is not the contract for this custom form.
- `MetadataCache.fileToLinktext()` generates Obsidian linktext and may choose a shortest/full vault path; it does not guarantee the ordinary relative Markdown-link format required here. Relative Markdown destinations are therefore generated by a small project-owned path formatter and covered by unit tests.
- Obsidian exposes no stable public API for reading the core Daily Notes plugin's configuration. The existing `TargetResolver` feature-tests that private integration defensively. Inbox may reuse that isolated fallback but must surface resolution failure rather than spreading internal API access to new modules.

## Project Structure

- `src/types.ts`: additive Inbox settings and defaults.
- `src/StateStore.ts`: nested default merge for new Inbox settings and folder arrays.
- `src/EventTaskFormState.ts`: Inbox kind, immutable capture timestamp, default title, body, and per-capture overrides.
- `src/InboxSuggestions.ts`: source scoping, aliases, tags, fuzzy ranking, and suggestion data contracts.
- `src/InboxMarkdown.ts`: pure relative-link and Inbox-entry formatting helpers.
- `src/EventTaskSubmission.ts`: route Inbox to its writer path without executing Event/Task note workflows.
- `src/EventTaskWriter.ts`: insert the formatted Inbox entry through the existing heading-aware insertion behavior.
- `src/EventTaskModal.ts`: desktop Inbox renderer and Advanced overrides.
- `src/EventTaskMobileScreen.ts`: mobile Inbox renderer and Advanced overrides.
- `src/SettingsTab.ts`: Inbox defaults and folder-list controls.
- `styles.css`: scoped desktop/mobile Inbox and suggestion styling.
- `test/`: pure-state, Markdown, suggestion, target, settings migration, and submission tests.

No new runtime dependency or UI framework is required.

## Code Style

Keep rendering separate from state and formatting. Exhaustively narrow record variants:

```ts
switch (record.kind) {
    case "event":
        return this.formatEventLine(record);
    case "task":
        return this.formatTaskLine(record);
    case "inbox":
        return formatInboxEntry(record, targetFilePath);
}
```

Use public Obsidian APIs, plugin-owned CSS classes, `Component` lifecycle cleanup, and Obsidian theme variables. Avoid inline visual styling and duplicated desktop/mobile business logic.

## Commands

```bash
pnpm test
pnpm run typecheck
pnpm run lint
OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run build
pnpm run verify:artifacts
git diff --check
```

## Testing Strategy

### Automated

- Form state: Inbox initializes the exact anchor timestamp/title and retains it across kind changes.
- Formatter: unchanged/blank/custom titles, one/multiple/blank body lines, Markdown preservation, and timestamp formatting.
- Relative links: same folder, parent folder, nested folder, spaces, aliases, duplicate names, and non-ASCII filenames.
- Suggestions: folder recursion, multiple configured roots, filename/alias matching, People/Place labels, missing folders, fuzzy ranking, and result limits.
- Tags: merge inline/frontmatter tags, de-duplicate, fuzzy filtering, and preserve typed new tags.
- Settings: old saved state gains complete Inbox defaults without losing prior settings; arrays do not alias mutable defaults.
- Targeting: Daily Note and active Event/Task destination modes, heading overrides, insert position, missing Daily Notes resolution, and invalid folder/file collisions.
- Submission: Inbox never creates hub/detail notes and reports success only after the primary write completes.
- Regression: all existing Event/Task state, submission, writer, and mobile tests continue to pass.

### Manual desktop and mobile acceptance

- Capture with untouched, edited, and blank Title.
- Enter multiline Notes and create multiple `@` links from filenames and aliases.
- Verify People/Place grouping and duplicate-name disambiguation.
- Select an existing `#` tag and type a new tag without selecting a suggestion.
- Move the cursor into the middle of Notes and confirm selection replaces only the active trigger token.
- Exercise keyboard navigation, touch selection, dismissal, and reopening of both suggesters.
- Override destination, heading, position, People folders, and Place folders in Advanced; confirm Settings remain unchanged.
- Save once to Daily Note and once to Event/Task target, then inspect exact Markdown and click every generated link.
- Test Android/iOS software keyboard behavior on the independent mobile screen.
- Confirm no runtime errors in Obsidian's developer console.

Automated checks do not count as real-device acceptance.

## Boundaries

### Always

- Preserve immutable capture time even when Title changes.
- Produce portable ordinary Markdown links relative to the actual destination file.
- Escape generated link labels/destinations without rewriting unrelated user Markdown.
- Keep per-capture Advanced overrides ephemeral.
- Use additive settings with backward-compatible defaults.
- Keep Event and Task output unchanged.

### Ask first

- Changing the Markdown entry shape or timestamp format.
- Replacing ordinary Markdown links with wikilinks.
- Searching the entire vault when source folders are empty.
- Creating missing People/Place notes or folders.
- Adding frontmatter or structured metadata to Inbox entries.
- Adding a dependency or accessing additional undocumented Obsidian internals.

### Never

- Convert unselected `@text` into a link.
- Prevent users from typing a new `#tag`.
- Infer People versus Place solely from a display name.
- Silently fall back to an unintended destination when Daily Note resolution fails.
- Serialize contenteditable HTML into the user's Markdown.
- Call build/typecheck proof of desktop or mobile UX acceptance.

## Success Criteria

- Desktop and mobile show chips in the order `Inbox`, `Event`, `Task` and expose only Title, Notes, Save, and collapsed Advanced in the primary Inbox flow.
- Title defaults to `YYYY-MM-DD HH:mm`; saved Markdown contains exactly one immutable capture timestamp.
- Each selected `@` result becomes the correct relative ordinary Markdown link using the selected filename or alias label.
- Unselected `@text`, ordinary Markdown, existing tags, and newly typed tags remain intact.
- `#` suggestions include de-duplicated tags from inline content and frontmatter.
- Daily Note and Event/Task target modes both write under the configured heading and honor per-capture overrides.
- Existing settings load safely with Inbox defaults, and override edits do not mutate global settings.
- Event and Task behavior and Markdown output do not regress.
- All automated commands pass and real desktop/mobile acceptance is recorded separately.

## Not Doing in the MVP

- Creating or editing People/Place notes from the suggester.
- Dedicated People or Place fields outside the Notes body.
- Inbox reminders, deadlines, scheduling, related notes, or detail notes.
- Structured People/Place metadata separate from the Markdown body.
- Editing or re-parsing already-saved Inbox entries.
- Contact, map, calendar, or other external integrations.

## Official References

- [Obsidian TypeScript API declarations](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts) — public contracts for `AbstractInputSuggest`, `EditorSuggest`, `MetadataCache`, `Vault.getMarkdownFiles`, `getAllTags`, `parseFrontMatterAliases`, and `prepareFuzzySearch`.
- [Obsidian HTML elements](https://docs.obsidian.md/Plugins/User%20interface/HTML%20elements) — custom UI built with Obsidian element helpers and plugin-owned classes.
- [Obsidian events](https://docs.obsidian.md/Plugins/Events) — lifecycle-aware event registration and cleanup.
- [Obsidian styling guidance](https://docs.obsidian.md/Reference/CSS%20variables/About%20styling) — theme-compatible custom interface styling.

## Open Questions

None. Any change to the agreed contract above returns the work to specification review before implementation.
