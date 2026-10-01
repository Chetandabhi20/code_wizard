// ================= API URLS =================
const API_BASE = window.location.port === '5000'
  ? '/api'
  : 'http://localhost:5000/api';

// ================= DOM ELEMENTS =================
const citizenPortal = document.getElementById('citizenPortal');
const adminPortal = document.getElementById('adminPortal');

const promptInput = document.getElementById('promptInput');
const submitBtn = document.getElementById('submitBtn');

// Auth DOM
const openAuthBtn = document.getElementById('openAuthBtn');
const closeAuthBtn = document.getElementById('closeAuthBtn');
const authModal = document.getElementById('authModal');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authStatus = document.getElementById('authStatus');
const userInfo = document.getElementById('userInfo');
const userNameDisplay = document.getElementById('userNameDisplay');
const logoutBtn = document.getElementById('logoutBtn');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const adminUserName = document.getElementById('adminUserName');
const adminUserRole = document.getElementById('adminUserRole');

const latitudeInput = document.getElementById('latitude');
const longitudeInput = document.getElementById('longitude');
const locationInput = document.getElementById('location');
const imageInput = document.getElementById('image');

// ================= HELPERS =================
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function readApiResponse(response) {
  const body = await response.text();
  let data;
  try {
    data = body ? JSON.parse(body) : {};
  } catch (error) {
    if (!response.ok) {
      throw new Error(body || `Request failed with status ${response.status}.`);
    }
    throw new Error('The server returned an invalid response.');
  }
  if (!response.ok || !data.success) {
    throw new Error(data.error || `Request failed with status ${response.status}.`);
  }
  return data;
}

function getAuthToken() { return localStorage.getItem('civicflow_token'); }
function getUser() {
  const user = localStorage.getItem('civicflow_user');
  return user ? JSON.parse(user) : null;
}

function setAuth(token, user) {
  localStorage.setItem('civicflow_token', token);
  localStorage.setItem('civicflow_user', JSON.stringify(user));
  syncViewWithRole();
}

function clearAuth() {
  localStorage.removeItem('civicflow_token');
  localStorage.removeItem('civicflow_user');
  syncViewWithRole();
}

function syncViewWithRole() {
  const user = getUser();
  
  if (user && (user.role === 'ADMIN' || user.role === 'DEPARTMENT')) {
    if (citizenPortal) citizenPortal.style.display = 'none';
    if (adminPortal) adminPortal.style.display = 'block';
    if (openAuthBtn) openAuthBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';
    if (userNameDisplay) userNameDisplay.textContent = user.name;
    if (adminUserName) adminUserName.textContent = user.name;
    if (adminUserRole) adminUserRole.textContent = user.role;
    // Load admin data
    loadAdminDashboard();
  } else {
    if (adminPortal) adminPortal.style.display = 'none';
    if (citizenPortal) citizenPortal.style.display = 'block';
    
    if (user) {
      if (openAuthBtn) openAuthBtn.style.display = 'none';
      if (userInfo) userInfo.style.display = 'flex';
      if (userNameDisplay) userNameDisplay.textContent = user.name;
    } else {
      if (openAuthBtn) openAuthBtn.style.display = 'block';
      if (userInfo) userInfo.style.display = 'none';
    }
    loadMyReports();
  }
}

// ================= AUTH MODAL =================
function openModal() { if (authModal) authModal.style.display = 'flex'; showLoginTab(); }
function closeModal() {
  if (authModal) authModal.style.display = 'none';
  if (loginForm) loginForm.reset();
  if (registerForm) registerForm.reset();
  if (authStatus) { authStatus.style.display = 'none'; authStatus.textContent = ''; }
}

function showLoginTab() {
  if (tabLogin) { tabLogin.classList.add('bg-surface-container-lowest', 'text-primary', 'shadow-sm'); tabLogin.classList.remove('text-on-surface-variant'); }
  if (tabRegister) { tabRegister.classList.remove('bg-surface-container-lowest', 'text-primary', 'shadow-sm'); tabRegister.classList.add('text-on-surface-variant'); }
  if (loginForm) loginForm.style.display = 'block';
  if (registerForm) registerForm.style.display = 'none';
  if (authStatus) authStatus.style.display = 'none';
}

function showRegisterTab() {
  if (tabRegister) { tabRegister.classList.add('bg-surface-container-lowest', 'text-primary', 'shadow-sm'); tabRegister.classList.remove('text-on-surface-variant'); }
  if (tabLogin) { tabLogin.classList.remove('bg-surface-container-lowest', 'text-primary', 'shadow-sm'); tabLogin.classList.add('text-on-surface-variant'); }
  if (registerForm) registerForm.style.display = 'block';
  if (loginForm) loginForm.style.display = 'none';
  if (authStatus) authStatus.style.display = 'none';
}

