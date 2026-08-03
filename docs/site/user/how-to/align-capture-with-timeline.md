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
