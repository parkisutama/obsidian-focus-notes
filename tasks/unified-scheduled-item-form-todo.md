# Unified Scheduled Item Form Tasks

## Task 1: Portable Object Reference grammar

**Acceptance criteria:**

- [x] Parse unresolved `@Name` and resolved `@{vault/path.md}` references without treating them as Markdown links.
- [x] Normalize resolved paths as vault-root `.md` paths and preserve ordinary text losslessly.
- [x] Serializer round-trips spaces, nested folders, multiple references, and invalid syntax safely.

**Verification:** `node --test test/object-reference.test.ts`; `pnpm run typecheck`.

**Dependencies:** None. **Estimated scope:** Small, 2 files.

## Task 2: Shared Scheduled Item form contract

**Acceptance criteria:**

- [x] One typed contract represents Task/Event title, description, Object References, detail selection, and kind fields.
- [x] Create/Edit persistence context is separate from semantic form data.
- [x] Existing create state and line-edit state have lossless adapters with focused tests.

**Verification:** `node --test test/scheduled-item-form-data.test.ts`; `pnpm run typecheck`.

**Dependencies:** Task 1. **Estimated scope:** Medium, 3 files.

## Task 3: Lossless scheduled-item block editor

**Acceptance criteria:**

- [x] Parse descriptions and reserved detail links while preserving nested checklists and unknown children.
- [x] Replace owned fields without changing preserved content or LF/CRLF.
- [x] Reject stale, missing, duplicated, moved, or ambiguous blocks.

**Verification:** `node --test test/scheduled-item-block-editor.test.ts`; full local gate.

**Dependencies:** Tasks 1-2. **Estimated scope:** Medium, 4 files.

## Task 4: Create/Edit form adapters and validation

**Acceptance criteria:**

- [x] Create and Edit hydrate and validate the same form data.
- [x] Task/Event output remains compatible with existing canonical Markdown.
- [x] Mode-specific target/snapshot data never leaks into semantic fields.

**Verification:** focused adapter tests; `pnpm run typecheck`.

**Dependencies:** Tasks 2-3. **Estimated scope:** Medium, 4 files.

## Task 5: Description and Object Reference edit workflow

**Acceptance criteria:**

- [x] Create/Edit both use contextual `@` suggestions and the approved portable path syntax.
- [x] Edit writes related logs only for newly resolved Object paths.
- [x] Related-log partial recovery cannot repeat the primary write.

**Verification:** focused controller/submission tests; full local gate.

**Dependencies:** Tasks 1, 3-4. **Estimated scope:** Medium, 5 files.

## Task 6: Detail Note promotion

**Acceptance criteria:**

- [x] Create/Edit support None, Link existing, and Create new.
- [x] Created notes use the same Task/Event frontmatter and template contract.
- [x] Partial creation/attach outcomes are idempotent and retryable without deletion or duplication.

**Verification:** focused promotion/recovery tests; full local gate.

**Dependencies:** Tasks 3-4. **Estimated scope:** Medium, 5 files.

## Task 7: Shared desktop renderer

**Acceptance criteria:**

- [x] One desktop renderer serves Create/Edit Task/Event.
- [x] Mode changes actions and target/source presentation, not field implementations.
- [x] Keyboard, labels, validation, empty, busy, and recovery states remain accessible.

**Verification:** composition/model tests; desktop Obsidian acceptance pending separately.

**Dependencies:** Tasks 4-6. **Estimated scope:** Medium, 5 files.

## Task 8: Shared mobile renderer

**Acceptance criteria:**

- [x] One workspace-anchored mobile renderer serves Create/Edit Task/Event.
- [x] It uses shared data/controllers without importing desktop DOM.
- [x] Safe areas, keyboard viewport, scrolling, busy, and recovery states are retained.

**Verification:** mobile policy/composition tests; Android/iOS acceptance pending separately.

**Dependencies:** Tasks 4-7. **Estimated scope:** Medium, 5 files.

## Task 9: Retire new Related Note/hub UI

**Acceptance criteria:**

- [x] New Create/Edit UI exposes Object References and Detail Notes, not Related Note/hub controls.
- [x] Existing linked titles and hub-created Markdown remain readable and losslessly editable.
- [x] No migration rewrites existing notes automatically.

**Verification:** legacy compatibility fixtures; full local gate.

**Dependencies:** Tasks 5-8. **Estimated scope:** Small, 3 files.

## Task 10: Documentation and acceptance

**Acceptance criteria:**

- [x] Semantic docs distinguish Object References, Object Notes, Detail Notes, and legacy hub behavior.
- [ ] Full CI-equivalent local gate passes from a clean worktree.
- [x] Desktop and mobile runtime acceptance results are recorded without conflating them with automated checks.

**Verification:** `OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run check:ci`; `git diff --check`; explicit runtime checklist.

**Dependencies:** Tasks 1-9. **Estimated scope:** Medium, documentation plus acceptance.
