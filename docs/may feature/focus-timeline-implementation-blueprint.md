# Focus Timeline Implementation Blueprint

## Purpose

Dokumen ini adalah blueprint implementasi untuk memperluas plugin `Focus Notes` menjadi:

- `Focus Notes` untuk timer + logging yang sudah ada
- `Focus Timeline` untuk menampilkan event dan task lintas note dalam mode `Day` dan `Multi-day`

Blueprint ini ditulis agar dapat dipakai oleh LLM atau engineer lain untuk mengimplementasikan fitur secara bertahap dari business logic sampai UI user-facing.

## Product Summary

Fitur baru menambahkan view planner/timeline terpisah yang:

- membaca event dan task dari banyak markdown notes
- menampilkan item sebagai block waktu, point item, due item, dan pending task
- selalu menampilkan konteks sumber note
- memiliki sidebar kiri untuk show/hide sumber notes
- dapat di-switch antara `Day` dan `Multi-day`

Fitur ini tidak menggantikan timer view yang sudah ada.

## Existing Codebase Constraints

Komponen saat ini yang harus dipertahankan:

- `src/main.ts`
- `src/TimerView.ts`
- `src/TimerEngine.ts`
- `src/NoteWriter.ts`
- `src/RecentEntriesReader.ts`
- `src/SettingsTab.ts`
- `src/types.ts`

Prinsip implementasi:

- jangan campur domain timeline ke `RecentEntriesReader`
- jangan tempel planner ke `TimerView`
- register view baru terpisah untuk timeline
- domain model timeline harus dipisah dari `SessionRecord`

## Final Markdown Grammar

### Event

Contoh:

```md
- 2026-05-24 15:00 - 16:00 Testing
- 2026-05-24 22:00 - 2026-05-25 02:00 Deployment window
```

Grammar:

```text
- <YYYY-MM-DD HH:mm> - <HH:mm | YYYY-MM-DD HH:mm> <title>
```

Aturan:

- start wajib datetime penuh
- end boleh `HH:mm` jika masih hari yang sama
- end boleh datetime penuh untuk event lintas hari
- title adalah semua teks setelah waktu akhir
- format longgar seperti `9:00`, `9am`, `2026/05/24` tidak didukung

### Task

Contoh:

```md
- [ ] Update CSV blok | due:2026-05-23 | remind:2026-05-23 18:11
- [ ] Agenda meeting | start:2026-05-20 14:00 | end:2026-05-20 15:00 | due:2026-05-20
- [x] Daftar aplikasi | due:2026-05-19
```

Grammar:

```text
- [ ] <title> | key:value | key:value
- [x] <title> | key:value | key:value
```

Key yang didukung:

- `due:YYYY-MM-DD`
- `remind:YYYY-MM-DD HH:mm`
- `start:YYYY-MM-DD HH:mm`
- `end:YYYY-MM-DD HH:mm`

Aturan:

- title adalah teks sebelum metadata pertama
- separator metadata adalah `|`
- key tidak dikenal diabaikan parser
- urutan metadata bebas
- task dengan `start` tanpa `end` tetap valid
- task unchecked dengan due lewat dianggap pending

## Feature Scope

### In Scope

- view baru `Focus Timeline`
- mode `Day`
- mode `Multi-day`
- source sidebar kiri dengan toggle show/hide
- collapse/expand source sidebar
- event block rendering
- task rendering untuk due, remind, start, end
- pending task summary dan/atau item
- open source note on click
- configurable source scope berdasarkan folder

### Out of Scope for Phase 1

- online calendar integration
- Dataview integration
- Obsidian Tasks plugin integration
- drag and drop calendar editing
- in-place editing dari timeline view
- auto rewrite pending tasks ke note hari ini
- recurrence / repeat rules

## High-Level Architecture

Tambahkan domain dan UI baru:

- `ScheduledItem` domain
- parser untuk event/task
- indexer lintas file
- query/filter layer
- layout engine untuk timeline
- view Obsidian baru untuk timeline

Arsitektur target:

