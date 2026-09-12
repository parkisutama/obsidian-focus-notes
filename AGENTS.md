# AGENTS.md

## Read this first
1. `docs/development-status.md` — posisi & kesiapan rilis proyek saat ini
2. `docs/current-state.md` — fitur dan model data yang berjalan hari ini
3. `docs/reference/code-architecture-baseline.md` — dependency direction & layer rules
4. `docs/reference/decisions/` — ADR, keputusan arsitektur yang masih berlaku
5. `test/architecture-boundaries.test.ts` — batas layer yang ditegakkan otomatis di CI,
   bukan sekadar dokumen

## Structure
- `src/plugin/` — komposisi Obsidian Plugin. `src/main.ts` adalah satu-satunya root module.
- `src/features/<capability>/{domain,application,ui}` — logic per fitur. `domain/` tidak
  boleh mengimpor Obsidian atau outer layer (`ui`, `infrastructure`, `plugin`).
- `src/infrastructure/obsidian/` — adapter konkret ke `App`/`Vault`/`MetadataCache`.
- `src/shared/` — primitif lintas fitur; tidak boleh mengimpor `features/`.
- `src/legacy/` — UI yang sudah tidak punya consumer, dikarantina, TIDAK dihapus.
- `test/` — flat, satu file per unit perilaku (bukan mirror path `src/`). Konvensi saat
  ini: nama deskriptif per perilaku, mis. `task-timebox-migration.test.ts`.
- `docs/current-state.md` — apa yang sudah jalan (fitur, model data, batas legacy).
- `docs/development-status.md` — snapshot kesiapan engineering/fitur/dokumentasi/gate.
- `CHANGELOG.md` (root) — format Keep a Changelog, sumber kebenaran rilis. Lihat
  § Git & Release.
- `docs/archive/dev-log.md` — catatan naratif pengembangan sebelum adopsi Keep a
  Changelog. Historis, bukan sumber kebenaran rilis, tidak ditambah lagi.
- `docs/reference/decisions/` — ADR, incremental, append-only. Keputusan usang ditandai
  "Superseded by ADR-XXX", tidak dihapus.
- `docs/reference/code-architecture-baseline.md` — dependency direction, entry point,
  compatibility identifier.
- `docs/reference/CAPABILITY-MAP-*.md` — peta modul dan dependency antar kapabilitas.
- `docs/archive/{specs,tasks,ideas,acceptance,audits,handovers}/` — artefak yang sudah
  selesai, dipindah manual dari spec/plan/todo aktif setelah fitur shipped.
- `docs/site/` — source VitePress untuk situs publik (`pnpm run docs:dev`/`docs:build`).
  Diorganisasi per **persona** sebagai folder fisik (`user/`, `developer/`); tipe
  **Diataxis** (`tutorial`/`how-to`/`reference`/`explanation`) dicatat lewat frontmatter
  `diataxis:` di tiap halaman, BUKAN sebagai subfolder — kecuali `reference/`, yang
  tetap satu folder tunggal karena sifatnya cross-cutting/lookup, bukan naratif per
  domain. Detail lihat `docs/site/developer/documentation-model.md`.
- `scripts/` — `version-bump.mjs` (dipanggil lewat `pnpm version`, jangan dieksekusi
  langsung), `verify-version-metadata.mjs`, `verify-build-artifacts.mjs`,
  `package-plugin.mjs`.
- `commitlint.config.mjs`, `.husky/commit-msg` — penegakan otomatis Conventional
  Commits di commit-msg hook lokal dan di CI (`quality.yml` job `commitlint`) untuk
  setiap commit pada pull request.

## Commands
```
pnpm run dev             # esbuild watch
pnpm run dev:vault       # watch + copy ke OBSIDIAN_VAULT_PLUGIN_PATH
pnpm run lint            # biome lint --error-on-warnings
pnpm run format          # biome format --write
pnpm run typecheck       # tsc --noEmit
pnpm run test            # node --test
pnpm run test:coverage
pnpm run check           # format:check + lint + verify:version + typecheck + test
pnpm run check:ci        # check + build + verify:artifacts + docs:build (gate CI penuh)
pnpm run docs:dev        # preview docs lokal
```

## Workflow order — jangan lompat fase
1. Kalau permintaan berasal dari kebutuhan pengguna/produk baru -> mulai dari skill PM
   (problem-statement / jobs-to-be-done / prd-development).
