---
diataxis: explanation
---

# Model dokumentasi

Dokumentasi Focus Notes memisahkan kebutuhan belajar dari kebutuhan mencari fakta,
mengikuti [Diataxis](https://diataxis.fr/). Pemisahan ini bekerja lewat dua sumbu
independen: **persona** (folder fisik) dan **tipe Diataxis** (frontmatter).

## Sumbu 1: persona — folder fisik

Satu-satunya split folder yang dipaksakan adalah persona, karena itu yang menentukan
bahasa dan kedalaman teknis sebuah halaman:

- `user/` — bahasa dan navigasi mengikuti pekerjaan pengguna di Obsidian, bukan nama
  class atau file source.
- `developer/` — fondasi bagi jalur user: kontrak aktual, alasan desain, dependency.

## Sumbu 2: tipe Diataxis — frontmatter, bukan folder

Tipe Diataxis (`tutorial`, `how-to`, `reference`, `explanation`) dicatat lewat
frontmatter `diataxis:` di setiap halaman, bukan lewat subfolder terpisah:

```md
---
diataxis: how-to
---
```

Alasannya: dokumen domain (mis. "Inbox quick capture", "Focus Timeline") sering butuh
lebih dari satu tipe Diataxis sekaligus seiring bertambah matang, dan memaksa folder
per tipe akan memecah topik yang sama ke banyak direktori alih-alih menjaga topik tetap
menyatu. Nama file mengikuti domain/topik (`capture-to-inbox.md`,
`align-capture-with-timeline.md`), bukan diprefix tipe.

**Pengecualian: `reference/` tetap folder tunggal.** Reference bersifat cross-cutting —
dicari (looked up), bukan dibaca naratif per topik — sehingga `developer/reference/`
tetap satu folder berisi semua kontrak teknis (lihat
[peta fitur](reference/feature-map.md)), alih-alih tersebar mengikuti domain.

## Definisi tiap tipe

- **Tutorial** (`user/`) — mengajarkan sebuah alur secara berurutan dan menghasilkan
  sesuatu yang dapat diperiksa.
- **How-to** (`user/`) — menyelesaikan satu masalah spesifik tanpa harus menjelaskan
  seluruh sistem.
- **Explanation** (`developer/`) — menjelaskan mengapa arsitektur, state, atau perilaku
  dipilih.
- **Reference** (`developer/reference/`) — menyatakan kontrak aktual seperti format
  data, target resolution, API, settings, dan command.

Tutorial atau how-to boleh menautkan reference developer ketika detail teknis membantu
verifikasi, tetapi panduan user harus tetap dapat diikuti tanpa membaca kode.

## Hubungan antarhalaman

```text
Use case pengguna (user/, diataxis: tutorial | how-to)
    ↓ bila butuh detail
Developer explanation (developer/, diataxis: explanation)
Developer reference (developer/reference/, diataxis: reference)
```

## Batas source publik

Konten situs berada di `docs/site`. Spec, ADR, audit, dan development status berada di
luar direktori tersebut agar tidak dipublikasikan sebagai dokumentasi produk. VitePress
memakai `docs` sebagai project root dan `docs/site` sebagai `srcDir`.
