# Code architecture baseline

Tanggal audit: 2026-08-22

## Tujuan

Baseline ini mencatat entry point, compatibility identifier, jalur capture aktif, dan ownership seluruh source sebelum pemindahan besar. Klasifikasi didasarkan pada consumer dan tanggung jawab runtime, bukan nama file saja.

## Dependency direction

```text
plugin composition / Obsidian entry points
    -> feature UI and application orchestration
        -> domain semantics and policies
            -> small pure primitives

feature application -> infrastructure ports
infrastructure adapters -> Obsidian App, Vault, MetadataCache, Plugin data
domain -X-> Obsidian, DOM, UI, concrete persistence
```

`test/architecture-boundaries.test.ts` menjaga domain baru dari import Obsidian atau outer layer.

## Entry points dan identifier kompatibilitas

| Surface | Entry point | Identifier yang dipertahankan |
| --- | --- | --- |
| Plugin | `main.ts` | manifest `focus-notes` |
| Hover links | `main.ts` | `focus-notes-inbox` |
| Focus view | `TimerView.ts` | `focus-notes-view` |
| Timeline view | `TimelineView.ts` | `focus-timeline-view` |
| Command | `main.ts` | `open-focus-notes` |
| Command | `main.ts` | `manage-active-note-events-tasks` |
| Command | `main.ts` | `open-focus-timeline` |
| Command | `main.ts` | `create-event-task` |
| Ribbon | `main.ts` | timer and calendar actions; labels unchanged |
| Settings | `main.ts` -> `SettingsTab.ts` | existing settings keys and save path |

`test/compatibility-identifiers.test.ts` mengunci identifier persisten tersebut sebelum registrasi dipisahkan dari `main.ts`.

## Jalur capture runtime aktif

### Moment

```text
main command / Scheduled Item kind switch
    -> openEventTaskForm
        -> EventTaskModal (desktop) or EventTaskMobileScreen (mobile)
            -> InboxDesktopForm / InboxMobileForm
                -> submitInbox
                    -> EventTaskWriter.writeInbox
                        -> primary Moment record + optional Daily backlink/related logs
```

Nama `Inbox*` saat ini mewakili form dan semantic Moment capture. Ia masih aktif dan belum boleh dianggap legacy hanya karena penamaannya lama.

### Event dan Task create

```text
main command / Active Note Manager / Timeline add / kind switch
    -> openEventTaskForm
        -> ScheduledItemDesktopCreateModal
           or ScheduledItemMobileCreateScreen
            -> shared ScheduledItem form data + adapter
                -> submitEventTask
                    -> EventTaskWriter
                        -> ledger Markdown + detail note + related logs
```

`EventTaskModal` tetap aktif sebagai Moment renderer dan delegating launcher. Bagian Event/Task DOM lama di dalamnya perlu dibuktikan tidak terpakai sebelum dihapus.

### Event dan Task edit

```text
Timeline / Active Note Manager
    -> openScheduledItemEditor
        -> ScheduledItemDesktopEditModal
           or ScheduledItemMobileEditScreen
            -> hydrate/build shared form contract
                -> saveScheduledItemBlock
                    -> conflict-aware vault modification + related-log recovery
```

`EventEditModal` dan `TaskEditModal` adalah legacy candidates, tetapi deletion menunggu audit runtime import dan characterization coverage tersendiri.

## Cycle dan coupling baseline

