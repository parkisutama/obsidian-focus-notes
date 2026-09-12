# Changelog

Semua perubahan penting pada proyek ini dicatat di file ini.

Format mengikuti [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), dan
proyek ini mematuhi [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

Tag rilis Obsidian plugin **tidak memakai prefix `v`** (mis. `1.2.0`, bukan `v1.2.0`).
Ini bukan penyimpangan dari SemVer — spesifikasinya hanya mendefinisikan format nomor
versi, bukan format tag git. Alasannya spesifik ke Obsidian: `release.yml` menolak
rilis kalau tag tidak identik string dengan `manifest.json.version`, karena installer
Obsidian membaca tag rilis GitHub itu langsung sebagai nomor versi plugin. Lihat
`AGENTS.md` § Git & Release untuk detail proses rilis.

## [Unreleased]

Belum ada rilis publik untuk proyek ini (belum ada git tag/GitHub release). Riwayat
pengembangan sebelum file ini dibuat ada di
[docs/archive/dev-log.md](docs/archive/dev-log.md) sebagai catatan naratif, bukan
entri rilis.

Mulai dari commit berikutnya yang mengubah perilaku user-facing, tambahkan entri di
sini pada commit yang sama, dikelompokkan sebagai berikut sesuai kebutuhan:

### Added
### Changed
### Deprecated
### Removed
### Fixed
### Security
