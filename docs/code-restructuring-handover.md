# Code restructuring handover

Tanggal: 2026-08-22
Status: Task 7 aktif; dependency Moment dari Scheduled Item parser/editor sudah dihapus melalui primitive shared Markdown
Tujuan berikutnya: Menetapkan batas modul yang jelas sebelum rebranding UX

## Ringkasan keputusan

Rebranding ditunda. Repository perlu direstrukturisasi terlebih dahulu karena tanggung jawab domain, UI, integrasi Obsidian, dan utilitas lintas fitur masih berada dalam satu direktori datar serta saling mengimpor secara luas.

Restrukturisasi harus bersifat **behavior-preserving**. Tahap ini tidak boleh mengubah nama yang terlihat pengguna, plugin ID, command/view ID, format Markdown, format settings, lokasi data, atau perilaku desktop/mobile. Rebranding menjadi fase terpisah setelah struktur baru stabil dan seluruh quality gate lulus.

Dokumen ini adalah handover implementasi awal, bukan keputusan bahwa seluruh struktur target harus diterapkan sekaligus. Setiap batas modul harus dibuktikan melalui pemetaan dependensi dan pemindahan kecil yang dapat diuji.

## Konteks saat ini

`src/` memiliki lebih dari 80 file TypeScript pada satu level. Beberapa pusat kompleksitas yang terlihat dari ukuran dan jumlah dependensinya:

| File | Perkiraan baris | Tanggung jawab yang bercampur |
| --- | ---: | --- |
| `src/SettingsTab.ts` | 1.353 | navigasi settings, render seluruh kategori, mutasi settings, validasi, status timeline, object sources |
| `src/EventTaskModal.ts` | 876 | legacy capture, routing form baru, target resolution, rendering desktop, submit |
| `src/EventTaskMobileScreen.ts` | 759 | rendering mobile, form state, target resolution, submit, recovery |
| `src/TimerView.ts` | 703 | view lifecycle, timer controls, target editor, recent entries, logging, notices |
| `src/features/settings/domain/FocusNotesSettings.ts` | 70 | composition contract lintas feature settings |
| `src/features/settings/domain/SettingsDefaults.ts` | 308 | persistence defaults dan legacy normalization/merge |
| `src/InboxNotesController.ts` | 554 | rich-text interaction, mentions, tags, scheduled-item suggestions, link insertion |
| `src/TimelineView.ts` | 441 | view lifecycle, indexing, range navigation, source state, rendering, notices |

Temuan struktur utama:

- Central `types.ts` sudah dihapus setelah setiap kontrak berpindah ke owner canonical dan seluruh consumer cut over langsung.
- Central `utils.ts` sudah dihapus. Pure Timeline date helpers canonical di `features/timeline/domain/TimelineDate.ts`; `isTFile`/`isTFolder` canonical di `infrastructure/obsidian/ObsidianFileTypes.ts`; dan vault folder mutation canonical di `infrastructure/obsidian/VaultFolders.ts`, semuanya tanpa shim.
- Awalan `Inbox*` masih dipakai untuk kemampuan contextual notes yang juga digunakan Event, Task, dan Scheduled Item. Nama file tidak lagi menggambarkan cakupan aktual.
- Implementasi capture lama (`EventTaskModal`/`EventTaskMobileScreen`) hidup berdampingan dengan renderer Scheduled Item baru. Batas legacy dan jalur aktif perlu dipastikan sebelum penghapusan.
- UI desktop dan mobile memang berbeda, tetapi sudah berbagi sebagian model, adapter, submission, dan recovery. Restrukturisasi tidak boleh menyatukan renderer secara paksa.
- Cycle `types.ts`/Scheduled Item dan seluruh source cycle sudah diputus. Settings composition/defaults/legacy merge serta kontrak Capture, Object Source termasuk Inbox registry, Timeline, dan Event/Task detail settings kini canonical di domain masing-masing; seluruh re-export kompatibilitas sudah dihapus setelah zero-reference proof.

## Sumber kebenaran yang sudah ada

Restrukturisasi harus mengikuti, bukan menggandakan, kontrak dalam dokumen berikut:

- `docs/spec-code-quality-remediation.md`: quality gate, persistence safety, submission outcome, dan prinsip pengujian.
- `tasks/unified-scheduled-item-form-plan.md`: arah shared semantic state dengan renderer desktop/mobile terpisah.
- `docs/spec-unified-scheduled-item-form.md`: kontrak form Scheduled Item.
- `docs/development-status.md`: status implementasi lintas pekerjaan.

Jika rencana di handover ini bertentangan dengan kontrak perilaku pada spec tersebut, spec perilaku menang. Perubahan keputusan arsitektur yang mahal atau sulit dibalik harus dicatat sebagai ADR terpisah setelah dependency audit selesai.