- Cycle langsung `types.ts <-> ScheduledItemTypes.ts` telah diputus. Seluruh consumer telah memakai kontrak domain dan shim `ScheduledItemTypes.ts` sudah dihapus setelah full CI lulus.
- Seluruh relative import di `src` kini acyclic dan dijaga oleh `test/architecture-boundaries.test.ts`. Cycle record/form/writer, desktop/mobile routing, dan `main.ts <-> SettingsTab.ts` diputus tanpa menggabungkan renderer atau mengubah persistence.
- Central `types.ts` sudah dihapus. `FocusNotesSettings` serta defaults/legacy normalization kini dimiliki settings domain; seluruh feature settings contract juga sudah berada pada owner masing-masing.
- `infrastructure/obsidian/ObsidianFileTypes.ts` dan `VaultFolders.ts` kini menjadi owner canonical file/folder guards serta vault folder mutation; seluruh consumer sudah direct-import dan central `utils.ts` sudah dihapus.
- Hotspot ukuran dan orchestration: `SettingsTab.ts`, `EventTaskModal.ts`, `EventTaskMobileScreen.ts`, `TimerView.ts`, `InboxNotesController.ts`, dan `TimelineView.ts`.
- Timeline mengonsumsi Scheduled Item; Timeline tidak memiliki aturan Task/Event.
- Object Sources dimiliki Object Notes/context domain dan dikonsumsi capture serta Timeline.

## Ownership seluruh source

Tabel berikut menetapkan owner saat ini dan arah target. Satu baris dapat memuat beberapa file hanya bila ownership dan layer-nya sama.

