# Focus Notes Documentation

Dokumentasi repository sudah dikonsolidasikan. Gunakan indeks ini untuk membedakan
referensi aktif, situs publik, dan catatan implementasi historis.

## Mulai dari sini

- [Current State](current-state.md) — fitur, arsitektur, model data, dan legacy.
- [Usage Workflow](usage-workflow.md) — alur penggunaan plugin dari capture sampai Timeline.
- [Changelog](../CHANGELOG.md) — format Keep a Changelog, root repository, sumber kebenaran rilis.
- [Archive](archive/README.md) — plan, todo, dan spec yang sudah selesai.

## Public documentation

Sumber situs VitePress berada di [`site/`](site/) dan dibagi menjadi dua pintu utama:

- **User** — tutorial berbasis pembelajaran dan how-to berbasis use case.
- **Developer** — explanation untuk konsep dan keputusan, serta reference untuk kontrak teknis yang dirujuk dokumentasi user.

Jalankan `pnpm run docs:dev` untuk menulis secara lokal dan `pnpm run docs:build` untuk memvalidasi build serta tautan internal. File di luar `site/` adalah catatan engineering internal dan tidak dipublikasikan.

## Source of truth

- [Development status](development-status.md) — snapshot kesiapan engineering, fitur, dokumentasi, dan gate sebelum merge.
- [ADR-001: Use VitePress for project documentation](reference/decisions/001-use-vitepress-for-documentation.md) — keputusan tooling dan struktur publikasi dokumentasi.
- [ADR-002: Object Source required-property schema](reference/decisions/002-object-source-required-property-schema.md) — keputusan mengganti single identity filter Object Source dengan skema required-property, plus Templater sebagai soft dependency.
- [Object Source required properties](archive/specs/spec-object-source-required-properties.md) — kontrak teknis skema required-property: domain model, resolusi default value, tiga titik enforcement (create/repair/auto-repair), dan kompatibilitas Obsidian Linter. Lihat juga [rencana implementasi](archive/tasks/object-source-required-properties-plan.md) dan [checklist](archive/tasks/object-source-required-properties-todo.md).
- [Persona-rooted contextual activity system](ideas/persona-rooted-contextual-activity-system.md) — arah produk untuk capture Daily Notes, object context yang extensible, Focus Timeline, promosi, dan historical related logs.
- [Persona-rooted implementation plan](archive/tasks/persona-contextual-activity-plan.md) — dependency graph dan acceptance criteria historis.
- [Code quality remediation](archive/specs/spec-code-quality-remediation.md) — kontrak historis.
- [Inbox quick capture](archive/specs/spec-inbox-quick-capture.md) — kontrak fitur Inbox.
- [Mobile event/task modal](archive/specs/spec-mobile-event-task-modal.md) — kontrak modal mobile.
- [Task and Event single-line semantics](archive/specs/spec-task-event-line-semantics.md) — kontrak historis grammar,
  lifecycle, batas implementasi saat ini, dan proposal ekstensi Task/Event.
- [Unified Scheduled Item form](archive/specs/spec-unified-scheduled-item-form.md) — kontrak Create/Edit bersama, Object Reference
  berbasis vault path, Detail Note promotion, dan pemisahan renderer desktop/mobile.
- [Unified Scheduled Item runtime acceptance](archive/acceptance/unified-scheduled-item-runtime-acceptance.md) — ledger historis hasil
  automated gate, desktop Obsidian, Android, dan iOS.
- [Event occurrence lifecycle](archive/specs/spec-event-occurrence-lifecycle.md) — proposal lifecycle Event yang belum
  diimplementasikan dan masih menunggu persetujuan semantic.

## Supporting notes

- [Mobile keyboard troubleshooting handover](archive/handovers/mobile-modal-keyboard-troubleshooting-handover.md) — bukti dan konteks debugging mobile.
- [Focus Timeline implementation blueprint](archive/ideas/focus-timeline-implementation-blueprint.md) — blueprint historis Timeline; bukan status implementasi terkini.
- [Development log (archived)](archive/dev-log.md) — catatan naratif pengembangan sebelum adopsi Keep a Changelog.

## Documentation gaps

Fondasi VitePress dan contoh awal setiap kategori sudah tersedia. Dokumentasi berikut masih harus dilengkapi sebelum release publik:

- Panduan pengguna terpisah untuk instalasi, timer/logging, Inbox, Event, Task, Timeline, target note, dan troubleshooting.
- Panduan developer untuk arsitektur, lifecycle Obsidian, persistence, format Markdown, testing, release, dan kontribusi.
- Checklist acceptance desktop dan mobile yang dapat diulang.
- Catatan kompatibilitas yang membuktikan `minAppVersion`.

`README.md` di root masih menjadi pengantar proyek, tetapi tidak boleh dianggap sebagai pengganti seluruh dokumentasi pengguna dan developer.