if (openAuthBtn) openAuthBtn.addEventListener('click', openModal);
if (closeAuthBtn) closeAuthBtn.addEventListener('click', closeModal);
if (authModal) authModal.addEventListener('click', (e) => { if (e.target === authModal) closeModal(); });
if (tabLogin) tabLogin.addEventListener('click', showLoginTab);
if (tabRegister) tabRegister.addEventListener('click', showRegisterTab);
if (logoutBtn) logoutBtn.addEventListener('click', clearAuth);
if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', clearAuth);

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await readApiResponse(res);
      if (data.success) {
        setAuth(data.token, data.user);
        closeModal();
      }
    } catch (err) {
      if (authStatus) {
        authStatus.textContent = err.message;
        authStatus.style.display = 'block';
        authStatus.className = 'mt-space-md p-3 rounded-lg text-center font-body-sm text-body-sm bg-error-container text-error';
      } else {
        alert(err.message);
      }
    }
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await readApiResponse(res);
      if (data.success) {
        setAuth(data.token, data.user);
        closeModal();
      }
    } catch (err) {
      if (authStatus) {
        authStatus.textContent = err.message;
        authStatus.style.display = 'block';
        authStatus.className = 'mt-space-md p-3 rounded-lg text-center font-body-sm text-body-sm bg-error-container text-error';
      } else {
        alert(err.message);
      }
    }
  });
}

// ================= GPS AUTO-DETECT =================
let gpsStatus = 'pending';
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      
      if (latitudeInput) latitudeInput.value = lat;
      if (longitudeInput) longitudeInput.value = lng;
      if (locationInput) locationInput.value = `GPS: (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
      gpsStatus = 'acquired';
      updateGpsButtonState();
    },
    (err) => {
      console.warn('Geolocation access error:', err);
      gpsStatus = 'denied';
      updateGpsButtonState();
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function updateGpsButtonState() {
  const gpsBtn = document.getElementById('gpsBtn');
  if (!gpsBtn) return;
  if (gpsStatus === 'acquired') {
    gpsBtn.innerHTML = '<span class="material-symbols-outlined text-[16px]">location_on</span> GPS Attached';
    gpsBtn.classList.add('bg-tertiary-container/20', 'text-tertiary-container', 'border-tertiary-container/30');
    gpsBtn.classList.remove('text-on-surface-variant');
  } else if (gpsStatus === 'denied') {
    gpsBtn.innerHTML = '<span class="material-symbols-outlined text-[16px]">location_off</span> GPS Denied';
    gpsBtn.classList.add('text-error');
  }
}

// ================= PHOTO UPLOAD =================
function triggerPhotoUpload() {
  if (imageInput) imageInput.click();
}

if (imageInput) {
  imageInput.addEventListener('change', () => {
    const photoBtn = document.getElementById('photoBtn');
    if (photoBtn && imageInput.files.length > 0) {
      const name = imageInput.files[0].name;
      photoBtn.innerHTML = `<span class="material-symbols-outlined text-[16px]">check_circle</span> ${escapeHtml(name.length > 15 ? name.substring(0,12) + '...' : name)}`;
      photoBtn.classList.add('bg-tertiary-container/20', 'text-tertiary-container', 'border-tertiary-container/30');
      photoBtn.classList.remove('text-on-surface-variant');
    }
  });
}

// ================= VOICE RECORDING =================
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

function toggleVoiceRecording() {
  const btn = document.getElementById('micBtn');
  if (!btn) return;

  if (isRecording) {
    // Stop recording
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    isRecording = false;
    btn.classList.remove('bg-error');
    btn.classList.add('bg-secondary');
    btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">mic</span>';
    return;
  }

  // Start recording
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Voice recording is not supported in this browser.');
    return;
  }

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      isRecording = true;
      btn.classList.remove('bg-secondary');
      btn.classList.add('bg-error');
      btn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-pulse">stop_circle</span>';
      
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (audioChunks.length > 0 && promptInput) {
          promptInput.value += '\n[Voice memo recorded - audio transcription not available in offline mode]';
        }
      };
      
      mediaRecorder.start();
    })
    .catch(err => {
      console.error('Microphone access error:', err);
      alert('Microphone access denied. Please allow microphone permissions.');
    });
}

// ================= SUBMIT REPORT =================
if (submitBtn) {
  submitBtn.addEventListener('click', async function (e) {
    e.preventDefault();

    const promptText = promptInput ? promptInput.value.trim() : '';
    if (!promptText) {
      alert('Please describe the issue before submitting.');
      return;
    }

    const locationText = locationInput ? locationInput.value : '';
    const lat = latitudeInput ? latitudeInput.value : '';
    const lng = longitudeInput ? longitudeInput.value : '';

    if (!locationText) {
      alert('Waiting for GPS location. Please allow location access or try again.');
      return;
    }

    const formData = new FormData();
    formData.append('prompt', promptText);
    if (locationText) formData.append('location', locationText);
    if (lat) formData.append('latitude', lat);
    if (lng) formData.append('longitude', lng);

    if (imageInput && imageInput.files.length > 0) {
      formData.append('image', imageInput.files[0]);
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">progress_activity</span><span>AI Analyzing...</span>';

    const headers = {};
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/complaints`, { method: 'POST', headers, body: formData });
      const data = await readApiResponse(res);

      if (data.success) {
        const c = data.complaint;
        showToast(`Report submitted! Classified as "${c.category}" [${c.priority} Priority].`, 'success');
        if (promptInput) promptInput.value = '';
        if (imageInput) imageInput.value = '';
        // Reset photo button
        const photoBtn = document.getElementById('photoBtn');
        if (photoBtn) {
          photoBtn.innerHTML = '<span class="material-symbols-outlined text-[16px]">add_a_photo</span> Add Photo';
          photoBtn.className = 'flex items-center gap-1 px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high font-label-sm text-label-sm transition-colors';
        }
        // Reload my reports if logged in
        if (getUser()) loadMyReports();
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      submitBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">send_spark</span><span>Submit Incident Report</span>';
      submitBtn.disabled = false;
    }
  });
}

