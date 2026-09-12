# Code architecture baseline

Tanggal audit: 2026-08-22

## Current organization checkpoint (2026-08-30)

Reorganisasi fisik Tasks 1–23 sudah menutup migration inventory. `src/main.ts` adalah satu-satunya TypeScript module di root dan hanya mengekspor `plugin/FocusNotesPlugin.ts`. Implementasi feature sekarang dimiliki oleh `features/<capability>/{domain,application,ui}`, sedangkan adapter konkret berada di `infrastructure/obsidian/{capture,focus-session,timeline,suggestions,vault}`.

Aturan dependensi yang aktif dan diuji:

- plugin boleh merangkai feature dan infrastructure; feature tidak boleh mengimpor plugin;
- domain tidak boleh mengimpor Obsidian atau outer layer;
- `shared` tidak boleh mengimpor feature;
- production tidak boleh mengimpor `legacy`, dan seluruh relative source graph harus acyclic;
- tiga UI yang tidak lagi memiliki consumer tetap dikarantina di `src/legacy/`, tidak dihapus.

`MoodReference.ts` sudah berada di Reflection domain, tetapi pemecahan static dataset/API sengaja menjadi Task 24 agar didahului characterization coverage. Bagian ownership/checkpoint lama di bawah dipertahankan sebagai catatan keputusan historis; path canonical terkini mengikuti pohon source dan guard arsitektur.

