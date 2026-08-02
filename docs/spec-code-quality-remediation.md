# Spec: Main Code Quality Remediation

## Status

Drafted on 2026-08-02 from the full `main` audit. Implementation is blocked until this specification is reviewed and approved.

## Objective

Strengthen the reliability and maintainability of Focus Notes without changing its intended Markdown formats or removing existing desktop and mobile features. The work addresses the confirmed audit findings in submission safety, settings persistence, date/time validation, static analysis, dependency hygiene, and regression coverage.

Success means the plugin fails explicitly instead of silently substituting data, repeated user actions cannot duplicate an in-flight submission, partial multi-file writes cannot be mistaken for a total failure, settings writes are ordered and recoverable, and the quality gate checks real source-code problems in addition to version metadata.

## Audit Baseline

The 2026-08-02 audit established this starting point:

- `main` builds successfully and all 14 existing test files pass.
- TypeScript strict mode is enabled, but unused locals and parameters are not checked.
- The script named `lint` only validates version metadata; it is not a code linter.
- Desktop submission has no in-flight guard, while mobile already prevents concurrent submission.
- A successful primary write followed by a failed hub write is reported as a generic failure, making a user retry capable of duplicating the primary entry.
- Settings read errors and JSON parse errors share one fallback path; later saves can overwrite data that failed to load temporarily.
- Event and task date parsing silently substitutes the current time for invalid input.
- An event opened during hour 23 defaults to equal start and end times.
- Core timer, Markdown writer, reader, and scheduled-item indexing paths have little or no direct automated coverage.
- `pnpm audit` reports one moderate, development-only advisory for `esbuild 0.20.2` (`GHSA-67mh-4wv8-2f99`).
- `package.json` declares the Obsidian API dependency as `latest`, although the lockfile currently resolves it to `1.12.3`.

## Scope and Priority

Implementation order follows data-loss and duplicate-write risk, not visual impact:

1. Prevent concurrent desktop submissions.
2. Represent partial multi-file submission outcomes accurately.
3. Make settings loading and saving ordered and recoverable.
4. Reject invalid date/time values and prevent zero-duration defaults.
5. Establish a real static-analysis gate and remove confirmed dead declarations.
6. Add direct coverage for core timer, writer, reader, and parser behavior.
7. Upgrade the vulnerable build dependency and pin the Obsidian API range.

Each numbered item must land as an independent, tested commit. A failed checkpoint blocks later work until corrected.

## Functional Requirements

### 1. Submission concurrency

- Desktop and mobile must share the same behavioral rule: only one Save operation may be active for a form.
- Save must become disabled or otherwise non-actionable while submission is active.
- Pressing Enter and clicking Save during the same in-flight operation must not create a second write.
- A failed submission must restore the ability to retry.
- A successful submission must close exactly once and invoke `onComplete` exactly once.
- Inbox, Event, and Task must follow the same concurrency policy.

The UI renderer may own its local disabled state, but the submission guard must be testable without relying only on timing in a real DOM.

### 2. Multi-file submission outcomes

Submission results must distinguish three states:

```ts
export type SubmissionResult =
    | { status: "success"; message: string }
    | { status: "partial"; message: string; completed: string[]; failed: string }
    | { status: "failure"; message: string };
```

- The primary destination is the authoritative write.
- If the primary write fails, the result is `failure` and the modal remains open.
- If the primary succeeds but the optional hub write fails, the result is `partial`, explicitly stating that the primary entry already exists.
- A partial result must not invite a blind full retry that duplicates the primary entry.
- The form closes after a partial result because its primary responsibility has completed; the user receives a warning identifying the failed secondary destination.
- Created hub/detail notes are not automatically deleted when a later operation fails. Automatic deletion would risk removing a pre-existing note returned by an idempotent create path.
- Failures while creating optional notes must identify what was created successfully before the failure.
- Existing successful Markdown output must remain byte-for-byte unchanged.

### 3. Settings persistence safety

- `adapter.exists`, `adapter.read`, and `JSON.parse` failures must be classified separately.
- An I/O read failure must not be described as corrupted JSON.
- After an external settings read failure, automatic or user-triggered saves must not overwrite the unread file until a successful reload or explicit recovery decision.
- Invalid JSON must remain untouched and must produce a recoverable error state with a clear message.
- Settings saves issued close together must execute in call order; an older write may never finish after and replace a newer snapshot.
- Each save must serialize an immutable snapshot captured at call time.
- Where the Obsidian adapter permits it safely, preserve a last-known-good backup before replacing the state file. Do not assume filesystem rename semantics without feature testing.
- First-install creation and legacy `data.json` migration must retain their existing behavior.
- No settings file may be deleted automatically.

Persistence policy should be implemented behind one plugin-owned state writer rather than duplicated across settings consumers.

### 4. Date and time validation

