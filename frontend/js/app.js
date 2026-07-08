const NAV_CONFIG = [
  { id: 'dashboard', label: 'Dashboard', roles: ['admin'], render: renderDashboard },
  { id: 'jadwal', label: 'Jadwal Saya', roles: ['beautician'], render: renderJadwal },
  { id: 'appointment', label: 'Appointment', roles: ['admin', 'beautician'], render: renderAppointment },
  { id: 'kasir', label: 'Kasir', roles: ['admin', 'kasir'], render: renderKasir },
  { id: 'pelanggan', label: 'Pelanggan', roles: ['admin', 'kasir'], render: renderPelanggan },
  { id: 'layanan', label: 'Layanan', roles: ['admin'], render: renderLayanan },
  { id: 'beautician', label: 'Beautician', roles: ['admin'], render: renderBeautician },
  { id: 'users', label: 'Akun', roles: ['admin'], render: renderUsers }
];

let _currentView = null;

function showLoginScreen() {
  document.getElementById('login-screen').hidden = false;
  document.getElementById('app-shell').hidden = true;
}

function showAppShell() {
  document.getElementById('login-screen').hidden = true;
  document.getElementById('app-shell').hidden = false;

  const user = Auth.getUser();
  document.getElementById('user-nama').textContent = user.nama;
  document.getElementById('user-role').textContent = ({
    admin: 'Admin', beautician: 'Beautician', kasir: 'Kasir'
  })[user.role];

  const nav = document.getElementById('main-nav');
  const items = NAV_CONFIG.filter(item => item.roles.includes(user.role));
  nav.innerHTML = items.map(item => `<button data-view="${item.id}">${item.label}</button>`).join('');
  nav.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.view));
  });

  navigateTo(items[0] ? items[0].id : null);
}

async function navigateTo(viewId) {
  if (!viewId) return;
  _currentView = viewId;
  document.querySelectorAll('#main-nav button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewId);
  });
  const config = NAV_CONFIG.find(v => v.id === viewId);
  const container = document.getElementById('view-container');
  if (!config) {
    container.innerHTML = `<div class="empty-state"><div class="display">Halaman tidak ditemukan</div></div>`;
    return;
  }
  container.innerHTML = `<p class="text-muted">Memuat...</p>`;
  try {
    await config.render(container);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="display">Terjadi kesalahan</div><p>${escapeHtml(err.message)}</p></div>`;
  }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.hidden = true;

  try {
    const { token, user } = await Api.login(username, password);
    Auth.setSession(token, user);
    showAppShell();
  } catch (err) {
    errorEl.hidden = false;
    errorEl.textContent = err.message;
  }
});

document.getElementById('btn-logout').addEventListener('click', () => {
  Auth.clearSession();
  showLoginScreen();
});

// ---------------------------------------------------------
// INISIALISASI
// ---------------------------------------------------------
(function init() {
  const token = Auth.getToken();
  const user = Auth.getUser();
  if (token && user) {
    showAppShell();
  } else {
    showLoginScreen();
  }
})();