Quality remediation Tasks 24–27 kemudian selesai dengan characterization-first extraction: Mood API menjadi facade kecil di atas katalog/type terpisah, Moment suggestion controller memisahkan DOM dan presentation, dan form Scheduled Item desktop/mobile memisahkan section melalui callback sempit. Bukti otomatis dan checklist runtime terbaru dicatat di `docs/refactor-acceptance.md`.

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
| Focus session domain | `features/focus-session/domain/Timer.ts`, `features/focus-session/domain/SessionRecord.ts`, `features/focus-session/domain/TimerEngine.ts` | Sudah canonical tanpa shim. `TimerEngine.ts` sudah murni sejak awal (tanpa import Obsidian, hanya `window.setInterval`) — pemindahan fisik ke domain adalah relokasi murni, bukan pemurnian |
| Focus session UI | `TimerView.ts`, `features/focus-session/ui/CircularDisplay.ts`, `LogModal.ts`, `TimerControls.ts`, `TimerTargetEditor.ts`, `TimerRecentEntries.ts`, `TimerLogWorkflow.ts` | `TimerView.ts` tetap di root sebagai thin ItemView shell (114 baris) — pola yang sama seperti `SettingsTab.ts`/`EventTaskModal.ts`: composition/lifecycle tetap di root, isi kategori/section pindah ke `features/`. `CircularDisplay.ts`/`LogModal.ts` sudah self-contained sebelum dipindah (tanpa restrukturisasi). `TimerControls`/`TimerTargetEditor`/`TimerRecentEntries`/`TimerLogWorkflow` diekstrak dari `TimerView.ts` (700→114 baris) — lihat catatan Task 11 di bawah |
| Focus session application/read model | `RecentEntriesReader.ts`, `NoteWriter.ts` | Masih di root — di luar scope Task 11 (fokus Task 11 adalah dekomposisi `TimerView.ts`, bukan pemindahan port ini) |
| Reflection/CBT domain | `features/reflection/domain/Wellbeing.ts`, `CognitiveDistortions.ts`, `MoodReference.ts`, `EmotionalWellbeingReference.ts` | Kontrak wellbeing sudah canonical; reference data lain menyusul berdasarkan consumer |
| Reflection/CBT UI | `EmotionalWellbeingPicker.ts`, `ReflectionFocusModal.ts` | `features/reflection/ui`. `MoodPicker.ts` **dikoreksi keluar** — ditemukan dead (Task 13, 2026-08-24): zero import di seluruh `src/`/`test/`, sudah digantikan `EmotionalWellbeingPicker.ts` (keduanya baca dari `MoodReference.ts`, yang tetap live lewat consumer lain). Penghapusan sengaja tidak dieksekusi — pengguna memilih "Leave all 3 alone" |
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
| Event legacy UI candidate | `EventEditModal.ts` | **Terbukti inactive (Task 13, 2026-08-24)**: zero import di seluruh `src/`/`test/`. Penghapusan sengaja tidak dieksekusi — pengguna memilih "Leave all 3 alone" saat ditanya (lihat catatan Task 13) — dicatat di sini untuk sesi berikutnya, bukan diabaikan |
| Task domain/persistence | `features/capture/scheduled-item/domain/TaskLineEditor.ts`, `features/capture/scheduled-item/domain/TaskLineLint.ts`, `infrastructure/obsidian/TaskLedgerEditor.ts` | Sudah canonical tanpa shim. `TaskLedgerEditor.ts` sama alasan dengan `EventLedgerEditor.ts` — masuk infrastructure |
| Task formatting domain/infrastructure/UI | `features/capture/scheduled-item/domain/TaskFormatWriter.ts`, `infrastructure/obsidian/TaskFormatWriter.ts`, `TaskFormatPreviewModal.ts` | `applyTaskFormatChanges`/`TaskFormatChange` (pure) dan `saveTaskFormatChanges` (adapter) sudah dipisah dan canonical; seluruh consumer direct-import dan shim root telah dihapus |
| Task legacy UI candidate | `TaskEditModal.ts` | **Terbukti inactive (Task 13, 2026-08-24)**: zero import di seluruh `src/`/`test/`; juga sudah dicatat "dead code" di `tasks/backlink-and-task-links-plan.md` dari upaya terpisah sebelumnya. Penghapusan sengaja tidak dieksekusi — pengguna memilih "Leave all 3 alone" (lihat catatan Task 13) |
| Active-note Scheduled Item management | `ActiveNoteLedger.ts`, `ActiveNoteManagerModel.ts`, `ActiveNoteManagerModal.ts` | Scheduled Item application/read model and UI |
| Timeline domain | `features/timeline/domain/Timeline.ts`, `features/timeline/domain/TimelineSettings.ts`, `features/timeline/domain/TimelineDate.ts`, `TimelineLayout.ts`, `TimelineSourceAlignment.ts`, `TimelineSourceGroups.ts`, `TimelineItemModalModel.ts` | Mode, settings, dan pure date helpers sudah canonical tanpa shim; `TimelineLayout.ts`/`TimelineSourceAlignment.ts`/`TimelineSourceGroups.ts`/`TimelineItemModalModel.ts` tetap di root — di luar scope Task 12 (fokusnya dekomposisi `TimelineView.ts`, bukan pemindahan file domain pure yang sudah tanpa shim) |
| Timeline application | `ScheduledItemQuery.ts`, `ScheduledItemIndexer.ts` | Timeline query/index orchestration; Obsidian indexing behind adapter. Tetap di root — di luar scope Task 12 |
| Timeline UI shell | `TimelineView.ts` | Sudah jadi thin ItemView shell (442→196 baris) — pola yang sama seperti `SettingsTab.ts`/`EventTaskModal.ts`/`TimerView.ts`: lifecycle (`constructor`/`onOpen`/`onClose`/`getViewType`/`getDisplayText`/`getIcon`/`getState`/`setState`) plus mode/anchorDate range state dan `currentRange()`/`shift()`, meng-compose empat class baru — lihat catatan Task 12 di bawah |
| Timeline UI sections | `features/timeline/ui/TimelineIndex.ts`, `TimelineHeader.ts`, `TimelineModalLauncher.ts`, `TimelineContentRenderer.ts` | Diekstrak dari `TimelineView.ts`: `TimelineIndex` (indexing/query orchestration — `refreshIndex()` mengembalikan status disabled/empty/ok/error, bukan langsung memanggil render), `TimelineHeader` (navigasi — callback-driven, tanpa logic mutasi settings sendiri), `TimelineModalLauncher` (modal launching), `TimelineContentRenderer` (grid/sidebar body — meng-compose ketiga class lain) |
| Timeline UI (existing, tidak berubah) | `TimelineGrid.ts`, `TimelineSourceSidebar.ts`, `TimelineItemModal.ts` | Tetap di root — sudah class terpisah sebelum Task 12, tidak perlu restrukturisasi |
| Scheduled mention domain/index | `ScheduledItemMentionIndex.ts` | Scheduled Item/query domain according to final consumers |
| Object Notes domain | `features/object-notes/domain/ContextSourceFilter.ts`, `features/object-notes/domain/ContextSourceSettings.ts`, `ContextSourceScope.ts` | Filter, source settings, dan persisted Inbox registry contract sudah canonical; seluruh consumer direct-import dan shim `types.ts` telah dihapus. `ObjectReference.ts` **dikoreksi keluar** dari baris ini — evidence consumer menunjukkan dipakai lintas capture (Moment+Event+Task), bukan `ObjectNote.ts`; sudah pindah ke `features/capture/domain/` |
| Object Notes required-property schema (2026-09, required-property-schema feature) | `features/object-notes/domain/RequiredPropertySchema.ts`, `RequiredPropertyGaps.ts`, `ObjectNoteTemplate.ts` | `ContextSourceSettings.filter` (single identity) digantikan `requiredProperties: RequiredPropertySchema[]`; `ContextSourceFilter.ts` **tidak dihapus** — tetap dipakai sebagai tipe pasangan match yang diturunkan lewat `identityEntry()` di `ContextSourceScope.ts`, dikonsumsi apa adanya oleh `Timeline.ts`/`TimelineSourceGroups.ts` tanpa perubahan. `ObjectNoteTemplate.ts` diekstrak dari `ObjectNote.ts` (application) murni supaya modul infrastructure baru bisa memakainya tanpa membentuk dependency infrastructure→application; `ObjectNote.ts` tetap re-export `expandObjectNoteTemplate` untuk compatibility consumer lama |
| Object Notes required-property infrastructure (2026-09) | `infrastructure/obsidian/templater/TemplaterApi.ts`, `infrastructure/obsidian/object-notes/RequiredPropertyResolution.ts`, `RepairObjectNotes.ts`, `RequiredPropertyRepairWatcher.ts` | Resolusi default value (token statis + Templater opsional lewat API undocumented, diprobe defensif, tidak pernah jadi hard dependency), command "Repair Object Note properties", dan watcher auto-repair (`vault.on("modify")` + `workspace.on("file-open")`, dengan `WriteSuppressionTracker` sendiri agar tidak re-entry ke tulisan sendiri) — lihat `docs/archive/specs/spec-object-source-required-properties.md` dan ADR-002. `RequiredPropertyRepairWatcher.ts` sengaja tidak memakai TypeScript constructor parameter property karena `node --test`'s native TS stripping menolak sintaks itu (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`), berbeda dari kelas lama (`TaskReferenceCheckboxWatcher.ts`, `Suggesters.ts`) yang memakainya tapi tidak pernah diimpor langsung oleh test |
| Object Notes application | `ObjectNote.ts` | `features/object-notes/application`. `ContextLinkResolver.ts` **dikoreksi keluar** — `ObjectNote.ts` tidak pernah mengimpornya; sudah pindah ke `features/capture/application/` |
| Object Notes UI | `ObjectNoteModal.ts`, `ObjectNoteSuggest.ts` | `features/object-notes/ui` |
| Obsidian suggestion/link adapters | `infrastructure/obsidian/ObsidianInboxSuggestionSource.ts`, `infrastructure/obsidian/ObsidianLinkResolver.ts`, `infrastructure/obsidian/ObsidianScheduledItemMentionSource.ts`, `infrastructure/obsidian/suggestions/Suggesters.ts` | Semuanya sudah canonical di `infrastructure/obsidian/`, mengikuti pola fungsi `async (app: App, ...)` yang sudah ada; seluruh consumer direct-import dan shim root telah dihapus. `Suggesters.ts` (2026-09) menambah `PropertySuggest` untuk autocomplete nama property dari `MetadataCache.getAllPropertyInfos` (undocumented, diprobe defensif) |
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

