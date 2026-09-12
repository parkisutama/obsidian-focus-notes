# Spec: Object Source required-property schema

## Status

- Approved 2026-09-12 following [ADR-002](../../reference/decisions/002-object-source-required-property-schema.md).
- Tasks 1–7 (all planned tasks except final closeout) are implemented and covered by automated tests;
  `pnpm run check` is green (643 tests: format, lint, `verify:version`, typecheck, full suite). See
  [the implementation plan](../tasks/object-source-required-properties-plan.md) and
  [checklist](../tasks/object-source-required-properties-todo.md) for per-task traceability and two
  documented limitations found during implementation (identity-property matching can't self-heal a note
  missing exactly that property; Templater's undocumented API shape is unverified without a real vault).
- Task 8 (documentation/changelog closeout) is done. Real desktop acceptance — using the new settings UI
  and Templater integration in a live Obsidian vault — is outside what an automated gate can certify; the
  user confirmed it behaves as expected (2026-09-12), closing Checkpoint C. This spec/plan/todo trio moves
  to `docs/archive/{specs,tasks}/` as part of merging this branch to `main`.

## Objective

Every Object Source (Places, Projects, Books, Activities, ...) can declare a schema of required
frontmatter properties, each with a default value. A note that matches an enabled source — by folder,
by property, or both — always carries every property its schema declares. Missing properties are filled
automatically: at creation, on a manual bulk "Repair Object Notes" pass, and as a matching note is opened
or saved. Today's single identity property (`filter.property`/`filter.value`, e.g. `type: place`) becomes
one entry in that schema rather than a separate concept.

Success means: (1) creating a new Object Note stamps every schema property, not just the identity one;
(2) running "Repair Object Notes" brings the whole vault's matching notes into schema compliance in one
reviewable pass; (3) opening or saving an already-matching note that drifted out of schema (e.g. a
property was deleted by hand) silently restores it; (4) none of this requires Templater to be installed,
but can use it when present.

## Out of scope

- The internal Flat Block Grammar fields used by Moment/Event/Task/Reflection (`docs/current-state.md` §
  Model data canonical). Those live in the Markdown body, not Obsidian frontmatter, and are untouched.
- Strict validation that blocks saving a note missing a required property. This feature only auto-fills;
  it never refuses a save or shows a blocking dialog.
- Per-property type/shape validation (e.g. "must be a number", "must be one of these values"). A required
  property is just a key that must exist with some resolved value.
- Detecting or resolving conflicts when two enabled sources both match the same note with different
  schemas for the same property key (existing shared-folder conflict UI already warns about overlapping
  sources; this spec does not add new conflict resolution beyond what that warning already covers).

## Domain model

```ts
// src/features/object-notes/domain/ContextSourceSettings.ts
export interface RequiredPropertySchema {
    /** Frontmatter key, e.g. "type", "region". Unique within one source's list. */
    property: string;
    /**
     * Non-null for at most one entry per source. That entry is the source's identity
     * constraint: matching uses it exactly like today's `filter`, and creation/repair
     * always stamp this exact value (defaultValue is ignored for this entry).
     */
    identityValue: string | null;
    /**
     * Value used to fill `property` when missing, for entries where identityValue is null.
     * May contain the existing static tokens ({{title}}, {{date}}, {{time}}) and/or one
     * Templater expression (<% ... %>).
     */
    defaultValue: string;
}

export interface ContextSourceSettings {
    id: string;
    name: string;
    icon: string;
    folders: string[];
    requiredProperties: RequiredPropertySchema[]; // replaces `filter: ContextSourceFilter | null`
    matchByFolder: boolean;
    /** Whether the schema's identity entry (if any) is required for a note to match this source. */
    matchByProperty: boolean;
    relatedHeading: string;
    relatedPosition: InsertPosition;
    templatePath: string;
    placement: ObjectNotePlacement;
    enabled: boolean;
    includeInTimeline: boolean;
}
```

`ContextSourceFilter.ts` (the existing `{ property, value }` matching pair) is kept unchanged — `Timeline.ts`/
`TimelineSourceGroup` still use it for matching and need no change at all. It is simply no longer stored
directly on `ContextSourceSettings`. Anywhere that read `source.filter` derives it instead:

```ts
export function identityEntry(source: Pick<ContextSourceSettings, "requiredProperties">): ContextSourceFilter | null {
    const entry = source.requiredProperties.find((candidate) => candidate.identityValue !== null);
    return entry ? { property: entry.property, value: entry.identityValue as string } : null;
}
```

`matchesContextFilter` keeps its existing signature and behavior unchanged, taking the `ContextSourceFilter | null`
derived by `identityEntry(source)` wherever it used to take `source.filter` directly.

## Default value resolution

One pure-ish function (Obsidian-free except for the optional Templater call, so it lives in
`infrastructure/obsidian/`, not `domain/`) resolves a schema entry's value for a given note context:

```ts
async function resolveRequiredPropertyValue(
    app: App,
    entry: RequiredPropertySchema,
    context: { title: string; createdAt: Date },
): Promise<string> {
    if (entry.identityValue !== null) return entry.identityValue;
    const expanded = expandObjectNoteTemplate(entry.defaultValue, context.title, context.createdAt);
    const templater = getTemplaterApi(app); // null if not installed/enabled
    if (templater && /<%[\s\S]*?%>/.test(expanded)) {
        try {
            return await templater.parseTemplate(expanded, context);
        } catch (error) {
            console.warn("[Focus Notes] Templater expression failed, using raw default", entry.property, error);
            return expanded;
        }
    }
    return expanded;
}
```

`getTemplaterApi(app)` reads `app.plugins.plugins["templater-obsidian"]` defensively (optional chaining,
returns `null` if absent/disabled/API shape unexpected) and lives in
`src/infrastructure/obsidian/templater/TemplaterApi.ts`. No `eval`/`new Function` is used directly by
this plugin; Templater does its own expansion internally through its published API surface.

## Missing-property computation

A single function decides what a note needs, independent of *when* it's called:

```ts
function computeRequiredPropertyGaps(
    source: ContextSourceSettings,
    currentProperties: Record<string, unknown> | undefined,
): RequiredPropertySchema[] {
    return source.requiredProperties.filter((entry) => currentProperties?.[entry.property] === undefined);
}
```

All three enforcement points call this, then resolve and write only the gaps:

1. **Creation** (`createObjectNote`, `ObjectNote.ts`): after the note is created (properties = `{}`),
   every schema entry is a gap; each is resolved and written via one `processFrontMatter` call.
2. **Manual repair** ("Repair Object Notes" command): iterates `app.vault.getMarkdownFiles()`, resolves
   each file's frontmatter via `app.metadataCache.getFileCache(file)?.frontmatter`, finds which enabled
   sources match (`contextSourceMatchesNote`), computes gaps per matched source, and writes them. Reports
   a `Notice` summary: files repaired, properties added, sources involved. Registered as
   `repair-object-note-properties` following the existing `repair-orphan-projection-references` command
   pattern (`FocusNotesPlugin.ts`).
3. **Auto-repair on open/save**: a new watcher, structurally parallel to `TaskReferenceCheckboxWatcher`,
   listens to `workspace.on("file-open")` and `vault.on("modify")`. For a matching file, it computes gaps
   from the metadata cache and writes them through `processFrontMatter`, wrapped in the same
   `WriteSuppressionTracker` pattern so its own write does not re-trigger itself as a `modify` event. This
   watcher only ever adds missing properties; it never edits or removes an existing property value.

## Compatibility with Obsidian Linter

The community Linter plugin also rewrites frontmatter (key order, quote style, array style) and body
formatting, either on manual lint or on save, independently of this feature. To avoid the two systems
fighting each other or racing:

- Every write this feature makes — creation stamping, manual repair, auto-repair — goes exclusively
  through `app.fileManager.processFrontMatter`'s mutate callback, and only ever **adds a key that is
  currently absent** (per `computeRequiredPropertyGaps`). It never reorders, reformats, re-quotes, or
  overwrites the value of a key that already exists, and it never touches note body content. This makes
  the feature's output agnostic to whatever key order or YAML style Linter (or the user) already
  established — there is nothing for Linter to "disagree" with beyond the one new key/value pair.
- Because both plugins can react to the same `vault.modify` event, ordering between "Linter reformats" and
  "this feature adds a missing key" is not guaranteed. This is safe by construction as long as the rule
  above holds: repeated passes from either plugin converge, since each only fixes what's actually missing
  or wrong from its own perspective, and neither undoes the other's change.
- Auto-repair's `WriteSuppressionTracker` usage only suppresses re-entry from *this plugin's own* writes
  (matching `TaskReferenceCheckboxWatcher`'s existing pattern); it does not attempt to suppress or wait for
  Linter's separate writes, which remain outside this feature's control.
- A test fixture uses a realistic Linter-formatted frontmatter block (sorted keys, single-quoted strings,
  empty-array style `tags: []`) as input and asserts that gap-filling adds only the missing key(s) without
  touching existing formatting.

## Settings UI

`ObjectSourceSettings.ts`'s single Property/Value row is replaced with a "Required properties" list per
source, each row offering:

- **Property** — text field with autocomplete drawn from the vault's existing frontmatter property names
  (`app.metadataCache.getAllPropertyInfos()` or the closest available Obsidian API), so users pick names
  already in use instead of retyping them.
- **Identity value** — optional text field; when set, this row becomes the source's (single) identity
  entry, used for matching, and any previously-marked identity row is cleared (radio-like — at most one
  identity entry per source, enforced in the UI, not just documented).
- **Default value** — text field, disabled when Identity value is set (identity entries always use their
  identity value verbatim); help text documents the supported tokens and Templater syntax.
- Add/remove row buttons, mirroring the existing folder-list add/remove UI in `renderContextSourceFolders`.

The `matchByProperty` toggle keeps its current meaning: whether the identity entry (if any) is required
for a note to match this source at all. If `matchByProperty` is on but no entry is marked as identity, it
behaves like today's `filter: null` case (property matching contributes nothing).

## Migration

`SettingsDefaults.ts`'s `mergeSettingsWithDefaults` migration:

```ts
requiredProperties: raw.filter
    ? [{ property: raw.filter.property, identityValue: raw.filter.value, defaultValue: raw.filter.value }]
    : (raw.requiredProperties ?? []),
```

- A source with an existing `filter` gets exactly that identity entry, nothing else — no new required
  properties appear out of nowhere for existing users.
- A source with `filter: null` and no prior `requiredProperties` starts with an empty list.
- The three built-in default sources (People, Places, Activities defined in `SettingsDefaults.ts`) keep
  their current single identity property as their only schema entry; this spec does not add new default
  required properties to them.

## Acceptance criteria

- [ ] `RequiredPropertySchema`/`requiredProperties` replace the `filter` field on `ContextSourceSettings`
      across `ObjectNote.ts`, `ContextSourceScope.ts`, `ContextLinkResolver.ts`, `InboxSuggestions.ts`,
      `TimelineSourceGroups.ts`, `ObjectSourceSettings.ts`, `SettingsDefaults.ts`; `ContextSourceFilter.ts`
      itself is unchanged and `Timeline.ts` needs no edits.
- [ ] Existing matching behavior (`contextSourceMatchesNote`, `matchesContextFilter`,
      `matchByFolder`/`matchByProperty` combinations) is unchanged for sources migrated from a single
      `filter`, proven by fixtures reusing today's `object-note.test.ts` scenarios.
- [ ] Creating an Object Note stamps every schema property, not just the identity one; identity value is
      always exact, non-identity values resolve tokens and, when present, Templater syntax.
- [ ] "Repair Object Notes" command fills gaps vault-wide for all enabled sources' matching notes in one
      pass, changes nothing for notes that already satisfy their schema, and reports a summary `Notice`.
- [ ] Opening or saving a note that matches an enabled source but is missing a required property gets it
      filled automatically, without an infinite `modify` loop and without altering unrelated frontmatter
      or body content.
- [ ] A vault without the Templater plugin installed behaves identically to today for any source whose
      defaults don't use `<% %>` syntax; a default using `<% %>` without Templater installed writes the
      raw string and logs a `console.warn`, without throwing or blocking the note operation.
- [ ] Settings UI lets a user add/remove/edit required-property rows, mark exactly one as identity, and
      get property-name autocomplete from existing vault frontmatter properties.
- [ ] Every write (creation, manual repair, auto-repair) only adds currently-absent keys via
      `processFrontMatter`; a Linter-formatted frontmatter fixture (sorted keys, single-quoted strings,
      empty-array style) keeps its existing formatting untouched aside from the added key(s).
- [ ] Existing persisted settings migrate losslessly: no existing source loses its identity property, and
      no source gains unrequested required properties as a side effect of migration.
- [ ] `pnpm run check` (and `pnpm run check:ci` before merge) stays green; `test/architecture-boundaries.test.ts`
      stays green (default-value resolution and Templater probing stay out of `domain/`).

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Auto-repair watcher re-triggers itself via its own `processFrontMatter` write | High | Reuse the existing `WriteSuppressionTracker` pattern from `TaskReferenceCheckboxWatcher` |
| Bulk "Repair Object Notes" silently rewrites many files with no visibility | Medium | Summary `Notice` after the pass; this spec does not add a preview/dry-run step — flagged here for explicit sign-off, not assumed |
| Templater API shape changes or plugin absent | Medium | Defensive optional access in one isolated module (`TemplaterApi.ts`); failure degrades to raw string, never throws |
| Migration loses or duplicates an existing identity property | High | Pure migration function with fixture coverage for filter-present, filter-null, and already-migrated `requiredProperties` states |
| Two enabled sources both require the same property with conflicting defaults on an overlapping folder | Low (documented, not solved) | Existing shared-folder conflict warning in `ObjectSourceSettings.ts` remains the mitigation; no new conflict UI is added by this spec |
| Obsidian Linter also reformats frontmatter/body on save, racing with this feature's writes | Medium | Writes are additive-only (never reorder/reformat/overwrite existing keys or touch body content), so repeated passes from either plugin converge regardless of ordering |
| A source with `matchByProperty: true` can't be repaired for the one note missing exactly its identity property, since `contextSourceMatchesNote` won't recognize the note as belonging to that source until the property is already correct | Medium (discovered in Task 5) | Documented limitation, not solved: changing shared matching semantics would affect Timeline/Inbox-suggestion/ContextLinkResolver matching, where requiring an already-correct property is intended disambiguation for sources sharing a folder. Sources matched purely by folder (or with `matchByProperty` off) are unaffected. |

## Deferred directions

- Preview/dry-run mode for "Repair Object Notes" before writing.
- Property value type/shape validation beyond "exists with a resolved value".
- Automatic schema discovery from existing vault property usage.
