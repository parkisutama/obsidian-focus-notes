# Pastikan capture muncul di Focus Timeline

Focus Timeline membaca Event dan Task hanya dari folder sumber yang terbatas. Pembatasan ini menjaga indexing tetap cepat dan mencegah pemindaian seluruh vault.

## Daily Notes

Ketika **Use Daily Notes plugin settings** aktif dan Daily Notes memakai sebuah folder, Focus Notes otomatis memasukkan folder tersebut ke scope Timeline. Folder ini tidak perlu ditambahkan lagi pada **Timeline → Source folders**.

Daily Notes yang disimpan langsung di root vault tidak ditambahkan otomatis karena itu akan membuat Timeline memindai seluruh vault. Tetapkan folder Daily Notes atau tambahkan source folder yang lebih spesifik.

Semua file di folder Daily Notes ditampilkan sebagai satu source **Daily Notes**. Nama file individual tetap tersedia pada modal detail dan **Open source note**, tetapi tidak memenuhi sidebar.

Focus Timeline hanya mengindeks:

- Event dengan format Focus Notes;
- Task yang mempunyai `due`, `start`, `end`, atau `remind`;
- record di bawah heading Timeline yang diterima.

Checkbox journal atau checklist biasa tidak menjadi Timeline Task. Heading default adalah `Activities & Tasks`. Tambahkan heading ledger lain melalui **Settings → Focus Notes → Timeline headings**. Heading tujuan Event/Task yang sedang aktif selalu disertakan otomatis.

## Hub dan Project Note

Event atau Task dapat disimpan pada note aktif, hub, atau Project Note. Pada bagian **Save to**, Focus Notes menampilkan salah satu status berikut:

- **Indexed by Focus Timeline** — target berada di dalam source folder efektif;
- **Outside Focus Timeline sources** — capture tetap dapat disimpan, tetapi tidak akan muncul di Timeline.

Project dan Activity tidak perlu berada di folder global khusus. Pada Object Source terkait, aktifkan **Include in Focus Timeline**. Focus Notes kemudian memakai folder dan property filter Object Source secara bersamaan, misalnya:

| Source | Folder | Property | Value |
|---|---|---|---|
| Projects | `persona` | `type` | `project` |
| Activities | `persona` | `type` | `activity` |

Keduanya boleh berada pada root yang sama dan pada kedalaman berbeda. `persona/Karyawan IAT/BLOK 05/BLOK 05.md` tetap menjadi Project karena `type: project`, sedangkan Activity di dalam Project tetap menjadi Activity karena `type: activity`.

Setelah Project dan Activity diikutkan melalui Object Source, hapus `persona` dari **Additional source folders** kecuali Anda memang ingin note tanpa property temporal di bawah `persona` ikut menjadi fallback source umum.

Jika target non-object berada di luar scope, tambahkan folder induk melalui **Settings → Focus Notes → Timeline → Additional source folders**. Pilih scope terkecil yang mencakup note terkait; jangan gunakan root vault hanya untuk menghilangkan warning.

Object Source menjadi unit filter di sidebar. Jika manual folder dan Object Source bertumpuk, kecocokan property-filtered menang; setelah itu folder paling spesifik dan urutan konfigurasi menjadi tie-breaker. Path file aslinya tidak berubah.

## Buka detail dan note asal

Klik kartu Event, Task, due item, atau point item untuk membuka modal detail di tengah layar. Modal mempertahankan konteks waktu, status, nama file, heading, nomor baris, dan path sumber tanpa bergantung pada posisi sidebar.

Untuk pending tasks, klik badge ringkasan lalu pilih task dari daftar. Pilihan tersebut membuka modal detail yang sama. Gunakan **Open source note** untuk berpindah ke file dan baris asal; gunakan **Close**, `Esc`, tombol kembali Android, atau area di luar modal untuk kembali ke Timeline.