## Task 13 status: complete (2026-08-24)

Semua acceptance criteria tertutup: `main.ts` turun dari 181 ke 147 baris — satu-satunya tempat yang berisi feature business logic (`openActiveNoteManager`: baca file, scan ledger/checklist scope, wiring modal) diekstrak ke `ActiveNoteManagerLauncher.ts`, mengikuti pola "Capture launch/orchestration" yang sudah ada (`ScheduledItemEditor.ts`, `EventTaskCaptureLauncher.ts`); `main.ts` sekarang murni lifecycle + composition (registrasi command/ribbon/view, load/save settings, activate-view boilerplate). Semua identifier command/ribbon/view/manifest/CSS/console dipertahankan — `test/compatibility-identifiers.test.ts` lulus tanpa perubahan. Audit shim/dead-import/empty-folder: tidak ada folder kosong di `features/`, tidak ada file re-export shim tersisa, `biome lint` bersih di seluruh repo. Ditemukan 3 file dengan zero runtime import (`EventEditModal.ts`, `TaskEditModal.ts` — sudah lama ditandai di ownership map sebagai kandidat legacy; `MoodPicker.ts` — temuan baru, digantikan `EmotionalWellbeingPicker.ts`) tapi **sengaja tidak dihapus** atas keputusan eksplisit pengguna ("Leave all 3 alone") — dicatat di baris ownership map masing-masing untuk sesi berikutnya, bukan diabaikan.

