const API_BASE = '/api';

const Auth = {
  getToken() { return localStorage.getItem('salon_token'); },
  getUser() {
    const raw = localStorage.getItem('salon_user');
    return raw ? JSON.parse(raw) : null;
  },
  setSession(token, user) {
    localStorage.setItem('salon_token', token);
    localStorage.setItem('salon_user', JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem('salon_token');
    localStorage.removeItem('salon_user');
  }
};

async function apiRequest(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  let data = null;
  try { data = await res.json(); } catch (e) { /* respons kosong */ }

  if (res.status === 401 || res.status === 403) {
    if (res.status === 401) {
      Auth.clearSession();
      showLoginScreen();
    }
    const err = new Error((data && data.message) || 'Akses ditolak.');
    err.status = res.status;
    throw err;
  }

  if (!res.ok) {
    const err = new Error((data && data.message) || `Terjadi kesalahan (${res.status}).`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

const Api = {
  login: (username, password) => apiRequest('POST', '/auth/login', { username, password }),
  me: () => apiRequest('GET', '/auth/me'),

  getLayanan: () => apiRequest('GET', '/layanan'),
  createLayanan: (data) => apiRequest('POST', '/layanan', data),
  updateLayanan: (id, data) => apiRequest('PUT', `/layanan/${id}`, data),
  deleteLayanan: (id) => apiRequest('DELETE', `/layanan/${id}`),

  getPelanggan: (search) => apiRequest('GET', `/pelanggan${search ? '?search=' + encodeURIComponent(search) : ''}`),
  createPelanggan: (data) => apiRequest('POST', '/pelanggan', data),
  updatePelanggan: (id, data) => apiRequest('PUT', `/pelanggan/${id}`, data),

  getBeautician: () => apiRequest('GET', '/beautician'),
  createBeautician: (data) => apiRequest('POST', '/beautician', data),
  updateBeautician: (id, data) => apiRequest('PUT', `/beautician/${id}`, data),
  getJadwalBeautician: (id, tanggal) => apiRequest('GET', `/beautician/${id}/jadwal${tanggal ? '?tanggal=' + tanggal : ''}`),

  getAppointments: (query) => {
    const qs = new URLSearchParams(query || {}).toString();
    return apiRequest('GET', `/appointment${qs ? '?' + qs : ''}`);
  },
  getAppointment: (id) => apiRequest('GET', `/appointment/${id}`),
  createAppointment: (data) => apiRequest('POST', '/appointment', data),
  updateAppointmentStatus: (id, status) => apiRequest('PUT', `/appointment/${id}/status`, { status }),
  cancelAppointment: (id) => apiRequest('DELETE', `/appointment/${id}`),

  getSiapBayar: () => apiRequest('GET', '/transaksi/siap-bayar'),
  getTransaksi: (query) => {
    const qs = new URLSearchParams(query || {}).toString();
    return apiRequest('GET', `/transaksi${qs ? '?' + qs : ''}`);
  },
  getTransaksiDetail: (id) => apiRequest('GET', `/transaksi/${id}`),
  bayarTransaksi: (data) => apiRequest('POST', '/transaksi', data),

  getUsers: () => apiRequest('GET', '/users'),
  createUser: (data) => apiRequest('POST', '/users', data),
  updateUser: (id, data) => apiRequest('PUT', `/users/${id}`, data),
  resetPassword: (id, password) => apiRequest('PUT', `/users/${id}/password`, { password })
};
