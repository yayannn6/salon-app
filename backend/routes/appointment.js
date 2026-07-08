const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ---------------------------------------------------------
// Helper: tambahkan menit ke string waktu "HH:MM:SS" -> "HH:MM:SS"
// ---------------------------------------------------------
function tambahMenit(jamMulai, totalMenit) {
  const [h, m, s] = jamMulai.split(':').map(Number);
  const totalDetikAwal = h * 3600 + m * 60 + (s || 0);
  const totalDetikBaru = totalDetikAwal + totalMenit * 60;
  const jamBaru = Math.floor(totalDetikBaru / 3600) % 24;
  const menitBaru = Math.floor((totalDetikBaru % 3600) / 60);
  const detikBaru = totalDetikBaru % 60;
  return [jamBaru, menitBaru, detikBaru].map((v) => String(v).padStart(2, '0')).join(':');
}

// GET /api/appointment?tanggal=YYYY-MM-DD&status=menunggu&beautician_id=1
router.get('/', authenticate, async (req, res) => {
  try {
    const { tanggal, status, beautician_id, pelanggan_id } = req.query;
    let sql = `
      SELECT a.*, p.nama AS nama_pelanggan, p.telepon AS telepon_pelanggan,
             b.nama AS nama_beautician
      FROM appointment a
      JOIN pelanggan p ON p.id = a.pelanggan_id
      JOIN beautician b ON b.id = a.beautician_id
      WHERE 1=1
    `;
    const params = [];

    // Beautician hanya boleh melihat jadwalnya sendiri
    if (req.user.role === 'beautician') {
      sql += ' AND a.beautician_id = ?';
      params.push(req.user.beautician_id);
    } else if (beautician_id) {
      sql += ' AND a.beautician_id = ?';
      params.push(beautician_id);
    }

    if (tanggal) {
      sql += ' AND a.tanggal = ?';
      params.push(tanggal);
    }
    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }
    if (pelanggan_id) {
      sql += ' AND a.pelanggan_id = ?';
      params.push(pelanggan_id);
    }

    sql += ' ORDER BY a.tanggal DESC, a.jam_mulai ASC';

    const [rows] = await pool.query(sql, params);

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
    res.status(500).json({ message: 'Gagal mengambil data appointment.' });
  }
});

// GET /api/appointment/:id - detail satu appointment
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, p.nama AS nama_pelanggan, p.telepon AS telepon_pelanggan,
              b.nama AS nama_beautician
       FROM appointment a
       JOIN pelanggan p ON p.id = a.pelanggan_id
       JOIN beautician b ON b.id = a.beautician_id
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Appointment tidak ditemukan.' });

    const appt = rows[0];

    if (req.user.role === 'beautician' && String(req.user.beautician_id) !== String(appt.beautician_id)) {
      return res.status(403).json({ message: 'Anda tidak memiliki akses ke appointment ini.' });
    }

    const [layananRows] = await pool.query(
      `SELECT al.layanan_id, l.nama_layanan, al.harga_saat_itu, al.durasi_saat_itu
       FROM appointment_layanan al
       JOIN layanan l ON l.id = al.layanan_id
       WHERE al.appointment_id = ?`,
      [appt.id]
    );
    appt.layanan = layananRows;

    res.json(appt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil detail appointment.' });
  }
});

