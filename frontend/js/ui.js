function showToast(message, type = 'default') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = 'toast' + (type === 'error' ? ' toast-error' : type === 'success' ? ' toast-success' : '');
  el.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => { el.hidden = true; }, 3800);
}

function formatRupiah(angka) {
  const n = Number(angka || 0);
  return 'Rp ' + n.toLocaleString('id-ID');
}

function formatTanggal(tgl) {
  if (!tgl) return '-';
  const d = new Date(tgl + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatJam(jam) {
  if (!jam) return '-';
  return jam.slice(0, 5);
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const STATUS_LABEL = {
  menunggu: 'Menunggu',
  proses: 'Proses',
  selesai: 'Selesai',
  dibayar: 'Dibayar',
  batal: 'Batal'
};

function statusBadge(status) {
  return `<span class="badge badge-${status}">${STATUS_LABEL[status] || status}</span>`;
}

function openModal(titleHtml, bodyHtml, { onMount } = {}) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box">
        <div class="modal-header">
          <h3>${titleHtml}</h3>
          <button class="modal-close" id="modal-close-btn" aria-label="Tutup">&times;</button>
        </div>
        <div id="modal-body">${bodyHtml}</div>
      </div>
    </div>
  `;
  document.getElementById('modal-close-btn').onclick = closeModal;
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  if (onMount) onMount(document.getElementById('modal-body'));
}

function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
