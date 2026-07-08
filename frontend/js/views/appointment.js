let _apptLayananCache = [];
let _apptBeauticianCache = [];
let _apptFilterTanggal = todayISO();
let _apptFilterStatus = '';

async function renderAppointment(container) {
  const user = Auth.getUser();
  container.innerHTML = `
    <div class="page-header">
      <div><h2>Appointment</h2><p>Kelola jadwal appointment pelanggan</p></div>
      ${user.role === 'admin' ? '<button class="btn btn-primary" id="btn-add-appt">+ Buat Appointment</button>' : ''}
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="form-row" style="align-items:flex-end">
        <div class="form-group" style="max-width:200px">
          <label>Tanggal</label>
          <input type="date" id="filter-tanggal" value="${_apptFilterTanggal}">
        </div>
        <div class="form-group" style="max-width:200px">
          <label>Status</label>
          <select id="filter-status">
            <option value="">Semua Status</option>
            <option value="menunggu">Menunggu</option>
            <option value="proses">Proses</option>
            <option value="selesai">Selesai</option>
            <option value="dibayar">Dibayar</option>
            <option value="batal">Batal</option>
          </select>
        </div>
      </div>
    </div>
    <div class="card"><div id="appt-table" class="table-wrap"></div></div>
  `;

  if (user.role === 'admin') {
    document.getElementById('btn-add-appt').onclick = () => openAppointmentForm();
  }
  document.getElementById('filter-tanggal').onchange = (e) => { _apptFilterTanggal = e.target.value; loadApptTable(); };
  document.getElementById('filter-status').onchange = (e) => { _apptFilterStatus = e.target.value; loadApptTable(); };

  await loadApptTable();
}

