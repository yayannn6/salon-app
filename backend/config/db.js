require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '45.127.32.20',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'hasna',
  password: process.env.DB_PASSWORD || 'PasswordKuat123!',
  database: process.env.DB_NAME || 'salon_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00',
  dateStrings: true // penting: agar tipe DATE/TIME dikembalikan sebagai string, bukan objek Date bertimezone
});

module.exports = pool;
