# Pastikan capture muncul di Focus Timeline

Focus Timeline membaca Event dan Task hanya dari folder sumber yang terbatas. Pembatasan ini menjaga indexing tetap cepat dan mencegah pemindaian seluruh vault.

## Daily Notes

Ketika **Use Daily Notes plugin settings** aktif dan Daily Notes memakai sebuah folder, Focus Notes otomatis memasukkan folder tersebut ke scope Timeline. Folder ini tidak perlu ditambahkan lagi pada **Timeline → Source folders**.

Daily Notes yang disimpan langsung di root vault tidak ditambahkan otomatis karena itu akan membuat Timeline memindai seluruh vault. Tetapkan folder Daily Notes atau tambahkan source folder yang lebih spesifik.

## Hub dan Project Note

Event atau Task dapat disimpan pada note aktif, hub, atau Project Note. Pada bagian **Save to**, Focus Notes menampilkan salah satu status berikut:

- **Indexed by Focus Timeline** — target berada di dalam source folder efektif;
- **Outside Focus Timeline sources** — capture tetap dapat disimpan, tetapi tidak akan muncul di Timeline.

Jika target berada di luar scope, tambahkan folder induk yang sesuai melalui **Settings → Focus Notes → Timeline → Source folders**. Pilih scope terkecil yang mencakup note terkait; jangan gunakan root vault hanya untuk menghilangkan warning.

## Buka detail dan note asal

Klik kartu Event, Task, due item, atau point item untuk membuka modal detail di tengah layar. Modal mempertahankan konteks waktu, status, nama file, heading, nomor baris, dan path sumber tanpa bergantung pada posisi sidebar.

Untuk pending tasks, klik badge ringkasan lalu pilih task dari daftar. Pilihan tersebut membuka modal detail yang sama. Gunakan **Open source note** untuk berpindah ke file dan baris asal; gunakan **Close**, `Esc`, tombol kembali Android, atau area di luar modal untuk kembali ke Timeline.
