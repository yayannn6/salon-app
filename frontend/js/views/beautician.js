let _beauticianCache = [];

async function renderBeautician(container) {
  container.innerHTML = `
    <div class="page-header">
      <div><h2>Beautician</h2><p>Kelola data terapis / beautician</p></div>
      <button class="btn btn-primary" id="btn-add-beautician">+ Tambah Beautician</button>
    </div>
    <div class="card"><div id="beautician-table" class="table-wrap"></div></div>
  `;
  document.getElementById('btn-add-beautician').onclick = () => openBeauticianForm();
  await loadBeauticianTable();
}

async function loadBeauticianTable() {
  const wrap = document.getElementById('beautician-table');
  wrap.innerHTML = `<p class="text-muted">Memuat data...</p>`;
  try {
    _beauticianCache = await Api.getBeautician();
  } catch (err) {
    wrap.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
    return;
  }

  if (_beauticianCache.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="display">Belum ada beautician</div></div>`;
    return;
  }

  wrap.innerHTML = `<table>
    <thead><tr><th>Nama</th><th>Telepon</th><th>Spesialisasi</th><th></th></tr></thead>
    <tbody>
      ${_beauticianCache.map(b => `
        <tr>
          <td data-label="Nama">${escapeHtml(b.nama)}</td>
          <td data-label="Telepon" class="mono">${escapeHtml(b.telepon || '-')}</td>
          <td data-label="Spesialisasi">${escapeHtml(b.spesialisasi || '-')}</td>
          <td data-label="Aksi"><button class="btn btn-ghost btn-sm" onclick="openBeauticianForm(${b.id})">Ubah</button></td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
}

function openBeauticianForm(id) {
  const existing = id ? _beauticianCache.find(b => b.id === id) : null;
  openModal(existing ? 'Ubah Beautician' : 'Tambah Beautician', `
    <div class="form-group"><label>Nama</label><input type="text" id="f-nama" value="${existing ? escapeHtml(existing.nama) : ''}"></div>
    <div class="form-group"><label>Telepon</label><input type="text" id="f-telepon" value="${existing ? escapeHtml(existing.telepon || '') : ''}"></div>
    <div class="form-group"><label>Spesialisasi</label><input type="text" id="f-spesialisasi" value="${existing ? escapeHtml(existing.spesialisasi || '') : ''}" placeholder="mis. Hair & Makeup"></div>
    <p id="form-error" class="error-text" hidden></p>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" id="btn-save-beautician">Simpan</button>
    </div>
  `);

  document.getElementById('btn-save-beautician').onclick = async () => {
    const payload = {
      nama: document.getElementById('f-nama').value.trim(),
      telepon: document.getElementById('f-telepon').value.trim(),
      spesialisasi: document.getElementById('f-spesialisasi').value.trim()
    };
    if (!payload.nama) {
      document.getElementById('form-error').hidden = false;
      document.getElementById('form-error').textContent = 'Nama wajib diisi.';
      return;
    }
    try {
      if (existing) {
        await Api.updateBeautician(existing.id, { ...payload, is_active: 1 });
      } else {
        await Api.createBeautician(payload);
      }
      showToast('Data beautician berhasil disimpan.', 'success');
      closeModal();
      await loadBeauticianTable();
    } catch (err) {
      document.getElementById('form-error').hidden = false;
      document.getElementById('form-error').textContent = err.message;
    }
  };
}
