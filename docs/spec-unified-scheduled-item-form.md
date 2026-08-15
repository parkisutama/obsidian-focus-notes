# Unified Scheduled Item Form Specification

## Objective

Provide one semantic form contract for creating and editing Task and Event records, rendered by one desktop view and one
mobile view. The form supports descriptions, portable Object References, and Task/Event detail-note promotion without
reintroducing separate create/edit field models.

## Approved semantics

- An unresolved Object Reference remains portable text: `@Rachel`.
- A resolved Object Reference stores a vault-root path and is not a Markdown link: `@{People/Rachel.md}`.
- Object Notes own contextual aggregation and related logs.
- The former Related Note/hub controls are retired from new Create/Edit UI. Existing linked titles and historical hub
  records remain readable and losslessly preserved.
- A Detail Note is distinct from an Object Note. It promotes one Task or Event to its own page and is attached as an
  indented `detail:` record.
- Create and Edit share the same `ScheduledItemFormData`; persistence context determines whether the record is inserted or
  conflict-safely replaced.
- Desktop and mobile have separate renderers, but neither renderer duplicates Create/Edit form implementations.

## Canonical data contract

```ts
interface ScheduledItemFormData {
    kind: "task" | "event";
    title: string;
    description: string;
    objectReferences: ObjectReference[];
    detailNote: DetailNoteSelection;
    task: TaskFormFields;
    event: EventFormFields;
}

interface ObjectReference {
    label: string;
    vaultPath: string | null;
}
```

Create/Edit differences live outside the form data:

```ts
type FormPersistenceContext =
    | { mode: "create"; targetFile: string; heading: string; position: "start" | "end" }
    | { mode: "edit"; snapshot: LedgerRecordSnapshot };
```

## Markdown block ownership

The first line owns Task/Event scheduling and lifecycle metadata. Immediate indented ordinary bullets are description
lines. A `detail:` child is reserved for the promoted detail page. Nested checklists and unrecognized indented content are
not form-owned and must remain byte-for-byte unchanged.

Example:

```md
- [ ] Prepare invoice | priority:high | due:2026-08-20
    - Coordinate with @{People/Rachel.md}
    - detail: [Prepare invoice](Tasks/Prepare%20invoice.md)
    - [ ] Preserve this nested subtask
```

## Object Reference behavior

- Suggestions resolve an existing Object Note to a normalized vault-root `.md` path.
- Plain `@Name` remains unresolved and does not create a note or related log automatically.
- Users may keep text unresolved, resolve it to an existing Object Note, or explicitly create an Object Note later.
- Edit writes related logs only for newly added resolved destinations. Repeated saves are idempotent; removing a reference
  does not delete append-only history.
- Vault rename handling updates resolved reference paths in a separately tested migration slice; it must not be hidden in a
  form save.

## Detail Note behavior

- Both Create and Edit offer `None`, `Link existing`, and `Create new` modes.
- Create new uses the same Task/Event detail frontmatter and configured template on both persistence paths.
- Existing files are never overwritten.
- Creating a detail file and attaching its nested link is a multi-file operation. Partial success retains the created note
  and exposes a retryable attach operation rather than deleting user data.

## Views

`DesktopScheduledItemForm` renders Create/Edit for Task/Event on desktop. `MobileScheduledItemForm` renders the same data
contract as a workspace-anchored mobile screen. Mode changes labels, source/target presentation, and persistence behavior;
it does not select a different field implementation.

## Commands and verification

- Focused tests: `node --test test/<focused-test>.test.ts`
- Typecheck: `pnpm run typecheck`
- Full local gate: `OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run check:ci`
- Markdown whitespace: `git diff --check`

## Boundaries

### Always

- Preserve unknown metadata, nested subtasks, legacy linked titles, line endings, and exact source provenance.
- Refuse stale, moved, deleted, duplicated, or ambiguous edit sources.
- Keep primary write, detail-note partial recovery, and related-log recovery outcomes explicit.

### Ask first

- Changing the approved `@{vault/path.md}` syntax.
- Automatically creating Object Notes from unresolved mentions.
- Deleting or overwriting an existing detail note.

### Never

- Re-run the primary Create/Edit write while retrying a related-log or detail-link failure.
- Convert legacy linked titles or unknown child content silently.
- Treat automated tests as desktop/mobile runtime acceptance.

## Success criteria

- Create and Edit round-trip through one shared data contract for Task and Event.
- Desktop has one shared Create/Edit renderer; mobile has one shared Create/Edit renderer.
- Description and Object Reference behavior is equivalent in Create and Edit.
- Detail Notes can be linked or created from Create and Edit with explicit partial recovery.
- Legacy Markdown remains readable and losslessly preserved.
- Full local automated gate passes; desktop/mobile runtime acceptance remains separately recorded.
