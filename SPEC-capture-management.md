# Spec: Capture and Management Integration

Module id: `capture-management`

## Objective

Make Moment, Event, and Task create/edit/manage flows operate on the approved flat grammar, present Reflection consistently,
and show planned Timeboxes separately from actual Focus Sessions on desktop and mobile.

## Commands and project structure

- Shared domain/form contracts: `src/features/capture/**/domain/`
- Application services: `src/features/capture/**/application/`
- Desktop UI: `src/features/capture/**/ui/desktop/`
- Mobile UI: `src/features/capture/**/ui/mobile/`
- Obsidian persistence: `src/infrastructure/obsidian/capture/`
- Verify: focused form/persistence tests; `pnpm run check`; manual desktop/mobile acceptance

## Form and manager behavior

- Moment gains stable identity and an edit/manage path using its canonical block.
- Moment/Event/Task forms expose Description, Emotional Wellbeing, and Reflection Notes as distinct state.
- Event/Task Manage shows a `Focus Sessions` section for actual history.
- Task Manage shows a separate `Timeboxes` section for planned history.
- Timebox and Focus Session lists are siblings in presentation and persistence.
- Editing a Focus Session changes only its Reflection fields and never its actual start/end/duration/mode.
- Detail remains an optional independent child and renders last.
- Create and Edit writers enforce canonical child ordering.
- Focus Panel logging modifies the selected canonical owner; UI does not manufacture a replacement owner.

## Explicit formatter behavior

- Manage's formatter provides preview and apply actions.
- It converts current development syntax to the new keyed syntax and direct Task session ownership.
- It preserves `moment-*`, `event-*`, `task-*`, `timebox-*`, and `focus-*` IDs.
- It is idempotent and conflict-safe.
- It does not run automatically and does not promise long-term compatibility with unreleased formats.

## Testing strategy

- Shared form-data and adapter tests for all supported owners.
- Desktop/mobile structure tests for equivalent fields and separate section ownership.
- Persistence conflict/no-op tests.
- Moment identity and manage-route tests.
- Formatter preview/apply/idempotency tests.
- Manual acceptance for create, edit, clear, retry, and mobile keyboard behavior.

## Boundaries

- Always: route writes through canonical block persistence; keep UI-specific DOM separate; preserve unknown children.
- Ask first: add another capture category or destructive bulk formatting behavior.
- Never: edit a Daily/weekly reference as canonical data; share desktop DOM with mobile; silently format the vault.

## Success criteria

- Moment/Event/Task create and edit produce the approved grammar and order.
- Desktop and mobile hydrate and save equivalent semantic data.
- Timebox and Focus Session management are visibly separate.
- Focus Session append/edit and owner Reflection edits do not overwrite one another.
- Formatter converts selected development records safely and converges after one application.

## Open questions

None. Explicit formatting and no background migration were approved on 2026-09-01.
