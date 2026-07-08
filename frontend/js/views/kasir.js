let _kasirTab = 'bayar';

async function renderKasir(container) {
  container.innerHTML = `
    <div class="page-header">
      <div><h2>Kasir</h2><p>Proses pembayaran appointment yang telah selesai dikerjakan</p></div>
    </div>
    <div class="main-nav" style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:6px;margin-bottom:16px;display:inline-flex">
      <button id="tab-bayar" class="btn btn-sm">Siap Dibayar</button>
      <button id="tab-riwayat" class="btn btn-sm">Riwayat Transaksi</button>
    </div>
    <div class="card"><div id="kasir-content"></div></div>
  `;

  document.getElementById('tab-bayar').onclick = () => { _kasirTab = 'bayar'; renderKasirTabs(); loadKasirContent(); };
  document.getElementById('tab-riwayat').onclick = () => { _kasirTab = 'riwayat'; renderKasirTabs(); loadKasirContent(); };

  renderKasirTabs();
  await loadKasirContent();
}

function renderKasirTabs() {
  document.getElementById('tab-bayar').className = 'btn btn-sm' + (_kasirTab === 'bayar' ? ' btn-primary' : ' btn-ghost');
  document.getElementById('tab-riwayat').className = 'btn btn-sm' + (_kasirTab === 'riwayat' ? ' btn-primary' : ' btn-ghost');
}

async function loadKasirContent() {
  if (_kasirTab === 'bayar') return loadSiapBayar();
  return loadRiwayatTransaksi();
}