2. Kalau requirement teknis masih underspecified (siapa, kenapa, definisi sukses,
   constraint belum jelas) -> `interview-me` dulu. JANGAN mengasumsikan sendiri lalu
   langsung menulis spec.
3. Begitu diskusi (skill PM dan/atau `interview-me`) selesai dan intent sudah dikonfirmasi
   eksplisit oleh manusia -> SEBELUM menulis artefak perencanaan pertama (ADR atau spec),
   buat branch baru dulu (`feature/`, `fix/`, `chore/`, `refactor/` per § Git & Release).
   Semua file ADR/spec/plan/todo untuk fitur tersebut dibuat dan dikembangkan di branch
   itu, bukan di `main`. Kalau artefak sudah terlanjur ditulis di `main` sebelum branch
   dibuat, pindahkan (branch baru dari posisi saat ini; jangan commit dulu di `main`)
   begitu pelanggaran ini disadari.
4. `spec-driven-development`: SPECIFY -> PLAN -> TASKS -> IMPLEMENT. Ikuti pola historis
   di `docs/archive/specs/` dan `docs/archive/tasks/` untuk format spec/plan/todo. Tidak
   lanjut fase berikutnya tanpa validasi eksplisit dari manusia di fase sebelumnya.
5. `planning-and-task-breakdown`: urai jadi vertical slice, bukan horizontal layer.
   Checkpoint verifikasi tiap 2-3 task lewat `pnpm run check`.
6. `incremental-implementation`: tiap slice -> Implement -> Test -> `pnpm run check` ->
   Commit -> slice berikutnya.
7. Kalau perubahan menyentuh dependency direction, API publik Obsidian (command id,
   view type, compatibility identifier), atau behavior user-facing yang mengubah format
   Markdown di vault -> `documentation-and-adrs`: tulis ADR baru di
   `docs/reference/decisions/` (format lihat ADR-001) SEBELUM implementasi.
8. Setelah implementasi selesai -> update `docs/current-state.md` dan
   `docs/reference/code-architecture-baseline.md` yang relevan. Tidak ada mekanisme
   otomatis untuk ini — wajib manual.

## Before changing, removing, or refactoring existing behavior
1. Baca `docs/reference/code-architecture-baseline.md` dan ADR terkait dulu — pahami
   KENAPA kode itu ada sebelum mengubahnya.
2. Jangan langgar layer rule (`test/architecture-boundaries.test.ts` akan gagal di CI):
   domain tidak boleh impor Obsidian/outer layer, `shared` tidak boleh impor `features`,
   production tidak boleh impor `legacy`, source graph harus acyclic.
3. ADR yang jadi tidak berlaku ditandai "Superseded by ADR-XXX", TIDAK dihapus/ditimpa.
4. Update `docs/current-state.md` setelah selesai.

## After shipping a feature
- Pindahkan spec/plan/todo yang selesai ke `docs/archive/{specs,tasks,ideas}/` (manual —
  belum ada `archive-task.sh`; ini kandidat automation kalau volume kerja naik).
- Tambahkan entri baru di `CHANGELOG.md` § `[Unreleased]` (grouped
  Added/Changed/Fixed/Deprecated/Removed/Security per Keep a Changelog), ditulis
  manual di commit yang sama dengan perubahan user-facing — bukan salinan mentah pesan
  commit teknis. Perubahan internal murni (refactor tanpa dampak user-facing) TIDAK
  perlu entri changelog.
- Update snapshot `docs/development-status.md`.

## Git & Release
- Commit: [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0-beta.4/)
  berskop, ditegakkan otomatis oleh `commitlint` di commit-msg hook lokal
  (`.husky/commit-msg`, aktif otomatis setelah `pnpm install` lewat script `prepare`)
  dan di CI (`quality.yml` job `commitlint`, jalan di setiap commit pull request).
  Contoh nyata dari riwayat repo ini: `feat(mobile): ...`, `fix(timer): ...`,
  `chore(deps): ...`, `docs: ...`, `refactor: ...`. Tipe mengikuti
  `@commitlint/config-conventional` (`feat`, `fix`, `docs`, `style`, `refactor`,
  `perf`, `test`, `build`, `ci`, `chore`, `revert`); scope bebas, tidak di-enum.
- Atomic commit: satu commit = satu perubahan logis. Conventional Commits menegakkan
  format pesan, bukan ukuran commit — pemisahan tetap tanggung jawab penulis commit.
