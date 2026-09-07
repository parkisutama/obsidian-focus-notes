# 1. INVENTORI DASAR

Audit ini hanya mencakup checkout repository `obsidian-focus-notes` yang aktif pada 15 Agustus 2026. Data lokal berasal dari file yang tercatat di repository; informasi “terbaru” diverifikasi terhadap npm dan repository resmi Obsidian pada tanggal audit.

## Identitas dan versi

| Item | Nilai | Status |
| --- | --- | --- |
| Nama tampilan plugin (`manifest.json`) | `Focus Notes` | — |
| ID plugin (`manifest.json`) | `focus-notes` | — |
| Nama package (`package.json`) | `obsidian-focus-notes` | Wajar berbeda: ini nama package/tooling, bukan ID plugin |
| Versi manifest | `1.2.0` | Sinkron |
| Versi package | `1.2.0` | Sinkron |
| Pemetaan `versions.json` | `1.2.0` → minimum Obsidian `1.4.0` | Sinkron dengan manifest |
| `isDesktopOnly` | `false` | Plugin menyatakan dukungan desktop dan mobile |

Sinkronisasi tiga metadata versi dijaga oleh `scripts/verify-version-metadata.mjs` dan dipanggil oleh quality gate. Namun repository tidak memiliki script npm bernama `version` untuk melakukan bump; sinkronisasi saat ini bersifat verifikasi, bukan otomasi perubahan versi.

## Minimum Obsidian versus package API

