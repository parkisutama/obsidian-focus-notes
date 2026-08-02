# Spec: Main Code Quality Remediation

## Status

Drafted on 2026-08-02 from the full `main` audit. Phase 1 (Developer Experience foundation) is implemented on `chore/developer-experience-foundation` and locally verified. Phases 2–4 remain planned and must be completed before merge unless an exception is explicitly approved. Current cross-cutting status and merge gates are tracked in [Development status](development-status.md).

## Objective

Strengthen the reliability and maintainability of Focus Notes without changing its intended Markdown formats or removing existing desktop and mobile features. Developer Experience is established first so every later correctness fix is evaluated by a reproducible toolchain, real static analysis, an explicit test contract, and the same automated gate locally and in CI.

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

## Tech Stack and Developer Experience

The project deliberately keeps a small, native Obsidian stack:

| Concern | Selected tool | Contract |
|---|---|---|
| Runtime API | Obsidian Plugin API | Explicit compatible version range; lockfile is authoritative for installs |
| Language | TypeScript | Strict typecheck, including unused declarations |
| Package manager | pnpm 11 | `packageManager` field and frozen lockfile in CI |
| Bundle | esbuild | CommonJS production artifact with Obsidian/Electron externals |
| Lint and format | Biome | One fast tool for TypeScript, JavaScript, JSON, and CSS where supported |
| Unit/integration tests | Node `node:test` | No Jest or Vitest migration |
| Assertions | `node:assert/strict` | State/output assertions rather than mock call choreography |
| Coverage | Node test coverage | Baseline and reporting without adding a second test runner |
| UI | Native DOM and Obsidian helpers | No React or other runtime UI framework |
| Acceptance | Obsidian desktop and real mobile | Required for modal, keyboard, hover, and suggestion behavior |

Biome does not replace TypeScript. Biome owns syntax/style linting and formatting; `tsc` owns type correctness and unused-declaration enforcement. Rules that require deeper type-aware promise analysis are enforced through explicit `void`, boundary error handling, code review, and behavior tests rather than introducing ESLint in the first remediation.

The initial Developer Experience work does not add `happy-dom`, Jest, Vitest, or a mocking framework. A DOM test dependency may be proposed later only when a concrete renderer behavior cannot be covered through a small policy/controller seam and manual Obsidian acceptance.

## Scope and Priority

Implementation order establishes a trustworthy engineering feedback loop before changing runtime behavior:

1. Pin and secure the development toolchain.
2. Establish Biome formatting/linting plus stricter TypeScript checks.
3. Define the `node:test` structure, coverage baseline, and reusable test fakes.
4. Run the same quality contract in CI.
5. Prevent concurrent desktop submissions.
6. Represent partial multi-file submission outcomes accurately.
7. Make settings loading and saving ordered and recoverable.
8. Reject invalid date/time values and prevent zero-duration defaults.
9. Expand direct coverage for timer, writer, reader, parser, and UI orchestration behavior.

Each numbered item must land as an independent, tested commit. A failed checkpoint blocks later work until corrected.

## Functional Requirements

### 1. Developer Experience foundation

- `pnpm install --frozen-lockfile` must reproduce the toolchain used by CI.
- `obsidian` must use an explicit compatible range rather than `latest`.
- `esbuild` must be upgraded beyond the affected advisory range in an isolated dependency commit.
- `pnpm run lint` must execute Biome checks over supported project sources.
- `pnpm run format` applies Biome formatting; `pnpm run format:check` verifies formatting without mutation.
- Existing metadata validation moves to `pnpm run verify:version` and remains visible as a separate gate.
- `tsc` must report unused locals and parameters in addition to strict type errors.
- `pnpm test` remains `node --test`; existing test syntax and imports remain valid.
- `pnpm run test:coverage` reports Node test coverage and exits non-zero when tests fail.
- The first coverage run records a baseline but does not impose an arbitrary repository-wide percentage. Behavioral contracts remain the acceptance standard.
- Test-only fakes for vault/storage/time must live under `test/support/` and must not ship in `main.js`.
- A CI workflow must run install, Biome, formatting check, version verification, typecheck, tests, production build, and artifact verification from a clean checkout.
- Local and CI commands must call the same package scripts rather than maintain duplicate command logic.
- `pnpm run check:ci` must be read-only with respect to a user's Obsidian vault when `OBSIDIAN_VAULT_PLUGIN_PATH` is empty.

### 2. Submission concurrency