// ================= TOAST NOTIFICATION =================
function showToast(message, type = 'success') {
  const existing = document.getElementById('toast-notification');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast-notification';
  const bgColor = type === 'success' ? 'bg-tertiary-container text-on-tertiary-fixed' : 'bg-error-container text-error';
  const icon = type === 'success' ? 'check_circle' : 'error';
  toast.className = `fixed top-4 right-4 z-[200] ${bgColor} px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 font-label-md text-label-md max-w-md animate-[slideIn_0.3s_ease]`;
  toast.innerHTML = `<span class="material-symbols-outlined text-[20px]">${icon}</span><span>${escapeHtml(message)}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// ================= CITIZEN: LOAD MY REPORTS =================
async function loadMyReports() {
  const panel = document.getElementById('panelReports');
  if (!panel) return;
  
  const token = getAuthToken();
  if (!token) {
    panel.innerHTML = `
      <div class="col-span-full flex flex-col items-center justify-center py-8 text-center">
        <span class="material-symbols-outlined text-outline text-[48px] mb-4">lock</span>
        <h3 class="font-title-md text-title-md text-on-surface mb-2">Sign in to see your reports</h3>
        <p class="font-body-sm text-body-sm text-on-surface-variant mb-4">Track the status of issues you've submitted.</p>
        <button onclick="openModal()" class="px-4 py-2 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md font-semibold">Sign In</button>
      </div>`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/complaints/my-reports`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await readApiResponse(res);
    
    const tabBtn = document.getElementById('tabReportsBtn');
    if (tabBtn) tabBtn.textContent = `My Active Reports (${data.total})`;

    if (!data.complaints || data.complaints.length === 0) {
      panel.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center py-8 text-center">
          <span class="material-symbols-outlined text-outline text-[48px] mb-4">inbox</span>
          <h3 class="font-title-md text-title-md text-on-surface mb-2">No reports yet</h3>
          <p class="font-body-sm text-body-sm text-on-surface-variant">Use the AI Reporter above to submit your first civic issue.</p>
        </div>`;
      return;
    }

    panel.innerHTML = data.complaints.map(c => {
      const statusConfig = getStatusConfig(c.status);
      const timeAgo = getTimeAgo(c.created_at);
      return `
        <div class="bg-surface-container-lowest border border-surface-container-high rounded-xl p-space-md flex flex-col gap-space-sm shadow-sm hover:shadow-md transition-shadow">
          <div class="flex items-center justify-between">
            <span class="px-2 py-1 rounded bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">#${c.id}</span>
            <span class="font-body-sm text-body-sm text-on-surface-variant">${timeAgo}</span>
          </div>
          <h3 class="font-title-md text-title-md text-on-surface">${escapeHtml(c.title)}</h3>
          <p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">${escapeHtml(c.description)}</p>
          <div class="flex flex-wrap gap-1">
            <span class="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">${escapeHtml(c.category)}</span>
            <span class="px-2 py-0.5 rounded-full ${getPriorityBadge(c.priority)} font-label-sm text-label-sm">${c.priority}</span>
          </div>
          ${c.image_url ? `<img src="${c.image_url}" class="w-full h-24 object-cover rounded-lg" alt="Report photo"/>` : ''}
          <div class="mt-auto pt-space-sm border-t border-surface-container flex items-center justify-between">
            <div class="flex items-center gap-1 ${statusConfig.color} font-label-sm text-label-sm">
              <span class="material-symbols-outlined text-[16px]">${statusConfig.icon}</span> ${statusConfig.label}
            </div>
            <span class="font-label-sm text-label-sm text-on-surface-variant">${escapeHtml(c.location)}</span>
          </div>
        </div>`;
    }).join('') + `
      <div onclick="window.scrollTo({top:0,behavior:'smooth'})" class="bg-surface-container-lowest border border-surface-container-high rounded-xl p-space-md flex flex-col gap-space-sm shadow-sm hover:shadow-md transition-shadow border-dashed border-2 bg-surface-container-low/50 items-center justify-center text-center cursor-pointer">
        <span class="material-symbols-outlined text-outline text-[32px] mb-2">add_circle</span>
        <h3 class="font-title-md text-title-md text-on-surface">Report New Issue</h3>
        <p class="font-body-sm text-body-sm text-on-surface-variant">Help improve our community.</p>
      </div>`;
  } catch (err) {
    console.error('Error loading reports:', err);
    panel.innerHTML = `<div class="col-span-full text-center py-8 text-on-surface-variant">${escapeHtml(err.message)}</div>`;
  }
}

// ================= ADMIN: LOAD DASHBOARD =================
let adminComplaints = [];
let adminCurrentPage = 1;
const adminPageSize = 10;
let adminFilterStatus = 'ALL';
let adminFilterDept = 'ALL';
let adminFilterPriority = 'ALL';
let adminMap = null;
let adminMapFull = null;
let adminMapMarkers = [];
let adminMapFullMarkers = [];

async function loadAdminDashboard() {
  const token = getAuthToken();
  if (!token) return;

  try {
    let url = `${API_BASE}/complaints?status=${adminFilterStatus}&department=${adminFilterDept}&priority=${adminFilterPriority}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await readApiResponse(res);

    adminComplaints = data.complaints || [];
    
    // Update KPIs
    updateAdminKPIs(data.stats, adminComplaints.length);
    
    // Render table
    renderTriageTable();
    renderFullTriageQueue();
    
    // Update map
    renderAdminMap();
    
    // Update spotlight
    renderIncidentSpotlight();
  } catch (err) {
    console.error('Error loading admin dashboard:', err);
  }
}