- `manifest.json.minAppVersion` adalah `1.4.0`.
- Dev dependency `obsidian` adalah exact `1.12.3`.
- Versi `latest` package `obsidian` di npm saat audit adalah `1.13.1` ([npm](https://www.npmjs.com/package/obsidian?activeTab=versions)). Jadi dependency typings lokal tertinggal dua rilis minor (`1.12.3` → `1.13.1`).
- `minAppVersion` dan versi package `obsidian` **tidak perlu sama**: yang pertama adalah minimum runtime yang dijanjikan kepada pengguna, sedangkan yang kedua adalah deklarasi TypeScript API untuk development. Gap yang lebar berarti code review dan pengujian harus memastikan source tidak memakai API yang baru muncul setelah Obsidian 1.4.0. Typecheck terhadap 1.12.3 saja tidak membuktikan kompatibilitas runtime 1.4.0.

## Dependencies utama

Repository tidak memiliki `dependencies` produksi; seluruh dependency berada di `devDependencies`, dan bundle mengecualikan modul Obsidian/Electron/CodeMirror/Lezer serta built-in Node.

| Dependency | Deklarasi | Resolusi lockfile | Fungsi |
| --- | --- | --- | --- |
| `obsidian` | `1.12.3` | `1.12.3` | Type declarations/API plugin |
| `esbuild` | `0.28.1` | `0.28.1` | Bundler |
| `typescript` | `^5.3.0` | `5.9.3` | Typecheck/kompilasi |
| `@biomejs/biome` | `2.5.6` | `2.5.6` | Lint dan format |
| `@types/node` | `^20.0.0` | `20.19.41` | Type declarations Node |
| `builtin-modules` | `^3.3.0` | `3.3.0` | Daftar external built-in saat bundling |
| `tslib` | `^2.6.0` | `2.8.1` | TypeScript runtime helpers |
| `vitepress` | `1.6.4` | `1.6.4` | Dokumentasi |

# 2. TOOLCHAIN

## Package manager

- Lockfile tunggal yang ada adalah `pnpm-lock.yaml` dengan `lockfileVersion: '9.0'`; tidak ada `package-lock.json` atau `yarn.lock`. Package manager repository adalah pnpm.
- `package.json.packageManager` mem-pin `pnpm@11.5.2`; CI mengaktifkannya melalui Corepack dan memasang dependency dengan `pnpm install --frozen-lockfile`.
- Versi pnpm 11 terbaru saat audit adalah `11.21.0` ([npm registry](https://registry.npmjs.org/pnpm/latest)). Repository sudah berada pada major standar yang diminta, tetapi tertinggal minor/patch.

## Target Node

Target Node konsisten:

- `.node-version`: `24`
- `package.json.engines.node`: `>=24 <25`
- `.github/workflows/quality.yml`: Node `24`
- `.github/workflows/release.yml`: Node `24.x`

Node 24 telah berstatus LTS dan menerima dukungan sampai akhir April 2028 ([Node.js](https://nodejs.org/en/blog/release/v24.11.0)). Dengan demikian repository sudah memenuhi baseline Node 24 LTS. Satu ketidaksejajaran tersisa: `@types/node` masih major 20, sehingga typecheck tidak sepenuhnya merepresentasikan runtime CI Node 24.

## Linter dan formatter

- Tool tunggal adalah Biome `2.5.6`, exact-pinned di package dan lockfile; tidak ditemukan konfigurasi ESLint atau Prettier.
- `biome.json` menunjuk schema `2.5.6`, memakai recommended lint rules, spasi 4, lebar baris 120, double quote, dan semicolon.
- Cakupan Biome adalah JS/MJS/TS/JSON/JSONC. Markdown, CSS, dan YAML tidak tercakup; `main.js`, `node_modules`, `.vscode`, serta cache/output VitePress dikecualikan.
- Baseline Biome 2.5 yang diminta sudah terpenuhi. Dibanding template resmi Obsidian, repository sengaja memakai Biome alih-alih ESLint 9 plus `eslint-plugin-obsidianmd`; konsekuensinya aturan khusus Obsidian dari plugin ESLint resmi tidak dijalankan.

## Perbandingan `esbuild.config.mjs` dengan template resmi

Template pembanding adalah `master` dari [`obsidianmd/obsidian-sample-plugin`](https://github.com/obsidianmd/obsidian-sample-plugin), dibaca pada tanggal audit ([konfigurasi esbuild resmi](https://raw.githubusercontent.com/obsidianmd/obsidian-sample-plugin/master/esbuild.config.mjs)).

Kesamaan inti:

- Entry `src/main.ts`, output `main.js`, bundle CommonJS.
- Daftar external Obsidian, Electron, CodeMirror, Lezer, dan built-in Node.
- Inline sourcemap saat development, minification tanpa sourcemap saat production.
- `treeShaking`, esbuild context, rebuild production, dan watch development mengikuti pola template.

Penyimpangan:

| Area | Repository ini | Template resmi | Dampak |
| --- | --- | --- | --- |
| JavaScript target | `es2018` | `es2021` | Lebih konservatif untuk runtime lama, tetapi menjauh dari baseline template dan dapat menghasilkan transform lebih banyak |
| Daftar built-in | Package `builtin-modules` | `builtinModules` dari `node:module` | Dependency pihak ketiga tambahan yang tidak lagi diperlukan pada Node modern |
| Banner | Satu baris “Auto-generated bundle” | Banner multi-baris dengan rujukan source repository | Kosmetik |
| Deployment lokal | Plugin custom membaca `.env` dan menyalin tiga artifact ke `OBSIDIAN_VAULT_PLUGIN_PATH` setiap build berhasil | Tidak ada | Berguna untuk loop development, tetapi membuat build berpotensi menulis ke vault bila env terisi |
| Parser `.env` | Implementasi parser minimal di file build | Tidak ada | Tidak mendukung seluruh semantik dotenv (misalnya escape/komentar inline); cukup hanya untuk key-value sederhana yang didokumentasikan |
| Lifecycle production | `ctx.rebuild()` lalu `process.exit(0)` | Sama | Selaras |

Catatan penting: menaikkan target ke `es2021` hanya demi menyamai template berpotensi bertentangan dengan klaim `minAppVersion: 1.4.0`, karena runtime Electron/mobile yang lebih tua belum dibuktikan mendukung seluruh output ES2021. Perubahan itu memerlukan uji desktop dan mobile pada runtime minimum yang benar-benar hendak didukung.

# 3. DEVELOPER EXPERIENCE

## Hot reload dan deployment ke vault

Ada deployment lokal berbasis copy, bukan symlink:

- `pnpm run dev` menjalankan esbuild watch.
- Setelah build sukses, plugin `copy-to-vault` menyalin `manifest.json`, `main.js`, dan `styles.css` ke path dari `OBSIDIAN_VAULT_PLUGIN_PATH`.
- Bila env tidak diisi, copy dilewati. Directory target dibuat bila belum ada.

Tidak ditemukan symlink setup, file `.hotreload`, dependency/plugin “Hot Reload”, atau otomasi yang memerintahkan Obsidian me-reload plugin. Jadi perubahan TypeScript dibundle dan dicopy otomatis, tetapi reload runtime Obsidian tetap memerlukan mekanisme eksternal/manual. Perubahan `styles.css` atau `manifest.json` sendiri juga tidak menjadi watch input esbuild; keduanya baru tercopy ketika rebuild source dipicu.

## Scripts `package.json`

| Script | Peran |
| --- | --- |
| `dev` | esbuild watch; optional copy ke vault |
| `build` | typecheck lalu production bundle |
| `lint` | Biome lint, warning dianggap error |
| `format` / `format:check` | Tulis/periksa format Biome |
| `typecheck` | TypeScript tanpa emit |
| `test` / `test:coverage` | Native Node test runner dan coverage eksperimental |
| `verify:version` | Cek konsistensi package/manifest/versions |
| `verify:artifacts` | Pastikan tiga artifact release ada dan tidak kosong |
| `package:plugin` | Membuat zip distribusi |
| `check` / `check:ci` | Quality gate lokal dan gate lengkap termasuk build/artifact/docs |
| `docs:dev` / `docs:build` / `docs:preview` | Workflow VitePress |

Tidak ada script `version`. Ini berbeda dari template resmi, yang memiliki `version-bump.mjs` dan script `version` untuk memperbarui `manifest.json`/`versions.json` lalu men-stage hasilnya ([package template resmi](https://raw.githubusercontent.com/obsidianmd/obsidian-sample-plugin/master/package.json)).

## GitHub Actions

- `.github/workflows/quality.yml` berjalan pada pull request dan push ke `main`: install frozen, `check:ci`, coverage, dan `pnpm audit --audit-level moderate`.
- `.github/workflows/release.yml` berjalan pada tag SemVer tanpa prefix `v`: memvalidasi tag terhadap manifest, menjalankan gate lengkap, membuat zip, lalu membuat/memperbarui GitHub Release.
- Release workflow repository memakai `actions/checkout@v4` dan `actions/setup-node@v4`, sedangkan quality workflow sudah `checkout@v6`/`setup-node@v7`. Template resmi saat audit memakai checkout v6, setup-node v6, dan build provenance attestation sebelum draft release ([workflow resmi](https://raw.githubusercontent.com/obsidianmd/obsidian-sample-plugin/master/.github/workflows/release.yml)). Repository ini belum membuat provenance attestation dan release-nya langsung latest, bukan draft.

## Test suite

- Ada 51 file `test/*.test.ts` dengan native `node --test`.
- Coverage dapat dijalankan dengan `node --test --experimental-test-coverage`, mencakup modul `src/**/*.ts` yang dimuat test.
- Test dan quality gate otomatis bukan bukti penerimaan runtime Obsidian. README secara eksplisit menyatakan integrasi UI masih memerlukan validasi manual desktop/mobile.

# 4. TEMUAN & REKOMENDASI

## Gap terhadap baseline terkini

| Baseline | Kondisi repo | Gap |
| --- | --- | --- |
| Node 24 LTS | `.node-version`, engines, quality CI, dan release CI menarget Node 24 | Tidak ada gap runtime; update `@types/node` 20 → 24 |
| pnpm 11 | Exact pin `11.5.2`; latest yang diverifikasi `11.21.0` | Major sesuai, minor/patch tertinggal |
| Biome 2.5 | Exact pin dan schema `2.5.6` | Tidak ada gap versi; coverage file tidak mencakup Markdown/CSS/YAML dan tidak ada lint rule khusus Obsidian |
| Obsidian API typings | `1.12.3`; npm latest `1.13.1` | Tertinggal; kompatibilitas minimum 1.4.0 belum dibuktikan oleh typecheck |
| Template build resmi | Inti selaras, tetapi target ES2018, package `builtin-modules`, dan custom copy-to-vault | Penyimpangan sebagian memang disengaja; perlu dirawat dan diuji |
| Release supply chain | Release otomatis tersedia | Action release lama/tidak konsisten dan belum ada provenance attestation |

## Potensi breaking changes saat migrasi

- **`obsidian` 1.12.3 → 1.13.1:** declaration baru dapat memunculkan error typecheck atau mengekspos API baru yang tidak tersedia pada runtime minimum. Jangan memakai API baru tanpa guard atau menaikkan `minAppVersion`; lakukan build, test, dan acceptance pada versi Obsidian tertua yang diklaim.
- **`@types/node` 20 → 24:** global/type declarations dapat berubah atau menjadi lebih ketat. Risiko utamanya compile-time; bundle plugin tetap harus menghindari Node API yang tidak tersedia di sandbox Obsidian/mobile.
- **pnpm 11.5.2 → 11.21.0:** kemungkinan perubahan resolusi peer dependency atau lockfile walau tetap satu major. Regenerasi lockfile harus ditinjau sebagai diff dependency dan diverifikasi dengan frozen install di CI.
- **Biome:** repo sudah pada 2.5.6. Upgrade patch/minor berikutnya dapat mengubah formatter atau recommended rules; jalankan `format:check`/`lint` dahulu dan pisahkan perubahan format massal dari perubahan logic.
- **ES2018 → ES2021:** dapat memutus kompatibilitas runtime lama. Ini lebih berisiko daripada manfaat kosmetik menyamai template selama `minAppVersion` tetap 1.4.0.
- **Mengganti Biome dengan ESLint template:** akan mengubah rule set, command, dependency tree, dan kemungkinan menghasilkan banyak temuan baru. Jika aturan khusus Obsidian diperlukan, evaluasi lapisan ESLint terbatas; jangan mengganti formatter/linter sekaligus tanpa kebutuhan terukur.
- **Hot reload:** menambahkan plugin Hot Reload atau symlink membawa ketergantungan pada vault lokal dan perilaku reload state. Jaga agar CI/build tetap tidak menulis vault, dan dokumentasikan bahwa state/lifecycle perlu diuji setelah reload.

## Prioritas berdasarkan risiko dan effort

| Prioritas | Rekomendasi | Risiko perubahan | Effort | Alasan/acceptance |
| --- | --- | --- | --- | --- |
| 1 | Selaraskan `@types/node` ke major 24 dan jalankan gate lengkap | Rendah | Rendah | Menghilangkan mismatch type environment dengan Node CI; `pnpm run check:ci` dan coverage harus lulus |
| 2 | Upgrade exact pin pnpm ke latest 11.x, regenerasi/review lockfile | Rendah–sedang | Rendah | Memenuhi baseline pnpm 11 terkini tanpa major migration; frozen install dan seluruh CI harus lulus |
| 3 | Upgrade `obsidian` typings ke `1.13.1`, lalu audit API yang dipakai terhadap minimum runtime | Sedang–tinggi | Sedang | Memisahkan “compile against latest” dari janji kompatibilitas; keputusan akhirnya: pertahankan 1.4.0 dengan bukti, atau naikkan minimum secara eksplisit |
| 4 | Perbarui action release dan tambahkan artifact provenance seperti template resmi | Rendah–sedang | Rendah–sedang | Konsistensi supply chain; verifikasi release pada tag uji/draft sebelum mengubah jalur latest |
| 5 | Hilangkan `builtin-modules` dan gunakan `builtinModules` dari `node:module` | Rendah | Rendah | Mengurangi satu dependency dan menyamai API Node bawaan; bandingkan external list serta artifact hasil build |
| 6 | Tambahkan script bump versi yang atomik atau dokumentasikan prosedur manual | Sedang | Sedang | Mengurangi risiko metadata/tag tidak sinkron; script harus memperbarui package, manifest, dan versions lalu lolos `verify:version` |
| 7 | Pisahkan deploy-to-vault menjadi perintah eksplisit, atau minimal dokumentasikan `.env` dan batas watch | Sedang | Sedang | Menghindari side effect build dan memperjelas bahwa copy bukan reload. Pertahankan `check:ci` tanpa akses vault |
| 8 | Evaluasi rule khusus Obsidian (`eslint-plugin-obsidianmd`) sebagai check tambahan | Rendah untuk evaluasi, sedang untuk adopsi | Sedang | Biome 2.5 sudah sehat; adopsi hanya jika temuan tambahannya bernilai dan tidak menduplikasi formatter |
| 9 | Jangan menaikkan target bundle ke ES2021 sebelum menetapkan matriks runtime minimum | Tinggi | Sedang–tinggi | Perlu acceptance desktop/mobile, terutama pada versi minimum; target template bukan alasan cukup untuk mengurangi kompatibilitas |

Kesimpulan: toolchain inti repository sudah modern—Node 24, pnpm 11, Biome 2.5, CI, release automation, dan test suite tersedia. Pekerjaan bernilai tertinggi adalah menyelaraskan types/tool patch level dan membuktikan kontrak kompatibilitas Obsidian; migrasi target JavaScript atau pergantian lint stack sebaiknya ditunda sampai ada kebutuhan dan matriks runtime yang jelas.
