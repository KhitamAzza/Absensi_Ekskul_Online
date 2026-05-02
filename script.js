const GAS_URL = 'https://script.google.com/macros/s/AKfycbzowRyPgNxxjbf9nIJlwLrbtWJTc6NO4aucfWZuZSq6MX96hD4Q20wcYuVbRU7rNACe/exec';
const PASSWORDS = { 
  'eksbanjari': 'Al-Banjari', 'futsal123': 'Futsal', 'eksesport': 'E-Sport',
  'eksfutsal': 'Futsal', 'ekspakbola': 'Sepakbola', 'eksperdiri': 'Perisai diri',
  'eksmusik': 'Musik', 'eksminton': 'Badminton', 'eksbasket': 'Basket',
  'eksbvoli': 'Bola Voli', 'ekstari': 'Seni tari', 'ekstabog': 'Tata Boga',
  'eksarias': 'Tata Rias', 'ekstapmr': 'PMR', 'ekswondo': 'Taekwondo',
  'eksdance': 'Dance', 'ekscinalam': 'Pecinta Alam', 'adminis':'Zero', 'ekscatur':'Catur'
};

let currentEkstra = '', todayDate = '', students = [], sheetAttendance = {}, localChanges = {};

document.addEventListener('DOMContentLoaded', () => {
  todayDate = new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
  document.getElementById('currentDate').textContent = todayDate;
  
  document.getElementById('passwordInput').addEventListener('input', function() {
    const pass = this.value.trim();
    const ekstra = PASSWORDS[pass];
    if (ekstra) {
      showLoading(); 
      checkGateAndLogin(ekstra);
    }
  });
});

function showLoading() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('loadingScreen').classList.remove('hidden');
  document.getElementById('blockedScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.add('hidden');
}

function hideLoading() {
  document.getElementById('loadingScreen').classList.add('hidden');
}

async function checkGateAndLogin(ekstra) {
  try {
    const r = await api('getAttendanceData', { ekstra: ekstra, date: todayDate });
    
    if (r.blocked) {
      showBlocked(r.message);
      return;
    }
    
    currentEkstra = ekstra;
    document.getElementById('ekstraTag').textContent = ekstra;
    hideLoading();
    document.getElementById('appScreen').classList.remove('hidden');

    students = r.students || [];
    sheetAttendance = r.attendance || {};
    localChanges = {};
    renderList();
    updateFab();
    
  } catch (e) {
    hideLoading();
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('passwordInput').value = '';
    toast('❌ Error: ' + e.message, 'error');
  }
}

function showBlocked(reason) {
  hideLoading();
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('blockedScreen').classList.remove('hidden');
  document.getElementById('blockedReason').textContent = reason || 'Aplikasi sedang ditutup sementara.';
  document.getElementById('blockedTime').textContent = 'Diblokir pada: ' + new Date().toLocaleString('id-ID');
}

async function api(action, payload = {}) {
  const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action, ...payload }) });
  return res.json();
}

function renderList() {
  const box = document.getElementById('studentList');
  if (!students.length) {
    box.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div>Tidak ada siswa di ekstra ini</div></div>';
    return;
  }
  
  box.innerHTML = students.map(s => {
    const nama = s.nama;
    let status = 'ALPHA';
    if (localChanges.hasOwnProperty(nama)) status = localChanges[nama];
    else if (sheetAttendance[nama] === 'HADIR') status = 'HADIR';
    
    const isAlpha = status === 'ALPHA';
    const hasChanged = localChanges.hasOwnProperty(nama);
    
    return `
      <div class="student-card ${isAlpha ? 'alpha' : 'hadir'} ${hasChanged ? 'pending' : ''}">
        <div class="student-info">
          <h3>${escapeHtml(nama)}</h3>
          <div class="kelas">👤 ${escapeHtml(s.kelas)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          ${hasChanged ? '<div class="pending-pulse"></div>' : ''}
          <button class="status-btn ${isAlpha ? 'alpha' : 'hadir'}" data-nama="${encodeURIComponent(nama)}">
            ${isAlpha ? '● ALPHA' : '✓ HADIR'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

document.getElementById('studentList').addEventListener('click', function(e) {
  const btn = e.target.closest('.status-btn');
  if (!btn) return;
  const nama = decodeURIComponent(btn.dataset.nama);
  if (nama) toggleStatus(nama);
});

function toggleStatus(nama) {
  let current = 'ALPHA';
  if (localChanges.hasOwnProperty(nama)) current = localChanges[nama];
  else if (sheetAttendance[nama] === 'HADIR') current = 'HADIR';
  localChanges[nama] = (current === 'ALPHA') ? 'HADIR' : 'ALPHA';
  renderList();
  updateFab();
}

function updateFab() {
  const count = Object.keys(localChanges).length;
  document.getElementById('fabCount').textContent = count;
  const fab = document.getElementById('fabUpdate');
  fab.disabled = count === 0;
  fab.classList.toggle('hidden', count === 0);
}

async function sendUpdate() {
  const fab = document.getElementById('fabUpdate');
  const originalHTML = fab.innerHTML;
  fab.innerHTML = '<span>⏳</span><span>UPDATING</span>';
  fab.disabled = true;
  
  try {
    const r = await api('updateAttendance', { ekstra: currentEkstra, date: todayDate, attendance: localChanges });
    
    if (r.blocked) {
      showBlocked(r.message);
      return;
    }
    
    if (r.success) {
      toast(`✅ ${r.updated} data berhasil diupdate`, 'success');
      await loadData();
    } else {
      toast('❌ Gagal: ' + (r.error || 'unknown'), 'error');
      fab.disabled = false;
    }
  } catch (e) {
    toast('❌ Error: ' + e.message, 'error');
    fab.disabled = false;
  }
  
  fab.innerHTML = originalHTML;
}

async function loadData() {
  try {
    const r = await api('getAttendanceData', { ekstra: currentEkstra, date: todayDate });
    
    if (r.blocked) {
      showBlocked(r.message);
      return;
    }
    
    students = r.students || [];
    sheetAttendance = r.attendance || {};
    localChanges = {};
    renderList();
    updateFab();
  } catch (e) {
    toast('❌ Error load data: ' + e.message, 'error');
  }
}

function toast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + (type || '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