- Branch: `feature/`, `fix/`, `chore/`, `refactor/` — pendek umur, trunk-based ke `main`.
- Versi mengikuti [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html) TAPI TIDAK
  otomatis dari commit message (beda dari semantic-release). Jalankan
  `pnpm version patch|minor|major` — ini memicu `scripts/version-bump.mjs` yang
  mensinkronkan `manifest.json` dan `versions.json`, lalu men-stage keduanya. JANGAN
  edit `manifest.json`/`versions.json` manual dan JANGAN jalankan `version-bump.mjs`
  langsung (butuh `npm_package_version` dari lifecycle `pnpm version`).
- `pnpm run check` menjalankan `verify:version` (`scripts/verify-version-metadata.mjs`)
  sebagai gate wajib: `package.json`, `manifest.json`, `versions.json` harus konsisten
  dan semver tanpa prefix `v`.
- Prefix `v` pada tag SENGAJA tidak dipakai — ini spesifik ke Obsidian, bukan
  penyimpangan dari SemVer (SemVer hanya mendefinisikan format nomor versi, bukan tag
  git). Obsidian membaca tag rilis GitHub langsung sebagai nomor versi plugin.
- Rilis dipicu manual dengan push git tag yang persis sama dengan `manifest.json`
  version (tanpa prefix `v`) — `.github/workflows/release.yml` menolak run kalau tag
  tidak cocok. Urutan: bump version -> commit -> `git tag` -> push commit -> push tag.
- CHANGELOG: `CHANGELOG.md` di root, format [Keep a Changelog
  1.1.0](https://keepachangelog.com/en/1.1.0/). Kerja berjalan menumpuk di
  `[Unreleased]`; saat rilis, ganti header `[Unreleased]` jadi `[x.y.z] - YYYY-MM-DD`
  yang sama dengan tag, lalu buka `[Unreleased]` baru yang kosong untuk siklus
  berikutnya. Tidak ada script freeze — lakukan manual di commit yang sama dengan
  `pnpm version`. Riwayat sebelum adopsi ini ada di `docs/archive/dev-log.md`
  (naratif, bukan per-versi, tidak ditambah lagi).

## Logging & error handling
- Tidak ada logger terstruktur (bukan structlog). Pakai `console.info/warn/error`
  dengan prefix tag konsisten seperti `"[Focus Notes]"` atau `"[Focus Timeline]"`.
- `console.*` HANYA di boundary layer (`plugin/`, `infrastructure/`, `ui/`). Domain
  harus tetap bebas dari `console` — jaga manual, saat ini tidak ada test yang
  meng-grep ini secara otomatis.
- Tidak ada `AppError` hierarchy. Pola yang dipakai: jalur expected-failure
  mengembalikan result/summary object (contoh: `ProjectionReconciliationSummary` di
  `FocusNotesPlugin.ts`), bukan `throw`. Error tak terduga di-catch di boundary,
  ditampilkan ke pengguna lewat `new Notice(...)`, dan dicatat lewat
  `console.error` untuk developer. Jangan panggil `Notice()` dari `domain`/
  `application`; jangan biarkan `throw` sampai ke UI tanpa `Notice`.

## Obsidian plugin constraints (non-negotiable)
- Tidak ada `innerHTML`/`outerHTML`/`eval`/`new Function`/`fetch`/`require('fs')` di
  `src/` — dipertahankan sengaja untuk lolos review keamanan Obsidian. Untuk network,
  pakai `requestUrl` dari API Obsidian, bukan `fetch`.
- `App` selalu diterima sebagai parameter eksplisit (`app: App`), jangan pakai global
  `window.app`.
- Style dinamis (posisi/ukuran di Timeline, dsb.) boleh lewat `element.style.*`, tapi
  warna/tema HARUS pakai CSS variable Obsidian (`var(--...)`) di `styles.css`, bukan
  hex hardcoded.
- Command id/name dan ribbon label: sentence case, bukan Title Case.
- `minAppVersion` dan version di `manifest.json` hanya lewat `pnpm version` (lihat
  § Git & Release) — `verify:version` menolak drift.

## Testing
- `node:test` + `node:assert`, dijalankan via `node --test` (bukan Vitest/Jest).
- `test/architecture-boundaries.test.ts` adalah gate arsitektur otomatis dan wajib
  tetap hijau: domain dilarang impor `obsidian` atau outer layer, `shared` dilarang
  impor `features`, production dilarang impor `legacy`, seluruh source graph harus
  acyclic.
- Assert pada struktur/nilai eksplisit, konsisten dengan pola existing test (lihat
  `test/canonical-focus-session-writer.test.ts` untuk contoh golden-file style).
