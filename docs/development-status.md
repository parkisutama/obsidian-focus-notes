# Development Status

## Snapshot

- Date: 2026-08-02
- Branch: `chore/developer-experience-foundation`
- Baseline: six commits ahead of local `main`
- Merge status: **not ready for `main`**
- Scope: engineering quality, feature maturity, documentation readiness, and Obsidian submission compliance

This document is the current development checkpoint. It records verified evidence separately from planned work so a passing build is not mistaken for release readiness.

## Executive status

The Developer Experience foundation is implemented and locally green. Runtime correctness remediation, core regression coverage, policy compliance, documentation, and repeatable Obsidian acceptance remain incomplete. No merge to `main` should occur until the merge gates in this document are satisfied or an exception is explicitly recorded.

## Engineering quality baseline

### Verified on this branch

- pnpm is declared through `packageManager`, and CI installs with `--frozen-lockfile`.
- Obsidian API is pinned to `1.12.3`; esbuild is pinned to `0.28.1`.
- Biome `2.5.6` owns formatting and linting; warnings fail the lint command.
- TypeScript strict mode includes unused-local and unused-parameter checks.
- Node.js 24 and the built-in `node:test` runner are the test contract.
- `pnpm run test:coverage` reports coverage for source modules loaded by tests.
- GitHub Actions runs the local quality contract on pull requests and pushes to `main`.
- The latest local verification passed formatting, lint, version metadata, typecheck, all 14 test files, production build, artifact validation, and dependency audit. A detailed reporter run exposes 47 individual test cases; the file count is the stable discovery contract.
- The recorded loaded-module coverage baseline is 94.25% lines, 85.48% branches, and 85.07% functions. This is not repository-wide runtime coverage.

### Still open from the code-quality audit

1. Prevent concurrent desktop submission and apply one shared submission rule to Inbox, Event, and Task.
2. Represent primary-success/secondary-failure as a typed partial outcome so retry cannot duplicate the primary entry.
3. Reject invalid or non-positive event/task time ranges instead of silently substituting values.
4. Separate missing, unreadable, and malformed state files; do not overwrite state after a failed read.
5. Serialize settings writes so an older delayed write cannot replace a newer snapshot.
6. Add direct regression coverage for `TimerEngine`, Markdown writers, scheduled-item parser/query/indexer, recent entries, persistence failure modes, and renderer orchestration.
7. Repeat the full quality gate from a clean checkout in CI; local success does not prove the remote workflow has run.

The detailed acceptance criteria and order remain in [Code quality remediation](spec-code-quality-remediation.md).

## Feature maturity

| Area | Implemented evidence | Remaining engineering or acceptance work | Status |
|---|---|---|---|
| Timer and session logging | Pomodoro, timer, stopwatch, logging target, wellbeing, reflection, and recent entries exist | Direct timer/writer/reader regression coverage is incomplete | Needs hardening |
| Focus Timeline | Day and multi-day views, source filtering, parsing, layout, and note navigation exist | Parser/query/indexer coverage and bounded performance fixtures are incomplete | Needs hardening |
| Event and Task capture | Desktop and dedicated mobile renderers exist; shared form/submission seams have tests | Concurrency, typed partial outcomes, shared validation, and repeatable desktop/mobile acceptance remain open | Needs hardening |
| Inbox quick capture | Inbox-first chip, editable destination, mention/tag suggestions, relative Markdown links, and desktop/mobile UI exist | Acceptance evidence is conversational rather than a repeatable checklist; submission and persistence risks still apply | Feature complete, not release-ready |
| Mobile modal UX | Dedicated mobile layout, viewport/keyboard policy, and suggestion layering exist | Test again on representative Android and iOS devices after runtime remediation | Provisional |
| Settings persistence | Migration and external config-dir state file exist | Failure classification, ordered writes, recovery UX, and adapter-focused tests remain open | High risk |

“Implemented” means code exists. It does not mean the feature has passed release acceptance.

## Obsidian policy and submission audit

Audit sources:

- <https://docs.obsidian.md/Developer+policies>
- <https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins>

### Confirmed blockers

