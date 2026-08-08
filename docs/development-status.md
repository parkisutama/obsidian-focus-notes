# Development Status

## Snapshot

- Date: 2026-08-08
- Branch: `feature/persona-reliability-foundation`
- Remote state: local semantic documentation, Task-priority, and Event-lifecycle work are ahead of
  `origin/feature/persona-reliability-foundation`;
  not merged to `main`
- Release status: **not ready for public release**
- Scope: engineering quality, feature maturity, documentation readiness, and Obsidian submission compliance

This document is the current development checkpoint. It records verified evidence separately from planned work so a passing build is not mistaken for release readiness.

## Executive status

The reliability foundation, contextual capture loop, Timeline source alignment/grouping, object-backed Timeline sources,
stable Timeline item modal, Task priority, and Event occurrence lifecycle semantics are implemented on the feature branch.
The local automated gate is green. Existing-record editing, representative performance evidence, complete documentation,
policy closure, and repeatable real Obsidian
desktop/mobile acceptance remain incomplete. A passing automated gate must not be interpreted as public-release
readiness.

## Engineering quality baseline

### Verified on this branch

- pnpm is declared through `packageManager`, and CI installs with `--frozen-lockfile`.
- Obsidian API is pinned to `1.12.3`; esbuild is pinned to `0.28.1`.
- Biome `2.5.6` owns formatting and linting; warnings fail the lint command.
- TypeScript strict mode includes unused-local and unused-parameter checks.
- Node.js 24 and the built-in `node:test` runner are the test contract.
- `pnpm run test:coverage` reports coverage for source modules loaded by tests.
- GitHub Actions runs the local quality contract on pull requests and pushes to `main`.
- On 2026-08-08, `OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run check:ci` passed formatting, lint, version metadata,
  typecheck, all 33 discovered test files, production build, artifact validation, and the documentation build.
- The older recorded loaded-module coverage baseline was 94.25% lines, 85.48% branches, and 85.07% functions. It is
  not repository-wide runtime coverage and was not refreshed by the 2026-08-08 gate.

### Current code-quality status

The submission concurrency policy, typed primary/secondary outcomes, failed-destination-only retry, temporal validation,
recoverable state reads, ordered settings writes, writer/parser compatibility fixtures, and Timeline integration coverage
have been implemented and are green in the local gate.

Still open:

1. Add or confirm direct regression coverage for remaining core areas such as `TimerEngine` and recent-entry behavior.
2. Complete representative suggestion and Timeline indexing benchmarks and runtime profiling.
3. Repeat the full quality gate from a clean checkout in remote CI; local success does not prove the remote workflow ran.
4. Record repeatable desktop and real-mobile acceptance separately from automated verification.

The detailed acceptance criteria and order remain in [Code quality remediation](spec-code-quality-remediation.md).

## Feature maturity

| Area | Implemented evidence | Remaining engineering or acceptance work | Status |
|---|---|---|---|
| Timer and session logging | Pomodoro, timer, stopwatch, logging target, wellbeing, reflection, and recent entries exist | Direct timer/writer/reader regression coverage is incomplete | Needs hardening |
| Focus Timeline | Day and multi-day views, aligned/grouped sources, object-backed source filters, stable detail modal, Event lifecycle presentation, parsing, layout, and source navigation exist | Existing-record editing, bounded representative performance evidence, and real desktop/mobile acceptance remain open | Feature complete, not release-ready |
| Event and Task capture | Desktop and dedicated mobile renderers, shared validation/submission policy, typed partial outcomes, Task priority, Event lifecycle fields, and related-log recovery have automated coverage | Existing-record editing and repeatable desktop/mobile acceptance remain open | Feature complete, not release-ready |
| Inbox quick capture | Inbox-first chip, editable destination, mention/tag suggestions, relative Markdown links, shared submission safety, and desktop/mobile UI exist | Acceptance evidence remains conversational rather than a repeatable record | Feature complete, not release-ready |
| Mobile modal UX | Dedicated mobile layout, viewport/keyboard policy, and suggestion layering exist | Test again on representative Android and iOS devices after runtime remediation | Provisional |
| Settings persistence | Recoverable load classification, migration through plugin data, ordered snapshot writes, and regression tests exist | Representative migrated-state acceptance and recovery UX confirmation remain open | Needs acceptance |

“Implemented” means code exists. It does not mean the feature has passed release acceptance.

## Obsidian policy and submission audit

Audit sources:

- <https://docs.obsidian.md/Developer+policies>
- <https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins>

### Confirmed blockers

1. Command ID `open-focus-notes` contains the plugin ID `focus-notes`; the existing audit records this as incompatible
   with Obsidian's automatic command-ID prefixing. The external policy has not been re-audited in this snapshot.