| Owner / layer | Source files | Arah target |
| --- | --- | --- |
| Plugin composition | `main.ts` | `plugin/FocusNotesPlugin.ts`, `commands.ts`, `view-registration.ts`, `identifiers.ts` |
| Settings composition and normalization | `features/settings/domain/FocusNotesSettings.ts`, `features/settings/domain/SettingsDefaults.ts` | Canonical owner; central `types.ts` sudah dihapus setelah direct-consumer cutover dan persistence characterization lulus |
| Obsidian file type adapter | `infrastructure/obsidian/ObsidianFileTypes.ts` | Canonical owner untuk runtime-safe `isTFile`/`isTFolder`; pertahankan duck-typing lintas runtime |
| Vault folder adapter | `infrastructure/obsidian/VaultFolders.ts` | Canonical owner `ensureFolderPath`; perilaku root/empty, file collision, create race, dan dot segments dikunci characterization tests |
| Capture target/settings contracts | `features/capture/domain/CaptureTarget.ts`, `features/capture/domain/CaptureSettings.ts` | Canonical owner; seluruh consumer target sudah direct-import dan shim `types.ts` telah dihapus |
| Focus session domain | `features/focus-session/domain/Timer.ts`, `features/focus-session/domain/SessionRecord.ts`, `TimerEngine.ts` | Kontrak Timer dan Session Record sudah canonical; state machine dipindahkan fisik pada batch terpisah |
| Focus session UI | `TimerView.ts`, `CircularDisplay.ts`, `LogModal.ts` | `features/focus-session/ui` |
| Focus session application/read model | `RecentEntriesReader.ts` | Feature application dengan vault read port |
| Reflection/CBT domain | `features/reflection/domain/Wellbeing.ts`, `CognitiveDistortions.ts`, `MoodReference.ts`, `EmotionalWellbeingReference.ts` | Kontrak wellbeing sudah canonical; reference data lain menyusul berdasarkan consumer |
| Reflection/CBT UI | `MoodPicker.ts`, `EmotionalWellbeingPicker.ts`, `ReflectionFocusModal.ts` | `features/reflection/ui` |
| Moment form and semantic text | `features/capture/moment/domain/InboxRecord.ts`, `InboxDesktopForm.ts`, `InboxMobileForm.ts`, `InboxNotesText.ts`, `InboxRichText.ts`, `InboxMarkdown.ts`, `InboxTarget.ts` | Record contract sudah canonical; form/text split berikutnya berdasarkan domain/UI |
| Moment suggestions UI/application | `InboxNotesController.ts`, `InboxSuggestions.ts`, `SuggestionSelection.ts` | Moment UI/application; generic primitive only if reuse is proven |
| Moment settings | `InboxFolderSettings.ts` | `features/capture/moment` or settings renderer owner |
| Scheduled Item domain contract | `features/capture/scheduled-item/domain/ScheduledItem.ts`, `features/capture/scheduled-item/domain/EventTaskRecord.ts` | Canonical owner; seluruh consumer record sudah dipotong langsung dan shim `EventTaskWriter.ts` telah dihapus |
| Scheduled Item Markdown rendering | `features/capture/scheduled-item/domain/EventTaskMarkdown.ts` | Canonical pure renderer untuk Event/Task Markdown; seluruh compatibility tests dan consumer sudah direct-import tanpa shim |
| Scheduled Item detail-note settings | `features/capture/scheduled-item/domain/DetailNoteSettings.ts` | Canonical owner; writer direct-import dan shim `types.ts` telah dihapus |
| Scheduled Item form semantics | `features/capture/scheduled-item/domain/ScheduledItemFormData.ts`, `features/capture/scheduled-item/domain/ScheduledItemFormAdapter.ts` | Form data dan adapter/validation sudah canonical; seluruh consumer (desktop UI, mobile UI, application) direct-import dan shim root telah dihapus. `EventTaskFormState.ts`/`SubmissionPolicy.ts` sengaja **tidak** dipindah — keduanya milik jalur capture legacy bersama Moment (lihat baris "Active legacy/delegating capture UI"), bukan domain Scheduled Item |
| Scheduled Item identity/parser | `features/capture/scheduled-item/domain/ScheduledItemBlockId.ts`, `features/capture/scheduled-item/domain/ScheduledItemParser.ts`, `features/capture/scheduled-item/domain/ScheduledItemIdentityMigration.ts` | Semuanya sudah canonical tanpa shim; `buildScheduledItemIdentityChange` pure dan hanya bergantung pada type `TaskFormatChange` (domain) |
| Scheduled Item block editing | `features/capture/scheduled-item/domain/ScheduledItemBlockEditor.ts`, `features/capture/scheduled-item/domain/LedgerRecordSource.ts` | Block/description/detail-note parsing dan snapshot capture/replace sudah canonical; seluruh consumer (ledger editor, application, desktop/mobile UI) direct-import dan shim root telah dihapus |
| Scheduled Item application | `features/capture/scheduled-item/application/ScheduledItemEditSubmission.ts`, `features/capture/scheduled-item/application/ScheduledItemCreateRelated.ts`, `features/capture/scheduled-item/application/DetailNotePromotion.ts` | Sudah canonical; semuanya sudah dependency-injection based (no Obsidian) sebelum dipindah, seluruh consumer UI desktop/mobile direct-import dan shim root telah dihapus. `EventTaskSubmission.ts` **bukan** anggota — dipakai Moment shell (`EventTaskModal.ts`/`EventTaskMobileScreen.ts`); `submitEventTask` sudah dihapus (zero caller setelah shell dipangkas), tersisa `submitInbox`/`retryRelatedSubmission`/tipe hasil bersama |
| Capture shared domain/application primitives | `features/capture/domain/ObjectReference.ts`, `features/capture/domain/RelatedLog.ts`, `features/capture/application/ContextLinkResolver.ts`, `features/capture/application/RelatedWriteRecovery.ts` | Sudah canonical dan dikoreksi dari peta ownership Phase 0: `ObjectReference.ts`/`RelatedLog.ts` murni tanpa I/O injeksi (domain); `ContextLinkResolver.ts`/`RelatedWriteRecovery.ts` mengorkestrasi resolver/writer yang diinjeksi (application). Ternyata dipakai lintas Moment/Event/Task (bukan Object-Notes-eksklusif seperti dugaan Phase 0 — `ObjectNote.ts` tidak pernah mengimpor keduanya); seluruh consumer direct-import dan shim root telah dihapus |
| Scheduled Item persistence | `infrastructure/obsidian/ScheduledItemBlockPersistence.ts`, `infrastructure/obsidian/EventTaskWriter.ts` | Sudah canonical di `infrastructure/obsidian/`; seluruh consumer (desktop/mobile create/edit, legacy `EventTaskModal.ts`/`EventTaskMobileScreen.ts`) direct-import dan shim root telah dihapus. `EventTaskWriter.ts` juga menulis Inbox (Moment) — adapter bersama, bukan Scheduled-Item-eksklusif, yang wajar untuk layer infrastructure |
| Capture launch/orchestration | `features/capture/domain/CaptureForm.ts`, `ScheduledItemEditor.ts`, `ScheduledItemMobileCreateLauncher.ts`, `EventTaskCaptureLauncher.ts` | Shared contract dan routing composition; desktop/mobile renderer tetap terpisah. `EventTaskCaptureLauncher.ts` (baru) berisi `openEventTaskForm`/`openDesktopScheduledItemCreate`, diekstrak dari `EventTaskModal.ts` setelah class itu diubah menerima callback `openScheduledItem` lewat constructor (pola yang sama sudah dipakai `EventTaskMobileScreen.ts`) — menghindari import cycle antara launcher dan class render |
| Scheduled Item desktop UI | `DesktopScheduledItemForm.ts`, `DesktopScheduledItemFormModel.ts`, `ScheduledItemDesktopCreateModal.ts`, `ScheduledItemDesktopEditModal.ts` | `features/capture/scheduled-item/ui/desktop` |
| Scheduled Item mobile UI | `MobileScheduledItemForm.ts`, `MobileScheduledItemFormModel.ts`, `MobileFormPolicy.ts`, `MobileViewport.ts`, `ScheduledItemMobileCreateScreen.ts`, `ScheduledItemMobileEditScreen.ts` | `features/capture/scheduled-item/ui/mobile` |
| Moment capture shell (formerly "legacy/delegating") | `EventTaskModal.ts`, `EventTaskMobileScreen.ts` | Sudah dipangkas jadi shell khusus Moment (887→418 baris desktop, 764→371 baris mobile). Tombol tab Event/Task menutup shell ini dan redirect ke `ScheduledItemDesktopCreateModal.ts`/`ScheduledItemMobileCreateScreen.ts` sebelum field Event/Task mana pun dirender/dibaca — kode render/submit Event/Task lama sudah dihapus (bukti zero-runtime-import). `EventTaskFormState.ts` tetap dipakai kedua shell ini **dan** modal canonical (sebagai default-value seed lewat `scheduledItemFormDataFromCreateState`), jadi belum bisa dipindah/disederhanakan. Kedua file sekarang **hanya** meng-export class render-nya masing-masing — `openEventTaskForm`/`openDesktopScheduledItemCreate` sudah diekstrak ke `EventTaskCaptureLauncher.ts` (lihat baris "Capture launch/orchestration"). Rename ke nama Moment-eksklusif kini tidak lagi berisiko salah label, tapi sengaja tidak dilakukan — bersifat kosmetik saja, bukan syarat penutupan Task 9 |
| Moment application | `features/capture/moment/application/EventTaskSubmission.ts` | Sudah canonical; `submitInbox`/`retryRelatedSubmission`/tipe hasil bersama dipindah dari root setelah `submitEventTask` terhapus (murni Moment-scoped sekarang). Nama file/simbol dipertahankan (`EventTaskSubmissionResult`, dst.) mengikuti pola "move tanpa rename" sesi ini; seluruh consumer (`EventTaskModal.ts`, `EventTaskMobileScreen.ts`, `SubmissionPolicy.ts`) direct-import dan shim root telah dihapus |
| Event domain/persistence | `features/capture/scheduled-item/domain/EventLineEditor.ts`, `infrastructure/obsidian/EventLedgerEditor.ts` | Sudah canonical tanpa shim. `EventLedgerEditor.ts` seluruhnya Obsidian-touching (setiap fungsi menerima `App` dan memanggil `app.vault` langsung, tanpa sisa logic murni), jadi masuk `infrastructure/obsidian/`, bukan application |
| Event legacy UI candidate | `EventEditModal.ts` | Prove inactive, then deletion-only batch |
| Task domain/persistence | `features/capture/scheduled-item/domain/TaskLineEditor.ts`, `features/capture/scheduled-item/domain/TaskLineLint.ts`, `infrastructure/obsidian/TaskLedgerEditor.ts` | Sudah canonical tanpa shim. `TaskLedgerEditor.ts` sama alasan dengan `EventLedgerEditor.ts` — masuk infrastructure |
| Task formatting domain/infrastructure/UI | `features/capture/scheduled-item/domain/TaskFormatWriter.ts`, `infrastructure/obsidian/TaskFormatWriter.ts`, `TaskFormatPreviewModal.ts` | `applyTaskFormatChanges`/`TaskFormatChange` (pure) dan `saveTaskFormatChanges` (adapter) sudah dipisah dan canonical; seluruh consumer direct-import dan shim root telah dihapus |
| Task legacy UI candidate | `TaskEditModal.ts` | Prove inactive, then deletion-only batch |
| Active-note Scheduled Item management | `ActiveNoteLedger.ts`, `ActiveNoteManagerModel.ts`, `ActiveNoteManagerModal.ts` | Scheduled Item application/read model and UI |
| Timeline domain | `features/timeline/domain/Timeline.ts`, `features/timeline/domain/TimelineSettings.ts`, `features/timeline/domain/TimelineDate.ts`, `TimelineLayout.ts`, `TimelineSourceAlignment.ts`, `TimelineSourceGroups.ts`, `TimelineItemModalModel.ts` | Mode, settings, dan pure date helpers sudah canonical tanpa shim; implementasi root lain dipindahkan per batch |
| Timeline application | `ScheduledItemQuery.ts`, `ScheduledItemIndexer.ts` | Timeline query/index orchestration; Obsidian indexing behind adapter |
| Timeline UI | `TimelineView.ts`, `TimelineGrid.ts`, `TimelineSourceSidebar.ts`, `TimelineItemModal.ts` | `features/timeline/ui` |
| Scheduled mention domain/index | `ScheduledItemMentionIndex.ts` | Scheduled Item/query domain according to final consumers |
| Object Notes domain | `features/object-notes/domain/ContextSourceFilter.ts`, `features/object-notes/domain/ContextSourceSettings.ts`, `ContextSourceScope.ts` | Filter, source settings, dan persisted Inbox registry contract sudah canonical; seluruh consumer direct-import dan shim `types.ts` telah dihapus. `ObjectReference.ts` **dikoreksi keluar** dari baris ini — evidence consumer menunjukkan dipakai lintas capture (Moment+Event+Task), bukan `ObjectNote.ts`; sudah pindah ke `features/capture/domain/` |
| Object Notes application | `ObjectNote.ts` | `features/object-notes/application`. `ContextLinkResolver.ts` **dikoreksi keluar** — `ObjectNote.ts` tidak pernah mengimpornya; sudah pindah ke `features/capture/application/` |
| Object Notes UI | `ObjectNoteModal.ts`, `ObjectNoteSuggest.ts` | `features/object-notes/ui` |
| Obsidian suggestion/link adapters | `infrastructure/obsidian/ObsidianInboxSuggestionSource.ts`, `infrastructure/obsidian/ObsidianLinkResolver.ts`, `infrastructure/obsidian/ObsidianScheduledItemMentionSource.ts`, `infrastructure/obsidian/Suggesters.ts` | Semuanya sudah canonical di `infrastructure/obsidian/`, mengikuti pola fungsi `async (app: App, ...)` yang sudah ada; seluruh consumer direct-import dan shim root telah dihapus |
| Periodical Notes domain | `features/periodical-notes/domain/PeriodicalNote.ts`, `DailyNotePath.ts`, `PeriodicalNoteSettings.ts` | Kontrak profile/settings sudah canonical; resolver dan helper dipindahkan pada batch terpisah |
| Target resolution | `features/capture/domain/CaptureTarget.ts`, `CaptureTarget.ts`, `TargetResolver.ts` | Kontrak dan pure selection policy dimiliki capture; Obsidian resolution adapter menuju infrastructure |
| Markdown insertion primitive | `shared/markdown/InsertPosition.ts`, `HeadingInsertion.ts` | Semantik posisi canonical di shared Markdown karena dipakai capture, Focus Session, Object Notes, dan writer; operasi insert tetap dipisahkan dari kontraknya |
| Markdown link primitive | `shared/markdown/MarkdownLink.ts` | Canonical `unwrapMarkdownLinkLabel` untuk Moment, Task editor, dan Scheduled Item parser; regex serta legacy plain-text fallback dipertahankan tanpa re-export feature |
| Task line editor/lint | `features/capture/scheduled-item/domain/TaskLineEditor.ts`, `features/capture/scheduled-item/domain/TaskLineLint.ts` | Parsing, edit, dan lint kanonis; seluruh consumer direct-import dan shim root telah dihapus |
| Event line editor | `features/capture/scheduled-item/domain/EventLineEditor.ts` | Parsing dan edit kanonis; seluruh consumer direct-import dan shim root telah dihapus |
| Scheduled Item parser | `features/capture/scheduled-item/domain/ScheduledItemParser.ts` | `parseLine` Event/Task kanonis; seluruh consumer direct-import dan shim root telah dihapus |
| Focus note persistence | `NoteWriter.ts` | `infrastructure/obsidian` implementing focus-session write port |
| Settings domain/persistence | `StateStore.ts` | Persistence adapter; settings normalization split from plugin storage |
| Settings UI shell | `SettingsLayout.ts`, `SettingsTab.ts` | `SettingsTab.ts` sudah jadi thin shell (1355→169 baris): `display()`/`navigateTo()`/`renderRoot()`/`renderBackBar()`/`renderCategoryRow()`/`settingsContext()` saja, tanpa logic rendering kategori apa pun |
| Settings UI categories | `features/settings/ui/PeriodicalNotesSettings.ts`, `ObjectSourceSettings.ts`, `FocusSessionSettings.ts`, `CaptureSettings.ts`, `TimelineSettings.ts` | Sudah canonical — lima kategori (Periodical Notes, Object Sources, Focus Session, Capture, Timeline) masing-masing punya satu file dengan satu exported entry function menerima `SettingsRenderContext` (app/settings/saveSettings/redisplay) alih-alih seluruh instance plugin. Object Sources juga menerima `ObjectSourceNavigation` (toList/toSource) untuk navigasi list↔edit |
| Settings UI shared field helpers | `features/settings/ui/SettingsFormFields.ts`, `SettingsRenderContext.ts` | `contextTextField`/`contextSelectField`/`renderProfilePicker` dipindah dari method private `SettingsTab.ts` ke fungsi shared begitu kategori pertama yang membutuhkannya diekstrak (bukan didup­likasi lalu di-dedupe belakangan) |

