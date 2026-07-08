const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function generateNoInvoice() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${y}${m}${d}-${rand}`;
}

// GET /api/transaksi - riwayat transaksi (admin & kasir)
router.get('/', authenticate, authorize('admin', 'kasir'), async (req, res) => {
  try {
    const { tanggal } = req.query;
    let sql = `
      SELECT t.*, a.tanggal AS tanggal_appointment, p.nama AS nama_pelanggan, u.nama AS nama_kasir
      FROM transaksi t
      JOIN appointment a ON a.id = t.appointment_id
      JOIN pelanggan p ON p.id = a.pelanggan_id
      JOIN users u ON u.id = t.kasir_id
      WHERE 1=1
    `;
    const params = [];
    if (tanggal) {
      sql += ' AND DATE(t.created_at) = ?';
      params.push(tanggal);
    }
    sql += ' ORDER BY t.created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil riwayat transaksi.' });
  }
});

// GET /api/transaksi/siap-bayar - daftar appointment berstatus 'selesai' (siap dibayarkan)
router.get('/siap-bayar', authenticate, authorize('admin', 'kasir'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, p.nama AS nama_pelanggan, p.telepon AS telepon_pelanggan, b.nama AS nama_beautician
       FROM appointment a
       JOIN pelanggan p ON p.id = a.pelanggan_id
       JOIN beautician b ON b.id = a.beautician_id
       WHERE a.status = 'selesai'
       ORDER BY a.tanggal ASC, a.jam_mulai ASC`
    );
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
    res.status(500).json({ message: 'Gagal mengambil daftar appointment siap bayar.' });
  }
});

// ---------------------------------------------------------
// POST /api/transaksi - proses pembayaran atas 1 appointment
// Body: { appointment_id, diskon, metode_bayar, jumlah_dibayar }
// Hanya bisa dibayar jika status appointment = 'selesai'
// Setelah pembayaran berhasil, status appointment otomatis -> 'dibayar'
// ---------------------------------------------------------
router.post('/', authenticate, authorize('admin', 'kasir'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { appointment_id, diskon, metode_bayar, jumlah_dibayar } = req.body;

    if (!appointment_id || !metode_bayar || jumlah_dibayar == null) {
      conn.release();
      return res.status(400).json({ message: 'Appointment, metode bayar, dan jumlah dibayar wajib diisi.' });
    }

    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM appointment WHERE id = ? FOR UPDATE', [appointment_id]);
    if (rows.length === 0) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ message: 'Appointment tidak ditemukan.' });
    }
    const appt = rows[0];

    if (appt.status !== 'selesai') {
      await conn.rollback(); conn.release();
      return res.status(409).json({ message: `Appointment belum berstatus 'selesai'. Status saat ini: '${appt.status}'. Layanan harus selesai dikerjakan sebelum dibayar.` });
    }

    const [existingTrx] = await conn.query('SELECT id FROM transaksi WHERE appointment_id = ?', [appointment_id]);
    if (existingTrx.length > 0) {
      await conn.rollback(); conn.release();
      return res.status(409).json({ message: 'Appointment ini sudah memiliki transaksi pembayaran.' });
    }

    const subtotal = Number(appt.total_biaya);
    const diskonValue = Number(diskon || 0);
    const totalBayar = Math.max(subtotal - diskonValue, 0);

    if (Number(jumlah_dibayar) < totalBayar) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ message: `Jumlah yang dibayarkan (${jumlah_dibayar}) kurang dari total tagihan (${totalBayar}).` });
    }

    const kembalian = Number(jumlah_dibayar) - totalBayar;
    const noInvoice = generateNoInvoice();

    const [result] = await conn.query(
      `INSERT INTO transaksi
       (appointment_id, kasir_id, no_invoice, subtotal, diskon, total_bayar, metode_bayar, jumlah_dibayar, kembalian, status_bayar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'lunas')`,
      [appointment_id, req.user.id, noInvoice, subtotal, diskonValue, totalBayar, metode_bayar, jumlah_dibayar, kembalian]
    );

    await conn.query("UPDATE appointment SET status = 'dibayar' WHERE id = ?", [appointment_id]);

    await conn.commit();
    conn.release();

    res.status(201).json({
      id: result.insertId,
      no_invoice: noInvoice,
      subtotal, diskon: diskonValue, total_bayar: totalBayar, kembalian,
      message: 'Pembayaran berhasil diproses.'
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error(err);
    res.status(500).json({ message: 'Gagal memproses pembayaran.' });
  }
});

// GET /api/transaksi/:id - detail 1 transaksi (untuk cetak struk)
router.get('/:id', authenticate, authorize('admin', 'kasir'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, a.tanggal AS tanggal_appointment, a.jam_mulai, a.jam_selesai_estimasi,
              p.nama AS nama_pelanggan, p.telepon AS telepon_pelanggan,
              b.nama AS nama_beautician, u.nama AS nama_kasir
       FROM transaksi t
       JOIN appointment a ON a.id = t.appointment_id
       JOIN pelanggan p ON p.id = a.pelanggan_id
       JOIN beautician b ON b.id = a.beautician_id
       JOIN users u ON u.id = t.kasir_id
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });

    const trx = rows[0];
    const [layananRows] = await pool.query(
      `SELECT al.layanan_id, l.nama_layanan, al.harga_saat_itu, al.durasi_saat_itu
       FROM appointment_layanan al
       JOIN layanan l ON l.id = al.layanan_id
       WHERE al.appointment_id = ?`,
      [trx.appointment_id]
    );
    trx.layanan = layananRows;

    res.json(trx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil detail transaksi.' });
  }
});

module.exports = router;