```text
Markdown files
  -> ScheduledItemParser
  -> ScheduledItemIndexer
  -> ScheduledItemQuery
  -> TimelineLayout
  -> TimelineView / TimelineGrid / TimelineSourceSidebar
```

## Data Model

Tambahkan model baru yang terpisah dari `SessionRecord`.

```ts
export type ScheduledItemKind = "event" | "task";

export type TimelineMode = "day" | "multi-day";

export interface ScheduledItemSource {
    filePath: string;
    fileName: string;
    lineNumber: number;
    headingPath: string[];
}

export interface ScheduledItem {
    id: string;
    kind: ScheduledItemKind;
    title: string;
    start: Date | null;
    end: Date | null;
    due: Date | null;
    remind: Date | null;
    isCompleted: boolean;
    source: ScheduledItemSource;
    rawLine: string;
}
```

Tambahkan tipe turunan untuk render:

```ts
export interface TimelineRange {
    start: Date;
    end: Date;
}

export interface TimelineSourceState {
    visible: boolean;
    color: string;
}
```

## Settings Additions

Tambahkan settings timeline ke settings plugin utama, misalnya di `src/types.ts`:

```ts
interface FocusTimelineSettings {
    enabled: boolean;
    defaultMode: TimelineMode;
    multiDaySpanDays: number;
    sourceFolders: string[];
    showCompletedTasks: boolean;
    showPendingSummary: boolean;
    sourceSidebarCollapsed: boolean;
    sourceVisibility: Record<string, boolean>;
    sourceColors: Record<string, string>;
}
```

Tambahkan field `timeline` ke `FocusNotesSettings`.

Default minimal:

- `enabled: true`
- `defaultMode: "multi-day"`
- `multiDaySpanDays: 7`
- `sourceFolders: []`
- `showCompletedTasks: true`
- `showPendingSummary: true`
- `sourceSidebarCollapsed: false`
- `sourceVisibility: {}`
- `sourceColors: {}`

## File-by-File Blueprint

### 1. `src/types.ts`

#### Change

Perluas types settings existing untuk memasukkan timeline settings, atau jika ingin menjaga file tetap ramping, pindahkan tipe timeline ke file baru lalu re-export dari `types.ts`.

#### Required edits

- tambah `TimelineMode`
- tambah `FocusTimelineSettings`
- tambah field `timeline` pada `FocusNotesSettings`
- tambah default settings untuk timeline

#### Notes

- jangan campurkan `ScheduledItem` ke file ini jika file menjadi terlalu padat
- jika perlu, gunakan `src/ScheduledItemTypes.ts`

### 2. `src/ScheduledItemTypes.ts`

#### Create

File baru untuk domain model timeline.

#### Responsibilities

- definisi `ScheduledItem`
- definisi `ScheduledItemSource`
- definisi `TimelineRange`
- definisi type hasil parse jika dibutuhkan

#### Suggested exports

- `ScheduledItemKind`
- `ScheduledItem`
- `ScheduledItemSource`
- `TimelineRange`
- `TimelineMode`

### 3. `src/ScheduledItemParser.ts`

#### Create

File baru untuk business logic parsing.

#### Responsibilities

- parse satu baris markdown menjadi `ScheduledItem` atau `null`
- bedakan event vs task
- parse due/remind/start/end
- resolve end time shorthand event ke same-day datetime
- ignore unknown keys
- tidak throw untuk line malformed

#### Public API

```ts
export class ScheduledItemParser {
    parseLine(
        line: string,
        ctx: {
            filePath: string;
            fileName: string;
            lineNumber: number;
            headingPath: string[];
        }
    ): ScheduledItem | null
}
```

#### Internal helpers

- `parseEventLine`
- `parseTaskLine`
- `parseTaskMetadata`
- `parseDate`
- `parseDateTime`
- `parseEventEnd`
- `buildItemId`

#### Parsing rules