- Desktop and mobile must share the same behavioral rule: only one Save operation may be active for a form.
- Save must become disabled or otherwise non-actionable while submission is active.
- Pressing Enter and clicking Save during the same in-flight operation must not create a second write.
- A failed submission must restore the ability to retry.
- A successful submission must close exactly once and invoke `onComplete` exactly once.
- Inbox, Event, and Task must follow the same concurrency policy.

The UI renderer may own its local disabled state, but the submission guard must be testable without relying only on timing in a real DOM.

### 3. Multi-file submission outcomes

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

### 4. Settings persistence safety

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

### 5. Date and time validation

- Parsing invalid date or time input must return an explicit validation failure; it must never substitute `new Date()`.
- Timed events require an end strictly later than their start.
- Until a separate end-date control is specified, cross-midnight events remain out of scope and must be rejected with a clear message.
- A form opened during hour 23 defaults to `23:00`–`23:59`, avoiding a zero-duration event.
- Enabled task timeboxes require an end strictly later than their start.
- Due dates and reminders must reject malformed date/time combinations.
- All-day events are exempt from start/end-time ordering because their time inputs are not persisted.
- Desktop and mobile must render the same validation message from shared validation logic.

### 6. Static-analysis details

- `pnpm run lint` must run Biome rather than the metadata script.
- Version metadata validation must move to an explicitly named command such as `verify:version` and remain part of `check`.
- Biome must cover `src/**/*.ts`, `test/**/*.ts`, project scripts, JSON, and CSS where its stable support is suitable.
- TypeScript compiler options must report unused imports, unused locals, and unused private properties.
- Biome must report common unsafe constructs and obvious accidental fallthrough; type-aware rules outside Biome's scope are not falsely claimed as covered.
- Existing intentional fire-and-forget operations must use an explicit `void` and handle user-visible failures at the appropriate boundary.
- Initial adoption must remove the currently confirmed unused declarations rather than suppressing them.
- New lint dependencies and their lockfile changes must be reviewed as one isolated tooling commit.
- No broad file-wide disable comments are allowed.
- Formatting adoption must be isolated from behavior changes. If the initial format diff is large, it lands as a dedicated mechanical commit before later feature diffs.

### 7. Core regression coverage

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

### 8. Dependency hygiene

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

### Phase 1 — Reproducible toolchain

#### Task 1: Pin and secure development dependencies

**Acceptance criteria:**

- `obsidian` uses an explicit compatible range.
- esbuild is outside the affected advisory range.
- Frozen installation, development watch, production build, and packaging succeed.

**Dependencies:** None.

**Likely files:** `package.json`, `pnpm-lock.yaml`, and `esbuild.config.mjs` only if documented migration changes require it.

**Verification:** `pnpm install --frozen-lockfile`, `pnpm audit`, watch startup, production build, artifact verification, and package creation.

#### Task 2: Adopt Biome and strict compiler hygiene

**Acceptance criteria:**

- `lint`, `format`, `format:check`, and `verify:version` have distinct responsibilities.
- TypeScript reports unused declarations.
- Existing code passes without broad rule suppressions.

**Dependencies:** Task 1.

**Likely files:** `package.json`, `pnpm-lock.yaml`, `biome.json`, `tsconfig.json`, and confirmed source files containing unused declarations. If initial formatting is broad, it is a separate mechanical commit.

**Verification:** prove Biome and `tsc` each fail on a temporary controlled violation, remove it, then run the full gate.

#### Task 3: Establish the Node test and coverage contract

**Acceptance criteria:**

- Existing `node:test` files continue to run unchanged.
- `test:coverage` produces a useful baseline report.
- Reusable fakes for delayed I/O, clocks, and vault storage have documented ownership under `test/support/`.

**Dependencies:** Task 2.

**Likely files:** `package.json`, test-support modules, and a small test proving the support utilities.

**Verification:** `pnpm test`, `pnpm run test:coverage`, and production bundle inspection confirming test support is excluded.

#### Task 4: Add a clean-checkout CI gate

**Acceptance criteria:**

- CI runs the same package scripts used locally with a frozen lockfile.
- Individual failures identify formatting, lint, typecheck, test, build, metadata, or artifact stages.
- No vault path, credential, or environment secret is required for validation.

**Dependencies:** Tasks 1–3.

**Likely files:** `.github/workflows/quality.yml` and package scripts only if composition needs adjustment.

**Verification:** validate workflow syntax and observe one complete green CI run before beginning runtime remediation.

### Checkpoint A — Developer Experience foundation