## Non-goals

Tahap restrukturisasi tidak mencakup:

- rebranding `Focus Notes`, `Focus Timeline`, `Inbox`, atau `Moment`;
- mengganti `manifest.id`, package name, command ID, view type, CSS prefix, atau console prefix;
- mengubah copy, layout, atau interaction flow;
- mengubah format record Markdown, block ID, frontmatter, heading default, atau relative link;
- memigrasikan key settings atau file data;
- menambah framework UI, dependency runtime, test runner, atau state-management library;
- melakukan rewrite sekaligus atau pemindahan massal tanpa checkpoint.

## Invariant kompatibilitas

Setiap batch harus menjaga invariant berikut:

1. `manifest.json`, `versions.json`, dan ID persisten tidak berubah.
2. Existing `data.json` dapat dimuat dengan hasil settings yang sama.
3. Output Moment/Inbox, Event, Task, focus session, related log, dan detail note tetap byte-for-byte sama untuk fixture yang sama.
4. Parser tetap menerima format legacy yang saat ini didukung.
5. Desktop dan mobile tetap menggunakan interaction model masing-masing.
6. Tidak ada file pengguna yang dipindahkan, ditulis ulang, atau dihapus oleh proses restrukturisasi.
7. Public command, ribbon action, dan view activation tetap bekerja dengan identifier lama.
8. Test yang ada tidak diubah hanya untuk menyesuaikan nama file; assertion perilaku harus tetap sama.

## Prinsip struktur

### 1. Colocation berdasarkan domain

Kode diletakkan dekat fitur yang memilikinya. Nama folder mengikuti tanggung jawab bisnis atau integrasi, bukan jenis teknis generik seperti `helpers`.

### 2. Dependency mengarah ke dalam

Urutan dependensi yang diinginkan:

```text
plugin composition / Obsidian entry points
    -> feature UI and orchestration
        -> domain models and policies
            -> small pure shared primitives

infrastructure adapters
    -> Obsidian API / vault / metadata / persistence
```

Domain murni tidak boleh mengimpor `obsidian`, DOM, Modal, ItemView, Notice, atau concrete vault adapter.

### 3. `shared/` bukan tempat pembuangan

Sebuah modul hanya masuk `shared/` bila:

- dipakai oleh setidaknya dua domain;
- tidak menggunakan istilah atau tipe privat milik salah satu domain;
- memiliki API kecil dengan kepemilikan yang jelas;
- tetap berguna tanpa mengetahui renderer atau Obsidian.

Jika syarat tersebut tidak terpenuhi, letakkan modul di domain pemiliknya.

### 4. Share semantics, bukan DOM

Desktop dan mobile boleh berbagi form data, validation, adapter, submission policy, dan typed result. Renderer, focus management, keyboard behavior, dan lifecycle UI tetap terpisah.

### 5. Compatibility identifiers tetap eksplisit

Identifier yang disimpan atau direferensikan Obsidian harus dikumpulkan dan diberi komentar kompatibilitas sebelum rebranding, tetapi nilainya belum diubah pada restrukturisasi.

## Struktur target awal

Struktur ini adalah arah kerja, bukan instruksi untuk membuat semua folder pada commit pertama:

```text
src/
  plugin/
    FocusNotesPlugin.ts
    commands.ts
    view-registration.ts

  features/
    focus-session/
      domain/
      ui/
    capture/
      moment/
      scheduled-item/
        domain/
        application/
        ui/desktop/
        ui/mobile/
    timeline/
      domain/
      ui/
    object-notes/
    periodical-notes/
    settings/
      ui/

  infrastructure/
    obsidian/
    persistence/

  shared/
    date-time/
    markdown/
```

Folder kosong tidak boleh dibuat. Struktur tumbuh hanya ketika satu batch pemindahan mempunyai batas dan verifikasi yang jelas.

## Rencana implementasi bertahap

### Fase 0 — Baseline dan dependency audit

Tujuan: membuktikan jalur aktif dan membangun peta sebelum memindahkan kode.

Pekerjaan:

1. Jalankan dan catat baseline `pnpm run check:ci` serta build dengan deployment vault dinonaktifkan.
2. Buat daftar entry point: `main.ts`, registered views, commands, settings tab, modal/screen launcher.
3. Buat import graph per domain, termasuk cycle dan fan-in/fan-out tertinggi.
4. Klasifikasikan setiap file: domain/pure, application orchestration, UI, Obsidian adapter, persistence, atau legacy candidate.
5. Verifikasi jalur runtime lama dan baru untuk Moment, Event, dan Task.
6. Tandai API atau identifier kompatibilitas yang tidak boleh berubah.

Deliverable:

