---
title: Focus Notes
created: 2026-09-03T00:00
modified: 2026-09-03T00:00
tags:
  - obsidian
  - focus
  - flat-block
---

# Focus Notes

Focus Notes adalah plugin Obsidian untuk menangkap apa yang sedang terjadi,
merencanakan apa yang akan dilakukan, memberi jeda untuk refleksi, dan
melacak waktu fokus yang benar-benar terjadi.

Modelnya terinspirasi dari beberapa cara kerja yang sudah akrab:

- **Moment** untuk catatan cepat seperti inbox, backlog, fleeting note, dan
  quick capture.
- **Event dan Task** menggunakan flat-block yang terinspirasi dari Periodical
  Notes: Daily, Weekly, dan Bullet Journal.
- **Reflection Notes** terinspirasi dari CBT dan Interstitial Journaling,
  yaitu jeda berpikir singkat yang proaktif di sekitar Moment, Event, dan Task.
- **Object Notes** terinspirasi dari Capacities untuk menyebut People, Project,
  dan Book pada setiap capture atau reflection.
- **Focus Session** melacak waktu aktual pada Event dan Task.
- **Timebox** menyimpan rencana waktu, sedangkan Focus Session menyimpan waktu
  aktual yang benar-benar digunakan.

## Cara berpikir tentang Focus Notes

```text
capture cepat -> Moment
sesuatu yang dijadwalkan -> Event atau Task
rencana durasi -> Timebox
waktu yang benar-benar fokus -> Focus Session
jeda berpikir -> Reflection Notes
konteks yang dirujuk -> People, Project, atau Book
```

## Apa itu flat-block?

Flat-block adalah format Markdown berbasis baris dan indentasi. Satu bullet
utama menjadi satu owner, lalu child bullet langsung di bawahnya menyimpan
informasi tambahan yang dimiliki owner tersebut.

Format ini sengaja tetap mudah dibaca sebagai Markdown biasa, tetapi juga
deterministik untuk dibaca plugin atau diekstrak menjadi tabel. Empat spasi
menunjukkan satu tingkat kepemilikan.

Setiap block penting memiliki **block ID** yang stabil di akhir baris, misalnya
`^task-abc123`. Block ID membuat record dapat ditemukan, diedit, dirujuk, dan
di-update tanpa bergantung pada judulnya.

### Contoh Moment

Moment adalah capture cepat. Moment dapat memiliki description, reflection, dan
reflection notes.

```markdown
- Menanyakan ide buku baru ^moment-a1b2c3
    - description: Catatan cepat sebelum ide ini hilang.
    - reflection: stress:normal | emotion:pleasant | mood:curious
    - reflection-notes: Saya ingin meninjau ide ini setelah sesi fokus.
```

### Contoh Event

Event memiliki interval terencana dan dapat memiliki Focus Session aktual.

```markdown
- Review roadmap Q4 | start:2026-09-03 10:00 | end:2026-09-03 11:30 ^event-d4e5f6
    - description: Menyelaraskan prioritas dengan tim.
    - focus-session: start:2026-09-03 10:08 | end:2026-09-03 10:52 | duration:44m | mode:pomodoro ^focus-d4e5f6-s1
        - reflection: stress:normal | emotion:pleasant | mood:focused
        - reflection-notes: Bagian risiko lebih jelas setelah ditulis.
    - reflection: stress:normal | emotion:pleasant | mood:satisfied
    - reflection-notes: Perlu mengirim rangkuman sebelum makan siang.
```

### Contoh Task dan Timebox

Task menggunakan checkbox Markdown. Timebox adalah rencana; beberapa Timebox
dapat hidup berdampingan dengan beberapa Focus Session.

```markdown
- [ ] Menulis proposal Project Atlas | priority:high | due:2026-09-05 17:00 ^task-g7h8i9
    - description: Menyusun masalah, opsi solusi, dan keputusan yang dibutuhkan.
    - timebox: start:2026-09-03 13:00 | end:2026-09-03 14:00 | status:planned ^timebox-g7h8i9-a1
    - focus-session: start:2026-09-03 13:07 | end:2026-09-03 13:32 | duration:25m | mode:pomodoro ^focus-g7h8i9-s1
    - reflection: stress:normal | emotion:pleasant | mood:productive
    - reflection-notes: Draft pertama sudah cukup untuk dibahas.
    - detail: [Proposal Project Atlas](Details/Proposal%20Project%20Atlas.md)
```

Timebox dan Focus Session adalah **sibling**, bukan parent-child. Focus Session
tidak dianggap milik Timebox hanya karena waktunya beririsan.

### Contoh Object Notes

People, Project, dan Book dapat disebut dari description atau reflection notes
menggunakan link Markdown biasa.

```markdown
- Membahas Project Atlas dengan [Rina](People/Rina.md) ^moment-j1k2l3
    - description: Membawa insight dari [Inspired](Books/Inspired.md).
    - reflection-notes: Rina membantu memperjelas keputusan berikutnya.
```

Object Notes memberi konteks yang dapat dipakai ulang tanpa mengubah Moment,
Event, Task, atau Reflection menjadi object yang sama.

## Aturan penting flat-block

- `description:` menyimpan teks bebas pada satu baris fisik.
- `timebox:` menyimpan rencana `start`, `end`, dan `status`.
- `focus-session:` menyimpan waktu aktual `start`, `end`, `duration`, dan
  `mode`.
- `reflection:` menyimpan wellbeing terstruktur.
- `reflection-notes:` menyimpan catatan refleksi bebas.
- `detail:` adalah child opsional terakhir.
- Field yang dihapus tidak meninggalkan baris kosong.
- Block ID dipertahankan saat edit atau formatting.
- Unknown children tetap dipertahankan saat perubahan yang tidak terkait.
- Formatter hanya berjalan melalui preview/apply eksplisit; tidak ada migrasi
  vault diam-diam saat startup.

## Mulai menggunakan repository

Prasyarat: Node.js 24 dan pnpm 11.

```powershell
pnpm install
pnpm run check
pnpm run build
```

Perintah penting:

| Perintah | Kegunaan |
| --- | --- |
| `pnpm run dev` | Watch build TypeScript |
| `pnpm run dev:vault` | Watch build dan copy ke vault |
| `pnpm run check` | Format, lint, version, typecheck, dan test |
| `pnpm run check:ci` | Check lengkap, build, artifact, dan docs |
| `pnpm run docs:dev` | Menjalankan dokumentasi VitePress |
| `pnpm run package:plugin` | Membuat zip distribusi |

## Dokumentasi lanjutan

- [Current State](docs/current-state.md) — fitur dan arsitektur saat ini.
- [Usage Workflow](docs/usage-workflow.md) — alur penggunaan plugin.
- [Capability Map](docs/reference/CAPABILITY-MAP-capture-focus-reflection.md)
  — hubungan antar capability.
- [Architecture Baseline](docs/reference/code-architecture-baseline.md)
  — ownership source dan arah dependency.
- [Documentation index](docs/README.md) — dokumentasi aktif dan arsip.
- [Archive](docs/archive/README.md) — plan, spec, audit, handover, dan
  acceptance record historis.

## Struktur source

```text
src/
  plugin/                    lifecycle dan composition plugin
  features/                  domain, application, dan UI per capability
  infrastructure/obsidian/  adapter vault dan persistence
  shared/                    primitive lintas feature
  legacy/                    source lama yang dikarantina
```

Markdown vault adalah sumber kebenaran canonical. Domain tidak mengimpor
Obsidian atau DOM, dan production tidak mengimpor `legacy`.

## Lisensi

MIT
