const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/users - admin only
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nama, username, role, beautician_id, is_active, created_at FROM users ORDER BY role, nama'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data user.' });
  }
});

// POST /api/users - admin only, membuat akun beautician / kasir / admin baru
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { nama, username, password, role, beautician_id } = req.body;
    if (!nama || !username || !password || !role) {
      return res.status(400).json({ message: 'Nama, username, password, dan role wajib diisi.' });
    }
    if (!['admin', 'beautician', 'kasir'].includes(role)) {
      return res.status(400).json({ message: 'Role tidak valid.' });
    }
    if (role === 'beautician' && !beautician_id) {
      return res.status(400).json({ message: 'Role beautician wajib memilih data beautician terkait.' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Username sudah digunakan.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (nama, username, password, role, beautician_id) VALUES (?, ?, ?, ?, ?)',
      [nama, username, hash, role, role === 'beautician' ? beautician_id : null]
    );
    res.status(201).json({ id: result.insertId, message: 'User berhasil ditambahkan.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menambahkan user.' });
  }
});

// PUT /api/users/:id - admin only (update status aktif / nama, dll)
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { nama, is_active, beautician_id } = req.body;
    await pool.query(
      'UPDATE users SET nama = ?, is_active = ?, beautician_id = ? WHERE id = ?',
      [nama, is_active ?? 1, beautician_id || null, req.params.id]
    );
    res.json({ message: 'User berhasil diperbarui.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memperbarui user.' });
  }
});

// PUT /api/users/:id/password - admin reset password user
router.put('/:id/password', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password minimal 6 karakter.' });
    }
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, req.params.id]);
    res.json({ message: 'Password berhasil direset.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mereset password.' });
  }
});

module.exports = router;
