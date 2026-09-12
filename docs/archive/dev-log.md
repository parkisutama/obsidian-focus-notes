---
title: Focus Notes — Development log (archived)
created: 2026-09-03T00:00
modified: 2026-09-12T00:00
tags:
  - focus-notes
  - history
---

> Diarsipkan 2026-09-12. Catatan naratif ini mendahului adopsi
> [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Perubahan baru dicatat di
> `/CHANGELOG.md` pada root repository, bukan di sini. File ini dipertahankan sebagai
> konteks historis pengembangan, bukan sumber kebenaran rilis.

# Focus Notes — Development log (archived)

## 2026-09-03 — Documentation archive

### Changed

- Artefak task dan spec yang telah selesai dipindahkan ke `docs/archive/`.
- Keadaan fitur, arsitektur, dan batas legacy dirangkum dalam
  [Current State](current-state.md).
- Workflow pengguna dirangkum dalam [Usage Workflow](usage-workflow.md).

## 2026-09-01 — Canonical capture model

### Added

- Flat block grammar dengan prefix bernama dan stable ID.
- Reflection terpisah menjadi `reflection:` dan `reflection-notes:`.
- Focus Session sebagai child langsung Event/Task.
- Timebox dan Focus Session sebagai sibling dengan summary turunan.
- Formatter preview/apply eksplisit dan idempotent.

## 2026-08-22 to 2026-08-30 — Source restructuring

### Changed

- Source dipindahkan ke feature-based `domain`, `application`, dan `ui`.
- Concrete Obsidian adapters dipusatkan di `src/infrastructure/obsidian/`.
- Dead UI dikarantina di `src/legacy/` tanpa penghapusan.
- Architecture dan compatibility guards ditambahkan.
