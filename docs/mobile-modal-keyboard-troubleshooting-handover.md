# Mobile modal keyboard troubleshooting handover

Tanggal: 2026-05-29

## Ringkasan masalah

Modal `EventTaskModal` untuk membuat event/task masih tidak usable di Obsidian mobile saat keyboard muncul. Area dari `Catatan terkait` ke bawah, termasuk `Simpan ke`, nama heading, dan checkbox `Sisipkan di atas`, tertutup keyboard. Close button modal juga masih terlihat terlalu besar dan menutupi area placeholder judul.

Masalah ini bukan lagi sekadar ukuran padding. Pola yang terlihat menunjukkan konflik antara modal bawaan Obsidian, keyboard mobile WebView, dan struktur form yang terlalu panjang untuk satu modal.

## File terkait

- `src/EventTaskModal.ts`
- `styles.css`
- Modal dibuka dari `src/main.ts` dan `src/TimelineView.ts` melalui `EventTaskModal`.

## Perubahan yang sudah dicoba

Di `styles.css`:

- Menambahkan aturan responsive untuk `.fn-gcal-modal`.
- Membuat modal hampir full-screen di mobile.
- Mengubah `.fn-gcal-body` menjadi area scroll.
- Mengurangi padding, font, tinggi input, dan row spacing.
- Menyembunyikan icon kiri pada mobile.
- Mengecilkan close button pada selector mobile.
- Menambahkan aturan `body.is-mobile .modal.fn-gcal-modal` agar tidak hanya bergantung pada `@media (max-width: 640px)`.
- Menambahkan `position: fixed`, `height` berbasis custom property, dan `transform: none`.

Di `src/EventTaskModal.ts`:

- Menambahkan `setupMobileViewportSupport()`.
- Membaca `window.visualViewport.height` dan `window.visualViewport.offsetTop`.
- Menulis CSS variable `--fn-gcal-viewport-height` dan `--fn-gcal-viewport-top` ke `this.modalEl`.
- Menambahkan listener `resize`/`scroll` pada `visualViewport`.
- Saat field fokus, kode mencoba scroll eksplisit pada `.fn-gcal-body` agar field aktif masuk area terlihat.

Build terakhir lolos dengan:

```bash
env OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run build
```

## Kenapa kemungkinan masih gagal

1. Obsidian mobile memakai modal container bawaan yang bisa tetap diposisikan berdasarkan layout viewport, bukan visual viewport. Saat keyboard muncul, WebView bisa menutup bagian bawah tanpa benar-benar mengubah layout modal seperti yang CSS harapkan.

2. `visualViewport` bisa berubah, tetapi parent modal Obsidian mungkin berada di stacking/positioning context yang tidak mengikuti `position: fixed` normal. Jika parent wrapper menggunakan transform, centering, atau overflow tertentu, aturan pada `.modal.fn-gcal-modal` tidak cukup.

3. Yang tertutup adalah bagian bawah form. Artinya scroll container yang benar belum mendapat tinggi efektif yang lebih kecil dari keyboard, atau scroll terjadi pada elemen yang salah. Walaupun `.fn-gcal-body` dibuat scrollable, modal wrapper/parent bisa tetap memotong bagian bawah.

4. Form terlalu panjang untuk satu modal mobile. Field saat ini mencakup title, tab event/task, date/time, description, hub note, detail note, target file, target heading, insert position, dan footer action. Ketika keyboard aktif, hanya sebagian kecil viewport tersisa.

5. Close button adalah elemen bawaan `Modal` Obsidian, bukan elemen yang kita render sendiri. Ukuran/posisinya bisa dipengaruhi CSS theme atau mobile skin Obsidian, sehingga override selector biasa bisa kalah atau tidak mengenai struktur DOM aktual.

## Rekomendasi pendekatan berikutnya

Jangan lanjut menambal `Modal` bawaan untuk mobile keyboard sebagai pendekatan utama. Buat mode mobile khusus.

### Opsi A: Mobile fullscreen form custom, bukan Obsidian Modal

Untuk Obsidian mobile, render overlay sendiri ke `document.body` alih-alih memakai `Modal`.

Struktur yang disarankan:

```text
.fn-mobile-sheet
  .fn-mobile-sheet-header
    input title
    small close button
  .fn-mobile-sheet-tabs
  .fn-mobile-sheet-body
    scrollable form content
  .fn-mobile-sheet-footer
    cancel/save buttons
```