- event regex harus ketat dan deterministic
- task split metadata berdasarkan `|`
- metadata trim kiri/kanan
- key parse dengan `indexOf(":")`, bukan regex kompleks
- unknown keys ignore
- invalid value untuk known key sebaiknya membuat key itu `null`, bukan merusak seluruh item, kecuali struktur task keseluruhan memang tidak valid

#### Tests expected

- valid same-day event
- valid cross-day event
- invalid event line
- task with due/remind
- task with start/end
- task with unknown metadata
- task checked vs unchecked
- task with malformed metadata

### 4. `src/ScheduledItemIndexer.ts`

#### Create

File baru untuk scanning source files.

#### Responsibilities

- membaca file markdown dalam folder yang dikonfigurasi
- parse line-by-line
- lacak heading path sederhana untuk source context
- hasilkan list `ScheduledItem`

#### Public API

```ts
export class ScheduledItemIndexer {
    constructor(app: App, parser: ScheduledItemParser) {}

    async buildIndex(sourceFolders: string[]): Promise<ScheduledItem[]>
}
```

#### Suggested behavior

- scan hanya `.md`
- abaikan file di luar configured folders
- setiap line diparse
- saat menemukan heading markdown, update `headingPath`
- line number simpan 0-based atau 1-based, tapi konsisten. Rekomendasi: 1-based untuk UX

#### Future-ready notes

- implementasi fase 1 boleh full rebuild index
- incremental re-index dapat ditambahkan nanti

### 5. `src/ScheduledItemQuery.ts`

#### Create

File baru untuk semua logic filter dan derivation.

#### Responsibilities

- filter item by date range
- filter item by visible sources
- compute pending tasks
- decide visibility per mode
- split cross-day items menjadi segmen render bila dibutuhkan

#### Public API

```ts
export class ScheduledItemQuery {
    getItemsForRange(
        items: ScheduledItem[],
        range: TimelineRange,
        opts: {
            visibleSources: Set<string>;
            includeCompleted: boolean;
        }
    ): ScheduledItem[]

    getPendingTasks(
        items: ScheduledItem[],
        today: Date,
        visibleSources: Set<string>
    ): ScheduledItem[]
}
```

#### Rules

- pending = task unchecked dengan `due < today` pada granularity hari
- completed task visibility mengikuti settings
- item tanpa schedule apapun tidak perlu muncul di timeline

### 6. `src/TimelineLayout.ts`

#### Create

File baru untuk mengubah item menjadi model render.

#### Responsibilities

- kelompokkan item menjadi:
  - timed blocks
  - point items
  - due items
  - pending items
- split block lintas hari menjadi per-day segments
- hitung overlap sederhana bila dua block berada pada slot waktu yang sama

#### Public API

```ts
export interface TimelineBlockSegment {
    itemId: string;
    dayKey: string;
    start: Date;
    end: Date;
    column: number;
    columnCount: number;
}

export interface TimelinePointItem {
    itemId: string;
    at: Date;
}

export interface TimelineDueItem {
    itemId: string;
    dayKey: string;
}
```

```ts
export class TimelineLayout {
    build(items: ScheduledItem[], range: TimelineRange): {
        blocks: TimelineBlockSegment[];
        points: TimelinePointItem[];
        dues: TimelineDueItem[];
    }
}
```

#### Phase 1 simplification

- overlap algorithm cukup sederhana
- tidak perlu perfect Google Calendar packing
- yang penting block tidak saling menimpa total

### 7. `src/TimelineSourceSidebar.ts`

#### Create

Komponen UI sidebar kiri.

#### Responsibilities

- render daftar source notes
- show/hide source per item
- collapse/expand sidebar
- tampilkan count item per source
- tampilkan warna source

#### Public API

Komponen class biasa yang menerima parent element dan callbacks.

```ts
export class TimelineSourceSidebar {
    constructor(
        app: App,
        parent: HTMLElement,
        opts: {
            sources: Array<{ filePath: string; fileName: string; count: number; color: string; visible: boolean }>;
            collapsed: boolean;
            onToggleSource: (filePath: string, visible: boolean) => void;
            onToggleCollapsed: (collapsed: boolean) => void;
        }
    ) {}

    render(): void
}
```

