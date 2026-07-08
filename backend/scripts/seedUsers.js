/**
 * Script bantu untuk generate hash password default & update ke database.
 * Jalankan: npm run seed:users
 * Semua user default akan memiliki password: password123
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function run() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const usernames = ['admin', 'kasir1', 'sari', 'dewi'];
  for (const uname of usernames) {
    await pool.query('UPDATE users SET password = ? WHERE username = ?', [passwordHash, uname]);
    console.log(`Password untuk user '${uname}' berhasil di-update.`);
  }

  console.log('\nSelesai! Semua user default sekarang memakai password: password123');
  process.exit(0);
}

run().catch((err) => {
  console.error('Gagal seeding user:', err);
  process.exit(1);
});