CSS utama:

```css
.fn-mobile-sheet {
    position: fixed;
    inset: 0;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    z-index: var(--layer-modal);
    background: var(--background-primary);
}

.fn-mobile-sheet-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding-bottom: calc(96px + env(safe-area-inset-bottom));
}

.fn-mobile-sheet-footer {
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: 1fr auto;
}
```

Keuntungan:

- Tidak lagi bergantung pada layout/close button bawaan Obsidian Modal.
- Header/footer bisa dikontrol penuh.
- Body scroll jelas satu elemen.
- Lebih mudah mengikuti keyboard dengan `visualViewport`.

Risiko:

- Perlu lifecycle manual: append/remove overlay, Escape/back behavior, focus trap minimal, dan cleanup listener.
- Perlu memastikan overlay tidak tertinggal saat plugin unload atau modal ditutup.

### Opsi B: Pecah form mobile menjadi beberapa langkah

Jika tetap memakai modal/sheet, kurangi tinggi konten aktif dengan stepper:

1. `Waktu`: title, event/task, date/time.
2. `Catatan`: description, catatan terkait, catatan detail.
3. `Simpan`: target file, heading, insert position, save.

Keuntungan:

- Keyboard tidak perlu berurusan dengan form panjang.
- Field `Simpan ke` tidak berada jauh di bawah.
- Tombol bisa minimal: `Back`, `Next`, `Save`.

Risiko:

- State UI lebih kompleks.
- Perlu validasi per-step.

### Opsi C: Minimalist mobile action bar

Jika tetap satu halaman, ubah tombol dan header:

- Hilangkan close button bawaan dengan CSS khusus mobile atau jangan pakai `Modal`.
- Header mobile: title input + icon close kecil.
- Footer mobile: hanya dua tombol compact.
- Button text bisa pendek: `Batal` dan `Simpan`.
- Hindari footer sticky di dalam scroll container; footer harus sibling dari body scroll.

## Rekomendasi teknis paling aman

Implementasikan `EventTaskModal` menjadi dua renderer:

- Desktop: tetap pakai `Modal` bawaan sekarang.
- Mobile: custom fullscreen sheet.

Deteksi mobile:

```ts
const isMobile = document.body.hasClass("is-mobile") || window.innerWidth <= 640;
```

Jika `isMobile`, jangan panggil `new EventTaskModal(...).open()` untuk UI lama. Pilihan implementasi:

1. Buat class baru `EventTaskSheet`.
2. Pindahkan state dan submit logic bersama ke helper/controller agar tidak menduplikasi logic writer.
3. Reuse fungsi `submit()` atau extract menjadi service kecil seperti `EventTaskFormController`.

Langkah kecil yang realistis:

1. Extract data/state submit dari `EventTaskModal` ke helper internal tanpa mengubah behavior desktop.
2. Buat `EventTaskMobileSheet` yang memakai helper tersebut.
3. Di tempat pemanggilan modal, pilih sheet ketika mobile.
4. Setelah mobile sheet stabil, hapus patch CSS mobile yang terlalu banyak di `styles.css`.

## Catatan untuk sesi berikutnya

- Jangan revert perubahan lain di worktree. Sebelum issue mobile ini, repo sudah punya perubahan lokal di:
  - `src/EventTaskModal.ts`
  - `src/EventTaskWriter.ts`
  - `src/SettingsTab.ts`
  - `src/types.ts`
- Screenshot Windows yang disebut user tidak terbaca dari environment Codex, jadi troubleshooting harus berbasis kode dan feedback user.
- Build normal `pnpm run build` bisa gagal bila `.env` mengisi `OBSIDIAN_VAULT_PLUGIN_PATH` ke path vault yang read-only dari sandbox. Gunakan:

```bash
env OBSIDIAN_VAULT_PLUGIN_PATH= pnpm run build
```

## Acceptance criteria untuk fix berikutnya

- Saat keyboard mobile muncul pada field `Simpan ke`, `Heading`, atau catatan terkait, field aktif tetap terlihat.
- Area form bisa discroll sampai checkbox `Sisipkan di atas`.
- Tombol close tidak menutupi title placeholder.
- Tombol save/cancel tetap dapat diakses tanpa menutup keyboard secara manual.
- Layout desktop tidak berubah besar selain spacing close button yang sudah diperbaiki.