function updateAdminKPIs(stats, total) {
  const kpiContainer = document.getElementById('adminKPIs');
  if (!kpiContainer) return;
  
  const s = stats || {};
  kpiContainer.innerHTML = `
    <div class="bg-surface-container-lowest border border-surface-container-high rounded-xl p-space-md shadow-sm">
      <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Active Incidents</span>
      <div class="flex items-end justify-between mt-2">
        <span class="font-headline-md text-headline-md text-on-surface">${total || 0}</span>
        <span class="text-on-surface-variant font-label-sm text-label-sm">${s.pending || 0} pending</span>
      </div>
    </div>
    <div class="bg-surface-container-lowest border border-surface-container-high rounded-xl p-space-md shadow-sm">
      <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">In Progress</span>
      <div class="flex items-end justify-between mt-2">
        <span class="font-headline-md text-headline-md text-on-surface">${s.in_progress || 0}</span>
        <span class="text-secondary font-label-sm text-label-sm">assigned</span>
      </div>
    </div>
    <div class="bg-surface-container-lowest border border-surface-container-high rounded-xl p-space-md shadow-sm">
      <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Resolved</span>
      <div class="flex items-end justify-between mt-2">
        <span class="font-headline-md text-headline-md text-on-surface">${s.resolved || 0}</span>
        <span class="text-tertiary-container font-label-sm text-label-sm">completed</span>
      </div>
    </div>
    <div class="bg-surface-container-lowest border border-surface-container-high rounded-xl p-space-md shadow-sm">
      <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">High Priority</span>
      <div class="flex items-end justify-between mt-2">
        <span class="font-headline-md text-headline-md text-error">${s.high_priority || 0}</span>
        <span class="text-error font-label-sm text-label-sm">urgent</span>
      </div>
    </div>`;
}

