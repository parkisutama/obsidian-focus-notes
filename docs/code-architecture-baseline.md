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
| Scheduled Item detail-note settings | `features/capture/scheduled-item/domain/DetailNoteSettings.ts` | Canonical owner; writer direct-import dan shim `types.ts` telah dihapus |
| Scheduled Item form semantics | `ScheduledItemFormData.ts`, `ScheduledItemFormAdapter.ts`, `EventTaskFormState.ts`, `SubmissionPolicy.ts` | `features/capture/scheduled-item/domain` or `application` according to side effects |
| Scheduled Item identity/parser | `ScheduledItemBlockId.ts`, `ScheduledItemParser.ts`, `ScheduledItemIdentityMigration.ts` | Domain; migration orchestration remains application |
| Scheduled Item block editing | `ScheduledItemBlockEditor.ts`, `LedgerRecordSource.ts` | Pure domain editing/snapshot contracts |
| Scheduled Item application | `ScheduledItemEditSubmission.ts`, `ScheduledItemCreateRelated.ts`, `RelatedWriteRecovery.ts`, `EventTaskSubmission.ts` | `features/capture/scheduled-item/application` |
| Scheduled Item persistence | `ScheduledItemBlockPersistence.ts`, `EventTaskWriter.ts` | Application port plus `infrastructure/obsidian` adapter |
| Capture launch/orchestration | `features/capture/domain/CaptureForm.ts`, `ScheduledItemEditor.ts`, `ScheduledItemMobileCreateLauncher.ts` | Shared contract dan routing composition; desktop/mobile renderer tetap terpisah |
| Scheduled Item desktop UI | `DesktopScheduledItemForm.ts`, `DesktopScheduledItemFormModel.ts`, `ScheduledItemDesktopCreateModal.ts`, `ScheduledItemDesktopEditModal.ts` | `features/capture/scheduled-item/ui/desktop` |
| Scheduled Item mobile UI | `MobileScheduledItemForm.ts`, `MobileScheduledItemFormModel.ts`, `MobileFormPolicy.ts`, `MobileViewport.ts`, `ScheduledItemMobileCreateScreen.ts`, `ScheduledItemMobileEditScreen.ts` | `features/capture/scheduled-item/ui/mobile` |
| Active legacy/delegating capture UI | `EventTaskModal.ts`, `EventTaskMobileScreen.ts` | Moment renderer plus cutover shell; split before retirement |
| Event domain | `EventTaskMarkdown.ts`, `EventLineEditor.ts`, `EventLedgerEditor.ts` | `features/capture/scheduled-item/domain/event` |
| Event legacy UI candidate | `EventEditModal.ts` | Prove inactive, then deletion-only batch |
| Task domain | `TaskLineEditor.ts`, `TaskLineLint.ts`, `TaskLedgerEditor.ts` | `features/capture/scheduled-item/domain/task` |
| Task formatting application/UI | `TaskFormatWriter.ts`, `TaskFormatPreviewModal.ts` | Task application and UI respectively |
| Task legacy UI candidate | `TaskEditModal.ts` | Prove inactive, then deletion-only batch |
| Detail note application | `DetailNotePromotion.ts` | Scheduled Item application |
| Related log semantics | `RelatedLog.ts` | Capture domain/application; not generic Markdown shared code |
| Active-note Scheduled Item management | `ActiveNoteLedger.ts`, `ActiveNoteManagerModel.ts`, `ActiveNoteManagerModal.ts` | Scheduled Item application/read model and UI |
| Timeline domain | `features/timeline/domain/Timeline.ts`, `features/timeline/domain/TimelineSettings.ts`, `features/timeline/domain/TimelineDate.ts`, `TimelineLayout.ts`, `TimelineSourceAlignment.ts`, `TimelineSourceGroups.ts`, `TimelineItemModalModel.ts` | Mode, settings, dan pure date helpers sudah canonical tanpa shim; implementasi root lain dipindahkan per batch |
| Timeline application | `ScheduledItemQuery.ts`, `ScheduledItemIndexer.ts` | Timeline query/index orchestration; Obsidian indexing behind adapter |
| Timeline UI | `TimelineView.ts`, `TimelineGrid.ts`, `TimelineSourceSidebar.ts`, `TimelineItemModal.ts` | `features/timeline/ui` |
| Scheduled mention domain/index | `ScheduledItemMentionIndex.ts` | Scheduled Item/query domain according to final consumers |
| Object Notes domain | `features/object-notes/domain/ContextSourceFilter.ts`, `features/object-notes/domain/ContextSourceSettings.ts`, `ObjectReference.ts`, `ContextSourceScope.ts` | Filter, source settings, dan persisted Inbox registry contract sudah canonical; seluruh consumer direct-import dan shim `types.ts` telah dihapus |
| Object Notes application | `ObjectNote.ts`, `ContextLinkResolver.ts` | `features/object-notes/application` with explicit link/vault ports |
| Object Notes UI | `ObjectNoteModal.ts`, `ObjectNoteSuggest.ts` | `features/object-notes/ui` |
| Obsidian suggestion/link adapters | `ObsidianInboxSuggestionSource.ts`, `ObsidianLinkResolver.ts`, `ObsidianScheduledItemMentionSource.ts`, `Suggesters.ts` | `infrastructure/obsidian` with feature-facing interfaces |
| Periodical Notes domain | `features/periodical-notes/domain/PeriodicalNote.ts`, `DailyNotePath.ts`, `PeriodicalNoteSettings.ts` | Kontrak profile/settings sudah canonical; resolver dan helper dipindahkan pada batch terpisah |
| Target resolution | `features/capture/domain/CaptureTarget.ts`, `CaptureTarget.ts`, `TargetResolver.ts` | Kontrak dan pure selection policy dimiliki capture; Obsidian resolution adapter menuju infrastructure |
| Markdown insertion primitive | `shared/markdown/InsertPosition.ts`, `HeadingInsertion.ts` | Semantik posisi canonical di shared Markdown karena dipakai capture, Focus Session, Object Notes, dan writer; operasi insert tetap dipisahkan dari kontraknya |
| Focus note persistence | `NoteWriter.ts` | `infrastructure/obsidian` implementing focus-session write port |
| Settings domain/persistence | `StateStore.ts` | Persistence adapter; settings normalization split from plugin storage |
| Settings UI | `SettingsLayout.ts`, `SettingsTab.ts` | `features/settings/ui`, one category per extraction batch |

