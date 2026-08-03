# Hubungkan capture dengan People, Places, atau Activity

Gunakan contextual link ketika Inbox, Event, atau Task menyebut objek yang ingin Anda temukan kembali, seperti seseorang, tempat, atau aktivitas berulang.

## Tambahkan context

1. Buka form **Create event or task**.
2. Pilih **Inbox**, **Event**, atau **Task**.
3. Pada Notes atau Description, ketik `@` diikuti sebagian nama atau alias note.
4. Pilih suggestion yang sesuai.

Trigger `@` berubah menjadi link Markdown biasa. Link disimpan relatif terhadap target note aktif, sehingga tetap portabel dan dapat membuka page preview Obsidian. Ketik `#` bila Anda ingin memilih tag vault.

## Simpan historical log

Ketika link yang dipilih termasuk source aktif di Settings, Focus Notes:

1. menyimpan capture utama terlebih dahulu;
2. menambahkan satu historical log di note context, di bawah heading yang dikonfigurasi untuk source tersebut;
3. mengabaikan link biasa yang tidak termasuk source context;
4. tidak menambahkan destination yang sama dua kali dalam satu capture.

Historical log bersifat append-only. Isinya memuat tanggal atau rentang waktu, judul capture, dan link kembali ke target note utama. Log tetap dapat dibaca apabila link tersebut kemudian putus akibat pengarsipan Project.

## Pulihkan kegagalan sebagian

Jika capture utama berhasil tetapi satu atau beberapa historical log gagal ditulis, form tetap terbuka dan tombol Save berubah menjadi **Retry related logs**.

Pilih tombol tersebut untuk mencoba kembali hanya destination yang masih gagal. Capture utama dan destination yang sudah berhasil tidak ditulis ulang. Anda juga dapat menutup form dan membiarkan historical log yang gagal belum tersimpan.

## Periksa konfigurasi source

Suggestion dan historical log hanya aktif untuk source yang:

- dalam keadaan enabled;
- memiliki folder sumber;
- memenuhi property filter bila filter dikonfigurasi.

People, Places, dan Activities adalah default awal. Source tambahan seperti Books dapat memakai mekanisme yang sama.

## Konfigurasikan Object Sources

Buka **Settings → Focus Notes → Object sources** untuk menentukan kelompok note yang dapat muncul dalam contextual suggester. Setiap source memiliki:

- label dan icon untuk mengenali jenis objek;
- satu atau beberapa folder sumber;
- property filter opsional untuk mempersempit note di dalam folder;
- heading tujuan historical log;
- default placement berupa flat note atau folder note;
- template note path opsional untuk mengisi Object Note baru.

Gunakan path note template di dalam vault, misalnya `Templates/Person.md`. Source aktif yang memiliki folder dapat membuat Object Note meskipun template kosong. Dalam kondisi tersebut Focus Notes membuat heading minimal dan memastikan property filter source tersedia di frontmatter.

## Buat Object Note baru

Object Source adalah definisi jenisnya, misalnya Places. Object Note adalah instansinya, misalnya Kantor Jakarta.

1. Ketik `@` dan nama object baru dalam Notes atau Description.
2. Pilih **Create “nama”…**.
3. Pilih Object Type dan salah satu folder yang sudah dikonfigurasi.
4. Pilih **Flat note** untuk menghasilkan `Folder/Nama.md`, atau **Folder note** untuk menghasilkan `Folder/Nama/Nama.md`.
5. Pilih **Create**.

Focus Notes menyalin isi template, mengganti token `{{title}}`, `{{name}}`, `{{date}}`, dan `{{time}}`, lalu memastikan property filter source tercatat di frontmatter. Object Note baru langsung menjadi link pada capture. File yang sudah ada tidak ditimpa.
