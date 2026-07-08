const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/layanan - semua role bisa lihat (untuk buat appointment / lihat harga)
router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM layanan WHERE is_active = 1 ORDER BY nama_layanan ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data layanan.' });
  }
});

// GET /api/layanan/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM layanan WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Layanan tidak ditemukan.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data layanan.' });
  }
});

// POST /api/layanan - hanya admin
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { nama_layanan, maksimal_layanan, durasi_menit, biaya } = req.body;
    if (!nama_layanan || durasi_menit == null || biaya == null) {
      return res.status(400).json({ message: 'Nama layanan, durasi, dan biaya wajib diisi.' });
    }
    const [result] = await pool.query(
      'INSERT INTO layanan (nama_layanan, maksimal_layanan, durasi_menit, biaya) VALUES (?, ?, ?, ?)',
      [nama_layanan, maksimal_layanan || 0, durasi_menit, biaya]
    );
    res.status(201).json({ id: result.insertId, message: 'Layanan berhasil ditambahkan.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menambahkan layanan.' });
  }
});

// PUT /api/layanan/:id - hanya admin
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { nama_layanan, maksimal_layanan, durasi_menit, biaya, is_active } = req.body;
    await pool.query(
      `UPDATE layanan SET nama_layanan = ?, maksimal_layanan = ?, durasi_menit = ?, biaya = ?, is_active = ?
       WHERE id = ?`,
      [nama_layanan, maksimal_layanan, durasi_menit, biaya, is_active ?? 1, req.params.id]
    );
    res.json({ message: 'Layanan berhasil diperbarui.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memperbarui layanan.' });
  }
});

// DELETE /api/layanan/:id - hanya admin (soft delete)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await pool.query('UPDATE layanan SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Layanan berhasil dinonaktifkan.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menghapus layanan.' });
  }
});

module.exports = router;
