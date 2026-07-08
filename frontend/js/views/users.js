let _usersCache = [];
let _usersBeauticianCache = [];

async function renderUsers(container) {
  container.innerHTML = `
    <div class="page-header">
      <div><h2>Akun Pengguna</h2><p>Kelola akun admin, beautician, dan kasir</p></div>
      <button class="btn btn-primary" id="btn-add-user">+ Tambah Akun</button>
    </div>
    <div class="card"><div id="users-table" class="table-wrap"></div></div>
  `;
  document.getElementById('btn-add-user').onclick = () => openUserForm();
  await loadUsersTable();
}

async function loadUsersTable() {
  const wrap = document.getElementById('users-table');
  wrap.innerHTML = `<p class="text-muted">Memuat data...</p>`;
  try {
    [_usersCache, _usersBeauticianCache] = await Promise.all([Api.getUsers(), Api.getBeautician()]);
  } catch (err) {
    wrap.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
    return;
  }

  const roleLabel = { admin: 'Admin', beautician: 'Beautician', kasir: 'Kasir' };

  wrap.innerHTML = `<table>
    <thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Status</th><th></th></tr></thead>
    <tbody>
      ${_usersCache.map(u => `
        <tr>
          <td data-label="Nama">${escapeHtml(u.nama)}</td>
          <td data-label="Username" class="mono">${escapeHtml(u.username)}</td>
          <td data-label="Role"><span class="badge badge-menunggu">${roleLabel[u.role]}</span></td>
          <td data-label="Status">${u.is_active ? '<span class="badge badge-selesai">Aktif</span>' : '<span class="badge badge-batal">Nonaktif</span>'}</td>
          <td data-label="Aksi">
            <button class="btn btn-ghost btn-sm" onclick="openUserForm(${u.id})">Ubah</button>
            <button class="btn btn-ghost btn-sm" onclick="openResetPasswordForm(${u.id})">Reset Password</button>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
}

function openUserForm(id) {
  const existing = id ? _usersCache.find(u => u.id === id) : null;

  openModal(existing ? 'Ubah Akun' : 'Tambah Akun Baru', `
    <div class="form-group"><label>Nama</label><input type="text" id="f-nama" value="${existing ? escapeHtml(existing.nama) : ''}"></div>
    ${!existing ? `
      <div class="form-group"><label>Username</label><input type="text" id="f-username"></div>
      <div class="form-group"><label>Password</label><input type="password" id="f-password"></div>
      <div class="form-group">
        <label>Role</label>
        <select id="f-role" onchange="toggleBeauticianSelect()">
          <option value="kasir">Kasir</option>
          <option value="beautician">Beautician</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div class="form-group" id="beautician-select-wrap">
        <label>Data Beautician Terkait</label>
        <select id="f-beautician-id">
          <option value="">-- Pilih --</option>
          ${_usersBeauticianCache.map(b => `<option value="${b.id}">${escapeHtml(b.nama)}</option>`).join('')}
        </select>
      </div>
    ` : `
      <div class="form-group">
        <label>Status Akun</label>
        <select id="f-active">
          <option value="1" ${existing.is_active ? 'selected' : ''}>Aktif</option>
          <option value="0" ${!existing.is_active ? 'selected' : ''}>Nonaktif</option>
        </select>
      </div>
    `}
    <p id="form-error" class="error-text" hidden></p>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" id="btn-save-user">Simpan</button>
    </div>
  `, {
    onMount: () => { if (!existing) toggleBeauticianSelect(); }
  });

  document.getElementById('btn-save-user').onclick = async () => {
    const errorEl = document.getElementById('form-error');
    try {
      if (existing) {
        await Api.updateUser(existing.id, {
          nama: document.getElementById('f-nama').value.trim(),
          is_active: Number(document.getElementById('f-active').value),
          beautician_id: existing.beautician_id
        });
      } else {
        const role = document.getElementById('f-role').value;
        const payload = {
          nama: document.getElementById('f-nama').value.trim(),
          username: document.getElementById('f-username').value.trim(),
          password: document.getElementById('f-password').value,
          role,
          beautician_id: role === 'beautician' ? Number(document.getElementById('f-beautician-id').value) : null
        };
        if (!payload.nama || !payload.username || !payload.password) {
          errorEl.hidden = false;
          errorEl.textContent = 'Nama, username, dan password wajib diisi.';
          return;
        }
        await Api.createUser(payload);
      }
      showToast('Akun berhasil disimpan.', 'success');
      closeModal();
      await loadUsersTable();
    } catch (err) {
      errorEl.hidden = false;
      errorEl.textContent = err.message;
    }
  };
}

function toggleBeauticianSelect() {
  const role = document.getElementById('f-role').value;
  const wrap = document.getElementById('beautician-select-wrap');
  wrap.style.display = role === 'beautician' ? 'block' : 'none';
}

function openResetPasswordForm(id) {
  openModal('Reset Password', `
    <div class="form-group"><label>Password Baru</label><input type="password" id="f-new-password"></div>
    <p id="form-error" class="error-text" hidden></p>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" id="btn-reset-password">Reset</button>
    </div>
  `);
  document.getElementById('btn-reset-password').onclick = async () => {
    const password = document.getElementById('f-new-password').value;
    try {
      await Api.resetPassword(id, password);
      showToast('Password berhasil direset.', 'success');
      closeModal();
    } catch (err) {
      document.getElementById('form-error').hidden = false;
      document.getElementById('form-error').textContent = err.message;
    }
  };
}
