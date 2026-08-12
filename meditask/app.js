/* ═══════════════════════════════════════════════════════════════
   MediTask – Application Logic
   Auth → Role-based Routing → Per-role Dashboards
═══════════════════════════════════════════════════════════════ */

// ── State ────────────────────────────────────────────────────────────────────
const API = 'http://localhost:3001/api/v1';
let currentUser = null;
let currentView = 'dashboard';
let tasksList    = [];   // in-memory tasks
let editingTask  = null;

// ── Utility ──────────────────────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }
function initials(name) { return name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2); }
function today() { return new Date().toISOString().split('T')[0]; }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
}
function randomColor(seed) {
  const colors = ['#6c63ff','#34d399','#60a5fa','#f9a825','#a78bfa','#f472b6','#fb923c'];
  let hash = 0; for (const c of seed) hash = (hash*31 + c.charCodeAt(0)) % colors.length;
  return colors[hash];
}

// ── Role Configuration ────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  ADMIN: {
    color:   '#a78bfa',
    emoji:   '⚙️',
    label:   'Administrateur',
    welcome: 'Vue d\'ensemble complète du système',
    nav: [
      { section: 'Principal' },
      { id:'dashboard', icon:iconDashboard(), label:'Tableau de bord', badge:null },
      { id:'tasks',     icon:iconTasks(),     label:'Toutes les tâches', badge:'12' },
      { id:'users',     icon:iconUsers(),     label:'Utilisateurs', badge:null },
      { section: 'Gestion' },
      { id:'patients',  icon:iconPatient(),   label:'Patients', badge:null },
      { id:'agenda',    icon:iconCalendar(),  label:'Agenda', badge:null },
      { id:'reports',   icon:iconReports(),   label:'Rapports', badge:null },
      { section: 'Système' },
      { id:'settings',  icon:iconSettings(),  label:'Paramètres', badge:null },
    ]
  },
  DOCTOR: {
    color:   '#34d399',
    emoji:   '🩺',
    label:   'Médecin',
    welcome: 'Vos consultations et tâches du jour',
    nav: [
      { section: 'Mon espace' },
      { id:'dashboard',    icon:iconDashboard(), label:'Mon tableau de bord', badge:null },
      { id:'tasks',        icon:iconTasks(),     label:'Mes tâches', badge:'5' },
      { id:'appointments', icon:iconCalendar(),  label:'Mes consultations', badge:null },
      { section: 'Patients' },
      { id:'patients',     icon:iconPatient(),   label:'Mes patients', badge:null },
      { id:'dictations',   icon:iconMic(),       label:'Dictées médicales', badge:null },
    ]
  },
  SECRETARY: {
    color:   '#60a5fa',
    emoji:   '📋',
    label:   'Secrétaire',
    welcome: 'Gestion des rendez-vous et dossiers',
    nav: [
      { section: 'Accueil' },
      { id:'dashboard',    icon:iconDashboard(), label:'Tableau de bord', badge:null },
      { id:'tasks',        icon:iconTasks(),     label:'Mes tâches', badge:'8' },
      { id:'appointments', icon:iconCalendar(),  label:'Agenda', badge:null },
      { section: 'Patients' },
      { id:'patients',     icon:iconPatient(),   label:'Dossiers patients', badge:null },
      { id:'calls',        icon:iconPhone(),     label:'Appels', badge:'3' },
      { id:'messages',     icon:iconMsg(),       label:'Messages', badge:null },
    ]
  },
  PATIENT: {
    color:   '#f9a825',
    emoji:   '👤',
    label:   'Patient',
    welcome: 'Votre espace santé personnel',
    nav: [
      { section: 'Mon espace' },
      { id:'dashboard',    icon:iconDashboard(), label:'Mon tableau de bord', badge:null },
      { id:'appointments', icon:iconCalendar(),  label:'Mes rendez-vous', badge:null },
      { id:'documents',    icon:iconDoc(),       label:'Mes documents', badge:null },
      { section: 'Assistance' },
      { id:'messages',     icon:iconMsg(),       label:'Messages', badge:null },
    ]
  }
};

