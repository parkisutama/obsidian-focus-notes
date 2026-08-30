# Refactor acceptance status

Updated: 2026-08-30

## Automated evidence

- `src/main.ts` is the only root TypeScript module; plugin composition lives under `src/plugin/`.
- Feature, infrastructure, shared, and unreachable legacy ownership is enforced by architecture tests.
- Relative source imports are acyclic; production cannot import `legacy`; feature code cannot import plugin composition.
- No empty source directory, re-export-only shim, TODO/FIXME/HACK marker, or active legacy consumer was found.
- The only source file above 400 lines is `MoodCatalog.ts` (774 lines), an intentionally cohesive static dataset with lookup and reference-integrity characterization coverage.
- Moment suggestion controller: 554 → 379 lines.
- Desktop Scheduled Item shell: 413 → 205 lines.
- Mobile Scheduled Item shell: 433 → 256 lines.
- Full CI passes with 309 tests, none skipped: formatting, lint, version metadata, typecheck, production build, artifact verification, and documentation build.
- `git diff --check` passes.

Evidence refreshed on 2026-08-30 with `OBSIDIAN_VAULT_PLUGIN_PATH` cleared: `pnpm run check:ci` passed all 309 tests,
production build, artifact verification, and VitePress build.

## Dependency advisory disposition

`pnpm audit --audit-level=moderate` reports one high and three moderate advisories in documentation development tooling: `vite` and `esbuild`, reached transitively through VitePress. They are not bundled into the Obsidian production artifact. Dependency upgrades remain a separate change because `package.json` and `pnpm-lock.yaml` already contained unrelated user changes before this source refactor. Re-run the audit and upgrade VitePress/tooling in an isolated dependency task.

## Manual runtime acceptance pending

Automated CI cannot substitute for a loaded Obsidian desktop and real-mobile session. Final human approval remains pending until the following are exercised:

- open Focus Notes and Timeline through ribbons and commands;
- create Moment, Task, and Event records and verify exact target file/heading placement;
- edit Task/Event records and verify no-op Markdown remains byte-identical;
- exercise Detail Note create/link and related-write retry recovery;
- verify settings load/save and Object Source suggestions;
- verify Timer start/pause/complete and recent entries;
- on real mobile, test keyboard closed/open, scrolling, suggestions, Escape/cancel, submit lock, and retry state.

No source deletion or dependency upgrade is authorized by this evidence note. The three zero-consumer UI modules remain quarantined under `src/legacy/`.

### Desktop runtime evidence and known defect

- The production artifact was deployed to the configured test vault and Obsidian loaded the plugin successfully.
- Runtime Event Capture testing reached the shared desktop create flow and exposed an existing behavioral defect: ambient
  active Markdown replaces the configured Event periodical target, and a successfully resolved profile can ignore the
  configured Event insert position.
- Source comparison confirmed the behavior existed before the physical reorganization; it is not evidence of a broken
  import or missing moved module.
- The approved correction and its Planned Start/manual-target semantics are specified in
  `spec-scheduled-item-timebox-focus-integration.md` and assigned to Task 31. It is intentionally not mixed into Task 28.
- Because exact Event target/position acceptance failed, desktop runtime acceptance remains incomplete even though plugin
  loading and form launch succeeded.
- Real-mobile acceptance has not been performed and remains required (or must be explicitly waived with recorded risk).