- Parsing invalid date or time input must return an explicit validation failure; it must never substitute `new Date()`.
- Timed events require an end strictly later than their start.
- Until a separate end-date control is specified, cross-midnight events remain out of scope and must be rejected with a clear message.
- A form opened during hour 23 defaults to `23:00`–`23:59`, avoiding a zero-duration event.
- Enabled task timeboxes require an end strictly later than their start.
- Due dates and reminders must reject malformed date/time combinations.
- All-day events are exempt from start/end-time ordering because their time inputs are not persisted.
- Desktop and mobile must render the same validation message from shared validation logic.

### 5. Static-analysis gate

- `pnpm run lint` must run a real TypeScript-aware source linter.
- Version metadata validation must move to an explicitly named command such as `verify:version` and remain part of `check`.
- The lint configuration must cover `src/**/*.ts`, `test/**/*.ts`, and project scripts where supported.
- Unused imports, unused private properties, unsafe `any`, floating promises, and obvious accidental fallthrough must be reported.
- Existing intentional fire-and-forget operations must use an explicit `void` and handle user-visible failures at the appropriate boundary.
- Initial adoption must remove the currently confirmed unused declarations rather than suppressing them.
- New lint dependencies and their lockfile changes must be reviewed as one isolated tooling commit.
- No broad file-wide disable comments are allowed.

### 6. Core regression coverage

Add direct tests for the following contracts:

#### Timer engine

- start, pause, resume, stop, reset, and completion transitions;
- countdown and stopwatch display values;
- completion callback fires once;
- invalid or non-finite duration is rejected;
- intervals are cleared after pause, stop, reset, and completion.

#### Writers

- creation of missing target folders/files;
- insertion at start and end of existing headings;
- creation of missing headings;
- event/task/inbox formatting with multiline descriptions;
- no modification outside the selected heading;
- primary/secondary partial-write behavior and retry safety.

Writer tests must use a small in-memory fake vault or temporary test adapter. They must assert final Markdown, not private method calls.

#### Scheduled-item parsing and queries

- event and task parsing for valid metadata;
- malformed schedule tokens are ignored or reported deterministically;
- completed tasks and source visibility filters;
- boundary behavior at start/end of day and week;
- large fixture behavior sufficient to catch accidental repeated full-vault scans.

#### Recent entries and state persistence

- flat and grouped headings, start/end ordering, multiline entries, and limits;
- valid state load, invalid JSON, transient read failure, ordered concurrent saves, first install, and legacy migration.

#### UI orchestration

- repeated desktop Save/Enter signals result in one submission;
- failure re-enables Save;
- partial success closes once and presents a warning;
- mobile and desktop use the same validation result.

No arbitrary coverage percentage is required in this remediation. Completion is based on the listed behavioral contracts and regression value, not line-count gaming.

### 7. Dependency hygiene

- Upgrade `esbuild` to a supported version not affected by `GHSA-67mh-4wv8-2f99`.
- Read the intervening esbuild release and migration notes before changing the version.
- Verify production bundling, external modules, CommonJS output, minification, watch mode, and optional vault-copy behavior.
- Replace the `obsidian: "latest"` specifier with an explicit compatible range based on the API version the project supports.
- Keep dependency upgrades separate from runtime correctness changes.
- Do not use `pnpm audit --fix --force` or perform unrelated bulk upgrades.

## Architecture Decisions

### Shared validation before renderer logic

Date/time validation and submission outcome semantics belong in renderer-independent modules. Desktop and mobile renderers consume typed results and control focus/disabled state; they do not independently decide whether a record is valid.

### Primary write as the commit boundary

The primary target entry defines whether an Event or Task was captured. Optional hub/detail operations are reported separately. This prevents the system from calling a completed primary write a total failure.

### Serialized settings writer

All settings writes flow through one queue owned by the plugin/state layer. The queue captures JSON before awaiting I/O and guarantees completion order. Load failure state is explicit, not encoded as ordinary default settings.

### Tests around public behavior

Pure logic should be extracted only where it creates a stable contract needed by both renderers or enables meaningful tests. Tests assert records, Markdown, state transitions, and user-facing results rather than private call order.

### No renderer reunification

Desktop and mobile layouts remain separate because their interaction and keyboard constraints differ. This remediation shares state, validation, and submission behavior without recombining the DOM renderers.

## Implementation Plan

### Phase 1 — Duplicate and partial-write safety

#### Task 1: Add a shared submission gate

**Acceptance criteria:**

- Concurrent calls execute the underlying submission once.
- Failure unlocks a retry; success remains resolved.
- Desktop and mobile both consume the same rule.

**Likely files:** `src/EventTaskSubmission.ts`, `src/EventTaskModal.ts`, `src/EventTaskMobileScreen.ts`, `test/event-task-submission.test.ts`.