- A clean clone can install and run every documented command.
- Biome, formatting, typecheck, tests, coverage, build, metadata, and artifacts are separately visible.
- CI and local `check:ci` execute equivalent contracts.
- The spec is updated if tool behavior differs from the proposed contract.

### Phase 2 — Duplicate and partial-write safety

#### Task 5: Add a shared submission gate

**Acceptance criteria:**

- Concurrent calls execute the underlying submission once.
- Failure unlocks a retry; success remains resolved.
- Desktop and mobile both consume the same rule.

**Dependencies:** Checkpoint A.

**Likely files:** `src/EventTaskSubmission.ts`, `src/EventTaskModal.ts`, `src/EventTaskMobileScreen.ts`, `test/event-task-submission.test.ts`.

**Verification:** focused submission tests, full `check:ci`, manual rapid double-tap/click on desktop and mobile.

#### Task 6: Introduce typed partial outcomes

**Acceptance criteria:**

- Primary-success/secondary-failure returns `partial`.
- User messaging names the successful and failed destinations.
- Retry cannot duplicate the primary write through the same form.

**Dependencies:** Task 5.

**Likely files:** `src/EventTaskSubmission.ts`, both form renderers, `test/event-task-submission.test.ts`.

**Verification:** inject failures at every write phase and assert outcome plus final fake-vault state.

### Checkpoint B — Submission safety

- Desktop and mobile rapid-submit smoke tests create one entry.
- A forced hub-write failure leaves one primary entry and produces a partial warning.
- Full automated gate remains green.

### Phase 3 — Data validation and persistence

#### Task 7: Add shared capture validation

**Acceptance criteria:**

- Invalid timestamps and non-positive time ranges are rejected before vault mutation.
- Hour-23 event defaults are valid.
- Both renderers show identical messages.

**Dependencies:** Checkpoint A; independent of Tasks 5–6.

**Likely files:** `src/EventTaskFormState.ts`, a focused validation module if extraction reduces complexity, both renderers, related tests.

**Verification:** boundary tests at 23:xx, malformed values, equal times, reversed times, all-day events, and task timeboxes.

#### Task 8: Separate state-load failure modes

**Acceptance criteria:**

- Missing, unreadable, and malformed state files produce distinct typed outcomes.
- Unreadable/malformed state is never overwritten implicitly.
- First install and migration remain green.

**Dependencies:** Task 3 test-support contract.

**Likely files:** `src/StateStore.ts`, `src/main.ts`, `test/state-store.test.ts`.

**Verification:** fake-adapter tests for each failure branch and manual recovery messaging check.

#### Task 9: Serialize settings saves

**Acceptance criteria:**

- Delayed older writes cannot replace newer snapshots.
- Write failure is surfaced and the queue remains usable for a later retry.
- Backup behavior is adapter-safe and tested if implemented.

**Dependencies:** Task 8.

**Likely files:** `src/StateStore.ts`, `src/main.ts`, `test/state-store.test.ts`.

**Verification:** deterministic deferred-promise tests and final stored JSON assertion.

### Checkpoint C — Validation and persistence

- No validation failure reaches a vault writer.
- Settings recovery scenarios preserve the original state file.
- Ordered-write tests prove the newest snapshot wins.
- Full automated gate remains green.

### Phase 4 — Core behavior coverage

#### Task 10: Cover TimerEngine

**Dependencies:** Task 3.

**Likely files:** `test/timer-engine.test.ts` and `src/TimerEngine.ts` only when a test exposes a defect.

**Verification:** deterministic fake-clock/interval tests plus full gate.

#### Task 11: Cover Markdown writers

**Dependencies:** Task 3 and submission outcome contracts from Task 6.

**Likely files:** writer tests, a reusable test-only fake vault, and writer source only for proven defects.

**Verification:** exact Markdown fixtures for file, heading, position, and multiline cases.

#### Task 12: Cover scheduled-item parser and query

**Acceptance criteria:**

- Valid and malformed schedule metadata behave deterministically.
- Date-range and completed/source filtering boundaries are covered.
- A bounded large fixture catches accidental repeated full-source work.

**Dependencies:** Task 3.

**Likely files:** parser/query tests and source only for proven defects.

**Verification:** deterministic fixtures plus full gate.

#### Task 13: Cover indexer and recent entries

**Dependencies:** Task 3 and Task 12 parser contracts.

**Likely files:** indexer/reader tests, shared fake vault, and source only for proven defects.

