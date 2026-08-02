# ADR-001: Use VitePress for project documentation

## Status

Accepted; implementation deferred until the current engineering-foundation branch is merged to `main`.

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

Bootstrap VitePress as the first documentation task after `chore/developer-experience-foundation` is merged to `main`. Keep its dependencies and scripts development-only, and ensure the Obsidian production bundle remains sourced exclusively from `src/main.ts`.

The initial information architecture will separate:

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

- Documentation bootstrap is intentionally not mixed into the current engineering-foundation branch.
- Complete user/developer documentation remains a public-release gate, but VitePress setup is not a gate for merging this branch.
- A later implementation must pin VitePress, add local build/check scripts, add CI validation, and document deployment separately.
- The root README will become a concise project landing page linking to the documentation site and contributor entry points.
