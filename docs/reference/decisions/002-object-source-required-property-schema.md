# ADR-002: Object Source required-property schema

## Status

Accepted and implemented on `feature/object-source-required-properties`. All 8 planned tasks landed with
`pnpm run check:ci` green; real-desktop acceptance in an actual Obsidian vault confirmed by the user
(2026-09-12) before merge to `main`. See
[the spec](../../spec-object-source-required-properties.md) and
[implementation plan](../../tasks/object-source-required-properties-plan.md) for traceability.

## Date

2026-09-12

## Context

Object Sources (`ContextSourceSettings`, `src/features/object-notes/domain/ContextSourceSettings.ts`) let a
user register a vault folder and/or a single frontmatter property as an "object type" (Places, Projects,
Books, Activities, ...). Today each source carries exactly one `filter: { property, value } | null`
(`ContextSourceFilter.ts`), which does double duty:

- It is the identity constraint used to classify a note into a source (`matchesContextFilter` /
  `contextSourceMatchesNote` in `ContextSourceScope.ts`), consumed by `ContextLinkResolver.ts`,
  `InboxSuggestions.ts`, `Timeline.ts`, and `TimelineSourceGroups.ts`.
- It is the only frontmatter Obsidian property stamped when a new Object Note is created
  (`createObjectNote` in `ObjectNote.ts:69-73`), via `app.fileManager.processFrontMatter`.

Beyond that one property, nothing is required or enforced: a new Object Note can be created with no other
metadata, and a pre-existing note that already qualifies for a source by folder or property is never
checked or repaired. There is no way to declare "every Place must also have `region` and `visited`" and
have the plugin keep that true.

The user wants each Object Source to declare a small schema of required frontmatter properties — the
existing identity property plus any number of additional ones — each with a default value, enforced both
for newly created notes and for the existing vault (manual bulk repair, plus automatic repair as notes are
opened or saved).

This changes the shape of frontmatter the plugin writes into vault notes and the shape of persisted plugin
settings, which is the "behavior user-facing yang mengubah format Markdown di vault" trigger in
`AGENTS.md` § Workflow order — hence this ADR precedes implementation.

## Decision

Replace `ContextSourceSettings.filter: ContextSourceFilter | null` with
`ContextSourceSettings.requiredProperties: RequiredPropertySchema[]`:

```ts
interface RequiredPropertySchema {
    /** Frontmatter key, e.g. "type", "region". */
    property: string;
    /**
     * Non-null for at most one entry per source: the identity value used for matching
     * (`matchesContextFilter`) and stamped verbatim on creation, exactly like today's `filter.value`.
     */
    identityValue: string | null;
    /** Value used to fill this property when it is missing. Ignored for the identity entry, which always uses identityValue. */
    defaultValue: string;
}
```

- At most one `requiredProperties` entry may have a non-null `identityValue`. Matching helpers
  (`matchesContextFilter`, `contextSourceMatchesNote`) derive their existing single-filter argument from
  that entry, so `matchByProperty` semantics and every current consumer of matching behavior are
  unchanged.
- `defaultValue` supports the existing static tokens already used by `expandObjectNoteTemplate`
  (`{{title}}`, `{{date}}`, `{{time}}`) plus Templater expressions (`<% ... %>`), resolved through the
  Templater plugin's public API (`app.plugins.plugins["templater-obsidian"]`) when it is installed and
  enabled. Templater is a soft, optional dependency: it is never added to `package.json`, is probed
  defensively at runtime, and its absence must not change behavior for sources that don't use `<% %>`
  syntax. If a default uses Templater syntax and Templater isn't available, the raw string is written
  as-is and `console.warn("[Focus Notes] ...")` records the fallback — no throw, no blocking `Notice`.
- One pure function computes "which required properties are missing on this note, and what resolved
  value should fill each" so every enforcement point shares identical logic. It is called from:
  1. Object Note creation (`createObjectNote`), extending today's single-property stamp to the full
     schema.
  2. A new "Repair Object Notes" command (mirrors the existing `repair-orphan-projection-references`
     command pattern in `FocusNotesPlugin.ts`) that scans the vault once for notes matching any enabled
     source, fills gaps, and reports a summary `Notice`.
  3. Automatic repair when a matching note is opened or saved, reusing the existing
     `WriteSuppressionTracker` (already used by `TaskReferenceCheckboxWatcher`) so the plugin's own
     `processFrontMatter` write never re-triggers itself as a false-positive edit.
- `ObjectSourceSettings.ts` replaces the single Property/Value row with an editable list of required
  properties. The property-name field gets autocomplete sourced from the vault's existing frontmatter
  property names (Obsidian's metadata cache) so users reuse existing property names instead of retyping
  them by hand.
- Persisted settings migrate losslessly: a source's current `filter` becomes its one identity entry in
  `requiredProperties`; sources without a `filter` start with an empty list. `SettingsDefaults.ts` gains a
  migration test fixture for this.

## Alternatives considered

### Keep `filter` untouched, add a separate `requiredProperties` list alongside it

- Advantage: smaller diff, no migration.
- Rejected: two independent places to declare "the" identity property invites drift and doubles the
  matching-logic surface. The user explicitly asked for the identity filter to become part of one unified
  schema.

### Hard dependency on the Templater plugin, or reimplementing its expression engine internally

- Advantage: default-value resolution would not depend on runtime plugin detection.
- Rejected: Obsidian plugins cannot declare a hard runtime dependency on another community plugin, and
  reimplementing Templater's expression evaluation would require `eval`/`new Function`, which
  `AGENTS.md` § Obsidian plugin constraints forbids outright.

### Auto-repair only, no manual command

- Advantage: fewer moving parts.
- Rejected: silently rewriting every matching note in the vault the moment this feature ships, with no
  reviewable step, is a surprising first-run mutation. A manual "Repair Object Notes" command gives an
  explicit, reviewable bulk pass; automatic per-note repair then keeps the vault from drifting again
  afterward.

## Consequences

- `ContextSourceFilter.ts` (the `{ property, value }` matching pair) is kept as-is — `Timeline.ts` and
  `TimelineSourceGroup` still use it for matching, unchanged — but it is no longer stored directly on
  `ContextSourceSettings`. A new `identityEntry(source)` helper in `ContextSourceScope.ts` derives it from
  `requiredProperties` on demand. `ObjectNote.ts`, `ContextSourceScope.ts`, `ContextLinkResolver.ts`,
  `InboxSuggestions.ts`, `TimelineSourceGroups.ts`, `ObjectSourceSettings.ts`, and `SettingsDefaults.ts` all
  need coordinated updates plus settings-migration test coverage; `Timeline.ts` itself needs no change.
- Frontmatter written to vault notes changes shape (more properties, sourced from user-configured
  schema); this is the intended, user-facing effect of the feature.
- A new optional-dependency surface (Templater) must be probed defensively; behavior for vaults without
  Templater must stay identical to today for any source that doesn't use `<% %>` in a default value.
- `docs/current-state.md` and `docs/reference/code-architecture-baseline.md` need updates once
  implemented, per `AGENTS.md` § Workflow order step 7.
