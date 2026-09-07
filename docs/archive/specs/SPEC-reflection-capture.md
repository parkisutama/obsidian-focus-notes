# Spec: Reflection Capture

Module id: `reflection-capture`

## Objective

Allow optional wellbeing metadata and optional free-text reflection notes on Moment, Event, Task, and Focus Session without
mixing them with description text. Reflection is editable after capture and remains easy to extract into a table.

## Commands and project structure

- Domain: `src/features/reflection/domain/`
- Shared Reflection UI: `src/features/reflection/ui/`
- Capture adapters: `src/features/capture/**`
- Tests: `test/*reflection*`, focused capture/block tests
- Verify: `pnpm run format:check`; `pnpm run lint`; `pnpm run typecheck`; `pnpm test`

## Data contract

```ts
interface ReflectionData {
    stressLevel: StressLevel | null;
    emotionCategory: EmotionCategory | null;
    emotionKey: string | null;
    notes: string | null;
}
```

- `reflection:` stores wellbeing fields only.
- `reflection-notes:` stores free text only.
- Both lines are optional and independently optional.
- Both are siblings owned by the same Moment/Event/Task/Focus Session.
- A Focus Session's Reflection lines are indented one level below its `focus-session:` line.
- Owner-level Reflection lines use the same direct-child indentation as description, timeboxes, sessions, and detail.
- Blank values remove their corresponding line; they never produce empty placeholder lines.
- Each owner has at most one of each line; duplicates are explicit invalid block states.

## UI behavior

- Moment, Event, and Task create/edit forms expose optional wellbeing and reflection-notes fields.
- Focus stop logging and Edit Focus Session expose the same fields.
- Description and reflection-notes use distinct form state and rich-text controllers.
- Reflection-notes newlines normalize to spaces on persistence.
- Existing mood/stress reference data and `EmotionalWellbeingPicker` remain the canonical UI vocabulary.

## Code style

```ts
const reflection: ReflectionData = {
    stressLevel: parsedReflection?.stressLevel ?? null,
    emotionCategory: parsedReflection?.emotionCategory ?? null,
    emotionKey: parsedReflection?.emotionKey ?? null,
    notes: parsedNotes ?? null,
};
```

## Testing strategy

- Parse/format tests for wellbeing-only, notes-only, both, and neither.
- Whole-owner tests for Moment/Event/Task/Focus Session placement.
- Duplicate-line rejection and clearing tests.
- Form hydration/submission tests proving description and reflection do not cross-contaminate.
- Desktop/mobile presentation contract tests using the same semantic data.

## Boundaries

- Always: retain `stress`, `emotion`, and `mood` keys; keep notes optional; normalize stored notes to one physical line.
- Ask first: allow multiple historical Reflection records per owner or add a Reflection identity.
- Never: write reflection fields on Event/Task/Focus Session primary lines; reuse description as reflection notes.

## Success criteria

- Every supported owner round-trips all four Reflection states: none, wellbeing-only, notes-only, and both.
- Reflection appears in the correct form and reloads without entering Description.
- Clearing one Reflection component does not remove the other.
- Tabular extraction can use `(owner_type, owner_id)` as the Reflection key.

## Open questions

None. Sibling `reflection:` and `reflection-notes:` lines were approved on 2026-09-01.
