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