## Legacy candidate rules

Sebuah file hanya boleh dihapus bila seluruh kondisi berikut terpenuhi:

1. Tidak ada runtime import atau dynamic launcher yang merujuk file tersebut.
2. Active desktop dan mobile entry points memiliki characterization coverage.
3. Golden/no-op Markdown tests tetap byte-identical.
4. Deletion dipisahkan dari move, rename, copy change, dan behavior fix.
5. Penghapusan telah disetujui karena merupakan compatibility-sensitive action.

## Batch berikutnya

1. Audit modul pure Scheduled Item terhadap boundary domain dan import Obsidian/DOM.
2. Pilih kelompok kohesif berukuran kecil untuk pemindahan fisik pertama Task 7.
3. Pertahankan parser legacy, format Markdown, dan byte-identical no-op melalui characterization tests.
4. Perlakukan penolakan dot-segment vault path sebagai hardening behavior-change terpisah, bukan bagian refactor.

Checkpoint 2026-08-22: Task 6 selesai. Timeline date helpers, Obsidian file guards, dan vault folder mutation sudah berada pada owner canonical; seluruh consumer cut over dan central `utils.ts` dihapus. Lima characterization test mengunci perilaku folder lama, sehingga suite menjadi 306 tes; full CI diverifikasi pada checkpoint ini.
