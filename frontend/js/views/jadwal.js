let _jadwalTanggal = todayISO();

async function renderJadwal(container) {
  const user = Auth.getUser();
  container.innerHTML = `
    <div class="page-header">
      <div><h2>Jadwal Saya</h2><p>Halo, ${escapeHtml(user.nama)} — berikut jadwal appointment Anda</p></div>
      <input type="date" id="jadwal-tanggal" value="${_jadwalTanggal}">
    </div>
    <div class="card"><div id="jadwal-timeline"></div></div>
  `;

  document.getElementById('jadwal-tanggal').onchange = (e) => {
    _jadwalTanggal = e.target.value;
    loadJadwal();
  };

  await loadJadwal();
}

async function loadJadwal() {
  const user = Auth.getUser();
  const wrap = document.getElementById('jadwal-timeline');
  wrap.innerHTML = `<p class="text-muted">Memuat jadwal...</p>`;

  let rows = [];
  try {
    rows = await Api.getJadwalBeautician(user.beautician_id, _jadwalTanggal);
  } catch (err) {
    wrap.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
    return;
  }

  rows = rows.filter(r => r.status !== 'batal');

  if (rows.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="display">Tidak ada jadwal</div><p>Anda tidak memiliki appointment pada ${formatTanggal(_jadwalTanggal)}.</p></div>`;
    return;
  }

  wrap.innerHTML = `<div class="timeline">
    ${rows.map(a => `
      <div class="timeline-slot">
        <div class="timeline-time">${formatJam(a.jam_mulai)}</div>
        <div class="timeline-dot"></div>
        <div class="timeline-card status-${a.status}">
          <div class="flex-between">
            <h4>${escapeHtml(a.nama_pelanggan)}</h4>
            ${statusBadge(a.status)}
          </div>
          <div class="text-muted" style="font-size:13px">${formatJam(a.jam_mulai)} - ${formatJam(a.jam_selesai_estimasi)} &middot; ${a.total_durasi_menit} menit</div>
          <div class="svc-tags">
            ${a.layanan.map(l => `<span class="svc-tag">${escapeHtml(l.nama_layanan)}</span>`).join('')}
          </div>
          <div style="margin-top:10px">
            ${a.status === 'menunggu' ? `<button class="btn btn-ghost btn-sm" onclick="jadwalUbahStatus(${a.id}, 'proses')">Mulai Layanan</button>` : ''}
            ${a.status === 'proses' ? `<button class="btn btn-ghost btn-sm" onclick="jadwalUbahStatus(${a.id}, 'selesai')">Tandai Selesai</button>` : ''}
          </div>
        </div>
      </div>
    `).join('')}
  </div>`;
}

async function jadwalUbahStatus(id, status) {
  try {
    await Api.updateAppointmentStatus(id, status);
    showToast('Status berhasil diperbarui.', 'success');
    await loadJadwal();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