## Legacy candidate rules

Sebuah file hanya boleh dihapus bila seluruh kondisi berikut terpenuhi:

1. Tidak ada runtime import atau dynamic launcher yang merujuk file tersebut.
2. Active desktop dan mobile entry points memiliki characterization coverage.
3. Golden/no-op Markdown tests tetap byte-identical.
4. Deletion dipisahkan dari move, rename, copy change, dan behavior fix.
5. Penghapusan telah disetujui karena merupakan compatibility-sensitive action.

## Task 9 status: complete (2026-08-24)

Semua acceptance criteria tertutup. Item verifikasi "manual acceptance testing" sengaja dilewati atas keputusan eksplisit pengguna (lihat log di bawah), bukan kelalaian. Phase 2 (Capture domain restructuring) selesai; lanjut Task 10 (Settings decomposition) atau reprioritisasi sesuai arahan pengguna berikutnya.

1. **Keputusan pengguna 2026-08-24**: manual acceptance testing desktop/mobile untuk Moment capture dan redirect tab Event/Task **dilewati secara sengaja** (bukan lupa) — risiko regresi dinilai cukup rendah berdasarkan tracing kode dan 299 tes yang lulus. Jika ada laporan bug di jalur ini pasca-refactor, cek batch "Task 9 batch 1/2/3" sebagai titik awal investigasi.
2. `EventTaskFormState.ts` tetap tidak bisa dipindah/disederhanakan — masih dipakai `ScheduledItemDesktopCreateModal.ts`/`ScheduledItemMobileCreateScreen.ts` sebagai default-value seed lewat `scheduledItemFormDataFromCreateState`.
3. `SubmissionPolicy.ts` tetap dipakai `EventTaskModal.ts`/`EventTaskMobileScreen.ts` untuk submission Moment; tidak berubah.
4. Rename `EventTaskModal.ts`/`EventTaskMobileScreen.ts` sekarang **tidak lagi berisiko salah label** — routing lintas-kind sudah diekstrak ke `EventTaskCaptureLauncher.ts` (lihat batch 3 di bawah) — tapi tetap sengaja tidak dilakukan karena bersifat kosmetik saja.
5. Sisa file di root yang masih menyebut "EventTask" tapi sudah Moment-eksklusif: `EventTaskModal.ts`, `EventTaskMobileScreen.ts` (class render), `EventTaskFormState.ts`, `EventTaskCaptureLauncher.ts` (fungsi routing, bukan Moment-eksklusif — dipakai Event/Task/Moment). Tidak ada lagi kandidat pindah tersisa dalam scope Task 9.