Sama seperti Task 9–12: tidak ada automated test coverage untuk `main.ts`/`ActiveNoteManagerLauncher.ts` (bergantung pada `Plugin`/`Modal` Obsidian live). Verifikasi bergantung pada diff review + full CI, bukan smoke test manual.

Checkpoint 2026-08-24 (Task 13, satu batch): `openActiveNoteManager` diekstrak ke `ActiveNoteManagerLauncher.ts` (fungsi async biasa menerima app/getSettings/owner/file, bukan bound method pada instance plugin). Audit shim/dead-import/empty-folder dijalankan — hasil di atas. Full CI (format, lint, typecheck, 299 tes, build produksi, verifikasi artifact, docs build) lulus.

## Task 12 status: complete (2026-08-24)

Semua acceptance criteria tertutup: query/layout/index logic (`TimelineIndex`, `ScheduledItemQuery`, `TimelineLayout`) tetap pure atau di balik port sempit — `TimelineIndex.refreshIndex()` mengembalikan status (`disabled`/`empty`/`ok`/`error`) alih-alih langsung memanggil render, menjaga pemisahan "orchestration memutuskan state, view memutuskan piksel"; view ID (`focus-timeline-view`), view state (`mode`/`anchorDate` lewat `getState()`/`setState()`), source classification, date range, dan edit launching tidak berubah (pure code motion, diverifikasi lewat diff review + full CI). Refresh listener (vault/metadataCache event registrations) tetap dimiliki dan dibersihkan oleh shell (`TimelineView.onOpen()`/`Component.register()`), sesuai kriteria "Refresh listeners are owned and cleaned up by the shell". Lanjut Task 13 (Thin plugin composition and remove shims) atau reprioritisasi sesuai arahan pengguna berikutnya.

Sama seperti Task 9/10/11: tidak ada automated test coverage untuk `TimelineView.ts` maupun kelas-kelas UI yang diekstrak (`TimelineHeader`, `TimelineModalLauncher`, `TimelineContentRenderer`) — semuanya bergantung pada kelas Obsidian live (`ItemView`, modal Obsidian) yang tidak bisa di-mock di `node:test`. `TimelineIndex` murni menerima app/getSettings/saveSettings tapi juga belum punya unit test langsung sebagai kelas terisolasi (logic query/index-nya sendiri — `ScheduledItemQuery`, `ScheduledItemIndexer` — sudah diuji lewat test lain yang sudah ada). Verifikasi bergantung pada diff review + full CI, bukan smoke test manual — gap yang sama, dicatat di sini, bukan diabaikan.

Checkpoint 2026-08-24 (Task 12 batch 4, final): `renderContent`/`renderDisabled`/`buildSourceSummaries` diekstrak ke `features/timeline/ui/TimelineContentRenderer.ts`, meng-compose `TimelineIndex`/`TimelineHeader`/`TimelineModalLauncher` (semua dipegang lewat referensi) dengan instance `ScheduledItemQuery`/`TimelineLayout` sendiri untuk merender sidebar sumber dan grid hari/minggu, sinkronisasi kontrol header setelah setiap render. `TimelineView.ts`: 273→196 baris — sekarang ItemView shell murni (lifecycle plus mode/anchorDate range state dan `currentRange()`/`shift()`), meng-compose keempat class baru.

Checkpoint 2026-08-24 (Task 12 batch 3): Header bar (title, tombol add, toggle source-sidebar, week label, prev/today/next, tombol weekly-open, mode select, refresh) plus `addButton()`/`openWeeklyPlanner()` diekstrak ke `features/timeline/ui/TimelineHeader.ts`. Menerima callback untuk setiap aksi (`onAdd`/`onToggleSidebar`/`onPrev`/`onToday`/`onNext`/`onModeChange`/`onRefresh`) alih-alih memegang referensi ke seluruh ItemView, dan tidak menyimpan logic mutasi settings sendiri. Mengekspos `syncControls()` (dipanggil setelah setiap content render) dan `setMode()` (dipanggil dari `setState()`). `VIEW_TYPE_FOCUS_TIMELINE` di-passing lewat options, bukan di-import, untuk menghindari import cycle dengan `TimelineView.ts`. `TimelineView.ts`: 345→273 baris.