// ---------------------------------------------------------
// POST /api/appointment - HANYA ADMIN yang boleh membuat appointment
//
// Body: {
//   pelanggan_id, beautician_id, tanggal, jam_mulai,
//   layanan_ids: [1,2,3], catatan
// }
//
// VALIDASI:
// 1) Kuota maksimal layanan per hari: hitung appointment dgn status
//    'menunggu' (belum diproses) di tanggal yg sama untuk tiap layanan
//    yang dipilih. Jika sudah mencapai maksimal_layanan, tolak.
// 2) Ketersediaan beautician: cek tidak ada appointment lain (status
//    selain 'batal') milik beautician yang sama pada tanggal yang sama
//    yang jam-nya beririsan (overlap) dengan slot baru.
// ---------------------------------------------------------
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { pelanggan_id, beautician_id, tanggal, jam_mulai, layanan_ids, catatan } = req.body;

    if (!pelanggan_id || !beautician_id || !tanggal || !jam_mulai || !Array.isArray(layanan_ids) || layanan_ids.length === 0) {
      conn.release();
      return res.status(400).json({ message: 'Pelanggan, beautician, tanggal, jam mulai, dan minimal 1 layanan wajib diisi.' });
    }

    await conn.beginTransaction();

    // Ambil detail layanan yang dipilih (lock row untuk konsistensi kuota)
    const placeholders = layanan_ids.map(() => '?').join(',');
    const [layananRows] = await conn.query(
      `SELECT * FROM layanan WHERE id IN (${placeholders}) AND is_active = 1`,
      layanan_ids
    );

    if (layananRows.length !== layanan_ids.length) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ message: 'Salah satu layanan tidak ditemukan atau sudah tidak aktif.' });
    }

    // ============ VALIDASI 1: KUOTA MAKSIMAL LAYANAN PER HARI ============
    for (const layanan of layananRows) {
      if (layanan.maksimal_layanan > 0) {
        const [[{ jumlah }]] = await conn.query(
          `SELECT COUNT(*) AS jumlah
           FROM appointment_layanan al
           JOIN appointment a ON a.id = al.appointment_id
           WHERE al.layanan_id = ? AND a.tanggal = ? AND a.status = 'menunggu'`,
          [layanan.id, tanggal]
        );

        if (jumlah >= layanan.maksimal_layanan) {
          await conn.rollback();
          conn.release();
          return res.status(409).json({
            message: `Kuota layanan "${layanan.nama_layanan}" pada tanggal ${tanggal} sudah penuh (maksimal ${layanan.maksimal_layanan} booking/hari, saat ini sudah ${jumlah} appointment menunggu diproses).`
          });
        }
      }
    }

    // ============ HITUNG TOTAL DURASI, TOTAL BIAYA, JAM SELESAI ============
    const totalDurasi = layananRows.reduce((sum, l) => sum + l.durasi_menit, 0);
    const totalBiaya = layananRows.reduce((sum, l) => sum + Number(l.biaya), 0);
    const jamSelesaiEstimasi = tambahMenit(jam_mulai, totalDurasi);

    // ============ VALIDASI 2: KETERSEDIAAN BEAUTICIAN (CEK BENTROK JADWAL) ============
    // Dua rentang waktu [A_mulai, A_selesai) dan [B_mulai, B_selesai) beririsan jika:
    //   A_mulai < B_selesai DAN A_selesai > B_mulai
    const [bentrok] = await conn.query(
      `SELECT id, jam_mulai, jam_selesai_estimasi FROM appointment
       WHERE beautician_id = ? AND tanggal = ? AND status != 'batal'
       AND jam_mulai < ? AND jam_selesai_estimasi > ?`,
      [beautician_id, tanggal, jamSelesaiEstimasi, jam_mulai]
    );

    if (bentrok.length > 0) {
      await conn.rollback();
      conn.release();
      return res.status(409).json({
        message: `Beautician tidak tersedia pada jam tersebut. Sudah ada jadwal pukul ${bentrok[0].jam_mulai} - ${bentrok[0].jam_selesai_estimasi} pada tanggal ${tanggal}.`
      });
    }

    // ============ SIMPAN APPOINTMENT ============
    const [result] = await conn.query(
      `INSERT INTO appointment
       (pelanggan_id, beautician_id, tanggal, jam_mulai, jam_selesai_estimasi, total_durasi_menit, total_biaya, status, catatan, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'menunggu', ?, ?)`,
      [pelanggan_id, beautician_id, tanggal, jam_mulai, jamSelesaiEstimasi, totalDurasi, totalBiaya, catatan || null, req.user.id]
    );

    const appointmentId = result.insertId;

    for (const layanan of layananRows) {
      await conn.query(
        `INSERT INTO appointment_layanan (appointment_id, layanan_id, harga_saat_itu, durasi_saat_itu)
         VALUES (?, ?, ?, ?)`,
        [appointmentId, layanan.id, layanan.biaya, layanan.durasi_menit]
      );
    }

    await conn.commit();
    conn.release();

    res.status(201).json({
      id: appointmentId,
      jam_selesai_estimasi: jamSelesaiEstimasi,
      total_durasi_menit: totalDurasi,
      total_biaya: totalBiaya,
      message: 'Appointment berhasil dibuat.'
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error(err);
    res.status(500).json({ message: 'Gagal membuat appointment.' });
  }
});

// ---------------------------------------------------------
// PUT /api/appointment/:id/status - update status appointment
// Alur status: menunggu -> proses -> selesai -> dibayar (dibayar hanya via transaksi)
// - admin: boleh ubah ke menunggu/proses/selesai/batal
// - beautician: boleh ubah HANYA appointment miliknya, transisi menunggu->proses / proses->selesai
// ---------------------------------------------------------
router.put('/:id/status', authenticate, authorize('admin', 'beautician'), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatus = ['menunggu', 'proses', 'selesai', 'batal'];
    if (!validStatus.includes(status)) {
      return res.status(400).json({ message: 'Status tidak valid.' });
    }

    const [rows] = await pool.query('SELECT * FROM appointment WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Appointment tidak ditemukan.' });
    const appt = rows[0];

    if (appt.status === 'dibayar') {
      return res.status(409).json({ message: 'Appointment yang sudah dibayar tidak dapat diubah statusnya.' });
    }

    if (req.user.role === 'beautician') {
      if (String(req.user.beautician_id) !== String(appt.beautician_id)) {
        return res.status(403).json({ message: 'Anda hanya dapat mengubah status appointment milik Anda sendiri.' });
      }
      const transisiValid = (appt.status === 'menunggu' && status === 'proses') ||
                             (appt.status === 'proses' && status === 'selesai');
      if (!transisiValid) {
        return res.status(400).json({ message: `Beautician hanya dapat mengubah status dari 'menunggu'->'proses' atau 'proses'->'selesai'.` });
      }
    }

    await pool.query('UPDATE appointment SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: `Status appointment berhasil diubah menjadi '${status}'.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengubah status appointment.' });
  }
});

// DELETE /api/appointment/:id - admin only, membatalkan appointment (soft: status = batal)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM appointment WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Appointment tidak ditemukan.' });
    if (rows[0].status === 'dibayar') {
      return res.status(409).json({ message: 'Appointment yang sudah dibayar tidak dapat dibatalkan.' });
    }
    await pool.query("UPDATE appointment SET status = 'batal' WHERE id = ?", [req.params.id]);
    res.json({ message: 'Appointment berhasil dibatalkan.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal membatalkan appointment.' });
  }
});

module.exports = router;