Checkpoint 2026-08-24 (Task 9 batch 3): `EventTaskMobileScreen.ts` sudah lebih dulu menerima aksi "switch ke Event/Task" lewat callback constructor (`openScheduledItem`) alih-alih mengimpor launcher-nya sendiri; `EventTaskModal.ts` (desktop) belum — `renderTabs()`/`activate()`-nya memanggil `openDesktopScheduledItemCreate` langsung, yang akan membentuk import cycle dua-file kalau fungsi itu diekstrak (launcher perlu class untuk konstruksi; class perlu fungsi routing launcher). Diterapkan pola constructor-injection yang sama seperti mobile: `EventTaskModal` sekarang menerima `openScheduledItem: (kind: "task" | "event") => void` dan memanggilnya dari `activate()`, tidak lagi mengimpor `openDesktopScheduledItemCreate`. Dengan cycle risk hilang, `openEventTaskForm`/`openDesktopScheduledItemCreate` diekstrak ke file baru `EventTaskCaptureLauncher.ts` mengikuti bentuk "Capture launch/orchestration" yang sudah ada (`ScheduledItemEditor.ts`, `ScheduledItemMobileCreateLauncher.ts`). `EventTaskModal.ts` sekarang hanya meng-export class render-nya. 3 consumer nyata (`main.ts`, `TimelineView.ts`; `ActiveNoteManagerModal.ts` lewat `main.ts`) dialihkan ke `./EventTaskCaptureLauncher`. Test komposisi diupdate untuk membaca file baru. Full CI (format, lint, typecheck, 299 tes, build produksi, verifikasi artifact, docs build) lulus tanpa import cycle baru.

