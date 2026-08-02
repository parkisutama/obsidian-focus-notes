# Focus Notes Documentation

Dokumentasi repository saat ini masih dalam tahap konsolidasi. Gunakan indeks ini untuk membedakan situs publik, status aktual, spesifikasi yang direncanakan, dan catatan implementasi historis.

## Public documentation

Sumber situs VitePress berada di [`site/`](site/) dan dibagi menjadi dua pintu utama:

- **User** — tutorial berbasis pembelajaran dan how-to berbasis use case.
- **Developer** — explanation untuk konsep dan keputusan, serta reference untuk kontrak teknis yang dirujuk dokumentasi user.

Jalankan `pnpm run docs:dev` untuk menulis secara lokal dan `pnpm run docs:build` untuk memvalidasi build serta tautan internal. File di luar `site/` adalah catatan engineering internal dan tidak dipublikasikan.

## Source of truth

- [Development status](development-status.md) — snapshot kesiapan engineering, fitur, dokumentasi, dan gate sebelum merge.
- [ADR-001: Use VitePress for project documentation](decisions/001-use-vitepress-for-documentation.md) — keputusan tooling dan struktur publikasi dokumentasi.
- [Role-rooted contextual activity system](ideas/role-rooted-contextual-activity-system.md) — arah produk untuk capture Daily Notes, object context yang extensible, Focus Timeline, promosi, dan historical related logs.
- [Code quality remediation](spec-code-quality-remediation.md) — rencana perbaikan kualitas setelah fondasi Developer Experience.
- [Inbox quick capture](spec-inbox-quick-capture.md) — kontrak fitur Inbox.
- [Mobile event/task modal](spec-mobile-event-task-modal.md) — kontrak modal mobile.

## Supporting notes

- [Mobile keyboard troubleshooting handover](mobile-modal-keyboard-troubleshooting-handover.md) — bukti dan konteks debugging mobile.
- [Focus Timeline implementation blueprint](may%20feature/focus-timeline-implementation-blueprint.md) — blueprint historis Timeline; bukan status implementasi terkini.

## Documentation gaps

Fondasi VitePress dan contoh awal setiap kategori sudah tersedia. Dokumentasi berikut masih harus dilengkapi sebelum release publik:

- Panduan pengguna terpisah untuk instalasi, timer/logging, Inbox, Event, Task, Timeline, target note, dan troubleshooting.
- Panduan developer untuk arsitektur, lifecycle Obsidian, persistence, format Markdown, testing, release, dan kontribusi.
- Changelog berorientasi dampak pengguna.
- Checklist acceptance desktop dan mobile yang dapat diulang.
- Catatan kompatibilitas yang membuktikan `minAppVersion`.

`README.md` di root masih menjadi pengantar proyek, tetapi tidak boleh dianggap sebagai pengganti seluruh dokumentasi pengguna dan developer.
