# ADR-001: Use VitePress for project documentation

## Status

Accepted and implemented on `docs/vitepress-documentation` after the engineering-foundation branch was merged to `main`.

## Date

2026-08-02

## Context

Focus Notes currently keeps the user guide, settings reference, architecture summary, and developer workflow in the root README plus several standalone specifications. This makes it difficult to distinguish current user behavior from historical implementation plans, and it does not provide a navigable home for user, developer, compatibility, release, and troubleshooting documentation.

The documentation system must:

- Keep Markdown as the source format.
- Support separate user and developer navigation.
- Fit the existing Node.js, pnpm, TypeScript, and GitHub Actions toolchain.
- Produce a static site without adding runtime dependencies to the Obsidian plugin bundle.
- Allow documentation checks to become an independent CI gate.

## Decision

Use VitePress as the documentation site generator.

VitePress is rooted at `docs/`, with publishable content isolated in `docs/site/` through `srcDir`. Internal specifications, ADRs, and development checkpoints remain under `docs/` but outside the generated site. Keep its dependencies and scripts development-only, and ensure the Obsidian production bundle remains sourced exclusively from `src/main.ts`.

The initial information architecture separates:

- User guide: installation, first run, timer and logging, Inbox, Event, Task, Timeline, settings, Markdown output, mobile behavior, storage/privacy, and troubleshooting.
- Developer guide: architecture, module ownership, Obsidian lifecycle and API baseline, persistence, Markdown contracts, testing, CI, release, and contribution workflow.
- Release reference: changelog, compatibility matrix, migrations, known issues, and desktop/mobile acceptance evidence.

## Alternatives considered

### Keep all documentation in the root README

- Advantage: no additional tooling.
- Rejected: the README is already mixing audiences and cannot scale into a clear user and developer reference.

### Plain Markdown files without a site generator

- Advantage: minimal dependencies and works directly on GitHub.
- Rejected: navigation, discoverability, and separation of user/developer material would remain manual as the documentation grows.

### A custom documentation application

- Advantage: complete presentation control.
- Rejected: unnecessary maintenance and a larger toolchain for content that is primarily Markdown.

## Consequences

- Documentation bootstrap was implemented on a dedicated branch after the engineering-foundation merge.
- Complete user/developer documentation remains a public-release gate, but VitePress setup is not a gate for merging this branch.
- VitePress is pinned, local build/preview scripts exist, and the production documentation build is part of `check:ci`.
- Deployment remains a separate decision and is not configured by this ADR.
- The root README will become a concise project landing page linking to the documentation site and contributor entry points.
