const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:8000' : '';
const state = { applications: [], requests: [], requestFilter: 'All', recommendation: null };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'U';
}
function setupLogin() {
  const saved = localStorage.getItem('accesspilot_user');
  const showApp = (user) => {
    $('#loginScreen').hidden = true;
    $('#appShell').hidden = false;
    const shortName = user.name.trim().split(/\s+/)[0];
    const userInitials = initials(user.name);
    $('#userName').textContent = shortName;
    $('#sidebarUserName').textContent = user.name;
    $('#sidebarUserEmail').textContent = user.email;
    $('#settingsUserName').textContent = user.name;
    $('#settingsUserEmail').textContent = user.email;
    $('#sidebarAvatar').textContent = userInitials;
    $('#settingsAvatar').textContent = userInitials;
    $('#topAvatar').textContent = userInitials;
  const logout = () => {
    localStorage.removeItem('accesspilot_user');
    sessionStorage.removeItem('accesspilot_pet_seen');
    location.reload();
  };
  $('#logoutButton').onclick = logout;
  $('#topLogout').onclick = logout;
  $('#topAvatar').onclick = (event) => { event.stopPropagation(); $('#profileMenu').hidden = !$('#profileMenu').hidden; };
  $('#profileMenu').querySelector('[data-profile-page]').onclick = () => { $('#profileMenu').hidden = true; navigate('settings'); };
  document.addEventListener('click', () => { $('#profileMenu').hidden = true; });
  setTimeout(() => {
    $('#petNudge').hidden = false;
    setTimeout(() => { $('#petNudge').hidden = true; }, 7000);
  }, 3500);
  $('#petNudgeClose').onclick = () => { $('#petNudge').hidden = true; };
  $('#petNudge').onclick = (event) => { if (event.target.id !== 'petNudgeClose') { $('#petNudge').hidden = true; openAssistant(); } };
  };
  if (saved) {
    try { const user = JSON.parse(saved); if (user.name && user.email) { showApp(user); return true; } } catch (_) { localStorage.removeItem('accesspilot_user'); }
  }
  $('#loginScreen').hidden = false;
  $('#appShell').hidden = true;
  $('#loginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const user = { name: $('#loginName').value.trim(), email: $('#loginEmail').value.trim() };
    localStorage.setItem('accesspilot_user', JSON.stringify(user));
    showApp(user);
    init();
  });
  return false;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function appByName(name) { return state.applications.find((item) => item.name === name); }
