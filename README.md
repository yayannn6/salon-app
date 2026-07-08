# Kirana Salon — Sistem Manajemen Appointment & Kasir

Aplikasi web responsif untuk manajemen salon: appointment, layanan, beautician,
pelanggan, dan transaksi pembayaran. Frontend HTML/CSS/vanilla JS, backend
Node.js (Express), database MySQL.

## Struktur Folder

```
salon-app/
├── backend/           Node.js + Express API
│   ├── config/db.js   Koneksi MySQL (pool)
│   ├── middleware/     Auth JWT & otorisasi role
│   ├── routes/         Endpoint API (auth, layanan, pelanggan, beautician, appointment, transaksi, users)
│   ├── scripts/        Script bantu (seed password user default)
│   ├── db.sql          Skema database + data contoh
│   ├── server.js        Entry point
│   └── .env.example
└── frontend/          HTML/CSS/JS statis (disajikan oleh Express)
    ├── index.html
    ├── css/style.css
    └── js/
        ├── api.js      Wrapper fetch + auth
        ├── ui.js       Helper toast/modal/format
        ├── app.js      Router & navigasi
        └── views/      Satu file per halaman (dashboard, layanan, pelanggan, beautician, appointment, jadwal, kasir, users)
```

## Peran (Role) Pengguna

| Role         | Akses                                                                 |
|--------------|------------------------------------------------------------------------|
| **admin**      | Semua akses: setting layanan/beautician/pelanggan/akun, membuat & mengelola appointment, kasir |
| **beautician** | Hanya melihat & mengelola (mulai/selesaikan) jadwal appointment miliknya sendiri |
| **kasir**      | Memproses pembayaran appointment berstatus "selesai" & melihat riwayat transaksi, serta mengelola data pelanggan |

## Alur Status Appointment

```
menunggu → proses → selesai → dibayar
              ↓
            batal (hanya dari menunggu/proses)
```

- **menunggu**: appointment baru dibuat admin, belum dikerjakan.
- **proses**: beautician/admin menandai mulai dikerjakan.
- **selesai**: layanan selesai dikerjakan, siap dibayar oleh kasir.
- **dibayar**: transaksi pembayaran sudah dibuat (final, tidak bisa diubah lagi).
- **batal**: dibatalkan oleh admin.

## Aturan Bisnis Appointment (divalidasi di server, `routes/appointment.js`)

1. **Kuota maksimal layanan per hari**: setiap layanan punya kolom
   `maksimal_layanan` (booking/hari). Saat membuat appointment baru, sistem
   menghitung jumlah appointment **berstatus `menunggu`** (belum diproses)
   pada tanggal yang sama untuk tiap layanan yang dipilih. Jika sudah
   mencapai batas, permintaan ditolak (HTTP 409) dengan pesan jelas.
2. **Ketersediaan beautician**: sistem mengecek apakah beautician yang
   dipilih sudah punya appointment lain (status apa pun selain `batal`)
   yang jam-nya beririsan (overlap) dengan slot baru pada tanggal yang sama.
   Jika bentrok, permintaan ditolak dengan info jam appointment yang bentrok.
3. **Estimasi selesai** dihitung otomatis dari total durasi seluruh layanan
   yang dipilih, ditambahkan ke jam mulai.

Frontend juga menampilkan indikator kuota (progress bar) secara real-time
saat memilih layanan & tanggal, namun validasi final selalu di server.

## Instalasi & Menjalankan

### 1. Siapkan Database MySQL

```bash
mysql -u root -p < backend/db.sql
```

Ini akan membuat database `salon_db` beserta seluruh tabel dan data contoh
(3 beautician, 7 layanan, 2 pelanggan, 4 user).

### 2. Konfigurasi Backend

```bash
cd backend
cp .env.example .env
# Edit .env: isi DB_USER, DB_PASSWORD, JWT_SECRET sesuai environment Anda
npm install
```

### 3. Set Password User Default

Password di `db.sql` masih berupa placeholder. Jalankan script berikut untuk
mengeset password default (`password123`) ke seluruh user contoh secara aman
(hash bcrypt asli):

```bash
npm run seed:users
```

### 4. Jalankan Server

```bash
npm start
# atau untuk development dengan auto-reload:
npm run dev
```

Server akan berjalan di `http://localhost:3000` dan otomatis menyajikan
frontend (folder `../frontend`) — jadi cukup buka `http://localhost:3000`
di browser, tidak perlu web server terpisah.

### Akun Default (setelah `npm run seed:users`)

| Username | Password    | Role       |
|----------|-------------|------------|
| admin    | password123 | admin      |
| kasir1   | password123 | kasir      |
| sari     | password123 | beautician |
| dewi     | password123 | beautician |

## Menambah Akun Beautician/Kasir Baru

Login sebagai admin → menu **Akun** → **Tambah Akun**. Untuk role
`beautician`, harus memilih data beautician yang sudah ada di menu
**Beautician** terlebih dahulu (buat datanya dulu di sana bila belum ada).

## Catatan Teknis

- Autentikasi menggunakan JWT (disimpan di `localStorage` browser), dikirim
  sebagai header `Authorization: Bearer <token>` di setiap request API.
- Semua password di-hash dengan bcrypt sebelum disimpan.
- Validasi kuota layanan & bentrok jadwal beautician dilakukan dalam
  1 transaksi database (MySQL transaction) agar konsisten saat diakses
  bersamaan (concurrent).
- Desain responsif: tabel otomatis berubah menjadi kartu bertumpuk di layar
  mobile (< 640px).
"# salon-app" 