function renderTriageTable() {
  const tbody = document.getElementById('triageTableBody');
  const paginationInfo = document.getElementById('paginationInfo');
  const paginationBtns = document.getElementById('paginationBtns');
  if (!tbody) return;

  const totalPages = Math.max(1, Math.ceil(adminComplaints.length / adminPageSize));
  if (adminCurrentPage > totalPages) adminCurrentPage = totalPages;
  const startIdx = (adminCurrentPage - 1) * adminPageSize;
  const pageItems = adminComplaints.slice(startIdx, startIdx + adminPageSize);

  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-on-surface-variant">No complaints found matching filters.</td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(c => {
      const statusConfig = getStatusConfig(c.status);
      const priorityBadge = getPriorityBadge(c.priority);
      const timeAgo = getTimeAgo(c.created_at);
      const actionBtn = getActionButton(c);
      return `
        <tr class="hover:bg-surface-container-low/50 transition-colors">
          <td class="p-3 font-semibold text-primary whitespace-nowrap">#${c.id}</td>
          <td class="p-3"><span class="px-2 py-0.5 rounded-full ${priorityBadge} font-label-sm">${c.priority}</span></td>
          <td class="p-3 text-on-surface">${escapeHtml(c.category)}</td>
          <td class="p-3 text-on-surface-variant max-w-[200px] truncate" title="${escapeHtml(c.location)}">${escapeHtml(c.location)}</td>
          <td class="p-3"><span class="flex items-center gap-1 ${statusConfig.color}"><span class="w-2 h-2 rounded-full ${statusConfig.dotColor}"></span> ${statusConfig.label}</span></td>
          <td class="p-3 text-on-surface-variant text-body-sm whitespace-nowrap">${timeAgo}</td>
          <td class="p-3">${actionBtn}</td>
        </tr>`;
    }).join('');
  }

  if (paginationInfo) {
    paginationInfo.textContent = `Showing ${startIdx + 1}-${Math.min(startIdx + adminPageSize, adminComplaints.length)} of ${adminComplaints.length}`;
  }

  if (paginationBtns) {
    let btns = `<button onclick="adminChangePage(${adminCurrentPage - 1})" class="w-8 h-8 rounded border border-surface-container-high flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-50" ${adminCurrentPage <= 1 ? 'disabled' : ''}><span class="material-symbols-outlined text-[18px]">chevron_left</span></button>`;
    for (let i = 1; i <= Math.min(totalPages, 5); i++) {
      btns += `<button onclick="adminChangePage(${i})" class="w-8 h-8 rounded ${i === adminCurrentPage ? 'bg-primary text-on-primary' : 'border border-surface-container-high text-on-surface-variant hover:bg-surface-container'} font-label-sm flex items-center justify-center">${i}</button>`;
    }
    if (totalPages > 5) btns += `<span class="text-on-surface-variant px-1">...</span><button onclick="adminChangePage(${totalPages})" class="w-8 h-8 rounded border border-surface-container-high text-on-surface-variant hover:bg-surface-container font-label-sm flex items-center justify-center">${totalPages}</button>`;
    btns += `<button onclick="adminChangePage(${adminCurrentPage + 1})" class="w-8 h-8 rounded border border-surface-container-high flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-50" ${adminCurrentPage >= totalPages ? 'disabled' : ''}><span class="material-symbols-outlined text-[18px]">chevron_right</span></button>`;
    paginationBtns.innerHTML = btns;
  }
}

function adminChangePage(page) {
  const totalPages = Math.max(1, Math.ceil(adminComplaints.length / adminPageSize));
  if (page < 1 || page > totalPages) return;
  adminCurrentPage = page;
  renderTriageTable();
}

function getActionButton(c) {
  if (c.status === 'PENDING') {
    return `<div class="flex gap-1">
      <button onclick="adminAssign(${c.id})" class="text-secondary hover:underline font-label-md">Dispatch</button>
      <button onclick="adminDelete(${c.id})" class="text-error hover:underline font-label-md ml-2">Delete</button>
    </div>`;
  } else if (c.status === 'ASSIGNED' || c.status === 'IN_PROGRESS') {
    return `<button onclick="adminResolve(${c.id})" class="text-tertiary-container hover:underline font-label-md">Resolve</button>`;
  } else if (c.status === 'RESOLVED') {
    return `<button onclick="adminDelete(${c.id})" class="text-outline-variant hover:text-on-surface font-label-md">Archive</button>`;
  }
  return `<span class="text-outline-variant font-label-sm">${c.status}</span>`;
}