### Unverified requirements and review risks

1. `minAppVersion` is `1.4.0`, while the development API is `1.12.3`; compatibility with 1.4.0 has not been demonstrated. Test the declared minimum or raise it to the verified baseline.
2. The manifest description is within the 250-character limit and ends with a period, but it is dense and does not clearly summarize the current Inbox/Event/Task/Timeline scope.
3. An `origin` remote is configured, but fork/original-author submission status has not been re-verified.
4. No verified `1.2.0` release/tag evidence has been recorded in this document.
5. The feature branch is not merged to `main`; release readiness must be evaluated from the final default-branch state.

### Confirmed policy-compatible evidence

- No runtime telemetry, network requests, ads, payment/account requirement, or self-update mechanism was found.
- No Node.js or Electron API import was found in runtime `src/`; `isDesktopOnly: false` is consistent with this scan.
- Build-only use of `fs`, `path`, and `process` is not bundled as plugin runtime behavior.
- No obvious sample-plugin placeholders or dynamic code execution were found.
- A root MIT `LICENSE` now exists. Required attribution and a full transitive license review remain separate checks.
- Settings use Obsidian's `Plugin.loadData()` and `Plugin.saveData()` APIs. The
  adapter is used read-only only for migration from the former
  `vault.configDir/focus-notes-state.json` location.

## Documentation status

VitePress is now configured with publishable sources under `docs/site/`. Its primary navigation separates User content (Tutorials and How-to) from Developer content (Explanation and Reference). The root README still combines product introduction, usage fragments, settings, architecture, and developer commands, so the migration is not complete.

Before public release, split the documentation into:

1. **User documentation** — installation, first-run setup, timer/logging, Inbox, Event, Task, Timeline, target selection, Markdown output, settings, mobile behavior, privacy/storage, and troubleshooting.
2. **Developer documentation** — architecture and module ownership, Obsidian lifecycle/API baseline, persistence contract, Markdown schemas, test strategy, local workflow, CI, release process, and contribution rules.
3. **Release documentation** — changelog, compatibility matrix, migration notes, known issues, and repeatable desktop/mobile acceptance results.

## Required order before merge

1. Preserve the current green Developer Experience and reliability baseline.
2. Preserve the completed submission-safety contract: concurrency guard, typed partial outcomes, and retry isolation.
3. Preserve the completed temporal validation and ordered/recoverable settings persistence behavior.
4. Add remaining core regression coverage and representative performance evidence.
5. Resolve remaining Obsidian blockers: command ID and verified `minAppVersion`; retain the new root `LICENSE`.
6. Keep the VitePress information architecture and build gate green while content is migrated incrementally.
7. Run automated gates from a clean checkout and capture real Obsidian desktop/mobile acceptance.
8. Review the complete branch diff against `main`, including the one-time Biome formatting baseline.
9. Merge only after the engineering and policy merge gates below are closed.
10. Complete the user/developer documentation and reduce the root README before public release.

## Merge gates

- [x] Reproducible dependency installation and pinned critical tooling
- [x] Real formatter, linter, typecheck, tests, coverage command, build, and artifact checks
- [x] Local dependency audit has no known moderate-or-higher vulnerability
- [x] Submission concurrency and partial-write semantics are protected by the shared submission contract
- [x] Invalid date/time input is rejected before submission reaches a writer
- [x] Settings read failures are classified and writes are ordered snapshots
- [ ] Core timer/writer/reader/parser/indexer behavior has direct regression coverage
- [ ] Root `LICENSE` exists; required attribution review remains open
- [ ] Command IDs comply with Obsidian submission requirements
- [ ] `minAppVersion` is evidence-backed
- [x] Documentation tooling decision and post-merge sequence are recorded
- [ ] Clean-checkout CI succeeds on the remote branch
- [ ] Desktop and real-mobile acceptance evidence is recorded
- [ ] Final diff review approves merge to `main`

## Post-merge release gates

- [x] VitePress is pinned, configured, and checked in CI without entering the plugin runtime bundle
- [ ] User documentation is complete and current
- [ ] Developer documentation is complete and current
- [ ] Changelog, compatibility matrix, migrations, known issues, and release instructions are current
- [x] Documentation build and internal link checks pass
- [ ] Root README is reduced to a clear landing page linked to the documentation

## Scope discipline

- Do not merge this branch merely because local static checks pass.
- Do not mix policy fixes, runtime correctness changes, and documentation rewrites into one commit.
- Do not treat the coverage percentage as a release target; close behavioral contracts instead.
- Do not publish or tag a release until the default branch and release assets are consistent.
- Keep `.vscode/settings.json` as shared workspace configuration; do not add machine-specific paths, credentials, or personal secrets.