Checkpoint 2026-08-24 (Task 12 batch 2): `openItemDetails`/`openItemEditor`/`openPendingItems`/`openSourceItem` diekstrak ke `features/timeline/ui/TimelineModalLauncher.ts`, menerima app/getSettings plus callback `onRefreshNeeded` sempit alih-alih memegang referensi ke seluruh ItemView. `TimelineView.ts`: 379→345 baris.

Checkpoint 2026-08-24 (Task 12 batch 1): `items`/`parser`/`indexRefreshTimer`/`refreshIndex`/`scheduleIndexRefresh`/`ensureSourceSettings`/`colorFor`/`isInSourceScope`/`getEffectiveSourceGroups`/`Folders`/`Headings` diekstrak ke `features/timeline/ui/TimelineIndex.ts`. `refreshIndex()` sekarang mengembalikan status disabled/empty/ok/error alih-alih langsung memanggil method render, jadi `TimelineView` yang memutuskan apa yang dirender. Mengekspos `dispose()` untuk debounce timer yang pending, disambungkan lewat `Component.register()`. `TimelineView.ts`: 442→379 baris.

## Task 11 status: complete (2026-08-24)

Semua acceptance criteria tertutup: `TimerView.ts` sekarang hanya memiliki Obsidian ItemView lifecycle dan composition (constructor/onOpen/onClose/getViewType/getDisplayText/getIcon), 700→114 baris; `TimerEngine` tetap murni (tidak ada import Obsidian, hanya `window.setInterval`/`window.clearInterval`) — pemindahannya ke `features/focus-session/domain/` adalah relokasi murni, transisi state tidak berubah; view ID (`focus-notes-view`), restorasi, format log Markdown, dan interaction behavior tidak berubah (pure code motion, diverifikasi lewat diff review + full CI, tanpa logic baru). Lanjut Task 12 (Decompose Timeline) atau reprioritisasi sesuai arahan pengguna berikutnya.

Sama seperti Task 9/10: tidak ada automated test coverage untuk `TimerView.ts` maupun kelas-kelas UI yang diekstrak (`TimerControls`, `TimerTargetEditor`, `TimerRecentEntries`, `TimerLogWorkflow`) — semuanya bergantung pada kelas Obsidian live (`ItemView`, `Menu`, `Modal`) yang tidak bisa di-mock di `node:test`. `TimerEngine.ts` sendiri murni tapi juga belum punya unit test langsung (hanya `toEngineMode` di `Timer.ts` yang diuji). Verifikasi bergantung pada diff review + full CI (format/lint/typecheck/299 tes/build/artifact/docs), bukan smoke test manual — gap yang sama, dicatat di sini, bukan diabaikan.

Checkpoint 2026-08-24 (Task 11 batch 5, final): Mode selector, focus-on input, circular display, duration row, dan tombol Discard/Start-Pause/Stop diekstrak ke `features/focus-session/ui/TimerControls.ts`. Kelas ini memiliki `currentMode` dan membaca/menulis `TimerEngine` yang diinjeksi, mengekspos accessor sempit (`getCurrentMode`/`getFocusInputValue`/`parseMinutes`) dan method refresh yang dipanggil balik oleh callback `TimerLogWorkflow`. `TimerView.ts`: 388→114 baris — sekarang pure ItemView shell yang meng-compose `TimerControls`, `TimerTargetEditor`, `TimerRecentEntries`, dan `TimerLogWorkflow` di sekitar satu `TimerEngine` bersama.

Checkpoint 2026-08-24 (Task 11 batch 4): `handleStopAndLog`/`handleComplete`/`openLogModal`/`beep` diekstrak ke `features/focus-session/ui/TimerLogWorkflow.ts`, menerima options object (app/engine/getSettings/buildWriter/buildResolver plus callback accessor sempit untuk currentMode, nilai focus input, planned minutes, dan dua callback notifikasi perubahan) alih-alih memegang referensi ke seluruh ItemView. `TimerView.ts`: 482→388 baris.

Checkpoint 2026-08-24 (Task 11 batch 3): Panel collapsible "Recent in section" (render, refresh, navigasi open-at-line) diekstrak ke `features/focus-session/ui/TimerRecentEntries.ts`, menerima app/getSettings/buildResolver/buildReader plus ItemView pemilik sebagai `Component` (hanya untuk mengikat cleanup `MarkdownRenderer` ke lifecycle view). `TimerView.ts`: 537→482 baris.