- dependency map singkat di `docs/` atau `tasks/`;
- tabel ownership file;
- daftar cycle dan kandidat extraction;
- keputusan eksplisit tentang file legacy yang masih aktif.

Checkpoint:

- tidak ada source runtime yang berubah;
- baseline quality gate tercatat;
- tidak ada file yang dikategorikan hanya berdasarkan namanya.

### Fase 1 — Pisahkan tipe dan utilitas berdasarkan ownership

Tujuan: mengurangi `types.ts` dan `utils.ts` tanpa mengubah API eksternal sekaligus.

Pekerjaan yang disarankan:

1. Inventaris seluruh export `types.ts` dan consumer-nya.
2. Pindahkan tipe ke domain pemilik dalam batch kecil, misalnya settings, focus session, capture target, dan object-source.
3. Pertahankan temporary compatibility re-export bila dibutuhkan agar diff import tidak melebar dalam satu batch.
4. Inventaris fungsi `utils.ts`; kelompokkan date/time, vault type guards, dan folder/path operations.
5. Pindahkan fungsi hanya setelah consumer membuktikan ownership-nya. Hindari membuat satu `shared/utils.ts` baru.
6. Putus cycle `types.ts` <-> `ScheduledItemTypes.ts` sebelum melakukan pemindahan UI besar.

Checkpoint per batch:

- focused tests terkait lulus;
- `pnpm run typecheck`, `pnpm run lint`, dan `pnpm run format:check` lulus;
- public behavior dan generated Markdown tidak berubah.

### Fase 2 — Bentuk boundary Scheduled Item/capture

Tujuan: menjadikan kontrak Scheduled Item yang sudah ada sebagai pusat semantic create/edit tanpa merusak Moment capture.

Pekerjaan:

1. Kelompokkan form data, adapter, block editor, parser, persistence, submission, related-write recovery, dan identity modules berdasarkan layer.
2. Pisahkan Moment capture dari Scheduled Item; jangan terus memakai nama `EventTask*` untuk konsep yang berbeda.
3. Audit `InboxNotesController` dan modul suggestion. Tentukan nama domain netral hanya setelah cakupan aktual diketahui.
4. Pertahankan desktop/mobile renderer terpisah dengan dependency pada kontrak semantic yang sama.
5. Setelah seluruh launcher memakai jalur baru dan test membuktikannya, tandai implementation legacy untuk retirement pada batch tersendiri.

Checkpoint:

- create/edit Event dan Task tetap menghasilkan semantic output yang sama;
- Moment tetap dapat dibuat melalui entry point yang sama;
- retry related writes tidak menduplikasi primary write;
- tidak ada legacy deletion dalam batch pemindahan.

### Fase 3 — Pecah Settings berdasarkan kategori

Tujuan: menjadikan `SettingsTab` sebagai composition/router tipis.

Kandidat renderer:

- Periodical Notes settings;
- Object Sources settings;
- Focus session settings;
- Capture settings: Moment, Event, Task, shared note creation;
- Timeline settings.

Aturan:

- navigation state dan root composition tetap pada settings shell;
- renderer menerima settings/service yang dibutuhkan saja, bukan seluruh plugin bila tidak perlu;
- mutasi dan persistence tetap melalui satu jalur yang sudah ada;
- copy UI belum disentralisasi atau diubah pada fase ini kecuali ekstraksi literal identik diperlukan tanpa perubahan nilai.

Checkpoint:

- `test/settings-layout.test.ts` dan seluruh settings-related tests lulus;
- urutan kategori, nilai default, description, conditional visibility, dan save behavior sama;
- smoke test settings di Obsidian desktop dilakukan.

### Fase 4 — Pecah Timer dan Timeline

Tujuan: pisahkan lifecycle Obsidian, application orchestration, dan rendering.

Timer candidates:

- ItemView shell;
- timer controls/presentation;
- live target editor;
- recent entries panel;
- session completion/log orchestration.

Timeline candidates:

- ItemView shell dan range state;
- indexing/query orchestration;
- toolbar/range navigation;
- source sidebar;
- grid and item modal launch.

Checkpoint:

- TimerEngine dan writer tests lulus;
- timeline layout/query/source tests lulus;
- view state dan view IDs tetap sama;
- desktop runtime smoke test untuk membuka, menutup, dan membuka kembali kedua view.

### Fase 5 — Rapikan plugin composition dan hapus compatibility shim

Tujuan: membuat `main.ts` hanya mengorkestrasi lifecycle plugin.

Pekerjaan:

1. Extract command registration dan view registration tanpa mengganti ID.
2. Pastikan state/persistence ownership tetap tunggal.
3. Hapus re-export sementara setelah seluruh consumer berpindah.
4. Hapus file legacy hanya dengan bukti tidak ada runtime import dan regression coverage memadai.
5. Dokumentasikan struktur aktual, bukan struktur target yang belum tercapai.