Checkpoint 2026-08-24 (Task 9 batch 2): `EventTaskSubmission.ts` (`submitInbox`, `retryRelatedSubmission`, tipe hasil bersama — sudah Moment-eksklusif sejak `submitEventTask` dihapus) dipindah ke `features/capture/moment/application/EventTaskSubmission.ts`, nama file/simbol dipertahankan. Seluruh consumer (`EventTaskModal.ts`, `EventTaskMobileScreen.ts`, `SubmissionPolicy.ts`, 2 test file) direct-import, shim root telah dihapus, full CI dengan 299 tes diverifikasi. Manual acceptance testing dilewati atas persetujuan eksplisit pengguna.

Checkpoint 2026-08-24 (Task 9 batch 1): Ditemukan dan dibuktikan lewat tracing bahwa `EventTaskModal.ts`/`EventTaskMobileScreen.ts` hanya pernah dikonstruksi dengan kind "inbox" — `openEventTaskForm`/tombol tab Event/Task selalu redirect ke `ScheduledItemDesktopCreateModal.ts`/`ScheduledItemMobileCreateScreen.ts` sebelum field Event/Task dirender/dibaca. Kode render/submit Event/Task yang provably dead dihapus dari kedua shell (887→418 baris desktop, 764→371 baris mobile), lalu `submitEventTask` dihapus setelah terbukti zero caller. `EventTaskFormState.ts`/`SubmissionPolicy.ts` sengaja tidak disentuh — keduanya masih load-bearing. Full CI dengan 299 tes diverifikasi setelah setiap commit.