function iconClass(name) { return name.toLowerCase().replace(/[^a-z]/g, ''); }
function iconMarkup(application, extra = '') {
  return `<span class="app-icon ${iconClass(application.name)} ${extra}">${escapeHtml(application.icon)}</span>`;
}
function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}
function statusMarkup(status) {
  const normalized = status.toLowerCase();
  return `<span class="status-pill ${normalized}">${escapeHtml(status)}</span>`;
}
async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  if (!response.ok) {
    let message = 'Something went wrong. Please try again.';
    try { message = (await response.json()).detail || message; } catch (_) { /* keep fallback */ }
    throw new Error(message);
  }
  return response.json();
}
function showToast(message) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 3000);
}
function renderRequests() {
  const recent = state.requests.slice(0, 3);
  $('#recentRequestRows').innerHTML = recent.map((request) => {
    const application = appByName(request.application);
    return `<tr><td><div class="app-cell">${application ? iconMarkup(application) : ''}<div><strong>${escapeHtml(request.application)}</strong><small>${escapeHtml(request.project)}</small></div></div></td><td><span class="role-pill">${escapeHtml(request.role)}</span></td><td>${formatDate(request.created_at)}</td><td>${statusMarkup(request.status)}</td><td><button class="row-more" aria-label="Request ${escapeHtml(request.id)} details">···</button></td></tr>`;
  }).join('');
  $('#recentEmpty').hidden = recent.length > 0;
  const pending = state.requests.filter((request) => request.status === 'Pending').length;
  const approved = state.requests.filter((request) => request.status === 'Approved').length;
  $('#statTotal').textContent = String(state.requests.length).padStart(2, '0');
  $('#statPending').textContent = String(pending).padStart(2, '0');
  $('#statApproved').textContent = String(approved).padStart(2, '0');
  $('#pendingNavCount').textContent = String(pending).padStart(2, '0');
  $('#allCount').textContent = String(state.requests.length);
  const search = ($('#requestSearch')?.value || '').toLowerCase();
  const rows = state.requests.filter((request) => (state.requestFilter === 'All' || request.status === state.requestFilter)
    && `${request.id} ${request.application} ${request.role} ${request.project}`.toLowerCase().includes(search));
  $('#allRequestRows').innerHTML = rows.map((request) => `<tr><td><strong>${escapeHtml(request.id)}</strong></td><td><div class="app-cell">${appByName(request.application) ? iconMarkup(appByName(request.application)) : ''}<strong>${escapeHtml(request.application)}</strong></div></td><td><span class="role-pill">${escapeHtml(request.role)}</span></td><td>${escapeHtml(request.project)}</td><td>${formatDate(request.created_at)}</td><td>${statusMarkup(request.status)}</td></tr>`).join('');
  $('#requestsEmpty').hidden = rows.length > 0;
  $('#allRequestRows').closest('table').hidden = rows.length === 0;
  $$('.filter-tab').forEach((tab) => tab.classList.toggle('selected', tab.dataset.filter === state.requestFilter));
}
function renderApplications() {
  const search = ($('#appSearch')?.value || '').toLowerCase();
  const category = $('#categoryFilter')?.value || 'all';
  const filtered = state.applications.filter((item) => (category === 'all' || item.category === category)
    && `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(search));
  $('#applicationGrid').innerHTML = filtered.map((application) => `<article class="application-card"><div class="application-card-head">${iconMarkup(application)}<div><h3>${escapeHtml(application.name)}</h3><p>${escapeHtml(application.category)}</p></div></div><p>${escapeHtml(application.description)}</p><div class="role-summary"><span>Available access levels</span><strong>${application.roles.length} roles</strong></div><div class="application-card-foot"><small>${escapeHtml(application.members)} workspace members</small><button class="secondary-button app-request-button" data-application="${escapeHtml(application.name)}">Request access <span>→</span></button></div></article>`).join('');
}
function renderPopular() {
  $('#popularApps').innerHTML = state.applications.map((application) => `<div class="popular-item">${iconMarkup(application)}<div class="popular-info"><strong>${escapeHtml(application.name)}</strong><small>${escapeHtml(application.category)}</small></div><span class="popular-members">${escapeHtml(application.members)}</span><button class="small-arrow app-request-button" data-application="${escapeHtml(application.name)}" aria-label="Request ${escapeHtml(application.name)} access">→</button></div>`).join('');
}
function populateApplicationSelects() {
  const options = state.applications.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join('');
  $('#formApplication').innerHTML = options;
  $('#assistantApplication').innerHTML = options;
  const projectInput = $('#assistantProject');
  if (projectInput && projectInput.tagName !== 'SELECT') {
    const projectSelect = document.createElement('select');
    projectSelect.id = 'assistantProject';
    projectSelect.className = projectInput.className;
    projectSelect.setAttribute('aria-label', 'Choose project or team');
    projectInput.replaceWith(projectSelect);
  }
  updateRoleOptions();
  updateProjectOptions('formProject', $('#formApplication').value);
  updateProjectOptions('assistantProject', $('#assistantApplication').value);
}
function updateProjectOptions(selectId, applicationName) {
  const application = appByName(applicationName);
  const control = $(`#${selectId}`);
  if (!application || !control) return;
  const projects = application.projects || [];
  if (control.tagName === 'SELECT') {
    control.innerHTML = projects.map((project) => `<option value="${escapeHtml(project)}">${escapeHtml(project)}</option>`).join('');
  } else {
    control.setAttribute('list', 'projectOptions');
    let list = $('#projectOptions');
    if (!list) { list = document.createElement('datalist'); list.id = 'projectOptions'; document.body.append(list); }
    list.innerHTML = projects.map((project) => `<option value="${escapeHtml(project)}"></option>`).join('');
  }
}
function updateRoleOptions(preferredRole) {
  const application = appByName($('#formApplication').value);
  if (!application) return;
  $('#formRole').innerHTML = application.roles.map((role) => `<option value="${escapeHtml(role.name)}">${escapeHtml(role.name)} — ${escapeHtml(role.description)}</option>`).join('');
  if (preferredRole && application.roles.some((role) => role.name === preferredRole)) $('#formRole').value = preferredRole;
}
function openRequestModal(applicationName, roleName, reason) {
  if (!state.applications.length) return;
  if (applicationName && appByName(applicationName)) $('#formApplication').value = applicationName;
  updateRoleOptions(roleName);
  updateProjectOptions('formProject', $('#formApplication').value);
  if (reason) $('#formReason').value = reason;
  if (!$('#modalAskAssistant')) {
    const callout = document.createElement('div');
    callout.className = 'modal-assistant-callout';
    callout.innerHTML = '<div class="modal-assistant-icon">✳</div><div><strong>Not sure which role you need?</strong><p>Tell AccessPilot what you’re trying to do and get a recommendation.</p></div><button type="button" id="modalAskAssistant">Ask assistant <span>→</span></button>';
    $('.request-modal .modal-header').after(callout);
    $('#modalAskAssistant').addEventListener('click', () => {
      $('#assistantApplication').value = $('#formApplication').value;
      updateProjectOptions('assistantProject', $('#assistantApplication').value);
      $('#assistantProject').value = $('#formProject').value;
      closeRequestModal();
      openAssistant();
    });
  }
  $('#requestModal').hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('#formProject').focus(), 50);
}
function closeRequestModal() { $('#requestModal').hidden = true; document.body.style.overflow = ''; }
function navigate(page) {
  const validPages = ['home', 'applications', 'requests', 'approvals', 'settings'];
  if (!validPages.includes(page)) page = 'home';
  validPages.forEach((name) => { $(`#${name}Page`).hidden = name !== page; });
  $$('.nav-link[data-page]').forEach((link) => link.classList.toggle('active', link.dataset.page === page));
  const labels = { home: 'Overview', applications: 'Applications', requests: 'My requests', approvals: 'Approvals', settings: 'Settings' };
  $('#breadcrumbCurrent').textContent = labels[page];
  history.replaceState(null, '', `#${page}`);
  if (page === 'requests') renderRequests();
  if (page === 'applications') renderApplications();
  $('#sidebar').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function openAssistant() {
  $('#assistantPanel').classList.add('open');
  $('#assistantPanel').setAttribute('aria-hidden', 'false');
  $('#drawerScrim').classList.add('open');
  setTimeout(() => $('#assistantQuestion').focus(), 180);
}
function closeAssistant() {
  $('#assistantPanel').classList.remove('open');
  $('#assistantPanel').setAttribute('aria-hidden', 'true');
  $('#drawerScrim').classList.remove('open');
}
function addMessage(content, type = 'assistant') {
  const body = $('#assistantMessages');
  const message = document.createElement('div'); message.className = `chat-message ${type}`; message.textContent = content;
  body.append(message); body.scrollTop = body.scrollHeight; return message;
}
function addRecommendationCard(result) {
  const card = document.createElement('div'); card.className = 'recommendation-card';
  const confidenceClass = result.confidence === 'High' ? '' : 'review';
  card.innerHTML = `<div class="rec-kicker">RECOMMENDED ACCESS</div><div class="rec-summary"><strong>It sounds like you want to:</strong><span>${escapeHtml(result.summary || 'complete the work described in your request')}</span></div><div class="rec-role"><strong>${escapeHtml(result.recommended_role)}</strong><span class="confidence ${confidenceClass}">${escapeHtml(result.confidence)}</span></div><p>${escapeHtml(result.reason)}</p><div class="rec-source">Source: ${escapeHtml(result.source)}</div><button class="rec-request">Raise a ${escapeHtml(result.recommended_role)} request →</button>`;
  card.querySelector('button').addEventListener('click', () => {
    closeAssistant();
    const project = $('#assistantProject').value.trim();
    const question = $('#assistantQuestion').value.trim() || 'this access is needed for my work';
    openRequestModal(result.application, result.recommended_role, `Project: ${project}. I need ${result.recommended_role} access because: ${question}. ${result.reason}`);
    $('#formProject').value = project;
    navigate('home');
  });
  $('#assistantMessages').append(card); $('#assistantMessages').scrollTop = $('#assistantMessages').scrollHeight;
}
async function askAssistant(question) {
  const text = question.trim();
  const project = $('#assistantProject').value.trim();
  const selectedApplication = appByName($('#assistantApplication').value);
  if (project.length < 2) { $('#assistantProject').focus(); showToast('Please choose a project or team first.'); return; }
  if (selectedApplication?.projects?.length && !selectedApplication.projects.includes(project)) { $('#assistantProject').focus(); showToast('Please choose a project from the list.'); return; }
  if (text.length < 3) { $('#assistantQuestion').focus(); return; }
  const application = $('#assistantApplication').value;
  $('#assistantQuestion').value = '';
  addMessage(text, 'user');
  const loadingMessages = ['Understanding your request', 'Checking the application roles', 'Finding the least-privilege role', 'Preparing your recommendation'];
  let loadingIndex = 0;
  const loading = addMessage(`${loadingMessages[loadingIndex]} ···`, 'assistant'); loading.classList.add('typing');
  const loadingTimer = setInterval(() => { loadingIndex = (loadingIndex + 1) % loadingMessages.length; loading.textContent = `${loadingMessages[loadingIndex]} ···`; }, 1400);
  $('#sendQuestion').disabled = true;
  try {
    const result = await api('/api/recommend-role', { method: 'POST', body: JSON.stringify({ application, question: text }) });
    clearInterval(loadingTimer); loading.remove(); addMessage(`For ${result.application}, here’s a least-privilege starting point:`, 'assistant');
    state.recommendation = result; addRecommendationCard(result);
  } catch (error) {
    clearInterval(loadingTimer); loading.textContent = `${error.message} Please try again.`; loading.classList.remove('typing');
  } finally { $('#sendQuestion').disabled = false; }
}
async function submitRequest(event) {
  event.preventDefault();
  const button = $('#submitRequest'); button.disabled = true; button.textContent = 'Submitting…';
  const payload = { application: $('#formApplication').value, role: $('#formRole').value, project: $('#formProject').value.trim(), reason: $('#formReason').value.trim() };
  try {
    const request = await api('/api/requests', { method: 'POST', body: JSON.stringify(payload) });
    state.requests.unshift(request); renderRequests(); closeRequestModal(); $('#requestForm').reset(); updateRoleOptions(); navigate('requests');
    showToast(`Request ${request.id} submitted to the application owner.`);
  } catch (error) { showToast(error.message); }
  finally { button.disabled = false; button.innerHTML = 'Submit request <span>→</span>'; }
}
function bindEvents() {
  $$('[data-page]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); navigate(link.dataset.page); }));
  $$('[data-page-link]').forEach((link) => link.addEventListener('click', () => navigate(link.dataset.pageLink)));
  ['newRequestButton', 'appsNewRequest', 'requestsNewRequest', 'emptyNewRequest'].forEach((id) => $(`#${id}`).addEventListener('click', () => openRequestModal()));
  $('#formApplication').addEventListener('change', () => { updateRoleOptions(); updateProjectOptions('formProject', $('#formApplication').value); });
  $('#assistantApplication').addEventListener('change', () => updateProjectOptions('assistantProject', $('#assistantApplication').value));
  $('#requestForm').addEventListener('submit', submitRequest);
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', closeRequestModal));
  $('#requestModal').addEventListener('click', (event) => { if (event.target === $('#requestModal')) closeRequestModal(); });
  $('#applicationGrid').addEventListener('click', (event) => { const button = event.target.closest('.app-request-button'); if (button) openRequestModal(button.dataset.application); });
  $('#popularApps').addEventListener('click', (event) => { const button = event.target.closest('.app-request-button'); if (button) openRequestModal(button.dataset.application); });
  $('#appSearch').addEventListener('input', renderApplications); $('#categoryFilter').addEventListener('change', renderApplications);
  $('#requestSearch').addEventListener('input', renderRequests);
  $$('.filter-tab').forEach((tab) => tab.addEventListener('click', () => { state.requestFilter = tab.dataset.filter; renderRequests(); }));
  $('#assistantLauncher').addEventListener('click', openAssistant);
  $$('[data-open-assistant]').forEach((button) => button.addEventListener('click', openAssistant));
  $('#assistantClose').addEventListener('click', closeAssistant); $('#drawerScrim').addEventListener('click', closeAssistant);
  $('#sendQuestion').addEventListener('click', () => askAssistant($('#assistantQuestion').value));
  $('#assistantQuestion').addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); askAssistant($('#assistantQuestion').value); } });
  $$('.suggestion-chip').forEach((button) => button.addEventListener('click', () => { $('#assistantQuestion').value = button.dataset.prompt; askAssistant(button.dataset.prompt); }));
  $('#menuToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeRequestModal(); closeAssistant(); } });
}
async function init() {
  if (!setupLogin()) return;
  try {
    const [applications, requests] = await Promise.all([api('/api/applications'), api('/api/requests')]);
    state.applications = applications; state.requests = requests;
    populateApplicationSelects(); renderPopular(); renderApplications(); renderRequests(); bindEvents();
    const initialPage = location.hash.slice(1) || 'home'; navigate(initialPage);
  } catch (error) {
    document.body.innerHTML = `<main style="max-width:520px;margin:12vh auto;padding:28px;font:14px 'DM Sans',sans-serif;color:#263146"><h1>AccessPilot couldn't connect</h1><p style="color:#778194;line-height:1.6">${escapeHtml(error.message)}<br>Start the FastAPI server, then refresh this page.</p><p style="font-size:12px;color:#778194">From the project folder, run <code>cd backend</code> then <code>fastapi dev main.py</code>.</p></main>`;
  }
}
init();