Checkpoint akhir restrukturisasi:

- full `pnpm run check:ci` lulus;
- production build dan artifact verification lulus;
- desktop dan real-mobile acceptance lulus untuk capture;
- tidak ada perubahan yang tidak disengaja pada `main.js`, kecuali hasil bundling struktural;
- diff format Markdown pada golden fixtures kosong;
- rebranding baru boleh direncanakan setelah checkpoint ini.

## Strategi commit

Setiap commit harus memiliki satu jenis perubahan:

1. characterization test atau architecture guard;
2. pure file move/import update;
3. extraction dengan API compatibility;
4. switch consumer ke boundary baru;
5. legacy removal setelah consumer cutover.

Jangan mencampur file move, rename istilah, copy change, formatting massal, dan behavior fix dalam satu commit. Bila sebuah test menemukan bug nyata, catat dan perbaiki dalam pekerjaan correctness terpisah kecuali bug tersebut menghalangi restrukturisasi.

## Strategi pengujian

Automated checks minimum untuk setiap batch:

```powershell
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm test
```

Checkpoint domain menambahkan focused tests terkait. Checkpoint fase menjalankan:

```powershell
$env:OBSIDIAN_VAULT_PLUGIN_PATH = ""
pnpm run check:ci
```

Acceptance manual tetap diperlukan untuk:

- view registration dan state restoration;
- Obsidian Modal/ItemView lifecycle;
- command palette dan ribbon;
- mobile keyboard, back behavior, dan fullscreen screen lifecycle;
- rich-text suggester, caret, dan click interaction.

## Risiko utama

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| File dipindahkan berdasarkan nama, bukan ownership | Struktur baru tetap membingungkan | Dependency audit dan tabel ownership sebelum move |
| Refactor mengubah Markdown secara tidak sengaja | Data pengguna atau timeline parsing rusak | Golden fixtures dan byte-for-byte assertions |
| Legacy path dihapus terlalu cepat | Salah satu entry point capture berhenti bekerja | Audit launcher, runtime imports, dan cutover test |
| `shared/` menjadi monolith baru | Coupling hanya berpindah lokasi | Admission rule untuk shared dan API kecil |
| Desktop/mobile dipaksa berbagi renderer | Regresi keyboard dan interaction | Share semantic layer saja |
| Re-export sementara tidak pernah dihapus | Boundary tetap kabur | Daftar shim dan removal checkpoint pada setiap fase |
| File move menghasilkan diff besar | Review tidak dapat membedakan behavior | Commit mekanis kecil dan tanpa formatting massal |

## Hal yang memerlukan persetujuan sebelum dilakukan

- perubahan plugin, command, atau view ID;
- perubahan schema/key settings atau strategi migrasi;
- perubahan format Markdown/frontmatter;
- penghapusan implementation legacy yang belum dibuktikan tidak aktif;
- dependency atau framework baru;
- perubahan UX/copy selama fase restrukturisasi;
- pemindahan source secara massal dalam satu commit.

## Langkah pertama untuk sesi berikutnya

1. Baca dokumen handover ini, `docs/spec-code-quality-remediation.md`, dan `tasks/unified-scheduled-item-form-plan.md`.
2. Periksa `git status`; pertahankan semua perubahan lokal pengguna yang tidak terkait.
3. Konfirmasi branch `refactor/domain-structure`; baseline terakhir `pnpm run check:ci` lulus dengan 306 tes pada 2026-08-22.
4. Gunakan `docs/code-architecture-baseline.md` sebagai ownership map saat ini; jangan membangun ulang audit yang sudah selesai.
5. Lanjutkan Task 7 dengan memindahkan `TaskLineEditor.ts` dan `TaskLineLint.ts` sebagai satu kelompok Task domain, memakai `shared/markdown/MarkdownLink.ts` dan characterization tests yang ada.
6. Pertahankan source import tetap acyclic; central `types.ts` dan seluruh re-export kontrak settings sudah dihapus setelah direct-consumer cutover selesai.
7. Pertahankan dependency advisory sebagai batch dependency-only yang terpisah dari restrukturisasi source.

## Kriteria handover ini dianggap selesai

Handover telah dipenuhi ketika agen/developer berikutnya dapat menjawab sebelum mengedit:

- jalur runtime mana yang aktif dan mana yang legacy;
- domain mana yang memiliki setiap tipe dan utility yang akan dipindahkan;
- identifier dan format data apa yang harus tetap kompatibel;
- test apa yang membuktikan tidak ada perubahan perilaku;
- ukuran tepat Batch 1 dan cara membatalkannya secara aman.
