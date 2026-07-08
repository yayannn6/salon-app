const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    console.log('[LOGIN] 1. request masuk', req.body.username);
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username dan password wajib diisi.' });
    }

    console.log('[LOGIN] 2. sebelum query DB');
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE username = ? AND is_active = 1',
      [username]
    );
    console.log('[LOGIN] 3. setelah query DB, jumlah baris:', rows.length);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Username atau password salah.' });
    }

    const user = rows[0];
    console.log('[LOGIN] 4. sebelum bcrypt.compare');
    const match = await bcrypt.compare(password, user.password);
    console.log('[LOGIN] 5. setelah bcrypt.compare, hasil:', match);

    if (!match) {
      return res.status(401).json({ message: 'Username atau password salah.' });
    }

    const payload = {
      id: user.id,
      username: user.username,
      nama: user.nama,
      role: user.role,
      beautician_id: user.beautician_id
    };
    console.log('[LOGIN] 6. sebelum jwt.sign, JWT_SECRET ada?', !!process.env.JWT_SECRET);

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h'
    });
    console.log('[LOGIN] 7. setelah jwt.sign, token panjang:', token.length);

    res.json({ token, user: payload });
    console.log('[LOGIN] 8. res.json terkirim');
  } catch (err) {
    console.log('[LOGIN] ERROR ditangkap:', err);
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;