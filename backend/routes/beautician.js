const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/beautician - semua role bisa lihat daftar beautician
router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM beautician WHERE is_active = 1 ORDER BY nama ASC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data beautician.' });
  }
});

// POST /api/beautician - admin only
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { nama, telepon, spesialisasi } = req.body;
    if (!nama) return res.status(400).json({ message: 'Nama beautician wajib diisi.' });
    const [result] = await pool.query(
      'INSERT INTO beautician (nama, telepon, spesialisasi) VALUES (?, ?, ?)',
      [nama, telepon || null, spesialisasi || null]
    );
    res.status(201).json({ id: result.insertId, message: 'Beautician berhasil ditambahkan.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menambahkan beautician.' });
  }
});

// PUT /api/beautician/:id - admin only
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { nama, telepon, spesialisasi, is_active } = req.body;
    await pool.query(
      'UPDATE beautician SET nama = ?, telepon = ?, spesialisasi = ?, is_active = ? WHERE id = ?',
      [nama, telepon, spesialisasi, is_active ?? 1, req.params.id]
    );
    res.json({ message: 'Data beautician berhasil diperbarui.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memperbarui beautician.' });
  }
});

// GET /api/beautician/:id/jadwal?tanggal=YYYY-MM-DD
// Beautician melihat jadwal appointment miliknya sendiri pada tanggal tertentu
router.get('/:id/jadwal', authenticate, async (req, res) => {
  try {
    const beauticianId = req.params.id;

    // Beautician hanya boleh lihat jadwal dirinya sendiri; admin & kasir boleh lihat semua
    if (req.user.role === 'beautician' && String(req.user.beautician_id) !== String(beauticianId)) {
      return res.status(403).json({ message: 'Anda hanya dapat melihat jadwal Anda sendiri.' });
    }

    const { tanggal } = req.query;
    let sql = `
      SELECT a.*, p.nama AS nama_pelanggan, p.telepon AS telepon_pelanggan
      FROM appointment a
      JOIN pelanggan p ON p.id = a.pelanggan_id
      WHERE a.beautician_id = ?
    `;
    const params = [beauticianId];
    if (tanggal) {
      sql += ' AND a.tanggal = ?';
      params.push(tanggal);
    }
    sql += ' ORDER BY a.tanggal ASC, a.jam_mulai ASC';

    const [rows] = await pool.query(sql, params);

    // Ambil detail layanan untuk setiap appointment
    for (const appt of rows) {
      const [layananRows] = await pool.query(
        `SELECT al.layanan_id, l.nama_layanan, al.harga_saat_itu, al.durasi_saat_itu
         FROM appointment_layanan al
         JOIN layanan l ON l.id = al.layanan_id
         WHERE al.appointment_id = ?`,
        [appt.id]
      );
      appt.layanan = layananRows;
    }

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil jadwal beautician.' });
  }
});

module.exports = router;
