---
title: Focus Notes — Current State
created: 2026-09-03T00:00
modified: 2026-09-03T00:00
tags:
  - focus-notes
  - architecture
  - reference
---

# Focus Notes — Current State

Focus Notes adalah plugin Obsidian untuk menangkap Moment, merencanakan Event dan
Task, menjalankan Focus Session, serta meninjau waktu aktual melalui Timeline.

## Status ringkas

Implementasi utama sudah terintegrasi dan artefak perencanaan selesai diarsipkan.
Markdown vault tetap menjadi sumber kebenaran; Daily dan weekly notes adalah
projection atau log terkait, bukan pemilik data canonical.

## Fitur yang tersedia

| Area | Perilaku saat ini |
| --- | --- |
| Moment | Quick capture ke Inbox, identity stabil, edit/manage, suggestion konteks |
| Event | Create/edit/manage dengan interval terencana dan Focus Session aktual |
| Task | Create/edit/manage, Timebox opsional, Focus Session langsung di owner |
| Reflection | Wellbeing dan reflection notes opsional pada semua owner yang didukung |
| Focus | Pomodoro/stopwatch, Event atau Task sebagai owner, retry idempotent |
| Timeline | Segment planned dan actual terpisah, summary diturunkan saat dibaca |
| Detail | Detail note opsional sebagai child terakhir |
| Mobile | Form dan flow terpisah dari desktop, termasuk keyboard handling |
| Formatting | Preview/apply eksplisit, conflict-safe, idempotent, tidak berjalan otomatis |
| Settings | Target capture, periodical notes, object sources, timeline, dan focus |

## Arsitektur runtime

```text
src/plugin/FocusNotesPlugin.ts
    -> features/*/ui and features/*/application
        -> features/*/domain
            -> infrastructure/obsidian/*
```

`src/main.ts` menjadi entry point tipis. Domain tidak mengimpor Obsidian atau
DOM. Adapter concrete yang menyentuh vault, metadata cache, dan App berada di
`src/infrastructure/obsidian/`. UI mobile dan desktop tidak berbagi DOM.

## Model data canonical

Event dan Task memiliki child terurut: `description`, `timebox` bila relevan,
`focus-session`, `reflection`, `reflection-notes`, lalu `detail`. Moment memiliki
identity stabil dan child reflection yang sama tanpa Timebox. Focus Session
selalu merupakan child langsung Event atau Task; overlap waktu tidak membuat
relasi Timebox.

Lihat [Flat Block Grammar](archive/specs/SPEC-flat-block-grammar.md) dan
[Focus Owner Model](archive/specs/SPEC-focus-owner-model.md) untuk kontrak lengkap.

## Legacy yang disengaja

`src/legacy/EventEditModal.ts`, `src/legacy/TaskEditModal.ts`, dan
`src/legacy/MoodPicker.ts` terbukti tidak memiliki consumer aktif, tetapi belum
dihapus karena keputusan eksplisitnya adalah mempertahankan file tersebut untuk
sesi berikutnya. Jangan menggunakannya sebagai dependency baru.

## Verifikasi

Gunakan `pnpm run check` untuk gate pengembangan. Gunakan
`pnpm run check:ci` untuk check, build, artifact verification, dan dokumentasi.