// ── SVG Icons ─────────────────────────────────────────────────────────────────
function svg(d, w=18) { return `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`; }
function iconDashboard() { return svg('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'); }
function iconTasks()     { return svg('<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'); }
function iconUsers()     { return svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'); }
function iconPatient()   { return svg('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'); }
function iconCalendar()  { return svg('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'); }
function iconReports()   { return svg('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'); }
function iconSettings()  { return svg('<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>'); }
function iconMic()       { return svg('<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>'); }
function iconPhone()     { return svg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.5 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.41 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.15a16 16 0 0 0 6 6l.27-.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 16.92z"/>'); }
function iconMsg()       { return svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'); }
function iconDoc()       { return svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'); }
function iconPlus()      { return svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12">', 15); }

// ── Seed Tasks ────────────────────────────────────────────────────────────────
function seedTasks(role) {
  const now = new Date();
  const seeds = {
    ADMIN: [
      { id:1, title:'Vérifier les accès utilisateurs', desc:'Audit des permissions du système', priority:'high', status:'todo', category:'admin', due: today(), assignedTo:'Admin' },
      { id:2, title:'Générer rapport mensuel',          desc:'Rapport d\'activité juillet 2026',  priority:'medium', status:'inprogress', category:'admin', due: today(), assignedTo:'Admin' },
      { id:3, title:'Mettre à jour les paramètres',     desc:'Configuration des notifications',  priority:'low',    status:'done', category:'admin', due: today(), assignedTo:'Admin' },
      { id:4, title:'Exporter les données patients',    desc:'Export CSV pour l\'ARS',           priority:'urgent', status:'todo', category:'medical', due: today(), assignedTo:'Admin' },
      { id:5, title:'Réviser les contrats fournisseurs',desc:'Contrats logiciels à renouveler',  priority:'medium', status:'inprogress', category:'admin', due: today(), assignedTo:'Admin' },
    ],
    DOCTOR: [
      { id:1, title:'Rédiger compte-rendu M. Dupont',   desc:'Consultation du 12/08 – cardiologie', priority:'high',   status:'todo',       category:'medical', due: today(), assignedTo:'Dr. Martin' },
      { id:2, title:'Valider ordonnances en attente',   desc:'3 ordonnances à signer',              priority:'urgent', status:'inprogress', category:'medical', due: today(), assignedTo:'Dr. Martin' },
      { id:3, title:'Rappeler patient Mme Lefebvre',    desc:'Résultats d\'analyse à transmettre',  priority:'high',   status:'todo',       category:'patient', due: today(), assignedTo:'Dr. Martin' },
      { id:4, title:'Formation DPC en ligne',           desc:'Module cybersécurité – 2h',           priority:'low',    status:'done',       category:'admin',   due: today(), assignedTo:'Dr. Martin' },
      { id:5, title:'Mettre à jour protocoles urgence', desc:'Nouveaux protocoles SAMU',            priority:'medium', status:'inprogress', category:'medical', due: today(), assignedTo:'Dr. Martin' },
    ],
    SECRETARY: [
      { id:1, title:'Confirmer RDV du 14/08',           desc:'10 rendez-vous à confirmer par SMS',   priority:'high',   status:'todo',       category:'patient', due: today(), assignedTo:'Secrétaire' },
      { id:2, title:'Classer dossiers patients',        desc:'25 dossiers numérisés à classer',      priority:'medium', status:'inprogress', category:'admin',   due: today(), assignedTo:'Secrétaire' },
      { id:3, title:'Commander fournitures cabinet',    desc:'Papier, stylos, ordonnanciers',        priority:'low',    status:'done',       category:'admin',   due: today(), assignedTo:'Secrétaire' },
      { id:4, title:'Rappel vaccins patients à risque', desc:'Liste de 8 patients à rappeler',       priority:'urgent', status:'todo',       category:'patient', due: today(), assignedTo:'Secrétaire' },
      { id:5, title:'Facturer consultations juillet',   desc:'Export comptabilité mensuelle',        priority:'medium', status:'inprogress', category:'admin',   due: today(), assignedTo:'Secrétaire' },
    ],
    PATIENT: [
      { id:1, title:'Prise de sang à jeun',        desc:'Ordonnance du Dr. Martin – laboratoire Lariboisière', priority:'high',   status:'todo',       category:'medical', due: today(), assignedTo:'Moi' },
      { id:2, title:'Prendre RDV ophtalmologue',   desc:'Renouvellement ordonnance lunettes',                  priority:'medium', status:'inprogress', category:'medical', due: today(), assignedTo:'Moi' },
      { id:3, title:'Acheter médicaments',         desc:'Doliprane 1000mg – renouvellement',                   priority:'low',    status:'done',       category:'medical', due: today(), assignedTo:'Moi' },
    ]
  };
  tasksList = (seeds[role] || []).map((t,i) => ({ ...t, createdAt: new Date(Date.now()-i*3600000).toISOString() }));
}

// ── Login Logic ───────────────────────────────────────────────────────────────
// Demo users (no real API needed when offline)
const DEMO_USERS = {
  'admin@cabinet.fr':     { password:'admin123',     role:'ADMIN',     name:'Sarah Admin',       id:1 },
  'doctor@cabinet.fr':    { password:'doctor123',    role:'DOCTOR',    name:'Dr. David Martin',  id:2 },
  'secretary@cabinet.fr': { password:'secretary123', role:'SECRETARY', name:'Emma Secrétaire',   id:3 },
  'patient@cabinet.fr':   { password:'patient123',   role:'PATIENT',   name:'James Bédard',      id:4 },
};

async function tryLogin(email, password) {
  // Try real API first
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      const data = await res.json();
      return { token: data.token, user: data.user };
    }
  } catch (_) { /* offline – fall through to demo */ }

  // Demo mode
  const demo = DEMO_USERS[email.toLowerCase()];
  if (demo && demo.password === password) {
    return { token: 'demo-token', user: { id: demo.id, name: demo.name, email, role: demo.role } };
  }
  return null;
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = el('login-email').value.trim();
  const pw    = el('login-password').value;
  const errBox = el('login-error');
  const btnText = el('btn-login-text');
  const spinner = el('btn-login-spinner');

  errBox.classList.add('hidden');
  btnText.textContent = 'Connexion…';
  spinner.classList.remove('hidden');

  const result = await tryLogin(email, pw);

  btnText.textContent = 'Se connecter';
  spinner.classList.add('hidden');

  if (!result) {
    errBox.classList.remove('hidden');
    el('login-error-msg').textContent = 'Email ou mot de passe incorrect.';
    return;
  }

  // Save session
  localStorage.setItem('meditask_token', result.token);
  localStorage.setItem('meditask_user',  JSON.stringify(result.user));
  currentUser = result.user;

  // Transition
  launchApp();
});

// Demo quick-fill buttons
document.querySelectorAll('.demo-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    el('login-email').value    = btn.dataset.email;
    el('login-password').value = btn.dataset.pw;
  });
});