function renderFullTriageQueue() {
  const container = document.getElementById('triageFullList');
  if (!container) return;
  if (!adminComplaints || adminComplaints.length === 0) {
    container.innerHTML = '<p class="col-span-full text-center text-on-surface-variant py-8">No complaints found matching filters.</p>';
    return;
  }
  container.innerHTML = adminComplaints.map(c => {
    const statusConfig = getStatusConfig(c.status);
    const priorityBadge = getPriorityBadge(c.priority);
    const timeAgo = getTimeAgo(c.created_at);
    const actionBtn = getActionButton(c);
    return `
      <div class="bg-surface-container-lowest border border-surface-container-high rounded-xl p-space-md flex flex-col gap-space-sm shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between">
          <span class="px-2 py-1 rounded bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">#${c.id}</span>
          <span class="font-body-sm text-body-sm text-on-surface-variant">${timeAgo}</span>
        </div>
        <h3 class="font-title-md text-title-md text-on-surface">${escapeHtml(c.title)}</h3>
        <p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">${escapeHtml(c.ai_summary || c.description)}</p>
        <div class="flex flex-wrap gap-1">
          <span class="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">${escapeHtml(c.category)}</span>
          <span class="px-2 py-0.5 rounded-full ${priorityBadge} font-label-sm text-label-sm">${c.priority}</span>
        </div>
        <div class="mt-auto pt-space-sm border-t border-surface-container flex items-center justify-between">
          <div class="flex items-center gap-1 ${statusConfig.color} font-label-sm text-label-sm">
            <span class="material-symbols-outlined text-[16px]">${statusConfig.icon}</span> ${statusConfig.label}
          </div>
          <div class="flex items-center">
            ${actionBtn}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ================= ADMIN ACTIONS =================
async function adminAssign(id) {
  const dept = prompt('Assign to department:\n(Roads / Water / Electricity / Sanitation / General Maintenance)', 'Roads');
  if (!dept) return;
  
  const priority = prompt('Set priority (HIGH / MEDIUM / LOW):', 'MEDIUM');
  
  try {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/complaints/${id}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ department: dept, priority: priority || undefined })
    });
    const data = await readApiResponse(res);
    showToast(`Complaint #${id} dispatched to ${dept}!`, 'success');
    loadAdminDashboard();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function adminResolve(id) {
  if (!confirm(`Mark complaint #${id} as RESOLVED?`)) return;
  
  try {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/complaints/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ status: 'RESOLVED' })
    });
    const data = await readApiResponse(res);
    showToast(`Complaint #${id} marked as resolved!`, 'success');
    loadAdminDashboard();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function adminDelete(id) {
  if (!confirm(`Delete/archive complaint #${id}? This cannot be undone.`)) return;
  
  try {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/complaints/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await readApiResponse(res);
    showToast(`Complaint #${id} deleted.`, 'success');
    loadAdminDashboard();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// ================= ADMIN: FILTER MODAL =================
function showAdminFilter() {
  const modal = document.getElementById('filterModal');
  if (modal) modal.style.display = 'flex';
}

function closeAdminFilter() {
  const modal = document.getElementById('filterModal');
  if (modal) modal.style.display = 'none';
}

function applyAdminFilter() {
  const statusSel = document.getElementById('filterStatus');
  const deptSel = document.getElementById('filterDept');
  const prioritySel = document.getElementById('filterPriority');
  
  adminFilterStatus = statusSel ? statusSel.value : 'ALL';
  adminFilterDept = deptSel ? deptSel.value : 'ALL';
  adminFilterPriority = prioritySel ? prioritySel.value : 'ALL';
  adminCurrentPage = 1;
  closeAdminFilter();
  loadAdminDashboard();
}

function resetAdminFilter() {
  adminFilterStatus = 'ALL';
  adminFilterDept = 'ALL';
  adminFilterPriority = 'ALL';
  adminCurrentPage = 1;
  closeAdminFilter();
  loadAdminDashboard();
}

// ================= ADMIN: EXPORT CSV =================
function exportCSV() {
  if (!adminComplaints || adminComplaints.length === 0) {
    showToast('No data to export.', 'error');
    return;
  }
  
  const headers = ['ID', 'Title', 'Category', 'Location', 'Priority', 'Status', 'Department', 'Reporter', 'Created At', 'AI Summary'];
  const rows = adminComplaints.map(c => [
    c.id,
    `"${(c.title || '').replace(/"/g, '""')}"`,
    c.category,
    `"${(c.location || '').replace(/"/g, '""')}"`,
    c.priority,
    c.status,
    c.assigned_department,
    c.reporter_name || 'Anonymous',
    c.created_at,
    `"${(c.ai_summary || '').replace(/"/g, '""')}"`
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `civicflow_export_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported successfully!', 'success');
}

// ================= ADMIN: MAP =================
function renderAdminMap() {
  const mapEl = document.getElementById('adminMap');
  const mapFullEl = document.getElementById('adminMapFull');
  const mapOverlay = document.getElementById('mapOverlay');

  // Remove overlay
  if (mapOverlay) mapOverlay.remove();

  // Init Dashboard Map
  if (mapEl && !adminMap) {
    try {
      adminMap = L.map('adminMap').setView([40.7128, -74.0060], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(adminMap);
    } catch (e) {
      console.warn('Map init failed:', e);
    }
  }

  // Init Full Map
  if (mapFullEl && !adminMapFull) {
    try {
      adminMapFull = L.map('adminMapFull').setView([40.7128, -74.0060], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(adminMapFull);
    } catch (e) {
      console.warn('Full Map init failed:', e);
    }
  }

  // Clear old markers
  adminMapMarkers.forEach(m => adminMap && adminMap.removeLayer(m));
  adminMapMarkers = [];

  adminMapFullMarkers.forEach(m => adminMapFull && adminMapFull.removeLayer(m));
  adminMapFullMarkers = [];

  const withCoords = adminComplaints.filter(c => c.latitude && c.longitude);
  
  withCoords.forEach(c => {
    const color = c.priority === 'HIGH' ? '#ba1a1a' : c.priority === 'MEDIUM' ? '#F59E0B' : '#4ac08f';
    
    if (adminMap) {
      const marker = L.circleMarker([c.latitude, c.longitude], {
        radius: 8, fillColor: color, color: '#fff', weight: 2, fillOpacity: 0.9
      }).addTo(adminMap);
      marker.bindPopup(`<strong>#${c.id}: ${escapeHtml(c.title)}</strong><br>${escapeHtml(c.category)} - ${c.priority}<br>${escapeHtml(c.location)}`);
      adminMapMarkers.push(marker);
    }

    if (adminMapFull) {
      const markerFull = L.circleMarker([c.latitude, c.longitude], {
        radius: 8, fillColor: color, color: '#fff', weight: 2, fillOpacity: 0.9
      }).addTo(adminMapFull);
      markerFull.bindPopup(`<strong>#${c.id}: ${escapeHtml(c.title)}</strong><br>${escapeHtml(c.category)} - ${c.priority}<br>${escapeHtml(c.location)}`);
      adminMapFullMarkers.push(markerFull);
    }
  });

  if (withCoords.length > 0) {
    const bounds = L.latLngBounds(withCoords.map(c => [c.latitude, c.longitude]));
    if (adminMap) adminMap.fitBounds(bounds, { padding: [30, 30] });
    if (adminMapFull) adminMapFull.fitBounds(bounds, { padding: [30, 30] });
  }

  if (adminMap) setTimeout(() => adminMap.invalidateSize(), 200);
  if (adminMapFull) setTimeout(() => adminMapFull.invalidateSize(), 200);
}

// ================= ADMIN: INCIDENT SPOTLIGHT =================
function renderIncidentSpotlight() {
  const container = document.getElementById('incidentSpotlight');
  if (!container) return;

  // Find the highest priority unresolved complaint
  const critical = adminComplaints.find(c => c.priority === 'HIGH' && c.status !== 'RESOLVED');
  
  if (!critical) {
    container.innerHTML = `
      <h3 class="font-title-md text-title-md text-on-surface font-semibold mb-space-md flex items-center gap-2"><span class="material-symbols-outlined text-tertiary-container">check_circle</span> All Clear</h3>
      <p class="font-body-sm text-body-sm text-on-surface-variant">No critical incidents at this time.</p>`;
    return;
  }

  container.innerHTML = `
    <h3 class="font-title-md text-title-md text-on-surface font-semibold mb-space-md flex items-center gap-2"><span class="material-symbols-outlined text-error">radar</span> Incident Spotlight</h3>
    <div class="p-space-md bg-error-container/10 border border-error/20 rounded-lg flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="px-2 py-1 rounded bg-error text-on-error font-label-sm text-label-sm">#${critical.id}</span>
        <span class="font-label-sm text-label-sm text-error animate-pulse">${critical.priority} Severity</span>
      </div>
      <h4 class="font-label-md text-label-md text-on-surface font-semibold">${escapeHtml(critical.title)}</h4>
      <p class="font-body-sm text-body-sm text-on-surface-variant">${escapeHtml(critical.ai_summary || critical.description)}</p>
      <div class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
        <span class="material-symbols-outlined text-[14px]">location_on</span> ${escapeHtml(critical.location)}
      </div>
      <div class="mt-2 flex gap-2">
        <button onclick="adminAssign(${critical.id})" class="flex-1 py-1.5 rounded bg-error text-on-error font-label-sm hover:bg-error/90 transition-colors">Dispatch Crew</button>
        <button onclick="adminResolve(${critical.id})" class="px-3 py-1.5 rounded border border-error text-error font-label-sm hover:bg-error-container/30 transition-colors">Mark Resolved</button>
      </div>
    </div>`;
}

// ================= ADMIN: SIDEBAR NAV =================
let currentAdminView = 'dashboard';

function switchAdminView(view) {
  currentAdminView = view;
  
  // Update sidebar highlight
  document.querySelectorAll('#adminSidebar a').forEach(a => {
    a.classList.remove('bg-secondary-container', 'text-on-secondary-container');
    a.classList.add('text-on-surface-variant');
  });
  const activeLink = document.querySelector(`[data-view="${view}"]`);
  if (activeLink) {
    activeLink.classList.add('bg-secondary-container', 'text-on-secondary-container');
    activeLink.classList.remove('text-on-surface-variant');
  }

  // Show/hide content sections
  const sections = document.querySelectorAll('.admin-section');
  sections.forEach(s => s.style.display = 'none');
  
  const target = document.getElementById(`section-${view}`);
  if (target) target.style.display = 'block';

  // Map needs a resize when shown
  if (view === 'map') {
    if (adminMap) setTimeout(() => adminMap.invalidateSize(), 100);
    if (adminMapFull) setTimeout(() => adminMapFull.invalidateSize(), 100);
  }
}

// ================= HELPERS =================
function getStatusConfig(status) {
  switch (status) {
    case 'PENDING': return { label: 'Pending', icon: 'schedule', color: 'text-outline', dotColor: 'bg-outline' };
    case 'ASSIGNED': return { label: 'Assigned', icon: 'assignment_ind', color: 'text-secondary', dotColor: 'bg-secondary' };
    case 'IN_PROGRESS': return { label: 'In Progress', icon: 'pending_actions', color: 'text-secondary', dotColor: 'bg-secondary' };
    case 'RESOLVED': return { label: 'Resolved', icon: 'check_circle', color: 'text-tertiary-container', dotColor: 'bg-tertiary-container' };
    case 'SHADOWBANNED': return { label: 'Processing', icon: 'hourglass_empty', color: 'text-outline', dotColor: 'bg-outline' };
    default: return { label: status || 'Unknown', icon: 'help', color: 'text-outline', dotColor: 'bg-outline' };
  }
}

function getPriorityBadge(priority) {
  switch (priority) {
    case 'HIGH': return 'bg-error/10 text-error';
    case 'MEDIUM': return 'bg-[#F59E0B]/10 text-[#D97706]';
    case 'LOW': return 'bg-tertiary-container/10 text-tertiary-container';
    default: return 'bg-surface-container text-on-surface-variant';
  }
}

function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ================= CITIZEN: TAB SWITCHING =================
function switchPortalTab(tabId) {
  const panelReports = document.getElementById('panelReports');
  const panelHeroes = document.getElementById('panelHeroes');
  const tabReportsBtn = document.getElementById('tabReportsBtn');
  const tabHeroesBtn = document.getElementById('tabHeroesBtn');
  
  if (panelReports) panelReports.classList.add('hidden');
  if (panelHeroes) panelHeroes.classList.add('hidden');
  if (tabReportsBtn) { tabReportsBtn.classList.remove('bg-surface-container-high', 'text-on-surface'); tabReportsBtn.classList.add('text-on-surface-variant'); }
  if (tabHeroesBtn) { tabHeroesBtn.classList.remove('bg-surface-container-high', 'text-on-surface'); tabHeroesBtn.classList.add('text-on-surface-variant'); }
  
  if (tabId === 'reports') {
    if (panelReports) panelReports.classList.remove('hidden');
    if (tabReportsBtn) { tabReportsBtn.classList.add('bg-surface-container-high', 'text-on-surface'); tabReportsBtn.classList.remove('text-on-surface-variant'); }
  } else {
    if (panelHeroes) panelHeroes.classList.remove('hidden');
    if (tabHeroesBtn) { tabHeroesBtn.classList.add('bg-surface-container-high', 'text-on-surface'); tabHeroesBtn.classList.remove('text-on-surface-variant'); }
  }
}

function toggleResolutionProof(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('hidden');
}

function insertTemplate(text) {
  if (promptInput) {
    promptInput.value = text;
    promptInput.focus();
  }
}

function clearPrompt() {
  if (promptInput) promptInput.value = '';
  if (imageInput) imageInput.value = '';
  const photoBtn = document.getElementById('photoBtn');
  if (photoBtn) {
    photoBtn.innerHTML = '<span class="material-symbols-outlined text-[16px]">add_a_photo</span> Add Photo';
    photoBtn.className = 'flex items-center gap-1 px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high font-label-sm text-label-sm transition-colors';
  }
}

// ================= ADMIN CLOCK =================
function updateAdminClock() {
  const el = document.getElementById('adminClock');
  if (el) {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-US', { hour12: false }) + ' LCL';
  }
}
setInterval(updateAdminClock, 1000);
updateAdminClock();

// ================= INITIALIZE =================
function scrollToReport() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    const input = document.getElementById('promptInput');
    if (input) input.focus();
  }, 500);
}

function scrollToReportsTab() {
  const tabs = document.getElementById('tabReportsBtn');
  if (tabs) {
    tabs.scrollIntoView({ behavior: 'smooth', block: 'start' });
    switchPortalTab('reports');
  }
}

function scrollToHeroesTab() {
  const tabs = document.getElementById('tabHeroesBtn');
  if (tabs) {
    tabs.scrollIntoView({ behavior: 'smooth', block: 'start' });
    switchPortalTab('heroes');
  }
}

syncViewWithRole();
