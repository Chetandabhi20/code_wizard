
    // ================= API URLS =================
    const API_BASE = window.location.port === '5000'
      ? '/api'
      : 'http://localhost:5000/api';

    // ================= DOM ELEMENTS =================
    const citizenPortal = document.getElementById('citizenPortal');
    const adminPortal = document.getElementById('adminPortal');

    // Citizen DOM
    const tabNewReport = document.getElementById('tabNewReport');
    const tabMyReports = document.getElementById('tabMyReports');
    const reportFormSection = document.getElementById('reportFormSection');
    const myReportsSection = document.getElementById('myReportsSection');
    const myComplaintsList = document.getElementById('myComplaintsList');
    const myReportCount = document.getElementById('myReportCount');
    const complaintForm = document.getElementById('complaintForm');
    const promptInput = document.getElementById('promptInput');
    const statusMessage = document.getElementById('statusMessage');
    const submitBtn = document.getElementById('submitBtn');
    const geoBtn = document.getElementById('geoBtn');
    const geoStatus = document.getElementById('geoStatus');
    const voiceBtn = document.getElementById('voiceBtn');
    const voiceBtnText = document.getElementById('voiceBtnText');
    const voiceStatus = document.getElementById('voiceStatus');

    // Admin DOM
    const statTotal = document.getElementById('statTotal');
    const statPending = document.getElementById('statPending');
    const statInProgress = document.getElementById('statInProgress');
    const statResolved = document.getElementById('statResolved');
    const statHigh = document.getElementById('statHigh');
    const filterDept = document.getElementById('filterDept');
    const filterStatus = document.getElementById('filterStatus');
    const filterPriority = document.getElementById('filterPriority');
    const adminComplaintsList = document.getElementById('adminComplaintsList');
    const adminComplaintCount = document.getElementById('adminComplaintCount');

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

    // ================= 1. LEAFLET MAP =================
    let map = null;
    let markersGroup = null;

    function initMapIfNeeded() {
      if (!map && document.getElementById('map')) {
        map = L.map('map').setView([20.5937, 78.9629], 5);
        markersGroup = L.layerGroup().addTo(map);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);
      }
    }

    // ================= 2. ROBUST CONTINUOUS VOICE SPEECH RECOGNITION =================
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isRecording = false;

    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isRecording = true;
        voiceBtn.classList.add('recording');
        voiceBtnText.textContent = 'Stop Speaking';
        voiceStatus.textContent = '🎙️ Listening... Speak naturally in English.';
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript + ' ';
          }
        }
        if (transcript) {
          promptInput.value += (promptInput.value ? ' ' : '') + transcript.trim();
        }
      };

      recognition.onerror = (e) => {
        console.warn('Speech event notification:', e.error);
        // Ignore harmless 'no-speech' pauses so the mic doesn't turn off while thinking
        if (e.error === 'no-speech') return;

        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          voiceStatus.textContent = '❌ Microphone access blocked. Please allow mic permissions.';
          stopVoiceRecognition();
        }
      };

      recognition.onend = () => {
        // If user didn't explicitly click stop and we are still in recording mode, keep it alive
        if (isRecording) {
          try {
            recognition.start();
          } catch (err) {
            stopVoiceRecognition();
          }
        } else {
          stopVoiceRecognition();
        }
      };
    }

    function stopVoiceRecognition() {
      isRecording = false;
      if (voiceBtn) {
        voiceBtn.classList.remove('recording');
        voiceBtnText.textContent = 'Click to Speak';
      }
      if (voiceStatus) voiceStatus.textContent = '';
    }

    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        if (!SpeechRecognition) {
          alert('Speech recognition is not supported on this browser. Please use Chrome or Edge.');
          return;
        }
        if (isRecording) {
          isRecording = false;
          recognition.stop();
          stopVoiceRecognition();
        } else {
          try {
            recognition.start();
          } catch (err) {
            console.error(err);
          }
        }
      });
    }

    // ================= 3. AUTH & PORTAL ROUTING =================
    function getAuthToken() { return localStorage.getItem('civicflow_token'); }
    function getUser() {
      const user = localStorage.getItem('civicflow_user');
      return user ? JSON.parse(user) : null;
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
        citizenPortal.classList.add('hidden');
        adminPortal.classList.remove('hidden');
        openAuthBtn.classList.add('hidden');
        userInfo.classList.remove('hidden');
        userNameDisplay.textContent = `🛡️ ${user.name} [${user.role}]`;

        initMapIfNeeded();
        setTimeout(() => { if (map) map.invalidateSize(); }, 200);
        fetchAdminFeed();
      } else {
        adminPortal.classList.add('hidden');
        citizenPortal.classList.remove('hidden');

        if (user) {
          openAuthBtn.classList.add('hidden');
          userInfo.classList.remove('hidden');
          userNameDisplay.textContent = `👤 ${user.name}`;
          fetchMyReports();
        } else {
          openAuthBtn.classList.remove('hidden');
          userInfo.classList.add('hidden');
        }
      }
    }

    // Tabs
    tabNewReport.addEventListener('click', () => {
      tabNewReport.classList.add('active');
      tabMyReports.classList.remove('active');
      reportFormSection.classList.remove('hidden');
      myReportsSection.classList.add('hidden');
    });

    tabMyReports.addEventListener('click', () => {
      tabMyReports.classList.add('active');
      tabNewReport.classList.remove('active');
      myReportsSection.classList.remove('hidden');
      reportFormSection.classList.add('hidden');
      fetchMyReports();
    });

    // GPS
    geoBtn.addEventListener('click', () => {
      if (!navigator.geolocation) return alert('Geolocation not supported.');
      geoStatus.textContent = '⏳ Fetching GPS...';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          document.getElementById('latitude').value = lat;
          document.getElementById('longitude').value = lng;
          document.getElementById('location').value = `GPS: (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
          geoStatus.textContent = `📍 Location locked: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        },
        (err) => { geoStatus.textContent = `⚠️ Location error: ${err.message}`; }
      );
    });

    // Citizen Reports
    async function fetchMyReports() {
      const token = getAuthToken();
      if (!token) {
        myComplaintsList.innerHTML = '<p class="loading-text">Please sign in to track reports.</p>';
        myReportCount.textContent = '0 reports';
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/complaints/my-reports`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await readApiResponse(res);

        myReportCount.textContent = `${data.total} reports`;
        if (data.complaints.length === 0) {
          myComplaintsList.innerHTML = '<p class="loading-text">No reports submitted yet.</p>';
          return;
        }

        myComplaintsList.innerHTML = data.complaints.map(item => {
          const dateFormatted = new Date(item.created_at).toLocaleDateString();
          const statusClass = `badge-${item.status.toLowerCase()}`;
          const imageHtml = item.image_url ? `<div class="complaint-img-box"><img src="${item.image_url}" class="complaint-img"></div>` : '';
          const aiHtml = item.ai_summary ? `<div class="ai-box"><span>🤖</span><span>${escapeHtml(item.ai_summary)}</span></div>` : '';

          return `
            <article class="complaint-card">
              <div class="card-top">
                <h4 class="card-title">#${item.id} — ${escapeHtml(item.title)}</h4>
                <span class="badge ${statusClass}">${item.status}</span>
              </div>
              <div class="card-meta">
                <span>🏷️ <strong>Category:</strong> ${escapeHtml(item.category)}</span>
                <span>📍 <strong>Location:</strong> ${escapeHtml(item.location)}</span>
                <span>🏢 <strong>Dept:</strong> ${escapeHtml(item.assigned_department || 'Triage')}</span>
              </div>
              <p class="card-desc">${escapeHtml(item.description)}</p>
              ${aiHtml}
              ${imageHtml}
              <div class="card-footer">
                <span>Reported on: ${dateFormatted}</span>
              </div>
            </article>
          `;
        }).join('');
      } catch (err) {
        myComplaintsList.innerHTML = `<p class="loading-text" style="color: #f43f5e;">⚠️ ${err.message}</p>`;
      }
    }

    // Admin Feed
    async function fetchAdminFeed() {
      const token = getAuthToken();
      if (!token) return;

      try {
        const dept = filterDept ? filterDept.value : 'ALL';
        const status = filterStatus ? filterStatus.value : 'ALL';
        const prio = filterPriority ? filterPriority.value : 'ALL';

        const queryParams = new URLSearchParams({ department: dept, status: status, priority: prio });
        const response = await fetch(`${API_BASE}/complaints?${queryParams.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await readApiResponse(response);

        if (data.stats) {
          statTotal.textContent = data.stats.total || 0;
          statPending.textContent = data.stats.pending || 0;
          statInProgress.textContent = data.stats.in_progress || 0;
          statResolved.textContent = data.stats.resolved || 0;
          statHigh.textContent = data.stats.high_priority || 0;
        }

        adminComplaintCount.textContent = `${data.total} issues in queue`;
        if (markersGroup) markersGroup.clearLayers();

        if (data.complaints.length === 0) {
          adminComplaintsList.innerHTML = '<p class="loading-text">No matching complaints found.</p>';
          return;
        }

        const bounds = [];
        adminComplaintsList.innerHTML = data.complaints.map(item => {
          const dateFormatted = new Date(item.created_at).toLocaleDateString();
          const statusClass = `badge-${item.status.toLowerCase()}`;
          const priorityClass = `priority-${item.priority ? item.priority.toLowerCase() : 'medium'}`;
          const imageHtml = item.image_url ? `<div class="complaint-img-box"><img src="${item.image_url}" class="complaint-img"></div>` : '';
          const aiHtml = item.ai_summary ? `<div class="ai-box"><span>🤖</span><span><strong>AI Assessment:</strong> ${escapeHtml(item.
  ai_summary)}</span></div>` : '';

          if (item.latitude && item.longitude && map) {
            const marker = L.marker([item.latitude, item.longitude]).addTo(markersGroup);
            marker.bindPopup(`<b>#${item.id} — ${escapeHtml(item.title)}</b><br>Status: ${item.status}<br>Priority: ${item.priority}`);
            bounds.push([item.latitude, item.longitude]);
          }

          return `
            <article class="complaint-card">
              <div class="card-top">
                <h4 class="card-title">#${item.id} — ${escapeHtml(item.title)}</h4>
                <div style="display: flex; gap: 6px;">
                  <span class="priority-badge ${priorityClass}">⚡ ${item.priority || 'MEDIUM'}</span>
                  <span class="badge ${statusClass}">${item.status}</span>
                </div>
              </div>
              <div class="card-meta">
                <span>🏷️ <strong>Category:</strong> ${escapeHtml(item.category)}</span>
                <span>📍 <strong>Location:</strong> ${escapeHtml(item.location)}</span>
                <span>🏢 <strong>Dept:</strong> ${escapeHtml(item.assigned_department || 'UNASSIGNED')}</span>
              </div>
              <p class="card-desc">${escapeHtml(item.description)}</p>
              ${aiHtml}
              ${imageHtml}
              <div class="card-footer">
                <span>Reported by: ${escapeHtml(item.reporter_name || 'Anonymous')}</span>
                <span>Date: ${dateFormatted}</span>
              </div>

              <div class="admin-actions">
                <label>Dept:</label>
                <select id="dept-${item.id}" class="admin-select">
                  <option value="Roads" ${item.assigned_department === 'Roads' ? 'selected' : ''}>Roads</option>
                  <option value="Electricity" ${item.assigned_department === 'Electricity' ? 'selected' : ''}>Electricity</option>
                  <option value="Sanitation" ${item.assigned_department === 'Sanitation' ? 'selected' : ''}>Sanitation</option>
                  <option value="Water" ${item.assigned_department === 'Water' ? 'selected' : ''}>Water</option>
                </select>

                <label>Priority:</label>
                <select id="prio-${item.id}" class="admin-select">
                  <option value="LOW" ${item.priority === 'LOW' ? 'selected' : ''}>LOW</option>
                  <option value="MEDIUM" ${item.priority === 'MEDIUM' ? 'selected' : ''}>MEDIUM</option>
                  <option value="HIGH" ${item.priority === 'HIGH' ? 'selected' : ''}>HIGH</option>
                </select>
                <button onclick="assignComplaint(${item.id})" class="btn-action btn-assign">Assign</button>

                <select id="status-${item.id}" class="admin-select">
                  <option value="PENDING" ${item.status === 'PENDING' ? 'selected' : ''}>PENDING</option>
                  <option value="ASSIGNED" ${item.status === 'ASSIGNED' ? 'selected' : ''}>ASSIGNED</option>
                  <option value="IN_PROGRESS" ${item.status === 'IN_PROGRESS' ? 'selected' : ''}>IN_PROGRESS</option>
                  <option value="RESOLVED" ${item.status === 'RESOLVED' ? 'selected' : ''}>RESOLVED</option>
                  <option value="REJECTED" ${item.status === 'REJECTED' ? 'selected' : ''}>REJECTED</option>
                </select>
                <button onclick="updateStatus(${item.id})" class="btn-action btn-resolve">Update</button>
                <button onclick="deleteComplaint(${item.id})" class="btn-action btn-delete">🗑️</button>
              </div>
            </article>
          `;
        }).join('');

        if (bounds.length > 0 && map) {
          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
        }
      } catch (err) {
        adminComplaintsList.innerHTML = `<p class="loading-text" style="color: #f43f5e;">⚠️ ${err.message}</p>`;
      }
    }

    if (filterDept) filterDept.addEventListener('change', fetchAdminFeed);
    if (filterStatus) filterStatus.addEventListener('change', fetchAdminFeed);
    if (filterPriority) filterPriority.addEventListener('change', fetchAdminFeed);

    // Admin Action Buttons
    window.assignComplaint = async function(id) {
      const department = document.getElementById(`dept-${id}`).value;
      const priority = document.getElementById(`prio-${id}`).value;
      const token = getAuthToken();

      try {
        const res = await fetch(`${API_BASE}/complaints/${id}/assign`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ department, priority })
        });
        if (res.ok) fetchAdminFeed();
      } catch (err) { alert(err.message); }
    };

    window.updateStatus = async function(id) {
      const status = document.getElementById(`status-${id}`).value;
      const token = getAuthToken();

      try {
        const res = await fetch(`${API_BASE}/complaints/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ status })
        });
        if (res.ok) fetchAdminFeed();
      } catch (err) { alert(err.message); }
    };

    window.deleteComplaint = async function(id) {
      if (!confirm(`Delete Complaint #${id}?`)) return;
      const token = getAuthToken();

      try {
        const res = await fetch(`${API_BASE}/complaints/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) fetchAdminFeed();
      } catch (err) { alert(err.message); }
    };

    // Form Submit
    complaintForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const promptText = promptInput.value;
      const locationText = document.getElementById('location').value;

      const formData = new FormData();
      formData.append('prompt', promptText);
      formData.append('location', locationText);
      formData.append('latitude', document.getElementById('latitude').value);
      formData.append('longitude', document.getElementById('longitude').value);

      const fileInput = document.getElementById('image');
      if (fileInput && fileInput.files.length > 0) formData.append('image', fileInput.files[0]);

      submitBtn.disabled = true;
      submitBtn.textContent = '🤖 Gemini AI is reading & analyzing...';

      const headers = {};
      const token = getAuthToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      try {
        const res = await fetch(`${API_BASE}/complaints`, { method: 'POST', headers, body: formData });
        const data = await readApiResponse(res);

        if (data.success) {
          statusMessage.textContent = `✅ AI classified as "${data.complaint.category}" [${data.complaint.priority} Priority] and dispatched
  to ${data.complaint.assigned_department}!`;
          statusMessage.className = 'status-box success';
          complaintForm.reset();
          geoStatus.textContent = '';
          if (token) fetchMyReports();
        }
      } catch (err) {
        statusMessage.textContent = `❌ ${err.message}`;
        statusMessage.className = 'status-box';
        statusMessage.style.background = 'rgba(244, 63, 94, 0.2)';
        statusMessage.style.color = '#f43f5e';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Submit & Analyze with AI';
      }
    });

    // Modal Logic
    function openModal() { authModal.classList.remove('hidden'); showLoginTab(); }
    function closeModal() {
      authModal.classList.add('hidden');
      loginForm.reset();
      registerForm.reset();
      authStatus.className = 'status-box hidden';
    }

    openAuthBtn.addEventListener('click', openModal);
    closeAuthBtn.addEventListener('click', closeModal);
    authModal.addEventListener('click', (e) => { if (e.target === authModal) closeModal(); });

    function showLoginTab() {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
      authStatus.className = 'status-box hidden';
    }

    function showRegisterTab() {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      registerForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
      authStatus.className = 'status-box hidden';
    }

    tabLogin.addEventListener('click', showLoginTab);
    tabRegister.addEventListener('click', showRegisterTab);

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
        authStatus.textContent = `❌ ${err.message}`;
        authStatus.className = 'status-box';
        authStatus.style.background = 'rgba(244, 63, 94, 0.2)';
        authStatus.style.color = '#f43f5e';
      }
    });

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
        authStatus.textContent = `❌ ${err.message}`;
        authStatus.className = 'status-box';
        authStatus.style.background = 'rgba(244, 63, 94, 0.2)';
        authStatus.style.color = '#f43f5e';
      }
    });

    logoutBtn.addEventListener('click', clearAuth);

    function escapeHtml(text) {
      if (!text) return '';
      return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    syncViewWithRole();