## Task 10 status: complete (2026-08-24)

Semua acceptance criteria tertutup: setiap renderer kategori hanya menerima `SettingsRenderContext` (app/settings/saveSettings/redisplay), bukan seluruh instance plugin; urutan kategori, copy, visibility, default, dan save behavior tidak berubah (pure code motion, tanpa logic baru); satu jalur persistence (`plugin.saveSettings()`) tetap satu-satunya jalur, dipanggil lewat `ctx.saveSettings()`. `SettingsTab.ts` turun dari 1355 baris jadi 169 baris — sekarang pure navigation shell (`display()`/`navigateTo()`/`renderRoot()`/`renderBackBar()`/`renderCategoryRow()`/`settingsContext()`), tanpa logic rendering kategori apa pun tersisa. Lanjut Task 11 (Decompose Timer) atau reprioritisasi sesuai arahan pengguna berikutnya.

Checkpoint 2026-08-24 (Task 10 batch 5, final): `renderFocusTimeline`/`renderTimelineAlignmentStatus` diekstrak ke `features/settings/ui/TimelineSettings.ts`. `SettingsTab.ts` selesai jadi thin shell. Full CI dengan 299 tes diverifikasi.

Checkpoint 2026-08-24 (Task 10 batch 4): `renderMomentCapture`/`renderEventCapture`/`renderTaskCapture`/`renderSharedNoteCreation`/`renderTaskAllowedSources` diekstrak ke `features/settings/ui/CaptureSettings.ts`. Method privat `renderProfilePicker` di `SettingsTab.ts` (sudah jadi duplikat sejak batch 3) dihapus — Moment/Event capture adalah dua caller terakhirnya. `SettingsTab.ts`: 948→330 baris.

