# Tasks: Inbox Quick Capture

## Task 1: Add backward-compatible Inbox settings and state

**Description:** Define Inbox record/settings/target contracts, default values, immutable capture timestamp/title, body, and ephemeral overrides while preserving the existing EventTask record contract.

**Acceptance criteria:**

- [ ] `EventTaskRecord` remains Event/Task and `CaptureRecord` adds Inbox explicitly.
- [ ] Old saved settings gain Inbox defaults with independent People/Place arrays.
- [ ] One form session retains its original Inbox capture timestamp across chip changes.

**Verification:**

- [ ] Add state and settings migration tests.
- [ ] Run `pnpm test` and `pnpm run typecheck`.

**Dependencies:** None.

**Files likely touched:**

- `src/types.ts`
- `src/StateStore.ts`
- `src/EventTaskFormState.ts`
- `test/event-task-form-state.test.ts`
- `test/state-store.test.ts`

**Estimated scope:** Medium, 5 files.

## Task 2: Format portable Inbox Markdown

**Description:** Implement pure helpers for timestamp/title formatting, multiline child bullets, safe labels, and ordinary Markdown destinations relative to the resolved target file.

**Acceptance criteria:**

- [ ] Unchanged/blank/custom titles produce the approved timestamp shape exactly once.
- [ ] Blank body lines are pruned while non-empty Markdown is preserved in order.
- [ ] Relative links handle same, parent, nested, spaced, and non-ASCII paths.

**Verification:**

- [ ] Add focused `InboxMarkdown` unit tests with exact string assertions.
- [ ] Run `pnpm test` and `pnpm run typecheck`.

**Dependencies:** Task 1.

**Files likely touched:**

- `src/InboxMarkdown.ts`
- `test/inbox-markdown.test.ts`

**Estimated scope:** Small, 2 files.

## Task 3: Add the Inbox target and write path

**Description:** Resolve Daily Note or active Event/Task targets and submit Inbox through heading-aware insertion without invoking hub/detail-note behavior.

**Acceptance criteria:**

- [ ] Both destination modes honor heading, position, and per-capture overrides.
- [ ] Missing/invalid destinations fail before modifying a vault file.
- [ ] Inbox submission never creates or writes related/detail notes.

**Verification:**

- [ ] Add target, writer, and submission tests with exact calls/output.
- [ ] Run the Checkpoint 2 command set.

**Dependencies:** Tasks 1 and 2.

**Files likely touched:**

- `src/TargetResolver.ts`
- `src/EventTaskWriter.ts`
- `src/EventTaskSubmission.ts`
- `test/event-task-submission.test.ts`
- `test/inbox-target.test.ts`

**Estimated scope:** Medium, 5 files.

## Task 4: Index People, Place, aliases, and tags

**Description:** Build read-only suggestion data from configured Markdown folders and public metadata APIs, then rank and label results predictably.

**Acceptance criteria:**

- [ ] People/Place recursively support multiple roots, filenames, aliases, and duplicate-name context.
- [ ] Tags merge inline/frontmatter metadata and are de-duplicated.
- [ ] Missing folders return no group results and matching is bounded/fuzzy.

**Verification:**

- [ ] Add isolated index/ranking tests using vault/cache fixtures.
- [ ] Run `pnpm test` and `pnpm run typecheck`.

**Dependencies:** Task 1.

**Files likely touched:**

- `src/InboxSuggestions.ts`
- `test/inbox-suggestions.test.ts`

**Estimated scope:** Small, 2 files.

## Task 5: Build cursor-safe inline Notes suggestions

**Description:** Add a shared contenteditable Notes controller that detects the active `@` or `#` token, opens the correct suggestions, and replaces only that range with Markdown/plain tag text.

**Acceptance criteria:**

- [ ] Selecting `@` inserts one relative Markdown link; selecting `#` inserts one ordinary tag.
- [ ] Cursor-in-middle, multiple triggers, dismissal, and unselected triggers preserve surrounding text.
- [ ] State synchronization stores plain Markdown and never editor HTML.

