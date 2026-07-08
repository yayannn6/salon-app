const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/pelanggan?search=nama
router.get('/', authenticate, async (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM pelanggan';
    const params = [];
    if (search) {
      sql += ' WHERE nama LIKE ? OR telepon LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY nama ASC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data pelanggan.' });
  }
});

// POST /api/pelanggan - admin & kasir bisa tambah pelanggan baru
router.post('/', authenticate, authorize('admin', 'kasir'), async (req, res) => {
  try {
    const { nama, telepon, email, alamat } = req.body;
    if (!nama || !telepon) {
      return res.status(400).json({ message: 'Nama dan telepon wajib diisi.' });
    }
    const [result] = await pool.query(
      'INSERT INTO pelanggan (nama, telepon, email, alamat) VALUES (?, ?, ?, ?)',
      [nama, telepon, email || null, alamat || null]
    );
    res.status(201).json({ id: result.insertId, message: 'Pelanggan berhasil ditambahkan.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menambahkan pelanggan.' });
  }
});

// PUT /api/pelanggan/:id - admin only
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { nama, telepon, email, alamat } = req.body;
    await pool.query(
      'UPDATE pelanggan SET nama = ?, telepon = ?, email = ?, alamat = ? WHERE id = ?',
      [nama, telepon, email, alamat, req.params.id]
    );
    res.json({ message: 'Data pelanggan berhasil diperbarui.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memperbarui pelanggan.' });
  }
});

module.exports = router;