Checkpoint 2026-08-24 (Task 10 batch 3): `renderDefaultDurations`/`renderFocusSessionCapture`/`renderDateGrouping`/`renderLogEntryFormat`/`renderBehavior` diekstrak ke `features/settings/ui/FocusSessionSettings.ts` di balik satu entry function `renderFocusSession()`. `renderProfilePicker` dipindah ke `SettingsFormFields.ts` karena Focus session capture butuh lebih dulu (Moment/Event capture masih pakai copy privat sampai batch 4). `SettingsTab.ts`: 1218→948 baris.

Checkpoint 2026-08-24 (Task 10 batch 2): `renderObjectsList`/`renderObjectSourceRow`/`renderObjectSourceEdit`/`renderContextSource`/`renderContextSourceFolders` diekstrak ke `features/settings/ui/ObjectSourceSettings.ts`, memakai `SettingsRenderContext` plus `ObjectSourceNavigation` (`toList`/`toSource`) untuk navigasi list↔edit yang kategori ini butuhkan. Method `saveContextSources()` (sekadar forward ke `plugin.saveSettings()`) dihapus — dipanggil `ctx.saveSettings()` langsung. `SettingsTab.ts`: 1355→948 baris (termasuk batch 1).

Checkpoint 2026-08-24 (Task 10 batch 1): Diperkenalkan `features/settings/ui/SettingsRenderContext.ts` (kontrak narrow: app/settings/saveSettings/redisplay) dan `SettingsFormFields.ts` (`contextTextField`/`contextSelectField`, dipindah verbatim dari method privat). `renderPeriodicalNotes`/`renderPeriodicalProfile` diekstrak ke `features/settings/ui/PeriodicalNotesSettings.ts`. `SettingsTab.ts`: 1355→1218 baris.