async function loadApptTable() {
  const wrap = document.getElementById('appt-table');
  wrap.innerHTML = `<p class="text-muted">Memuat data...</p>`;
  const user = Auth.getUser();
  const query = {};
  if (_apptFilterTanggal) query.tanggal = _apptFilterTanggal;
  if (_apptFilterStatus) query.status = _apptFilterStatus;

  let rows = [];
  try {
    rows = await Api.getAppointments(query);
  } catch (err) {
    wrap.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
    return;
  }

  if (rows.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="display">Tidak ada appointment</div><p>Coba ubah filter tanggal atau status.</p></div>`;
    return;
  }

  wrap.innerHTML = `<table>
    <thead><tr><th>Jam</th><th>Pelanggan</th><th>Beautician</th><th>Layanan</th><th>Total</th><th>Status</th><th></th></tr></thead>
    <tbody>
      ${rows.map(a => `
        <tr>
          <td data-label="Jam" class="mono">${formatJam(a.jam_mulai)}-${formatJam(a.jam_selesai_estimasi)}</td>
          <td data-label="Pelanggan">${escapeHtml(a.nama_pelanggan)}<div class="text-muted" style="font-size:12px">${escapeHtml(a.telepon_pelanggan)}</div></td>
          <td data-label="Beautician">${escapeHtml(a.nama_beautician)}</td>
          <td data-label="Layanan">${a.layanan.map(l => `<span class="svc-tag">${escapeHtml(l.nama_layanan)}</span>`).join(' ')}</td>
          <td data-label="Total" class="mono">${formatRupiah(a.total_biaya)}</td>
          <td data-label="Status">${statusBadge(a.status)}</td>
          <td data-label="Aksi">${renderApptActions(a, user)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;

  wrap.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleApptAction(btn.dataset.action, Number(btn.dataset.id)));
  });
}

function renderApptActions(a, user) {
  const btns = [];
  if (user.role === 'admin') {
    if (a.status === 'menunggu') btns.push(`<button class="btn btn-ghost btn-sm" data-action="proses" data-id="${a.id}">Mulai Proses</button>`);
    if (a.status === 'proses') btns.push(`<button class="btn btn-ghost btn-sm" data-action="selesai" data-id="${a.id}">Selesaikan</button>`);
    if (['menunggu', 'proses'].includes(a.status)) btns.push(`<button class="btn btn-danger btn-sm" data-action="batal" data-id="${a.id}">Batalkan</button>`);
  }
  if (user.role === 'beautician') {
    if (a.status === 'menunggu') btns.push(`<button class="btn btn-ghost btn-sm" data-action="proses" data-id="${a.id}">Mulai</button>`);
    if (a.status === 'proses') btns.push(`<button class="btn btn-ghost btn-sm" data-action="selesai" data-id="${a.id}">Selesai</button>`);
  }
  return btns.join(' ') || '<span class="text-muted">-</span>';
}

async function handleApptAction(action, id) {
  try {
    if (action === 'batal') {
      if (!confirm('Yakin ingin membatalkan appointment ini?')) return;
      await Api.cancelAppointment(id);
    } else {
      await Api.updateAppointmentStatus(id, action);
    }
    showToast('Status appointment berhasil diperbarui.', 'success');
    await loadApptTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------------------------------------------------
// FORM BUAT APPOINTMENT BARU (admin)
// ---------------------------------------------------------
async function openAppointmentForm() {
  let pelangganList = [], beauticianList = [], layananList = [];
  try {
    [pelangganList, beauticianList, layananList] = await Promise.all([
      Api.getPelanggan(), Api.getBeautician(), Api.getLayanan()
    ]);
  } catch (err) {
    showToast(err.message, 'error');
    return;
  }
  _apptBeauticianCache = beauticianList;
  _apptLayananCache = layananList;

  openModal('Buat Appointment Baru', `
    <div class="form-group">
      <label>Pelanggan</label>
      <select id="f-pelanggan">
        <option value="">-- Pilih Pelanggan --</option>
        ${pelangganList.map(p => `<option value="${p.id}">${escapeHtml(p.nama)} (${escapeHtml(p.telepon)})</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Tanggal</label>
        <input type="date" id="f-tanggal" value="${todayISO()}">
      </div>
      <div class="form-group">
        <label>Jam Mulai</label>
        <input type="time" id="f-jam">
      </div>
    </div>
    <div class="form-group">
      <label>Beautician</label>
      <select id="f-beautician">
        <option value="">-- Pilih Beautician --</option>
        ${beauticianList.map(b => `<option value="${b.id}">${escapeHtml(b.nama)} ${b.spesialisasi ? '— ' + escapeHtml(b.spesialisasi) : ''}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Pilih Layanan</label>
      <div id="svc-checklist" class="checkbox-list"></div>
    </div>
    <div class="form-group">
      <label>Catatan (opsional)</label>
      <textarea id="f-catatan" rows="2"></textarea>
    </div>
    <div class="card" style="background:var(--surface-alt);border:none;padding:14px">
      <div class="flex-between"><span class="text-muted" style="font-size:13px">Total Durasi</span><strong id="preview-durasi">0 menit</strong></div>
      <div class="flex-between" style="margin-top:6px"><span class="text-muted" style="font-size:13px">Estimasi Selesai</span><strong id="preview-selesai" class="mono">-</strong></div>
      <div class="flex-between" style="margin-top:6px"><span class="text-muted" style="font-size:13px">Total Biaya</span><strong id="preview-biaya" class="mono">Rp 0</strong></div>
    </div>
    <p id="form-error" class="error-text" hidden></p>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" id="btn-save-appt">Buat Appointment</button>
    </div>
  `, {
    onMount: () => {
      renderServiceChecklist();
      document.getElementById('f-tanggal').addEventListener('change', renderServiceChecklist);
      document.getElementById('f-jam').addEventListener('change', updateApptPreview);
    }
  });

  document.getElementById('btn-save-appt').onclick = submitAppointmentForm;
}

async function renderServiceChecklist() {
  const tanggal = document.getElementById('f-tanggal').value;
  const listEl = document.getElementById('svc-checklist');
  listEl.innerHTML = `<p class="text-muted" style="font-size:13px">Memuat kuota layanan untuk ${tanggal}...</p>`;

  // Ambil appointment 'menunggu' pada tanggal ini untuk menghitung sisa kuota tiap layanan
  let apptHariIni = [];
  try {
    apptHariIni = await Api.getAppointments({ tanggal, status: 'menunggu' });
  } catch (err) {
    // Biarkan tetap tampil meski gagal hitung kuota; validasi final tetap di server
  }

  const pemakaian = {};
  apptHariIni.forEach(a => {
    a.layanan.forEach(l => {
      pemakaian[l.layanan_id] = (pemakaian[l.layanan_id] || 0) + 1;
    });
  });

  listEl.innerHTML = _apptLayananCache.map(l => {
    const used = pemakaian[l.id] || 0;
    const max = l.maksimal_layanan;
    const penuh = max > 0 && used >= max;
    const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
    return `
      <label class="service-check" style="${penuh ? 'opacity:0.55' : ''}">
        <input type="checkbox" value="${l.id}" data-durasi="${l.durasi_menit}" data-biaya="${l.biaya}" ${penuh ? 'disabled' : ''} onchange="updateApptPreview()">
        <div style="flex:1">
          <div class="svc-name">${escapeHtml(l.nama_layanan)}</div>
          <div class="svc-meta">${l.durasi_menit} menit &middot; ${formatRupiah(l.biaya)}</div>
          ${max > 0 ? `
            <div class="quota-bar-track"><div class="quota-bar-fill ${penuh ? 'full' : ''}" style="width:${pct}%"></div></div>
            <div class="quota-label">${used}/${max} slot terpakai hari ini${penuh ? ' — PENUH' : ''}</div>
          ` : `<div class="quota-label">Tanpa batas kuota harian</div>`}
        </div>
      </label>
    `;
  }).join('');
}

function updateApptPreview() {
  const checked = [...document.querySelectorAll('#svc-checklist input:checked')];
  const totalDurasi = checked.reduce((sum, c) => sum + Number(c.dataset.durasi), 0);
  const totalBiaya = checked.reduce((sum, c) => sum + Number(c.dataset.biaya), 0);
  document.getElementById('preview-durasi').textContent = `${totalDurasi} menit`;
  document.getElementById('preview-biaya').textContent = formatRupiah(totalBiaya);

  const jam = document.getElementById('f-jam').value;
  if (jam && totalDurasi > 0) {
    const [h, m] = jam.split(':').map(Number);
    const totalMenit = h * 60 + m + totalDurasi;
    const jamSelesai = `${String(Math.floor(totalMenit / 60) % 24).padStart(2, '0')}:${String(totalMenit % 60).padStart(2, '0')}`;
    document.getElementById('preview-selesai').textContent = jamSelesai;
  } else {
    document.getElementById('preview-selesai').textContent = '-';
  }

  document.querySelectorAll('.service-check').forEach(el => {
    const cb = el.querySelector('input');
    el.classList.toggle('checked', cb.checked);
  });
}

async function submitAppointmentForm() {
  const errorEl = document.getElementById('form-error');
  errorEl.hidden = true;

  const pelanggan_id = document.getElementById('f-pelanggan').value;
  const beautician_id = document.getElementById('f-beautician').value;
  const tanggal = document.getElementById('f-tanggal').value;
  const jam_mulai = document.getElementById('f-jam').value;
  const catatan = document.getElementById('f-catatan').value.trim();
  const layanan_ids = [...document.querySelectorAll('#svc-checklist input:checked')].map(c => Number(c.value));

  if (!pelanggan_id || !beautician_id || !tanggal || !jam_mulai || layanan_ids.length === 0) {
    errorEl.hidden = false;
    errorEl.textContent = 'Lengkapi pelanggan, beautician, tanggal, jam, dan minimal 1 layanan.';
    return;
  }

  try {
    await Api.createAppointment({
      pelanggan_id: Number(pelanggan_id),
      beautician_id: Number(beautician_id),
      tanggal, jam_mulai,
      layanan_ids,
      catatan
    });
    showToast('Appointment berhasil dibuat.', 'success');
    closeModal();
    _apptFilterTanggal = tanggal;
    document.getElementById('filter-tanggal') && (document.getElementById('filter-tanggal').value = tanggal);
    await loadApptTable();
  } catch (err) {
    errorEl.hidden = false;
    errorEl.textContent = err.message;
  }
}