async function loadSiapBayar() {
  const wrap = document.getElementById('kasir-content');
  wrap.innerHTML = `<p class="text-muted">Memuat data...</p>`;
  let rows = [];
  try {
    rows = await Api.getSiapBayar();
  } catch (err) {
    wrap.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
    return;
  }

  if (rows.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="display">Tidak ada tagihan</div><p>Belum ada appointment berstatus "selesai" yang siap dibayar.</p></div>`;
    return;
  }

  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Tanggal</th><th>Pelanggan</th><th>Beautician</th><th>Layanan</th><th>Total</th><th></th></tr></thead>
    <tbody>
      ${rows.map(a => `
        <tr>
          <td data-label="Tanggal">${formatTanggal(a.tanggal)}<div class="text-muted mono" style="font-size:12px">${formatJam(a.jam_mulai)}-${formatJam(a.jam_selesai_estimasi)}</div></td>
          <td data-label="Pelanggan">${escapeHtml(a.nama_pelanggan)}<div class="text-muted" style="font-size:12px">${escapeHtml(a.telepon_pelanggan)}</div></td>
          <td data-label="Beautician">${escapeHtml(a.nama_beautician)}</td>
          <td data-label="Layanan">${a.layanan.map(l => `<span class="svc-tag">${escapeHtml(l.nama_layanan)}</span>`).join(' ')}</td>
          <td data-label="Total" class="mono">${formatRupiah(a.total_biaya)}</td>
          <td data-label="Aksi"><button class="btn btn-primary btn-sm" onclick="openBayarForm(${a.id})">Bayar</button></td>
        </tr>
      `).join('')}
    </tbody>
  </table></div>`;
}

function openBayarForm(appointmentId) {
  Api.getAppointment(appointmentId).then(appt => {
    const subtotal = Number(appt.total_biaya);
    openModal('Proses Pembayaran', `
      <div class="card" style="background:var(--surface-alt);border:none;padding:14px;margin-bottom:16px">
        <div><strong>${escapeHtml(appt.nama_pelanggan)}</strong> &middot; ${escapeHtml(appt.nama_beautician)}</div>
        <div class="svc-tags" style="margin-top:8px">${appt.layanan.map(l => `<span class="svc-tag">${escapeHtml(l.nama_layanan)}</span>`).join('')}</div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Subtotal</label><input type="text" value="${formatRupiah(subtotal)}" disabled class="mono"></div>
        <div class="form-group"><label>Diskon (Rp)</label><input type="number" id="f-diskon" min="0" value="0" oninput="updateBayarPreview(${subtotal})"></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Metode Pembayaran</label>
          <select id="f-metode">
            <option value="tunai">Tunai</option>
            <option value="debit">Kartu Debit</option>
            <option value="kredit">Kartu Kredit</option>
            <option value="qris">QRIS</option>
            <option value="transfer">Transfer Bank</option>
          </select>
        </div>
        <div class="form-group"><label>Jumlah Dibayar (Rp)</label><input type="number" id="f-jumlah" min="0" value="${subtotal}" oninput="updateBayarPreview(${subtotal})"></div>
      </div>
      <div class="card" style="background:var(--bg);border:1px dashed var(--border);padding:14px">
        <div class="flex-between"><span>Total Tagihan</span><strong id="preview-total" class="mono">${formatRupiah(subtotal)}</strong></div>
        <div class="flex-between" style="margin-top:6px"><span>Kembalian</span><strong id="preview-kembalian" class="mono">Rp 0</strong></div>
      </div>
      <p id="form-error" class="error-text" hidden></p>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" id="btn-proses-bayar">Proses Pembayaran</button>
      </div>
    `);

    document.getElementById('btn-proses-bayar').onclick = async () => {
      const diskon = Number(document.getElementById('f-diskon').value) || 0;
      const metode_bayar = document.getElementById('f-metode').value;
      const jumlah_dibayar = Number(document.getElementById('f-jumlah').value);
      const errorEl = document.getElementById('form-error');
      try {
        const result = await Api.bayarTransaksi({ appointment_id: appointmentId, diskon, metode_bayar, jumlah_dibayar });
        showToast('Pembayaran berhasil diproses.', 'success');
        tampilkanStruk(result, appt);
        await loadSiapBayar();
      } catch (err) {
        errorEl.hidden = false;
        errorEl.textContent = err.message;
      }
    };
  }).catch(err => showToast(err.message, 'error'));
}

function updateBayarPreview(subtotal) {
  const diskon = Number(document.getElementById('f-diskon').value) || 0;
  const jumlah = Number(document.getElementById('f-jumlah').value) || 0;
  const total = Math.max(subtotal - diskon, 0);
  const kembalian = Math.max(jumlah - total, 0);
  document.getElementById('preview-total').textContent = formatRupiah(total);
  document.getElementById('preview-kembalian').textContent = formatRupiah(kembalian);
}

function tampilkanStruk(result, appt) {
  openModal('Pembayaran Berhasil', `
    <div class="receipt">
      <div style="text-align:center;margin-bottom:10px">
        <strong>KIRANA SALON</strong><br>
        <span class="text-muted">No. Invoice: ${result.no_invoice}</span>
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-row"><span>Pelanggan</span><span>${escapeHtml(appt.nama_pelanggan)}</span></div>
      <div class="receipt-row"><span>Beautician</span><span>${escapeHtml(appt.nama_beautician)}</span></div>
      <div class="receipt-divider"></div>
      ${appt.layanan.map(l => `<div class="receipt-row"><span>${escapeHtml(l.nama_layanan)}</span><span>${formatRupiah(l.harga_saat_itu)}</span></div>`).join('')}
      <div class="receipt-divider"></div>
      <div class="receipt-row"><span>Subtotal</span><span>${formatRupiah(result.subtotal)}</span></div>
      <div class="receipt-row"><span>Diskon</span><span>-${formatRupiah(result.diskon)}</span></div>
      <div class="receipt-row receipt-total"><span>Total Bayar</span><span>${formatRupiah(result.total_bayar)}</span></div>
      <div class="receipt-row"><span>Kembalian</span><span>${formatRupiah(result.kembalian)}</span></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="closeModal()">Selesai</button>
    </div>
  `);
}

async function loadRiwayatTransaksi() {
  const wrap = document.getElementById('kasir-content');
  wrap.innerHTML = `<p class="text-muted">Memuat data...</p>`;
  let rows = [];
  try {
    rows = await Api.getTransaksi();
  } catch (err) {
    wrap.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
    return;
  }

  if (rows.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="display">Belum ada transaksi</div></div>`;
    return;
  }

  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Invoice</th><th>Tanggal</th><th>Pelanggan</th><th>Kasir</th><th>Metode</th><th>Total</th></tr></thead>
    <tbody>
      ${rows.map(t => `
        <tr>
          <td data-label="Invoice" class="mono">${t.no_invoice}</td>
          <td data-label="Tanggal">${formatTanggal(t.tanggal_appointment)}</td>
          <td data-label="Pelanggan">${escapeHtml(t.nama_pelanggan)}</td>
          <td data-label="Kasir">${escapeHtml(t.nama_kasir)}</td>
          <td data-label="Metode">${t.metode_bayar.toUpperCase()}</td>
          <td data-label="Total" class="mono">${formatRupiah(t.total_bayar)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table></div>`;
}
