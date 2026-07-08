let _layananCache = [];

async function renderLayanan(container) {
  container.innerHTML = `
    <div class="page-header">
      <div><h2>Layanan</h2><p>Kelola daftar layanan, kuota harian, durasi, dan biaya</p></div>
      <button class="btn btn-primary" id="btn-add-layanan">+ Tambah Layanan</button>
    </div>
    <div class="card"><div id="layanan-table" class="table-wrap"></div></div>
  `;

  document.getElementById('btn-add-layanan').onclick = () => openLayananForm();

  await loadLayananTable();
}

async function loadLayananTable() {
  const wrap = document.getElementById('layanan-table');
  wrap.innerHTML = `<p class="text-muted">Memuat data...</p>`;
  try {
    _layananCache = await Api.getLayanan();
  } catch (err) {
    wrap.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
    return;
  }

  if (_layananCache.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="display">Belum ada layanan</div><p>Tambahkan layanan pertama Anda.</p></div>`;
    return;
  }

  wrap.innerHTML = `<table>
    <thead><tr><th>Nama Layanan</th><th>Maks/Hari</th><th>Durasi</th><th>Biaya</th><th></th></tr></thead>
    <tbody>
      ${_layananCache.map(l => `
        <tr>
          <td data-label="Nama">${escapeHtml(l.nama_layanan)}</td>
          <td data-label="Maks/Hari" class="mono">${l.maksimal_layanan > 0 ? l.maksimal_layanan + 'x' : 'Tanpa batas'}</td>
          <td data-label="Durasi" class="mono">${l.durasi_menit} menit</td>
          <td data-label="Biaya" class="mono">${formatRupiah(l.biaya)}</td>
          <td data-label="Aksi">
            <button class="btn btn-ghost btn-sm" onclick="openLayananForm(${l.id})">Ubah</button>
            <button class="btn btn-danger btn-sm" onclick="hapusLayanan(${l.id})">Nonaktifkan</button>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
}

function openLayananForm(id) {
  const existing = id ? _layananCache.find(l => l.id === id) : null;

  openModal(existing ? 'Ubah Layanan' : 'Tambah Layanan', `
    <div class="form-group">
      <label>Nama Layanan</label>
      <input type="text" id="f-nama" value="${existing ? escapeHtml(existing.nama_layanan) : ''}" placeholder="mis. Creambath">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Maksimal Booking / Hari</label>
        <input type="number" id="f-maks" min="0" value="${existing ? existing.maksimal_layanan : 5}">
        <p class="form-hint">Isi 0 jika tidak dibatasi</p>
      </div>
      <div class="form-group">
        <label>Durasi (menit)</label>
        <input type="number" id="f-durasi" min="1" value="${existing ? existing.durasi_menit : 30}">
      </div>
    </div>
    <div class="form-group">
      <label>Biaya (Rp)</label>
      <input type="number" id="f-biaya" min="0" value="${existing ? existing.biaya : 0}">
    </div>
    <p id="form-error" class="error-text" hidden></p>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" id="btn-save-layanan">Simpan</button>
    </div>
  `);

  document.getElementById('btn-save-layanan').onclick = async () => {
    const payload = {
      nama_layanan: document.getElementById('f-nama').value.trim(),
      maksimal_layanan: Number(document.getElementById('f-maks').value),
      durasi_menit: Number(document.getElementById('f-durasi').value),
      biaya: Number(document.getElementById('f-biaya').value)
    };
    if (!payload.nama_layanan || !payload.durasi_menit) {
      document.getElementById('form-error').hidden = false;
      document.getElementById('form-error').textContent = 'Nama layanan dan durasi wajib diisi.';
      return;
    }
    try {
      if (existing) {
        await Api.updateLayanan(existing.id, { ...payload, is_active: 1 });
        showToast('Layanan berhasil diperbarui.', 'success');
      } else {
        await Api.createLayanan(payload);
        showToast('Layanan berhasil ditambahkan.', 'success');
      }
      closeModal();
      await loadLayananTable();
    } catch (err) {
      document.getElementById('form-error').hidden = false;
      document.getElementById('form-error').textContent = err.message;
    }
  };
}

async function hapusLayanan(id) {
  if (!confirm('Nonaktifkan layanan ini? Layanan tidak akan muncul lagi saat membuat appointment baru.')) return;
  try {
    await Api.deleteLayanan(id);
    showToast('Layanan berhasil dinonaktifkan.', 'success');
    await loadLayananTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