**Verification:** flat/grouped headings, ordering, multiline entries, limits, recursive sources, and full gate.

#### Task 14: Cover renderer orchestration

**Dependencies:** Tasks 5–7.

**Likely files:** focused UI policy/controller tests and minimal renderer changes needed for test seams.

**Verification:** one-submit semantics, retry after failure, partial outcome, and common validation messaging.

### Final checkpoint

- Every functional requirement has a regression test or an explicitly recorded real-device acceptance step.
- `OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run check:ci` passes.
- `pnpm run format:check`, `pnpm run lint`, and `pnpm run test:coverage` pass independently.
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

Target Developer Experience contract after Phase 1:

```bash
pnpm install --frozen-lockfile
pnpm run format
pnpm run format:check
pnpm run lint
pnpm run verify:version
pnpm run typecheck
pnpm test
pnpm run test:coverage
OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run build
pnpm run verify:artifacts
OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run check:ci
pnpm audit
pnpm run package:plugin
```

`format` is the only quality command above that intentionally mutates source files. Every command used by CI must be read-only.

## Project Structure

- `src/EventTaskSubmission.ts`: typed orchestration and primary/secondary outcome boundary.
- `src/EventTaskFormState.ts` or a focused sibling module: shared capture validation.
- `src/EventTaskModal.ts`: desktop disabled state and result presentation.
- `src/EventTaskMobileScreen.ts`: mobile disabled state and result presentation.
- `src/StateStore.ts`: typed load outcomes and ordered persistence.
- `src/main.ts`: ownership of the state writer and recovery policy.
- `test/`: behavior-focused unit and integration tests with test-only fakes.
- `test/support/`: reusable in-memory vault/storage, clock, and deferred-I/O test utilities.
- `biome.json`: source linting and formatting policy.
- `.github/workflows/quality.yml`: clean-checkout quality gate using package scripts.
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
- Keep `node:test` as the only test runner; do not introduce Jest or Vitest.
- Use Node's test coverage output for the initial baseline instead of adding `c8` unless runtime support proves insufficient.
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
- Adding a second linter, formatter, test runner, DOM emulator, or coverage package after the Phase 1 tool choices.
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
- Biome formatting, TypeScript strict/unused checks, Node tests, coverage, build, and metadata verification have independent commands and a shared CI gate.
- A clean checkout installs reproducibly with the frozen pnpm lockfile.
- The confirmed esbuild advisory is removed without an unrelated dependency sweep.
- Direct regression tests cover timer state, Markdown writers, scheduled-item parsing/querying, recent-entry reading, settings persistence, and submission orchestration.
- Full automated gates and recorded Obsidian desktop/mobile acceptance pass.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Partial writes cannot be transactional across vault files | Duplicate or orphaned content | Define the primary commit boundary, use typed partial outcomes, and avoid blind retry |
| Adapter implementations differ across desktop/mobile | Settings recovery could fail on one platform | Depend only on feature-tested public adapter methods and test fallback behavior |
| Lint adoption produces a large unrelated diff | Review becomes difficult | Configure rules narrowly, remove confirmed debt in a dedicated commit, defer style-only rules |
| Biome lacks a desired type-aware rule | False sense of coverage | Keep `tsc` authoritative for types and cover async boundaries with explicit handling and tests |
| Coverage becomes a vanity metric | Work optimizes percentages instead of risk | Record a baseline but gate on named behavioral contracts first |
| CI and local commands drift | Green locally but red remotely | CI invokes package scripts directly with a frozen lockfile |
| Dependency upgrade changes bundle behavior | Plugin fails to load | Read migration notes and verify watch, production, externalization, and package artifacts |
| Renderer tests become DOM-framework-heavy | Brittle tests | Extract small orchestration policies and retain a short real Obsidian acceptance checklist |
| Writer fixtures diverge from actual Markdown | False confidence | Assert exact representative output and preserve existing accepted fixtures |

## Open Questions for Approval

1. Should a partial result close the form after the primary entry succeeds, as proposed, or remain open in a read-only “saved with warning” state?
2. Is rejecting cross-midnight events acceptable for this remediation, with a separate future feature for an end-date control?
3. May Phase 1 add `@biomejs/biome` as a development dependency and use Biome instead of ESLint plus Prettier?
4. Should the settings recovery UI initially be a Notice plus blocked save, or include a dedicated recovery action in Settings during this remediation?
5. May Phase 1 add a GitHub Actions quality workflow, assuming no publishing or deployment permissions are included?