**Verification:** focused submission tests, full `check:ci`, manual rapid double-tap/click on desktop and mobile.

#### Task 2: Introduce typed partial outcomes

**Acceptance criteria:**

- Primary-success/secondary-failure returns `partial`.
- User messaging names the successful and failed destinations.
- Retry cannot duplicate the primary write through the same form.

**Likely files:** `src/EventTaskSubmission.ts`, both form renderers, `test/event-task-submission.test.ts`.

**Verification:** inject failures at every write phase and assert outcome plus final fake-vault state.

### Checkpoint A

- Full automated gate passes.
- Desktop and mobile rapid-submit smoke tests create one entry.
- A forced hub-write failure leaves one primary entry and produces a partial warning.

### Phase 2 — Data validation and persistence

#### Task 3: Add shared capture validation

**Acceptance criteria:**

- Invalid timestamps and non-positive time ranges are rejected before vault mutation.
- Hour-23 event defaults are valid.
- Both renderers show identical messages.

**Likely files:** `src/EventTaskFormState.ts`, a focused validation module if extraction reduces complexity, both renderers, related tests.

**Verification:** boundary tests at 23:xx, malformed values, equal times, reversed times, all-day events, and task timeboxes.

#### Task 4: Separate state-load failure modes

**Acceptance criteria:**

- Missing, unreadable, and malformed state files produce distinct typed outcomes.
- Unreadable/malformed state is never overwritten implicitly.
- First install and migration remain green.

**Likely files:** `src/StateStore.ts`, `src/main.ts`, `test/state-store.test.ts`.

**Verification:** fake-adapter tests for each failure branch and manual recovery messaging check.

#### Task 5: Serialize settings saves

**Acceptance criteria:**

- Delayed older writes cannot replace newer snapshots.
- Write failure is surfaced and the queue remains usable for a later retry.
- Backup behavior is adapter-safe and tested if implemented.

**Likely files:** `src/StateStore.ts`, `src/main.ts`, `test/state-store.test.ts`.

**Verification:** deterministic deferred-promise tests and final stored JSON assertion.

### Checkpoint B

- Full automated gate passes.
- No validation failure reaches a vault writer.
- Settings recovery scenarios preserve the original state file.

### Phase 3 — Enforceable quality tooling

#### Task 6: Install and configure real linting

**Acceptance criteria:**

- `pnpm run lint` checks code rather than only metadata.
- `pnpm run verify:version` retains the existing metadata check.
- Confirmed unused declarations are removed with no broad suppressions.

**Likely files:** `package.json`, `pnpm-lock.yaml`, lint configuration, three source files containing confirmed unused declarations.

**Verification:** intentionally introduce one unused declaration locally to prove the gate fails, remove it, then run `check:ci`.

#### Task 7: Upgrade and pin development dependencies

**Acceptance criteria:**

- `pnpm audit` reports no known moderate-or-higher esbuild advisory.
- Obsidian API dependency no longer uses `latest`.
- Development watch and production build retain current output contracts.

**Likely files:** `package.json`, `pnpm-lock.yaml`, and build configuration only if required by documented migration changes.

**Verification:** audit, watch startup, production build, artifact verification, and package creation.

### Checkpoint C

- Lint, metadata verification, typecheck, tests, build, artifact verification, and dependency audit are separately visible and green.

### Phase 4 — Core behavior coverage

#### Task 8: Cover TimerEngine

**Likely files:** `test/timer-engine.test.ts` and `src/TimerEngine.ts` only when a test exposes a defect.

**Verification:** deterministic fake-clock/interval tests plus full gate.

#### Task 9: Cover Markdown writers

**Likely files:** writer tests, a reusable test-only fake vault, and writer source only for proven defects.

**Verification:** exact Markdown fixtures for file, heading, position, and multiline cases.

#### Task 10: Cover parser, indexer, query, and recent entries

This work is split into separate parser/query and reader/indexer commits if it would exceed five files or one focused session.

**Verification:** deterministic fixtures, date-boundary cases, source filtering, and a bounded performance regression fixture.

#### Task 11: Cover renderer orchestration

**Likely files:** focused UI policy/controller tests and minimal renderer changes needed for test seams.

**Verification:** one-submit semantics, retry after failure, partial outcome, and common validation messaging.

### Final checkpoint

- Every functional requirement has a regression test or an explicitly recorded real-device acceptance step.
- `OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run check:ci` passes.
- `pnpm audit` has no unresolved moderate-or-higher issue accepted without rationale.
- Desktop Obsidian and real mobile acceptance complete without console errors.
- No existing Markdown fixture changes unless separately approved.

## Commands

Current baseline commands:

```bash
pnpm test
pnpm run typecheck
pnpm run lint
OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run build
pnpm run verify:artifacts
pnpm run check:ci
pnpm audit
pnpm run package:plugin
```

