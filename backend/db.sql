-- =========================================================
-- SKEMA DATABASE - APLIKASI MANAJEMEN SALON
-- =========================================================
CREATE DATABASE IF NOT EXISTS salon_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE salon_db;

-- ---------------------------------------------------------
-- TABEL USERS (admin, beautician, kasir)
-- ---------------------------------------------------------
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,           -- di-hash dengan bcrypt
  role ENUM('admin','beautician','kasir') NOT NULL,
  beautician_id INT NULL,                   -- diisi jika role = beautician, relasi ke tabel beautician
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- TABEL BEAUTICIAN
-- ---------------------------------------------------------
CREATE TABLE beautician (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  telepon VARCHAR(20),
  spesialisasi VARCHAR(150),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

ALTER TABLE users
  ADD CONSTRAINT fk_users_beautician
  FOREIGN KEY (beautician_id) REFERENCES beautician(id) ON DELETE SET NULL;

-- ---------------------------------------------------------
-- TABEL LAYANAN
-- nama layanan, maksimal layanan (per hari), durasi (menit), biaya
-- ---------------------------------------------------------
CREATE TABLE layanan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama_layanan VARCHAR(150) NOT NULL,
  maksimal_layanan INT NOT NULL DEFAULT 0,   -- 0 = tidak dibatasi; kuota booking layanan ini per hari
  durasi_menit INT NOT NULL,                 -- durasi pengerjaan dalam menit
  biaya DECIMAL(12,2) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- TABEL PELANGGAN
-- ---------------------------------------------------------
CREATE TABLE pelanggan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  telepon VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  alamat VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- TABEL APPOINTMENT
-- status: menunggu -> proses -> selesai -> dibayar / batal
-- ---------------------------------------------------------
CREATE TABLE appointment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pelanggan_id INT NOT NULL,
  beautician_id INT NOT NULL,
  tanggal DATE NOT NULL,
  jam_mulai TIME NOT NULL,
  jam_selesai_estimasi TIME NOT NULL,        -- dihitung dari total durasi layanan yang dipilih
  total_durasi_menit INT NOT NULL,
  total_biaya DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('menunggu','proses','selesai','dibayar','batal') NOT NULL DEFAULT 'menunggu',
  catatan VARCHAR(255),
  created_by INT NOT NULL,                  -- user id (admin) yang membuat appointment
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_appt_pelanggan FOREIGN KEY (pelanggan_id) REFERENCES pelanggan(id),
  CONSTRAINT fk_appt_beautician FOREIGN KEY (beautician_id) REFERENCES beautician(id),
  CONSTRAINT fk_appt_created_by FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE INDEX idx_appt_tanggal_beautician ON appointment(tanggal, beautician_id);
CREATE INDEX idx_appt_status ON appointment(status);

-- ---------------------------------------------------------
-- TABEL APPOINTMENT_LAYANAN (relasi many-to-many appointment <-> layanan)
-- ---------------------------------------------------------
CREATE TABLE appointment_layanan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL,
  layanan_id INT NOT NULL,
  harga_saat_itu DECIMAL(12,2) NOT NULL,     -- snapshot harga layanan saat appointment dibuat
  durasi_saat_itu INT NOT NULL,              -- snapshot durasi saat appointment dibuat
  CONSTRAINT fk_al_appointment FOREIGN KEY (appointment_id) REFERENCES appointment(id) ON DELETE CASCADE,
  CONSTRAINT fk_al_layanan FOREIGN KEY (layanan_id) REFERENCES layanan(id)
) ENGINE=InnoDB;

CREATE INDEX idx_al_layanan ON appointment_layanan(layanan_id);

-- ---------------------------------------------------------
-- TABEL TRANSAKSI (pembayaran atas appointment)
-- ---------------------------------------------------------
CREATE TABLE transaksi (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL UNIQUE,
  kasir_id INT NOT NULL,
  no_invoice VARCHAR(30) NOT NULL UNIQUE,
  subtotal DECIMAL(12,2) NOT NULL,
  diskon DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_bayar DECIMAL(12,2) NOT NULL,
  metode_bayar ENUM('tunai','debit','kredit','qris','transfer') NOT NULL,
  jumlah_dibayar DECIMAL(12,2) NOT NULL,
  kembalian DECIMAL(12,2) NOT NULL DEFAULT 0,
  status_bayar ENUM('lunas','batal') NOT NULL DEFAULT 'lunas',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_trx_appointment FOREIGN KEY (appointment_id) REFERENCES appointment(id),
  CONSTRAINT fk_trx_kasir FOREIGN KEY (kasir_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- =========================================================
-- SEED DATA AWAL
-- =========================================================

-- Beautician contoh
INSERT INTO beautician (nama, telepon, spesialisasi) VALUES
('Sari Wulandari', '081234567801', 'Hair & Makeup'),
('Dewi Anggraini', '081234567802', 'Facial & Skincare'),
('Rina Marlina', '081234567803', 'Nail Art & Spa');

-- User default (password semua: "password123", sudah di-hash dengan bcrypt cost 10)
-- Hash di bawah ini adalah contoh placeholder - jalankan backend/scripts/seedUsers.js untuk generate hash yang valid
INSERT INTO users (nama, username, password, role, beautician_id) VALUES
('Admin Utama', 'admin', '$2b$10$replace_with_generated_hash', 'admin', NULL),
('Kasir Satu', 'kasir1', '$2b$10$replace_with_generated_hash', 'kasir', NULL),
('Sari Wulandari', 'sari', '$2b$10$replace_with_generated_hash', 'beautician', 1),
('Dewi Anggraini', 'dewi', '$2b$10$replace_with_generated_hash', 'beautician', 2);

-- Layanan contoh
INSERT INTO layanan (nama_layanan, maksimal_layanan, durasi_menit, biaya) VALUES
('Creambath', 5, 60, 75000),
('Hair Spa', 5, 90, 120000),
('Facial Wajah', 8, 45, 100000),
('Manicure', 10, 30, 50000),
('Pedicure', 10, 40, 55000),
('Potong Rambut', 15, 30, 60000),
('Massage Tubuh', 6, 60, 150000);

-- Pelanggan contoh
INSERT INTO pelanggan (nama, telepon, email, alamat) VALUES
('Ani Susanti', '081211112222', 'ani@example.com', 'Jl. Melati No. 10'),
('Budi Hartono', '081233334444', 'budi@example.com', 'Jl. Kenanga No. 5');
