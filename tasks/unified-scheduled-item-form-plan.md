# Implementation Plan: Unified Scheduled Item Create/Edit Form

## Dependency graph

```text
Object Reference grammar + shared form types
    -> lossless Task/Event block model
        -> create/edit adapters + shared validation
            -> desktop renderer
            -> mobile renderer
        -> detail-note link/create orchestration
        -> contextual related-log delta/recovery
            -> legacy UI retirement
                -> automated gate + runtime acceptance
```

## Phase 1: Contracts and lossless Markdown

1. Define portable Object Reference parsing/serialization.
2. Define shared Task/Event form data and persistence context.
3. Implement lossless scheduled-item block parsing and replacement.

### Checkpoint A

- Pure round-trip fixtures pass for LF/CRLF, descriptions, detail links, nested tasks, unknown children, and legacy titles.
- Existing Create/Edit paths remain behaviorally unchanged.

## Phase 2: Shared form orchestration

4. Add create/edit adapters around the shared form data.
5. Add description and Object Reference editing with delta-based contextual writes.
6. Add detail-note link/create promotion with explicit partial recovery.

### Checkpoint B

- Create/Edit persistence tests prove equivalent semantic output.
- Retry paths never repeat a committed primary write or create a duplicate detail note.

## Phase 3: Two platform renderers

7. Extract one desktop Scheduled Item renderer and route Create/Edit Task/Event through it.
8. Extract one mobile Scheduled Item renderer and route Create/Edit Task/Event through it.
9. Retire Related Note/hub controls from new UI while preserving legacy Markdown compatibility.

### Checkpoint C

- Automated desktop/mobile composition tests pass.
- Production build and artifact verification pass.
- Existing form implementations are removed only after both new routes are active.

## Phase 4: Acceptance and documentation

10. Update semantic documentation and execute desktop/mobile runtime acceptance.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Child bullets are misclassified as description | High | Own only immediate ordinary bullets; preserve checklist/reserved/unknown nodes |
| Multi-file promotion partially succeeds | High | Idempotent create plus retryable detail-link attach; never auto-delete |
| Edit of `@` duplicates historical logs | High | Diff original/new resolved paths and write only additions |
| Shared state becomes a platform UI abstraction | Medium | Share semantic state/controllers only; keep desktop/mobile DOM separate |
| Legacy hub/title links are damaged | High | Golden compatibility fixtures and lossless unknown/title preservation |
| Mobile keyboard regression | High | Keep workspace-anchored mobile screen and perform real-device acceptance |

## Open questions

None blocking. Vault rename migration for `@{path}` is explicitly sequenced after the core form cutover unless runtime
evidence requires it earlier.
