---
title: Focus Notes — Usage Workflow
created: 2026-09-03T00:00
modified: 2026-09-03T00:00
tags:
  - focus-notes
  - workflow
  - user-guide
---

# Focus Notes — Usage Workflow

## Menangkap Moment

1. Jalankan command capture atau buka form capture.
2. Tulis isi Moment pada field utama.
3. Tambahkan object/context link, wellbeing, dan reflection notes bila perlu.
4. Simpan ke target Inbox yang aktif.
5. Edit atau manage Moment melalui identity canonical yang dibuat saat capture.

## Membuat Event atau Task

1. Buka command create Event/Task.
2. Isi title, waktu atau Timebox, description, reflection, dan detail opsional.
3. Simpan melalui form desktop atau mobile yang sesuai.
4. Untuk Task, Timebox hanya rencana; field ini tidak wajib untuk memulai Focus.

## Menjalankan Focus Session

1. Pilih Event atau Task canonical sebagai owner.
2. Pilih mode Pomodoro atau stopwatch dan mulai timer.
3. Saat berhenti, isi wellbeing/reflection opsional.
4. Plugin menambahkan satu `focus-session:` di bawah owner terpilih.
5. Daily/weekly log menerima reference terkait, sementara owner tetap berada di
   ledger canonical.

## Membaca Timeline

Timebox tampil sebagai planned segment dan Focus Session sebagai actual segment.
Keduanya memakai warna owner yang sama tetapi style berbeda. Klik segment untuk
membuka owner modal dan melihat total planned, focused, difference, serta detail
segment terpilih.

## Memformat data lama

Gunakan Manage/Format untuk melihat preview, lalu apply hanya pada record yang
dipilih. Formatter mempertahankan stable ID, menjaga unknown children, aman
terhadap konflik, dan idempotent. Formatter tidak berjalan saat startup dan
tidak melakukan bulk migration diam-diam.

## Troubleshooting singkat

- Jika Focus tidak dapat dimulai, pastikan Event/Task canonical dapat di-resolve.
- Jika keyboard menutupi field di mobile, gunakan flow mobile dan cek kembali
  viewport setelah modal dibuka.
- Jika format tampak lama, lakukan preview formatter dan periksa diff sebelum
  apply.
- Jika perubahan tidak tersimpan, jalankan ulang check dan periksa konflik vault.