After Task 6, `lint`, `verify:version`, and `check:ci` must be distinct enough that their output shows which gate failed.

## Project Structure

- `src/EventTaskSubmission.ts`: typed orchestration and primary/secondary outcome boundary.
- `src/EventTaskFormState.ts` or a focused sibling module: shared capture validation.
- `src/EventTaskModal.ts`: desktop disabled state and result presentation.
- `src/EventTaskMobileScreen.ts`: mobile disabled state and result presentation.
- `src/StateStore.ts`: typed load outcomes and ordered persistence.
- `src/main.ts`: ownership of the state writer and recovery policy.
- `test/`: behavior-focused unit and integration tests with test-only fakes.
- `scripts/`: version/artifact checks; these remain verification tools, not substitutes for linting.
- `docs/spec-code-quality-remediation.md`: source of truth for this remediation.

## Code Style

Prefer explicit result types over fallback values that hide invalid state:

```ts
type ValidationResult<T> =
    | { ok: true; value: T }
    | { ok: false; message: string };

const parsed = parseEventDateTime(date, time);
if (!parsed.ok) return parsed;
```

Keep side effects at orchestration boundaries, use exhaustive discriminated-union handling, and keep desktop/mobile business rules out of renderer-specific branches.

## Testing Strategy

- Use Node's built-in test runner for pure logic.
- Use deterministic fakes for vault adapters, clocks, intervals, and delayed writes.
- Test final state and Markdown output rather than private method invocation order.
- Add a regression test before each bug fix and demonstrate that it fails on the pre-fix behavior.
- Run focused tests during implementation and the full gate at every checkpoint.
- Static tests may protect build/config contracts, but they do not replace runtime tests.
- Desktop/mobile interaction changes require Obsidian runtime smoke tests; keyboard and touch behavior require a real mobile check.

## Boundaries

### Always

- Preserve user-created notes and settings files.
- Keep every task independently buildable and revertible.
- Separate runtime correctness, tooling, dependency, and coverage commits.
- Use shared typed logic for behavior common to desktop and mobile.
- Record partial side effects accurately in user-facing messages.

### Ask first

- Changing any persisted Markdown format or frontmatter field.
- Adding an event end-date UI or cross-midnight behavior.
- Deleting or automatically rolling back a user note.
- Adding runtime dependencies.
- Changing the state-file location or migration contract.
- Raising the minimum supported Obsidian version.

### Never

- Replace invalid input with the current date/time silently.
- Retry a vault mutation automatically without an idempotency guarantee.
- Overwrite an unreadable or malformed settings file as part of normal saving.
- Disable failing tests or lint rules merely to make the gate green.
- Treat static checks as proof of desktop/mobile acceptance.
- Commit `.env`, local vault paths, or `.vscode/` workspace state.

## Success Criteria

- Rapid repeated Save/Enter actions produce exactly one primary entry on desktop and mobile.
- A secondary write failure is reported as partial success and cannot lead to accidental primary duplication.
- Invalid event/task date-time input is rejected before any vault mutation.
- Default timed events always have positive duration.
- Transient settings read failures and invalid JSON cannot be overwritten implicitly.
- Concurrent settings saves preserve the newest requested snapshot.
- `pnpm run lint` performs real source analysis and reports no violations.
- The confirmed esbuild advisory is removed without an unrelated dependency sweep.
- Direct regression tests cover timer state, Markdown writers, scheduled-item parsing/querying, recent-entry reading, settings persistence, and submission orchestration.
- Full automated gates and recorded Obsidian desktop/mobile acceptance pass.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Partial writes cannot be transactional across vault files | Duplicate or orphaned content | Define the primary commit boundary, use typed partial outcomes, and avoid blind retry |
| Adapter implementations differ across desktop/mobile | Settings recovery could fail on one platform | Depend only on feature-tested public adapter methods and test fallback behavior |
| Lint adoption produces a large unrelated diff | Review becomes difficult | Configure rules narrowly, remove confirmed debt in a dedicated commit, defer style-only rules |
| Dependency upgrade changes bundle behavior | Plugin fails to load | Read migration notes and verify watch, production, externalization, and package artifacts |
| Renderer tests become DOM-framework-heavy | Brittle tests | Extract small orchestration policies and retain a short real Obsidian acceptance checklist |
| Writer fixtures diverge from actual Markdown | False confidence | Assert exact representative output and preserve existing accepted fixtures |

## Open Questions for Approval

1. Should a partial result close the form after the primary entry succeeds, as proposed, or remain open in a read-only “saved with warning” state?
2. Is rejecting cross-midnight events acceptable for this remediation, with a separate future feature for an end-date control?
3. May Task 6 add ESLint and TypeScript-aware lint packages as development dependencies?
4. Should the settings recovery UI initially be a Notice plus blocked save, or include a dedicated recovery action in Settings during this remediation?