**Verification:**

- [ ] Unit-test token/range and replacement helpers.
- [ ] Perform a minimal Obsidian desktop interaction check before UI integration continues.

**Dependencies:** Tasks 2 and 4.

**Files likely touched:**

- `src/InboxNotesController.ts`
- `src/InboxSuggestions.ts`
- `test/inbox-notes-controller.test.ts`

**Estimated scope:** Medium, 3 files.

## Task 6: Expose Inbox defaults in Settings

**Description:** Add default destination, heading, position, and editable People/Place folder lists using existing Setting and folder-suggester patterns.

**Acceptance criteria:**

- [ ] Defaults are Daily Note, heading `Inbox`, and root `People`/`Place` folders.
- [ ] Users can add/remove multiple source folders without losing unrelated settings.
- [ ] Settings controls have clear labels, descriptions, and accessible inputs.

**Verification:**

- [ ] Run typecheck and inspect persisted state after add/remove/reload.
- [ ] Verify folder suggestions on desktop.

**Dependencies:** Task 1.

**Files likely touched:**

- `src/SettingsTab.ts`
- `src/types.ts`
- `styles.css`

**Estimated scope:** Medium, 3 files.

## Task 7: Deliver the desktop Inbox vertical slice

**Description:** Render chips in `Inbox`, `Event`, `Task` order and connect the minimal Inbox form, inline Notes controller, Advanced overrides, validation, and save path in the desktop modal.

**Acceptance criteria:**

- [ ] Inbox shows only Title, Notes, Save, and collapsed Advanced in its primary flow.
- [ ] Advanced overrides destination/heading/position/source folders without changing Settings.
- [ ] Switching chips preserves each variant's state and Event/Task behavior.

**Verification:**

- [ ] Run all automated gates through Checkpoint 4.
- [ ] Manually save both target modes and inspect/click exact Markdown links.

**Dependencies:** Tasks 3, 5, and 6.

**Files likely touched:**

- `src/EventTaskModal.ts`
- `src/EventTaskFormState.ts`
- `src/InboxNotesController.ts`
- `styles.css`
- `test/event-task-form-state.test.ts`

**Estimated scope:** Medium, 5 files.

## Task 8: Deliver the mobile Inbox vertical slice

**Description:** Add the same Inbox flow to the independent mobile screen while preserving its system-chrome, scrolling, touch-target, and software-keyboard policies.

**Acceptance criteria:**

- [ ] Mobile chips appear as `Inbox`, `Event`, `Task` with accessible selected state.
- [ ] Title, Notes, Save, and collapsed Advanced remain reachable with the keyboard open.
- [ ] Suggestions support touch/keyboard selection without clipping or losing the Notes cursor.

**Verification:**

- [ ] Run all automated gates.
- [ ] Test approximately 390x844 and 360x640 with keyboard closed/open.

**Dependencies:** Task 7.

**Files likely touched:**

- `src/EventTaskMobileScreen.ts`
- `src/InboxNotesController.ts`
- `styles.css`
- `test/mobile-form-policy.test.ts`

**Estimated scope:** Medium, 4 files.

## Task 9: Complete regression and runtime acceptance

**Description:** Run complete technical gates and verify the approved flow in real Obsidian desktop/mobile, recording technical evidence separately from operator acceptance.

**Acceptance criteria:**

- [ ] All automated commands pass with no skipped tests or artifact mismatch.
- [ ] Desktop/mobile scenarios in the spec pass without console errors.
- [ ] Existing Event/Task outputs and interactions do not regress.

**Verification:**

- [ ] Run every command from the spec.
- [ ] Record exact device/viewports, keyboard state, target modes, and link checks.
- [ ] Obtain explicit user acceptance before merge to `main`.

**Dependencies:** Task 8.

**Files likely touched:**

- No production files unless acceptance identifies a defect.
- Optional acceptance evidence under `docs/`.

**Estimated scope:** Small, verification-focused.