function togglePw() {
  const inp = el('login-password');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

// ── App Boot ──────────────────────────────────────────────────────────────────
function launchApp() {
  // Page switch
  el('page-login').classList.remove('active');
  el('page-app').classList.add('active');

  const u = currentUser;
  const cfg = ROLE_CONFIG[u.role];

  // Sidebar user info
  el('sidebar-avatar').textContent    = initials(u.name);
  el('topbar-avatar').textContent     = initials(u.name);
  el('sidebar-name').textContent      = u.name;
  const badge = el('sidebar-role-badge');
  badge.textContent = u.role;
  badge.className = `sidebar-user-role ${u.role}`;

  // Sidebar nav
  buildSidebarNav(cfg.nav);

  // Seed tasks for this role
  seedTasks(u.role);

  // Navigate to dashboard
  navigateTo('dashboard');
}

function buildSidebarNav(nav) {
  const container = el('sidebar-nav');
  container.innerHTML = '';
  nav.forEach(item => {
    if (item.section) {
      const s = document.createElement('div');
      s.className = 'nav-section-title';
      s.textContent = item.section;
      container.appendChild(s);
    } else {
      const a = document.createElement('a');
      a.className = 'nav-item';
      a.dataset.view = item.id;
      a.innerHTML = `${item.icon}<span class="nav-item-label">${item.label}</span>${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}`;
      a.addEventListener('click', () => navigateTo(item.id));
      container.appendChild(a);
    }
  });
}

function navigateTo(view) {
  currentView = view;

  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const active = document.querySelector(`[data-view="${view}"]`);
  if (active) active.classList.add('active');

  // Update topbar
  const titles = {
    dashboard: 'Tableau de bord', tasks: 'Gestion des tâches',
    appointments: 'Agenda & Rendez-vous', patients: 'Dossiers patients',
    users: 'Utilisateurs', reports: 'Rapports', settings: 'Paramètres',
    calls: 'Appels entrants', messages: 'Messages', dictations: 'Dictées médicales',
    documents: 'Mes documents', agenda: 'Agenda', profile: 'Mon profil'
  };
  el('topbar-title').textContent     = titles[view] || view;
  el('topbar-breadcrumb').textContent = `Accueil → ${titles[view] || view}`;

  // Render view
  const container = el('view-container');
  container.innerHTML = '';
  container.style.opacity = '0';

  const renderers = {
    dashboard:    renderDashboard,
    tasks:        renderTasks,
    appointments: renderAppointments,
    patients:     renderPatients,
    users:        renderUsers,
    reports:      renderReports,
    calls:        renderCalls,
    messages:     renderMessages,
    dictations:   renderDictations,
    documents:    renderDocuments,
  };

  const fn = renderers[view] || (() => { container.innerHTML = `<div class="card"><p style="color:var(--text2)">Vue "${view}" en cours de développement…</p></div>`; });
  fn(container);

  requestAnimationFrame(() => {
    container.style.transition = 'opacity 0.3s ease';
    container.style.opacity = '1';
  });
}

// ── Sidebar Toggle ────────────────────────────────────────────────────────────
function toggleSidebar() {
  el('sidebar').classList.toggle('collapsed');
}

// ── Logout ────────────────────────────────────────────────────────────────────
function logout() {
  localStorage.removeItem('meditask_token');
  localStorage.removeItem('meditask_user');
  currentUser = null; tasksList = [];
  el('page-app').classList.remove('active');
  el('page-login').classList.add('active');
  el('login-email').value = '';
  el('login-password').value = '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEWS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Dashboard (per role) ─────────────────────────────────────────────────────
function renderDashboard(c) {
  const role = currentUser.role;
  if (role === 'ADMIN')     renderAdminDashboard(c);
  else if (role === 'DOCTOR')    renderDoctorDashboard(c);
  else if (role === 'SECRETARY') renderSecretaryDashboard(c);
  else                           renderPatientDashboard(c);
}

function renderAdminDashboard(c) {
  c.innerHTML = `
    <div class="welcome-banner">
      <div class="welcome-icon">⚙️</div>
      <div class="welcome-text">
        <h2>Bonjour, ${currentUser.name.split(' ')[0]} !</h2>
        <p>Voici l'état complet du système – ${new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</p>
      </div>
    </div>
    <div class="stats-row">
      ${statCard('👥', '247', 'Patients actifs', 'up', '+12 ce mois', '#6c63ff', 'rgba(108,99,255,0.15)')}
      ${statCard('📅', '38',  'RDV aujourd\'hui', 'up', '+3 vs hier', '#34d399', 'rgba(52,211,153,0.15)')}
      ${statCard('✅', '24',  'Tâches complétées', 'up', 'cette semaine', '#60a5fa', 'rgba(96,165,250,0.15)')}
      ${statCard('⚠️', '5',  'Urgences en cours', 'down', '-2 vs hier', '#ef4444', 'rgba(239,68,68,0.15)')}
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-title">Activité récente <span class="card-link" onclick="navigateTo('reports')">Voir tout →</span></div>
        <div class="activity-feed">
          ${activityItem('Nouveau patient enregistré', 'il y a 5 min')}
          ${activityItem('RDV confirmé – M. Bernard', 'il y a 12 min')}
          ${activityItem('Ordonnance validée – Dr. Martin', 'il y a 23 min')}
          ${activityItem('Message reçu – Mme Dupont', 'il y a 41 min')}
          ${activityItem('Rapport mensuel généré', 'il y a 1h')}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Tâches par statut <span class="card-link" onclick="navigateTo('tasks')">Gérer →</span></div>
        ${progressRow('À faire', tasksList.filter(t=>t.status==='todo').length, tasksList.length, '#ef4444')}
        ${progressRow('En cours', tasksList.filter(t=>t.status==='inprogress').length, tasksList.length, '#fbbf24')}
        ${progressRow('Terminées', tasksList.filter(t=>t.status==='done').length, tasksList.length, '#34d399')}
      </div>
    </div>`;
}

function renderDoctorDashboard(c) {
  c.innerHTML = `
    <div class="welcome-banner">
      <div class="welcome-icon">🩺</div>
      <div class="welcome-text">
        <h2>Bonjour, ${currentUser.name} !</h2>
        <p>${new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} – 6 consultations prévues</p>
      </div>
    </div>
    <div class="stats-row">
      ${statCard('📅', '6',   'Consultations du jour', 'up', '+1 urgence', '#34d399', 'rgba(52,211,153,0.15)')}
      ${statCard('✍️', '3',   'Comptes-rendus à rédiger', 'down', 'en attente', '#fb923c', 'rgba(251,146,60,0.15)')}
      ${statCard('💊', '12',  'Ordonnances signées', 'up', 'cette semaine', '#6c63ff', 'rgba(108,99,255,0.15)')}
      ${statCard('🎤', '2',   'Dictées en attente', 'down', 'depuis hier', '#f9a825', 'rgba(249,168,37,0.15)')}
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-title">Prochains patients <span class="card-link" onclick="navigateTo('appointments')">Agenda →</span></div>
        <div class="appt-list">
          ${apptItem('09:00','Marie Dupont','Consultation générale','confirmed')}
          ${apptItem('10:30','Jean Bernard','Suivi cardiologique','confirmed')}
          ${apptItem('11:00','Sophie Martin','Renouvellement ordonnance','pending')}
          ${apptItem('14:00','Paul Leroy','Urgence – douleurs thoraciques','confirmed')}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Mes tâches urgentes <span class="card-link" onclick="navigateTo('tasks')">Voir tout →</span></div>
        <div class="task-cards">
          ${tasksList.filter(t=>t.priority==='urgent'||t.priority==='high').slice(0,3).map(t => miniTaskCard(t)).join('')}
        </div>
      </div>
    </div>`;
}

function renderSecretaryDashboard(c) {
  c.innerHTML = `
    <div class="welcome-banner">
      <div class="welcome-icon">📋</div>
      <div class="welcome-text">
        <h2>Bonjour, ${currentUser.name.split(' ')[0]} !</h2>
        <p>${new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} – Journée chargée !</p>
      </div>
    </div>
    <div class="stats-row">
      ${statCard('📞', '8',   'Appels en attente', 'down', '3 rappels urgents', '#ef4444', 'rgba(239,68,68,0.15)')}
      ${statCard('📅', '32',  'RDV aujourd\'hui', 'up', '+4 vs hier', '#34d399', 'rgba(52,211,153,0.15)')}
      ${statCard('💬', '15',  'Messages non lus', 'up', 'depuis hier', '#6c63ff', 'rgba(108,99,255,0.15)')}
      ${statCard('📂', '6',   'Dossiers à traiter', 'down', 'en attente', '#f9a825', 'rgba(249,168,37,0.15)')}
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-title">RDV du jour <span class="card-link" onclick="navigateTo('appointments')">Agenda complet →</span></div>
        <div class="appt-list">
          ${apptItem('08:30','Pierre Moreau','Consultation générale','confirmed')}
          ${apptItem('09:15','Alice Girard','Dermatologie','pending')}
          ${apptItem('10:00','Robert Blanc','Suivi diabète','confirmed')}
          ${apptItem('10:45','Lucie Petit','Bilan sanguin','confirmed')}
          ${apptItem('11:30','Marc Dubois','Cardiologie','cancelled')}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Mes tâches <span class="card-link" onclick="navigateTo('tasks')">Voir tout →</span></div>
        <div class="task-cards">
          ${tasksList.slice(0,3).map(t => miniTaskCard(t)).join('')}
        </div>
        <button class="btn-primary" style="width:100%;margin-top:0.8rem;justify-content:center" onclick="openTaskModal()">
          ${iconPlus()} Nouvelle tâche
        </button>
      </div>
    </div>`;
}

function renderPatientDashboard(c) {
  c.innerHTML = `
    <div class="welcome-banner">
      <div class="welcome-icon">👤</div>
      <div class="welcome-text">
        <h2>Bonjour, ${currentUser.name.split(' ')[0]} !</h2>
        <p>Votre espace santé – ${new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</p>
      </div>
    </div>
    <div class="stats-row">
      ${statCard('📅', '2', 'Prochains RDV', 'up', 'cette semaine', '#34d399', 'rgba(52,211,153,0.15)')}
      ${statCard('💊', '3', 'Ordonnances actives', '', '', '#6c63ff', 'rgba(108,99,255,0.15)')}
      ${statCard('📄', '5', 'Documents disponibles', '', '', '#60a5fa', 'rgba(96,165,250,0.15)')}
      ${statCard('✅', '1', 'Tâche santé en cours', '', '', '#f9a825', 'rgba(249,168,37,0.15)')}
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-title">Mes prochains rendez-vous <span class="card-link" onclick="navigateTo('appointments')">Voir tout →</span></div>
        <div class="appt-list">
          ${apptItem('14/08 – 10h00','Dr. Martin','Consultation de suivi','confirmed')}
          ${apptItem('22/08 – 09h30','Dr. Leblanc','Ophtalmologie','pending')}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Mes tâches santé <span class="card-link" onclick="navigateTo('tasks')">Voir tout →</span></div>
        <div class="task-cards">
          ${tasksList.map(t => miniTaskCard(t)).join('')}
        </div>
      </div>
    </div>`;
}

// ── Task Kanban ───────────────────────────────────────────────────────────────
function renderTasks(c) {
  const todo       = tasksList.filter(t=>t.status==='todo');
  const inprogress = tasksList.filter(t=>t.status==='inprogress');
  const done       = tasksList.filter(t=>t.status==='done');

  c.innerHTML = `
    <div class="view-header">
      <div class="view-header-left">
        <h1>Gestion des tâches</h1>
        <p>${tasksList.length} tâche(s) au total · ${done.length} terminée(s)</p>
      </div>
      <button class="btn-primary" onclick="openTaskModal()">
        ${iconPlus()} Nouvelle tâche
      </button>
    </div>
    <div class="kanban-board">
      ${kanbanCol('📋 À faire', 'todo', todo, '#ef4444')}
      ${kanbanCol('⚡ En cours', 'inprogress', inprogress, '#fbbf24')}
      ${kanbanCol('✅ Terminées', 'done', done, '#34d399')}
    </div>`;
}

function kanbanCol(title, status, tasks, dotColor) {
  return `
    <div class="kanban-col">
      <div class="kanban-col-header">
        <div class="kanban-col-title">
          <span class="col-dot" style="background:${dotColor}"></span>${title}
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="kanban-count">${tasks.length}</span>
          <button class="kanban-add-btn" onclick="openTaskModal('${status}')">+</button>
        </div>
      </div>
      <div class="task-cards" id="col-${status}">
        ${tasks.map(t => fullTaskCard(t)).join('') || '<p style="color:var(--text3);font-size:0.8rem;text-align:center;padding:1rem">Aucune tâche</p>'}
      </div>
    </div>`;
}

function fullTaskCard(t) {
  const colors = { low:'#34d399', medium:'#fbbf24', high:'#fb923c', urgent:'#ef4444' };
  const color = colors[t.priority] || '#6c63ff';
  return `
    <div class="task-card" style="--priority-color:${color}" onclick="openTaskModal(null,'${t.id}')">
      <div class="task-card-title">${t.title}</div>
      <div class="task-card-desc">${t.desc}</div>
      <div class="task-card-meta">
        <span class="priority-badge priority-${t.priority}">${t.priority}</span>
        <span class="task-date">${fmtDate(t.due)}</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:0.55rem">
        <div style="display:flex;align-items:center;gap:5px">
          <div class="patient-avatar" style="width:22px;height:22px;font-size:0.6rem;background:${randomColor(t.assignedTo||'A')}">${initials(t.assignedTo||'?')}</div>
          <span style="font-size:0.73rem;color:var(--text2)">${t.assignedTo||'—'}</span>
        </div>
        <button onclick="event.stopPropagation();deleteTask(${t.id})" style="color:var(--text3);font-size:0.75rem;padding:2px 6px;border-radius:4px;transition:color 0.2s" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='var(--text3)'">✕</button>
      </div>
    </div>`;
}

function miniTaskCard(t) {
  const colors = { low:'#34d399', medium:'#fbbf24', high:'#fb923c', urgent:'#ef4444' };
  const color = colors[t.priority] || '#6c63ff';
  return `
    <div class="task-card" style="--priority-color:${color};cursor:pointer" onclick="navigateTo('tasks')">
      <div class="task-card-title">${t.title}</div>
      <div class="task-card-meta">
        <span class="priority-badge priority-${t.priority}">${t.priority}</span>
        <span class="task-date">${fmtDate(t.due)}</span>
      </div>
    </div>`;
}

// ── Appointments ──────────────────────────────────────────────────────────────
function renderAppointments(c) {
  c.innerHTML = `
    <div class="view-header">
      <div class="view-header-left">
        <h1>Agenda & Rendez-vous</h1>
        <p>${new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
      </div>
      <button class="btn-primary">${iconPlus()} Nouveau RDV</button>
    </div>
    <div class="card">
      <div class="card-title">Rendez-vous du jour</div>
      <div class="appt-list">
        ${apptItem('08:30','Pierre Moreau','Consultation générale','confirmed')}
        ${apptItem('09:15','Alice Girard','Dermatologie','pending')}
        ${apptItem('10:00','Robert Blanc','Suivi diabète','confirmed')}
        ${apptItem('10:45','Lucie Petit','Bilan sanguin','confirmed')}
        ${apptItem('11:30','Marc Dubois','Cardiologie','cancelled')}
        ${apptItem('14:00','Sophie Laurent','Gynécologie','confirmed')}
        ${apptItem('15:30','Henri Durand','Neurologie','pending')}
      </div>
    </div>`;
}

// ── Patients ──────────────────────────────────────────────────────────────────
function renderPatients(c) {
  const patients = [
    { name:'Marie Dupont',  phone:'+33 6 12 34 56 78', since:'Jan 2024', color:'#6c63ff' },
    { name:'Jean Bernard',  phone:'+33 6 98 76 54 32', since:'Mars 2023', color:'#34d399' },
    { name:'Sophie Martin', phone:'+33 6 55 44 33 22', since:'Avr 2024', color:'#f9a825' },
    { name:'Paul Leroy',    phone:'+33 6 11 22 33 44', since:'Fév 2022', color:'#60a5fa' },
    { name:'Lucie Petit',   phone:'+33 6 77 88 99 00', since:'Juil 2024', color:'#f472b6' },
    { name:'Marc Dubois',   phone:'+33 6 44 55 66 77', since:'Oct 2023', color:'#fb923c' },
  ];
  c.innerHTML = `
    <div class="view-header">
      <div class="view-header-left">
        <h1>Dossiers patients</h1>
        <p>${patients.length} patients enregistrés</p>
      </div>
      <button class="btn-primary">${iconPlus()} Nouveau patient</button>
    </div>
    <div class="card">
      <div class="patient-list">
        ${patients.map(p=>`
          <div class="patient-item">
            <div class="patient-avatar" style="background:${p.color}">${initials(p.name)}</div>
            <div class="patient-info">
              <div class="patient-name">${p.name}</div>
              <div class="patient-phone">${p.phone}</div>
            </div>
            <span class="patient-since">depuis ${p.since}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

// ── Users (Admin only) ────────────────────────────────────────────────────────
function renderUsers(c) {
  const users = [
    { name:'Dr. David Martin',  email:'doctor@cabinet.fr',    role:'DOCTOR',    color:'#34d399' },
    { name:'Emma Secrétaire',   email:'secretary@cabinet.fr', role:'SECRETARY', color:'#60a5fa' },
    { name:'Sarah Admin',       email:'admin@cabinet.fr',     role:'ADMIN',     color:'#a78bfa' },
    { name:'James Bédard',      email:'patient@cabinet.fr',   role:'PATIENT',   color:'#f9a825' },
  ];
  const roleColors = { ADMIN:'#a78bfa', DOCTOR:'#34d399', SECRETARY:'#60a5fa', PATIENT:'#f9a825' };
  c.innerHTML = `
    <div class="view-header">
      <div class="view-header-left"><h1>Utilisateurs</h1><p>${users.length} comptes actifs</p></div>
      <button class="btn-primary">${iconPlus()} Ajouter un utilisateur</button>
    </div>
    <div class="card">
      <div class="patient-list">
        ${users.map(u=>`
          <div class="patient-item">
            <div class="patient-avatar" style="background:${u.color}">${initials(u.name)}</div>
            <div class="patient-info">
              <div class="patient-name">${u.name}</div>
              <div class="patient-phone">${u.email}</div>
            </div>
            <span class="sidebar-user-role ${u.role}" style="font-size:0.7rem;padding:3px 9px;border-radius:20px;font-weight:700">${u.role}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

// ── Reports ───────────────────────────────────────────────────────────────────
function renderReports(c) {
  c.innerHTML = `
    <div class="view-header">
      <div class="view-header-left"><h1>Rapports</h1><p>Statistiques et analyses</p></div>
      <button class="btn-primary">📥 Exporter CSV</button>
    </div>
    <div class="stats-row">
      ${statCard('📅','247','RDV ce mois','up','+18% vs mois dernier','#6c63ff','rgba(108,99,255,0.15)')}
      ${statCard('👥','38','Nouveaux patients','up','+5','#34d399','rgba(52,211,153,0.15)')}
      ${statCard('💰','12 480€','Chiffre d\'affaires','up','+9%','#f9a825','rgba(249,168,37,0.15)')}
      ${statCard('⭐','4.8','Satisfaction patient','up','+0.2','#60a5fa','rgba(96,165,250,0.15)')}
    </div>
    <div class="card">
      <div class="card-title">Répartition par statut</div>
      ${progressRow('Confirmés', 80, 100, '#34d399')}
      ${progressRow('En attente', 12, 100, '#fbbf24')}
      ${progressRow('Annulés', 8, 100, '#ef4444')}
    </div>`;
}

// ── Calls ─────────────────────────────────────────────────────────────────────
function renderCalls(c) {
  c.innerHTML = `
    <div class="view-header">
      <div class="view-header-left"><h1>Appels entrants</h1><p>3 appels en attente de rappel</p></div>
    </div>
    <div class="card">
      <div class="appt-list">
        ${apptItem('09:12','Mme Bernard','Demande de RDV urgent','pending')}
        ${apptItem('10:05','M. Garnier','Question ordonnance','confirmed')}
        ${apptItem('11:30','Mme Fontaine','Annulation RDV demain','cancelled')}
      </div>
    </div>`;
}

// ── Messages ──────────────────────────────────────────────────────────────────
function renderMessages(c) {
  c.innerHTML = `
    <div class="view-header">
      <div class="view-header-left"><h1>Messages</h1><p>15 messages non lus</p></div>
      <button class="btn-primary">${iconPlus()} Nouveau message</button>
    </div>
    <div class="card">
      <div class="activity-feed">
        ${activityItem('Mme Dupont : "Bonjour, puis-je avoir un RDV urgent ?"', 'il y a 10 min')}
        ${activityItem('M. Leroy : "Merci pour l\'ordonnance reçue."', 'il y a 25 min')}
        ${activityItem('Cabinet Ophtalmologie : "Confirmation RDV Dr. Laurent"', 'il y a 1h')}
        ${activityItem('CPAM : "Nouvelles modalités de remboursement"', 'il y a 2h')}
      </div>
    </div>`;
}

// ── Dictations ────────────────────────────────────────────────────────────────
function renderDictations(c) {
  c.innerHTML = `
    <div class="view-header">
      <div class="view-header-left"><h1>Dictées médicales</h1><p>2 dictées en attente</p></div>
      <button class="btn-primary">🎤 Nouvelle dictée</button>
    </div>
    <div class="card">
      <div class="activity-feed">
        ${activityItem('M. Dupont – Compte-rendu cardiologique (en cours de traitement)', 'Hier 18:30')}
        ${activityItem('Mme Martin – Note de consultation (transcription prête)', 'Aujourd\'hui 09:00')}
      </div>
    </div>`;
}

// ── Documents ─────────────────────────────────────────────────────────────────
function renderDocuments(c) {
  c.innerHTML = `
    <div class="view-header">
      <div class="view-header-left"><h1>Mes documents</h1><p>5 documents disponibles</p></div>
    </div>
    <div class="card">
      <div class="activity-feed">
        ${activityItem('📄 Ordonnance – Dr. Martin – 12/08/2026', 'Télécharger')}
        ${activityItem('📋 Résultats analyse sanguine – 05/08/2026', 'Télécharger')}
        ${activityItem('🧾 Facture consultation – 02/08/2026', 'Télécharger')}
        ${activityItem('📝 Compte-rendu de consultation – 28/07/2026', 'Télécharger')}
        ${activityItem('💊 Prescription médicaments – 10/07/2026', 'Télécharger')}
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK MODAL
// ═══════════════════════════════════════════════════════════════════════════════
let editStatus = 'todo';

function openTaskModal(status, taskId) {
  editingTask = null;
  editStatus  = status || 'todo';
  el('modal-title').textContent = 'Nouvelle tâche';
  el('task-title-input').value    = '';
  el('task-desc-input').value     = '';
  el('task-priority-input').value = 'medium';
  el('task-due-input').value      = today();
  el('task-category-input').value = 'admin';

  if (taskId) {
    const t = tasksList.find(x=>x.id==taskId);
    if (t) {
      editingTask = t;
      el('modal-title').textContent     = 'Modifier la tâche';
      el('task-title-input').value      = t.title;
      el('task-desc-input').value       = t.desc;
      el('task-priority-input').value   = t.priority;
      el('task-due-input').value        = t.due || today();
      el('task-category-input').value   = t.category;
    }
  }
  el('task-modal-overlay').classList.remove('hidden');
}

function closeTaskModal(e) {
  if (e && e.target !== el('task-modal-overlay')) return;
  el('task-modal-overlay').classList.add('hidden');
}

function saveTask() {
  const title = el('task-title-input').value.trim();
  if (!title) { el('task-title-input').style.borderColor='#ef4444'; return; }
  el('task-title-input').style.borderColor = '';

  if (editingTask) {
    editingTask.title    = title;
    editingTask.desc     = el('task-desc-input').value;
    editingTask.priority = el('task-priority-input').value;
    editingTask.due      = el('task-due-input').value;
    editingTask.category = el('task-category-input').value;
  } else {
    tasksList.push({
      id:         Date.now(),
      title,
      desc:       el('task-desc-input').value,
      priority:   el('task-priority-input').value,
      status:     editStatus,
      category:   el('task-category-input').value,
      due:        el('task-due-input').value,
      assignedTo: currentUser.name,
      createdAt:  new Date().toISOString()
    });
  }

  el('task-modal-overlay').classList.add('hidden');
  navigateTo('tasks');
}

function deleteTask(id) {
  tasksList = tasksList.filter(t=>t.id!==id);
  navigateTo('tasks');
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════
function statCard(icon, value, label, dir, change, color, bg) {
  return `
    <div class="stat-card" style="--stat-color:${color};--stat-bg:${bg}">
      <div class="stat-icon">${icon}</div>
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
      ${change ? `<div class="stat-change ${dir}">${dir==='up'?'↑':'↓'} ${change}</div>` : ''}
    </div>`;
}

function apptItem(time, name, type, status) {
  const labels = { confirmed:'Confirmé', pending:'En attente', cancelled:'Annulé' };
  return `
    <div class="appt-item">
      <div class="appt-time">${time}</div>
      <div class="appt-info">
        <div class="appt-name">${name}</div>
        <div class="appt-type">${type}</div>
      </div>
      <span class="appt-status status-${status}">${labels[status]||status}</span>
    </div>`;
}

function activityItem(text, time) {
  return `
    <div class="activity-item">
      <div class="activity-dot"></div>
      <div>
        <div class="activity-text">${text}</div>
        <div class="activity-time">${time}</div>
      </div>
    </div>`;
}

function progressRow(label, value, total, color) {
  const pct = total > 0 ? Math.round((value/total)*100) : 0;
  return `
    <div style="margin-bottom:0.8rem">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:0.82rem;color:var(--text2)">${label}</span>
        <span style="font-size:0.82rem;font-weight:700">${value}</span>
      </div>
      <div class="progress-wrap">
        <div class="progress-bar-wrap">
          <div class="progress-bar" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="progress-pct">${pct}%</span>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-LOGIN (session restore)
// ═══════════════════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  const storedUser  = localStorage.getItem('meditask_user');
  const storedToken = localStorage.getItem('meditask_token');
  if (storedUser && storedToken) {
    try {
      currentUser = JSON.parse(storedUser);
      launchApp();
    } catch (_) { /* invalid session */ }
  }

  // Keyboard shortcut: Escape closes modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') el('task-modal-overlay').classList.add('hidden');
  });

  // Search filter on tasks view
  el('global-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    if (currentView === 'tasks') {
      document.querySelectorAll('.task-card').forEach(card => {
        const title = card.querySelector('.task-card-title')?.textContent?.toLowerCase() || '';
        card.style.display = title.includes(q) ? '' : 'none';
      });
    }
  });
});