Checkpoint 2026-08-24 (Task 11 batch 2): Section collapsible "Log target" (input file/heading/position/group-by-date, preview target resolved, listener vault-modify) diekstrak ke `features/focus-session/ui/TimerTargetEditor.ts`, menerima app/getSettings/saveSettings/buildResolver plus callback `onTargetChanged` sempit dan callback `registerEvent` (mencerminkan `Component.registerEvent`) alih-alih memegang referensi ke seluruh ItemView. `TimerView.ts`: 700→537 baris.

Checkpoint 2026-08-24 (Task 11 batch 1): `TimerEngine.ts` dipindah ke `features/focus-session/domain/` (sudah murni sejak awal, tanpa import Obsidian — relokasi murni). `CircularDisplay.ts` dan `LogModal.ts` dipindah ke `features/focus-session/ui/` (keduanya sudah self-contained, tanpa restrukturisasi). Nama file dan simbol yang di-export dipertahankan; hanya path import yang disesuaikan. `TimerView.ts` (satu-satunya consumer ketiganya) dialihkan ke lokasi baru.

## Task 10 status: complete (2026-08-24)

Semua acceptance criteria tertutup: setiap renderer kategori hanya menerima `SettingsRenderContext` (app/settings/saveSettings/redisplay), bukan seluruh instance plugin; urutan kategori, copy, visibility, default, dan save behavior tidak berubah (pure code motion, tanpa logic baru); satu jalur persistence (`plugin.saveSettings()`) tetap satu-satunya jalur, dipanggil lewat `ctx.saveSettings()`. `SettingsTab.ts` turun dari 1355 baris jadi 169 baris — sekarang pure navigation shell (`display()`/`navigateTo()`/`renderRoot()`/`renderBackBar()`/`renderCategoryRow()`/`settingsContext()`), tanpa logic rendering kategori apa pun tersisa.

Checkpoint 2026-08-24 (Task 10 batch 5, final): `renderFocusTimeline`/`renderTimelineAlignmentStatus` diekstrak ke `features/settings/ui/TimelineSettings.ts`. `SettingsTab.ts` selesai jadi thin shell. Full CI dengan 299 tes diverifikasi.

Checkpoint 2026-08-24 (Task 10 batch 4): `renderMomentCapture`/`renderEventCapture`/`renderTaskCapture`/`renderSharedNoteCreation`/`renderTaskAllowedSources` diekstrak ke `features/settings/ui/CaptureSettings.ts`. Method privat `renderProfilePicker` di `SettingsTab.ts` (sudah jadi duplikat sejak batch 3) dihapus — Moment/Event capture adalah dua caller terakhirnya. `SettingsTab.ts`: 948→330 baris.

Checkpoint 2026-08-24 (Task 10 batch 3): `renderDefaultDurations`/`renderFocusSessionCapture`/`renderDateGrouping`/`renderLogEntryFormat`/`renderBehavior` diekstrak ke `features/settings/ui/FocusSessionSettings.ts` di balik satu entry function `renderFocusSession()`. `renderProfilePicker` dipindah ke `SettingsFormFields.ts` karena Focus session capture butuh lebih dulu (Moment/Event capture masih pakai copy privat sampai batch 4). `SettingsTab.ts`: 1218→948 baris.

Checkpoint 2026-08-24 (Task 10 batch 2): `renderObjectsList`/`renderObjectSourceRow`/`renderObjectSourceEdit`/`renderContextSource`/`renderContextSourceFolders` diekstrak ke `features/settings/ui/ObjectSourceSettings.ts`, memakai `SettingsRenderContext` plus `ObjectSourceNavigation` (`toList`/`toSource`) untuk navigasi list↔edit yang kategori ini butuhkan. Method `saveContextSources()` (sekadar forward ke `plugin.saveSettings()`) dihapus — dipanggil `ctx.saveSettings()` langsung. `SettingsTab.ts`: 1355→948 baris (termasuk batch 1).

Checkpoint 2026-08-24 (Task 10 batch 1): Diperkenalkan `features/settings/ui/SettingsRenderContext.ts` (kontrak narrow: app/settings/saveSettings/redisplay) dan `SettingsFormFields.ts` (`contextTextField`/`contextSelectField`, dipindah verbatim dari method privat). `renderPeriodicalNotes`/`renderPeriodicalProfile` diekstrak ke `features/settings/ui/PeriodicalNotesSettings.ts`. `SettingsTab.ts`: 1355→1218 baris.
