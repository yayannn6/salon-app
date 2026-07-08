require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const layananRoutes = require('./routes/layanan');
const pelangganRoutes = require('./routes/pelanggan');
const beauticianRoutes = require('./routes/beautician');
const appointmentRoutes = require('./routes/appointment');
const transaksiRoutes = require('./routes/transaksi');
const usersRoutes = require('./routes/users');

const app = express();

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/layanan', layananRoutes);
app.use('/api/pelanggan', pelangganRoutes);
app.use('/api/beautician', beauticianRoutes);
app.use('/api/appointment', appointmentRoutes);
app.use('/api/transaksi', transaksiRoutes);
app.use('/api/users', usersRoutes);

// Sajikan frontend statis (folder ../frontend)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server salon berjalan di http://localhost:${PORT}`);
});