1. The repository has no root `LICENSE` file. `package.json` declaring MIT does not satisfy the policy requirement.
2. Command ID `open-focus-notes` contains the plugin ID `focus-notes`; Obsidian automatically prefixes command IDs.

### Unverified requirements and review risks

1. `minAppVersion` is `1.4.0`, while the development API is `1.12.3`; compatibility with 1.4.0 has not been demonstrated. Test the declared minimum or raise it to the verified baseline.
2. The manifest description is within the 250-character limit and ends with a period, but it is dense and does not clearly summarize the current Inbox/Event/Task/Timeline scope.
3. Fork/original-author status cannot be verified from this checkout because no `origin` remote is configured.
4. No local `1.2.0` tag or GitHub release could be verified. The release workflow exists, but remote artifacts are not evidence until it runs.
5. The default branch still lacks the six commits in this branch; Obsidian evaluates the manifest at the default branch HEAD during submission.

### Confirmed policy-compatible evidence

- No runtime telemetry, network requests, ads, payment/account requirement, or self-update mechanism was found.
- No Node.js or Electron API import was found in runtime `src/`; `isDesktopOnly: false` is consistent with this scan.
- Build-only use of `fs`, `path`, and `process` is not bundled as plugin runtime behavior.
- No obvious sample-plugin placeholders or dynamic code execution were found.
- Direct development dependencies use permissive licenses, but this does not replace the missing project `LICENSE` or a full transitive attribution review.
- State is stored inside `vault.configDir` and the behavior is disclosed in the root README; it does not access files outside the vault.

## Documentation status

The root README combines product introduction, usage fragments, settings, architecture, and developer commands. It is useful as a starting point but is not a complete user or developer documentation set.

Before public release, split the documentation into:

1. **User documentation** — installation, first-run setup, timer/logging, Inbox, Event, Task, Timeline, target selection, Markdown output, settings, mobile behavior, privacy/storage, and troubleshooting.
2. **Developer documentation** — architecture and module ownership, Obsidian lifecycle/API baseline, persistence contract, Markdown schemas, test strategy, local workflow, CI, release process, and contribution rules.
3. **Release documentation** — changelog, compatibility matrix, migration notes, known issues, and repeatable desktop/mobile acceptance results.

## Required order before merge

1. Preserve the current green Developer Experience baseline.
2. Complete submission-safety fixes: concurrency and partial outcomes.
3. Complete validation and settings persistence safety.
4. Add missing core regression coverage.
5. Resolve Obsidian blockers: `LICENSE`, command ID, and verified `minAppVersion`.
6. Build proper user and developer documentation, then reconcile the root README with it.
7. Run automated gates from a clean checkout and capture real Obsidian desktop/mobile acceptance.
8. Review the complete branch diff against `main`, including the one-time Biome formatting baseline.
9. Merge only after all blocking rows below are closed.

## Merge gates

- [x] Reproducible dependency installation and pinned critical tooling
- [x] Real formatter, linter, typecheck, tests, coverage command, build, and artifact checks
- [x] Local dependency audit has no known moderate-or-higher vulnerability
- [ ] Submission concurrency and partial-write semantics are safe
- [ ] Invalid date/time input cannot reach a writer
- [ ] Settings read failure cannot cause destructive overwrite; writes are ordered
- [ ] Core timer/writer/reader/parser/indexer behavior has direct regression coverage
- [ ] Root `LICENSE` exists and required attribution has been reviewed
- [ ] Command IDs comply with Obsidian submission requirements
- [ ] `minAppVersion` is evidence-backed
- [ ] User documentation is complete and current
- [ ] Developer and release documentation is complete and current
- [ ] Clean-checkout CI succeeds on the remote branch
- [ ] Desktop and real-mobile acceptance evidence is recorded
- [ ] Final diff review approves merge to `main`

## Scope discipline

- Do not merge this branch merely because local static checks pass.
- Do not mix policy fixes, runtime correctness changes, and documentation rewrites into one commit.
- Do not treat the coverage percentage as a release target; close behavioral contracts instead.
- Do not publish or tag a release until the default branch and release assets are consistent.
- Preserve `.vscode/` as untracked user workspace configuration unless the user explicitly decides to share it.
