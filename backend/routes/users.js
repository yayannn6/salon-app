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

    // Pastikan data beautician yang dipilih belum dikaitkan ke user lain (relasi 1-to-1)
    if (role === 'beautician') {
      const [dipakai] = await pool.query(
        'SELECT username FROM users WHERE beautician_id = ?',
        [beautician_id]
      );
      if (dipakai.length > 0) {
        return res.status(409).json({
          message: `Data beautician ini sudah memiliki akun (username: ${dipakai[0].username}). Setiap beautician hanya boleh dikaitkan ke 1 akun.`
        });
      }
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (nama, username, password, role, beautician_id) VALUES (?, ?, ?, ?, ?)',
      [nama, username, hash, role, role === 'beautician' ? beautician_id : null]
    );
    res.status(201).json({ id: result.insertId, message: 'User berhasil ditambahkan.' });
  } catch (err) {
    // Jaring pengaman kalau ada 2 request nyaris bersamaan lolos cek di atas (race condition):
    // UNIQUE constraint di database akan menolaknya di sini.
    if (err.code === 'ER_DUP_ENTRY' && err.sqlMessage && err.sqlMessage.includes('beautician_id')) {
      return res.status(409).json({ message: 'Data beautician ini baru saja dikaitkan ke akun lain. Silakan pilih beautician lain.' });
    }
    console.error(err);
    res.status(500).json({ message: 'Gagal menambahkan user.' });
  }
});

// GET /api/users/beautician-tersedia - daftar id beautician yang BELUM punya akun user
router.get('/beautician-tersedia', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.nama FROM beautician b
       WHERE b.is_active = 1
       AND b.id NOT IN (SELECT beautician_id FROM users WHERE beautician_id IS NOT NULL)
       ORDER BY b.nama`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil daftar beautician yang tersedia.' });
  }
});

// PUT /api/users/:id - admin only (update status aktif / nama, dll)
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { nama, is_active, beautician_id } = req.body;

    // Kalau beautician_id diisi, pastikan belum dipakai user LAIN (selain user ini sendiri)
    if (beautician_id) {
      const [dipakai] = await pool.query(
        'SELECT username FROM users WHERE beautician_id = ? AND id != ?',
        [beautician_id, req.params.id]
      );
      if (dipakai.length > 0) {
        return res.status(409).json({
          message: `Data beautician ini sudah memiliki akun (username: ${dipakai[0].username}). Setiap beautician hanya boleh dikaitkan ke 1 akun.`
        });
      }
    }

    await pool.query(
      'UPDATE users SET nama = ?, is_active = ?, beautician_id = ? WHERE id = ?',
      [nama, is_active ?? 1, beautician_id || null, req.params.id]
    );
    res.json({ message: 'User berhasil diperbarui.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' && err.sqlMessage && err.sqlMessage.includes('beautician_id')) {
      return res.status(409).json({ message: 'Data beautician ini baru saja dikaitkan ke akun lain. Silakan pilih beautician lain.' });
    }
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
