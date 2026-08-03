# Peta fitur

Halaman ini memetakan perilaku user ke pemilik implementasi utama. Ini adalah titik awal reference, bukan pengganti dokumentasi API setiap modul.

## Timer dan session logging

| Concern | Implementasi utama |
|---|---|
| State countdown dan stopwatch | `src/TimerEngine.ts` |
| Panel dan orchestration sesi | `src/TimerView.ts` |
| Resolusi note tujuan | `src/TargetResolver.ts` |
| Penulisan Markdown sesi | `src/NoteWriter.ts` |
| Pembacaan recent entries | `src/RecentEntriesReader.ts` |

## Inbox quick capture

| Concern | Implementasi utama |
|---|---|
| State bersama Inbox/Event/Task | `src/EventTaskFormState.ts` |
| Target Inbox | `src/InboxTarget.ts` |
| Format bullet dan relative link | `src/InboxMarkdown.ts` |
| Mention dan tag suggestions | `src/InboxSuggestions.ts` |
| Editor link hidup | `src/InboxNotesController.ts` |
| Model dan ID Object Sources baru | `src/ContextSourceSettings.ts` |
| Path, template expansion, dan Object Note writer | `src/ObjectNote.ts` |
| Modal pembuatan Object Note | `src/ObjectNoteModal.ts` |
| Resolusi link ke source context | `src/ContextLinkResolver.ts` |
| Format append-only historical log | `src/RelatedLog.ts` |
| Receipt dan failed-destination-only retry | `src/RelatedWriteRecovery.ts` |
| Submission orchestration | `src/EventTaskSubmission.ts` |

## Event dan Task

| Concern | Implementasi utama |
|---|---|
| Desktop modal | `src/EventTaskModal.ts` |
| Mobile screen | `src/EventTaskMobileScreen.ts` |
| Record writer | `src/EventTaskWriter.ts` |
| Shared form state | `src/EventTaskFormState.ts` |
| Contextual write dan partial outcome | `src/EventTaskSubmission.ts` |

## Focus Timeline

| Concern | Implementasi utama |
|---|---|
| Parsing source Markdown | `src/ScheduledItemParser.ts` |
| Indexing source folders | `src/ScheduledItemIndexer.ts` |
| Effective source scope dan target mismatch | `src/TimelineSourceAlignment.ts` |
| Source groups dan accepted headings | `src/TimelineSourceGroups.ts` |
| Range dan source queries | `src/ScheduledItemQuery.ts` |
| Layout model | `src/TimelineLayout.ts` |
| Model presentasi detail dan pending | `src/TimelineItemModalModel.ts` |
| Modal detail item dan daftar pending | `src/TimelineItemModal.ts` |
| Workspace view | `src/TimelineView.ts` |

`ScheduledItem.source.groupId` mengendalikan visibility, warna, dan agregasi sidebar. `ScheduledItem.source.filePath`, heading path, dan line number tetap menjadi provenance untuk navigasi. Indexer hanya menerima record di bawah accepted heading; Task tanpa metadata temporal tidak masuk projection Timeline.

## Settings dan persistence

| Concern | Implementasi utama |
|---|---|
| Settings schema dan defaults | `src/types.ts` |
| Settings UI | `src/SettingsTab.ts` |
| Load, migration, dan save | `src/StateStore.ts` |
| Plugin lifecycle | `src/main.ts` |

`ContextSourceSettings.templatePath` menyimpan path note template opsional yang sudah dinormalisasi. Object Note creation memakai fallback minimal saat template kosong dan selalu memastikan property filter source ada di frontmatter. `placement` menentukan default `flat` atau `folder-note`, tetapi dapat dioverride dalam modal. Field `peopleFolders` dan `placeFolders` hanya dibaca oleh migrasi data lama; runtime dan state kanonik memakai `contextSources` saja.

Status reliability setiap area dicatat di dokumen internal `docs/development-status.md` dan tidak dipublikasikan melalui VitePress.
