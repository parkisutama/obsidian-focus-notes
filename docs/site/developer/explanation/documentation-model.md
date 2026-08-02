# Model dokumentasi

Dokumentasi Focus Notes memisahkan kebutuhan belajar dari kebutuhan mencari fakta.

## Jalur user

Dokumentasi user dimulai dari use case:

- **Tutorial** mengajarkan sebuah alur secara berurutan dan menghasilkan sesuatu yang dapat diperiksa.
- **How-to** menyelesaikan satu masalah spesifik tanpa harus menjelaskan seluruh sistem.

Bahasa dan navigasinya mengikuti pekerjaan pengguna, bukan nama class atau file source.

## Jalur developer

Dokumentasi developer menjadi fondasi bagi jalur user:

- **Explanation** menjelaskan mengapa arsitektur, state, atau perilaku dipilih.
- **Reference** menyatakan kontrak aktual seperti format data, target resolution, API, settings, dan command.

Tutorial atau how-to boleh menautkan reference developer ketika detail teknis membantu verifikasi, tetapi panduan user harus tetap dapat diikuti tanpa membaca kode.

## Hubungan antarhalaman

```text
Use case pengguna
    ├── Tutorial: belajar alur lengkap
    └── How-to: menyelesaikan kebutuhan khusus
              ↓ bila butuh detail
Developer explanation: memahami alasan
Developer reference: memeriksa kontrak aktual
```

## Batas source publik

Konten situs berada di `docs/site`. Spec, ADR, audit, dan development status berada di luar direktori tersebut agar tidak dipublikasikan sebagai dokumentasi produk. VitePress memakai `docs` sebagai project root dan `docs/site` sebagai `srcDir`.
