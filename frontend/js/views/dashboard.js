async function renderDashboard(container) {
  container.innerHTML = `<div class="page-header"><div><h2>Dashboard</h2><p>Ringkasan operasional hari ini</p></div></div>
  <div id="dash-stats" class="grid grid-4"></div>
  <div class="card" style="margin-top:20px">
    <div class="flex-between" style="margin-bottom:12px">
      <h3 class="mt-0 mb-0">Appointment Hari Ini</h3>
    </div>
    <div id="dash-appt-today" class="table-wrap"></div>
  </div>`;

  const today = todayISO();
  let appts = [];
  try {
    appts = await Api.getAppointments({ tanggal: today });
  } catch (err) {
    showToast(err.message, 'error');
  }

  const jumlahMenunggu = appts.filter(a => a.status === 'menunggu').length;
  const jumlahProses = appts.filter(a => a.status === 'proses').length;
  const jumlahSelesai = appts.filter(a => a.status === 'selesai').length;
  const jumlahDibayar = appts.filter(a => a.status === 'dibayar').length;

  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Menunggu</div><div class="stat-value">${jumlahMenunggu}</div></div>
    <div class="stat-card"><div class="stat-label">Sedang Diproses</div><div class="stat-value">${jumlahProses}</div></div>
    <div class="stat-card"><div class="stat-label">Selesai (Siap Bayar)</div><div class="stat-value">${jumlahSelesai}</div></div>
    <div class="stat-card"><div class="stat-label">Sudah Dibayar</div><div class="stat-value">${jumlahDibayar}</div></div>
  `;

  const wrap = document.getElementById('dash-appt-today');
  if (appts.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="display">Belum ada appointment</div><p>Tidak ada jadwal untuk hari ini.</p></div>`;
    return;
  }

  wrap.innerHTML = `<table>
    <thead><tr><th>Jam</th><th>Pelanggan</th><th>Beautician</th><th>Layanan</th><th>Status</th></tr></thead>
    <tbody>
      ${appts.map(a => `
        <tr>
          <td data-label="Jam" class="mono">${formatJam(a.jam_mulai)} - ${formatJam(a.jam_selesai_estimasi)}</td>
          <td data-label="Pelanggan">${escapeHtml(a.nama_pelanggan)}</td>
          <td data-label="Beautician">${escapeHtml(a.nama_beautician)}</td>
          <td data-label="Layanan">${a.layanan.map(l => l.nama_layanan).join(', ')}</td>
          <td data-label="Status">${statusBadge(a.status)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
}