### 8. `src/TimelineGrid.ts`

#### Create

Komponen UI area utama timeline.

#### Responsibilities

- render day grid
- render multi-day grid
- render hour lines
- render timed blocks
- render due chips
- render pending summary
- handle click item untuk membuka source note

#### Public API

```ts
export class TimelineGrid {
    constructor(
        app: App,
        parent: HTMLElement,
        opts: {
            mode: TimelineMode;
            range: TimelineRange;
            items: ScheduledItem[];
            layout: ReturnType<TimelineLayout["build"]>;
            onOpenItem: (item: ScheduledItem) => void;
        }
    ) {}

    render(): void
}
```

#### UX rules

- event block dan task block beda styling
- completed task muted
- pending task diberi visual urgency ringan
- source label tampil di dalam block atau tooltip singkat

### 9. `src/TimelineView.ts`

#### Create

View Obsidian baru untuk timeline.

#### Responsibilities

- mengatur state mode `day` / `multi-day`
- mengatur current anchor date
- trigger re-index dan refresh UI
- menampung header actions
- merender `TimelineSourceSidebar` dan `TimelineGrid`

#### Public API

`ItemView` baru seperti `TimerView`.

#### State to manage

- current mode
- current anchor date
- source visibility state
- sidebar collapsed state
- indexed items cache

#### Header controls

- `Prev`
- `Today`
- `Next`
- switch `Day` / `Multi-day`
- toggle sidebar
- refresh button

#### Data flow

```text
open view
  -> build index from configured folders
  -> filter/query items for active range
  -> derive layout
  -> render sidebar + grid
```

#### Refresh triggers

- on open
- on settings change if possible
- on vault modify for files in source folders
- on manual refresh button

### 10. `src/main.ts`

#### Change

Register timeline view baru tanpa merusak view lama.

#### Required edits

- tambah constant view type baru, mis. `focus-timeline-view`
- register view baru
- tambah ribbon icon atau command baru untuk `Open Focus Timeline`
- buat `activateTimelineView()` terpisah dari `activateView()`

#### Notes

- jangan ubah alur timer view yang existing
- timeline view harus dapat dibuka independen

### 11. `src/SettingsTab.ts`

#### Change

Tambahkan section settings baru untuk timeline.

#### Required settings UI

- enable timeline feature
- default timeline mode
- multi-day span
- source folders
- show completed tasks
- show pending summary
- source sidebar collapsed default

#### UX notes

- source folders bisa dimulai dari text area sederhana satu folder per baris
- tidak perlu custom folder picker kompleks pada fase 1

### 12. `src/utils.ts`

#### Change if useful

Tambahkan helper non-domain bila diperlukan:

- `isMarkdownFile`
- `startOfDay`
- `endOfDay`
- `formatDayKey`
- `clampDate`

Jangan taruh parser business logic berat di sini.

### 13. `styles.css`

#### Change

Tambahkan styling untuk timeline view.

#### Required classes

- timeline root
- timeline header
- source sidebar
- source sidebar collapsed state
- day/multi-day grid
- hour lines
- event blocks
- task blocks
- due chips
- pending badge/summary
- mode switch buttons

#### UX notes

- ikuti gaya plugin existing, jangan terlalu berbeda
- source colors harus tetap terbaca
- layout harus usable di lebar panel Obsidian

### 14. `README.md`

#### Change in final phase

Tambahkan dokumentasi:

- format event
- format task
- cara mengaktifkan timeline
- cara konfigurasi source folders
- cara switch day vs multi-day
- cara hide/show source notes

## Recommended Implementation Order

### Phase 1: Domain Foundation

Files:

- `src/ScheduledItemTypes.ts`
- `src/ScheduledItemParser.ts`

Goals:

- definisi model final
- parser event/task stabil
- unit-testable business logic

Exit criteria:

- parser mampu parse semua grammar final
- parser aman terhadap line invalid

### Phase 2: Indexing and Query

Files:

- `src/ScheduledItemIndexer.ts`
- `src/ScheduledItemQuery.ts`
- optional helper additions di `src/utils.ts`

Goals:

- scan configured folders
- ekstrak item dari banyak file
- hitung pending task
- filter berdasarkan visible sources dan date range

Exit criteria:

- index build dari beberapa note berjalan
- pending tasks dan range filter benar

### Phase 3: Timeline View Skeleton

Files:

- `src/TimelineLayout.ts`
- `src/TimelineGrid.ts`
- `src/TimelineView.ts`
- `src/main.ts`

Goals:

- register view baru
- tampilkan day view basic
- render event blocks dan due/task items
- open source note on click

Exit criteria:

- timeline view bisa dibuka
- item muncul untuk hari aktif
- click membuka note sumber

### Phase 4: Multi-day and Source Sidebar

Files:

- `src/TimelineSourceSidebar.ts`
- `src/TimelineView.ts`
- `src/TimelineGrid.ts`
- `styles.css`

Goals:

- source sidebar kiri
- hide/show per source
- collapse/expand sidebar
- mode switch day/multi-day

Exit criteria:

- user bisa filter source
- multi-day view usable
- sidebar state tersimpan

### Phase 5: Settings and Polish

Files:

- `src/types.ts`
- `src/SettingsTab.ts`
- `README.md`
- `styles.css`

Goals:

- settings timeline lengkap
- visual refinement
- docs grammar dan usage

Exit criteria:

- user bisa konfigurasi source scope
- docs cukup untuk penggunaan nyata

## Parser Edge Cases To Handle

- event dengan end `HH:mm` harus copy tanggal dari start
- event dengan end sebelum start pada same-day shorthand sebaiknya dianggap invalid, bukan otomatis cross-day
- task dengan `start` tanpa `end` valid
- task dengan `end` tanpa `start` boleh diabaikan sebagai timed block
- task dengan duplicate key:
  - rekomendasi: last value wins
- line kosong atau bullet biasa yang tidak cocok grammar harus diabaikan
- metadata dengan key tidak dikenal jangan memecahkan parse

## Timeline Rendering Rules

### Event

- tampil sebagai block waktu
- cross-day event dipecah menjadi segmen per hari

### Task

- `start + end` => block waktu
- `start` saja => point item
- `remind` saja => point item
- `due` saja => due chip pada hari due
- `isCompleted` => muted style

### Pending

- pending task adalah unchecked task dengan `due` sebelum hari aktif
- ditampilkan pada hari ini / range aktif
- tidak ditulis ulang ke markdown

### Source

- source name selalu tersedia untuk semua item
- source visibility mempengaruhi query output sebelum render

## Suggested Test Matrix

### Parser tests

- parse same-day event
- parse cross-day event
- reject malformed event
- parse task with due
- parse task with remind
- parse task with start/end
- parse checked task
- ignore unknown metadata
- allow freeform title text

### Query tests

- filter by visible source
- compute pending task
- include/exclude completed tasks
- range intersection for timed items

### Layout tests

- split cross-day block
- classify due-only task
- classify remind-only task
- overlapping blocks get separate columns

## Acceptance Criteria

- view lama `Focus Notes` tetap berfungsi
- view baru `Focus Timeline` ter-register dan dapat dibuka
- event dan task sesuai grammar final terbaca dari banyak notes
- source note tampil dan dapat di-hide/show
- sidebar kiri bisa collapse/expand
- day dan multi-day mode bisa di-switch
- pending task tampil secara visual tanpa rewrite note
- click item membuka note sumber yang benar

## Handoff Notes For LLM

- Implementasi harus dimulai dari parser dan types, bukan dari UI.
- Jangan gunakan parser markdown penuh; line-based parser sudah cukup untuk scope ini.
- Jangan scan seluruh vault tanpa source folder configuration.
- Jaga agar timeline code tidak menginvasi timer/logging flow yang ada.
- Fokus fase 1 adalah correctness dan usability, bukan visual parity dengan Google Calendar.
