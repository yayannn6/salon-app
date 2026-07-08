let _pelangganCache = [];

async function renderPelanggan(container) {
  container.innerHTML = `
    <div class="page-header">
      <div><h2>Pelanggan</h2><p>Data pelanggan salon</p></div>
      <button class="btn btn-primary" id="btn-add-pelanggan">+ Tambah Pelanggan</button>
    </div>
    <div class="card">
      <input type="text" id="search-pelanggan" placeholder="Cari nama atau telepon..." style="width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border);margin-bottom:14px;background:var(--bg)">
      <div id="pelanggan-table" class="table-wrap"></div>
    </div>
  `;

  document.getElementById('btn-add-pelanggan').onclick = () => openPelangganForm();
  document.getElementById('search-pelanggan').addEventListener('input', debounceSearchPelanggan);

  await loadPelangganTable();
}

let _searchTimer;
function debounceSearchPelanggan(e) {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => loadPelangganTable(e.target.value), 300);
}

async function loadPelangganTable(search) {
  const wrap = document.getElementById('pelanggan-table');
  wrap.innerHTML = `<p class="text-muted">Memuat data...</p>`;
  try {
    _pelangganCache = await Api.getPelanggan(search);
  } catch (err) {
    wrap.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
    return;
  }

  if (_pelangganCache.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="display">Tidak ada pelanggan</div><p>Coba kata kunci lain atau tambah pelanggan baru.</p></div>`;
    return;
  }

  wrap.innerHTML = `<table>
    <thead><tr><th>Nama</th><th>Telepon</th><th>Email</th><th>Alamat</th><th></th></tr></thead>
    <tbody>
      ${_pelangganCache.map(p => `
        <tr>
          <td data-label="Nama">${escapeHtml(p.nama)}</td>
          <td data-label="Telepon" class="mono">${escapeHtml(p.telepon)}</td>
          <td data-label="Email">${escapeHtml(p.email || '-')}</td>
          <td data-label="Alamat">${escapeHtml(p.alamat || '-')}</td>
          <td data-label="Aksi"><button class="btn btn-ghost btn-sm" onclick="openPelangganForm(${p.id})">Ubah</button></td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
}

function openPelangganForm(id) {
  const existing = id ? _pelangganCache.find(p => p.id === id) : null;
  openModal(existing ? 'Ubah Pelanggan' : 'Tambah Pelanggan', `
    <div class="form-group"><label>Nama</label><input type="text" id="f-nama" value="${existing ? escapeHtml(existing.nama) : ''}"></div>
    <div class="form-group"><label>Telepon</label><input type="text" id="f-telepon" value="${existing ? escapeHtml(existing.telepon) : ''}"></div>
    <div class="form-group"><label>Email (opsional)</label><input type="email" id="f-email" value="${existing ? escapeHtml(existing.email || '') : ''}"></div>
    <div class="form-group"><label>Alamat (opsional)</label><textarea id="f-alamat" rows="2">${existing ? escapeHtml(existing.alamat || '') : ''}</textarea></div>
    <p id="form-error" class="error-text" hidden></p>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" id="btn-save-pelanggan">Simpan</button>
    </div>
  `);

  document.getElementById('btn-save-pelanggan').onclick = async () => {
    const payload = {
      nama: document.getElementById('f-nama').value.trim(),
      telepon: document.getElementById('f-telepon').value.trim(),
      email: document.getElementById('f-email').value.trim(),
      alamat: document.getElementById('f-alamat').value.trim()
    };
    if (!payload.nama || !payload.telepon) {
      document.getElementById('form-error').hidden = false;
      document.getElementById('form-error').textContent = 'Nama dan telepon wajib diisi.';
      return;
    }
    try {
      if (existing) {
        await Api.updatePelanggan(existing.id, payload);
      } else {
        await Api.createPelanggan(payload);
      }
      showToast('Data pelanggan berhasil disimpan.', 'success');
      closeModal();
      await loadPelangganTable();
    } catch (err) {
      document.getElementById('form-error').hidden = false;
      document.getElementById('form-error').textContent = err.message;
    }
  };
}
