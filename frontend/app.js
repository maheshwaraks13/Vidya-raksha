/**
 * VidyaRaksha — Frontend Application Logic
 * Connects to Flask backend API with JWT authentication
 */

// ═══════════════════ CONFIG ═══════════════════
const API_BASE = window.location.origin + '/api';
let AUTH_TOKEN = localStorage.getItem('vr_token') || '';
let CURRENT_USER = JSON.parse(localStorage.getItem('vr_user') || 'null');
let studentsCache = [];
let schemesCache = [];

const demoUsers = [
  { username: 'admin', password: 'admin123', full_name: 'System Administrator', email: 'admin@vidyaraksha.gov', role: 'Administrator' },
  { username: 'teacher', password: 'teacher123', full_name: 'Rajesh Kumar', email: 'rkumar@school.edu.in', role: 'Senior Teacher' },
  { username: 'officer', password: 'officer123', full_name: 'Suhani Verma', email: 'sverma@deo.gov.in', role: 'Education Officer' }
];

// ═══════════════════ API HELPER ═══════════════════
async function api(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    const data = await res.json();
    if (res.status === 401) { handleLogout(); return null; }
    return data;
  } catch (e) {
    console.warn('API unavailable, will check local demo users');
    return null;
  }
}

// ═══════════════════ AUTH ═══════════════════
async function handleRegister(e) {
  e.preventDefault();
  const full_name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const username = document.getElementById('reg-user').value;
  const password = document.getElementById('reg-pass').value;
  const role = document.getElementById('reg-role').value;
  
  const el = document.getElementById('reg-error');
  el.style.display = 'none';
  
  const data = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ full_name, email, username, password, role })
  });
  
  if (data && data.message) {
    alert('Registration successful! Please login.');
    document.getElementById('register-view').style.display = 'none';
    document.getElementById('login-view').style.display = 'block';
    document.getElementById('login-user').value = username;
    document.getElementById('login-pass').value = password;
  } else {
    // Local registration simulation
    alert('Backend offline. Demo account created locally for this session.');
    demoUsers.push({ username, password, full_name, email, role });
    document.getElementById('register-view').style.display = 'none';
    document.getElementById('login-view').style.display = 'block';
    document.getElementById('login-user').value = username;
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-user').value;
  const password = document.getElementById('login-pass').value;
  const role = document.getElementById('login-role')?.value || 'Guest';
  
  const data = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  
  if (data && data.access_token) {
    loginSuccess(data.access_token, data.user);
  } else {
    // Check demo users
    const user = demoUsers.find(u => u.username === username && u.password === password);
    if (user) {
      console.info('Logging in via Demo Account');
      loginSuccess('simulated-jwt-token', user, true);
    } else if (username && password) {
      // Auto-create session for any other credentials
      console.info('Logging in via Auto-Guest Mode');
      const guestUser = {
        username: username,
        full_name: username.charAt(0).toUpperCase() + username.slice(1),
        email: `${username}@vidyaraksha.local`,
        role: role.charAt(0).toUpperCase() + role.slice(1)
      };
      loginSuccess('simulated-guest-token', guestUser, true);
    } else {
      const el = document.getElementById('login-error');
      el.textContent = 'Please enter both username and password.';
      el.style.display = 'block';
    }
  }
}

function loginSuccess(token, user, isSimulated = false) {
  AUTH_TOKEN = token;
  CURRENT_USER = user;
  localStorage.setItem('vr_token', AUTH_TOKEN);
  localStorage.setItem('vr_user', JSON.stringify(CURRENT_USER));
  
  document.getElementById('login-overlay').classList.add('hidden');
  const nameEl = document.getElementById('topbar-name');
  if (nameEl) nameEl.textContent = CURRENT_USER.full_name;
  
  const avatarEl = document.getElementById('topbar-avatar');
  if (avatarEl) avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(CURRENT_USER.full_name)}&background=4f46e5&color=fff&rounded=true`;
  
  if (document.getElementById('dropdown-name')) document.getElementById('dropdown-name').textContent = CURRENT_USER.full_name;
  if (document.getElementById('dropdown-email')) document.getElementById('dropdown-email').textContent = CURRENT_USER.email;
  if (document.getElementById('dropdown-role')) {
    document.getElementById('dropdown-role').textContent = isSimulated ? `${CURRENT_USER.role} (Simulation)` : CURRENT_USER.role;
    document.getElementById('dropdown-role').className = isSimulated ? 'badge badge-yellow' : 'badge badge-green';
  }
  
  loadDashboardData();
}

function handleLogout() {
  AUTH_TOKEN = '';
  CURRENT_USER = null;
  localStorage.removeItem('vr_token');
  localStorage.removeItem('vr_user');
  document.getElementById('login-overlay').classList.remove('hidden');
}

function enterOfflineMode() {
  // This is now handled by handleLogin, but kept for auto-login logic
  handleLogout();
}

function toggleProfileDropdown(e) {
  e.stopPropagation();
  const menu = document.getElementById('profile-dropdown');
  if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

document.addEventListener('click', () => {
  const menu = document.getElementById('profile-dropdown');
  if (menu) menu.style.display = 'none';
});

// ═══════════════════ NAV ═══════════════════
const pageTitles = {
  dashboard:'Dashboard Overview', students:'Student Registry', predict:'Predict Dropout Risk',
  alerts:'SMS Alert Log', schemes:'Government Schemes', upload:'Upload Data', 'add-student':'Add New Student', about:'About This Project'
};

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.getElementById('page-title').textContent = pageTitles[id];
  const map = ['dashboard','students','predict','alerts','schemes','upload','add-student','about'];
  const items = document.querySelectorAll('.nav-item');
  const idx = map.indexOf(id);
  if (idx >= 0 && items[idx]) items[idx].classList.add('active');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ═══════════════════ OFFLINE DATA ═══════════════════
const offlineStudents = [
  { id:1,student_id:'S001',name:'Priya Sharma',grade:8,attendance_percentage:41,exam_scores:35,distance_to_school:9,family_income:6500,parent_education_level:0,health_issues:true,internet_access:false,previous_failures:2,parent_occupation:0,gender:'F',dropout_risk_score:0,risk_level:'Low' },
  { id:2,student_id:'S002',name:'Rajan Kumar',grade:9,attendance_percentage:62,exam_scores:52,distance_to_school:5,family_income:9000,parent_education_level:1,health_issues:false,internet_access:false,previous_failures:1,parent_occupation:1,gender:'M',dropout_risk_score:0,risk_level:'Low' },
  { id:3,student_id:'S003',name:'Anita Desai',grade:7,attendance_percentage:78,exam_scores:68,distance_to_school:3,family_income:14000,parent_education_level:2,health_issues:false,internet_access:true,previous_failures:0,parent_occupation:2,gender:'F',dropout_risk_score:0,risk_level:'Low' },
  { id:4,student_id:'S004',name:'Mohan Yadav',grade:10,attendance_percentage:44,exam_scores:31,distance_to_school:12,family_income:5500,parent_education_level:0,health_issues:true,internet_access:false,previous_failures:3,parent_occupation:0,gender:'M',dropout_risk_score:0,risk_level:'Low' },
  { id:5,student_id:'S005',name:'Sunita Patel',grade:8,attendance_percentage:55,exam_scores:48,distance_to_school:7,family_income:8000,parent_education_level:1,health_issues:false,internet_access:false,previous_failures:1,parent_occupation:1,gender:'F',dropout_risk_score:0,risk_level:'Low' },
  { id:6,student_id:'S006',name:'Deepak Nair',grade:9,attendance_percentage:88,exam_scores:75,distance_to_school:2,family_income:20000,parent_education_level:3,health_issues:false,internet_access:true,previous_failures:0,parent_occupation:3,gender:'M',dropout_risk_score:0,risk_level:'Low' },
  { id:7,student_id:'S007',name:'Kavya Reddy',grade:7,attendance_percentage:38,exam_scores:28,distance_to_school:14,family_income:4500,parent_education_level:0,health_issues:true,internet_access:false,previous_failures:2,parent_occupation:0,gender:'F',dropout_risk_score:0,risk_level:'Low' },
  { id:8,student_id:'S008',name:'Arjun Singh',grade:10,attendance_percentage:70,exam_scores:61,distance_to_school:4,family_income:12000,parent_education_level:2,health_issues:false,internet_access:true,previous_failures:0,parent_occupation:2,gender:'M',dropout_risk_score:0,risk_level:'Low' },
  { id:9,student_id:'S009',name:'Meera Iyer',grade:8,attendance_percentage:42,exam_scores:33,distance_to_school:11,family_income:6000,parent_education_level:0,health_issues:true,internet_access:false,previous_failures:2,parent_occupation:1,gender:'F',dropout_risk_score:0,risk_level:'Low' },
  { id:10,student_id:'S010',name:'Vikas Sharma',grade:9,attendance_percentage:65,exam_scores:58,distance_to_school:6,family_income:11000,parent_education_level:1,health_issues:false,internet_access:false,previous_failures:1,parent_occupation:1,gender:'M',dropout_risk_score:0,risk_level:'Low' },
  { id:11,student_id:'S011',name:'Pooja Gupta',grade:7,attendance_percentage:82,exam_scores:71,distance_to_school:3,family_income:18000,parent_education_level:2,health_issues:false,internet_access:true,previous_failures:0,parent_occupation:3,gender:'F',dropout_risk_score:0,risk_level:'Low' },
  { id:12,student_id:'S012',name:'Suresh Babu',grade:10,attendance_percentage:39,exam_scores:30,distance_to_school:15,family_income:5000,parent_education_level:0,health_issues:true,internet_access:false,previous_failures:3,parent_occupation:0,gender:'M',dropout_risk_score:0,risk_level:'Low' },
];

const offlineSchemes = [
  { icon:'🎓', scheme_name:'Pre-Matric Scholarship', ministry:'Ministry of Education', description:'Financial support for SC/ST/OBC students from low-income families' },
  { icon:'🚲', scheme_name:'Free Bicycle Scheme', ministry:'State Government', description:'Free bicycles for students living more than 3km from school' },
  { icon:'🍱', scheme_name:'Mid-Day Meal Programme', ministry:'Ministry of Education', description:'Free nutritious lunch to all children in government schools' },
  { icon:'👧', scheme_name:'Beti Bachao Beti Padhao', ministry:'Government of India', description:'Supports education and welfare of the girl child' },
  { icon:'🏥', scheme_name:'Rashtriya Bal Swasthya Karyakram', ministry:'Ministry of Health', description:'Free health screenings and treatment for school children' },
  { icon:'📚', scheme_name:'Kasturba Gandhi Balika Vidyalaya', ministry:'Ministry of Education', description:'Residential schools for girls from marginalized communities' },
  { icon:'💻', scheme_name:'PM eVidya', ministry:'Ministry of Education', description:'Digital learning resources and online education access' },
  { icon:'🏠', scheme_name:'Samagra Shiksha Abhiyan', ministry:'Ministry of Education', description:'Holistic school improvement including transport support' },
  { icon:'💰', scheme_name:'National Means-cum-Merit Scholarship', ministry:'Ministry of Education', description:'Merit-based scholarships for students from economically weaker sections' },
];

// ═══════════════════ RISK COMPUTATION ═══════════════════
function computeRisk(s) {
  const att = s.attendance_percentage || s.attendance || 0;
  const sc = s.exam_scores || s.score || 0;
  const dist = s.distance_to_school || s.distance || 0;
  const inc = s.family_income || s.income || 0;
  const edu = s.parent_education_level || s.parentEdu || 0;
  const health = s.health_issues ? 1 : (s.health || 0);
  const inet = s.internet_access ? 1 : (s.internet || 0);
  const fail = s.previous_failures || s.failures || 0;
  
  let score = 0;
  score += Math.max(0, (75 - att)) / 75 * 0.30;
  score += Math.max(0, (60 - sc)) / 60 * 0.25;
  score += Math.min(dist / 20, 1) * 0.10;
  score += Math.max(0, (15000 - inc)) / 15000 * 0.15;
  score += Math.max(0, (2 - edu)) / 2 * 0.08;
  score += health * 0.05;
  score += (1 - inet) * 0.04;
  score += Math.min(fail / 3, 1) * 0.03;
  return Math.min(Math.max(score, 0), 1);
}

function riskLevel(score) { return score >= 0.65 ? 'High' : score >= 0.35 ? 'Medium' : 'Low'; }
function riskColor(level) { return level === 'High' ? 'var(--accent)' : level === 'Medium' ? '#b5810a' : 'var(--accent2)'; }

// ═══════════════════ DATA LOADING ═══════════════════
async function loadDashboardData() {
  // Try API first
  const statsData = await api('/students/statistics');
  const alertStats = await api('/alerts/statistics');
  
  if (statsData) {
    const h = statsData.high_risk, m = statsData.medium_risk, l = statsData.low_risk, t = statsData.total_students;
    document.getElementById('stat-high').textContent = h;
    document.getElementById('stat-med').textContent = m;
    document.getElementById('stat-low').textContent = l;
    document.getElementById('stat-sms').textContent = alertStats ? alertStats.this_month : '—';
    document.getElementById('high-count').textContent = h;
    document.getElementById('med-count').textContent = m;
    document.getElementById('total-badge').textContent = `${t} students`;
    document.getElementById('stat-low-pct').textContent = t > 0 ? `${Math.round(l/t*100)}% of total` : '';
    initCharts(h, m, l, statsData.school_breakdown || []);
  } else {
    loadOfflineData();
  }
  
  // Load students
  const studData = await api('/students/?per_page=200');
  if (studData && studData.students) {
    studentsCache = studData.students;
  } else {
    studentsCache = offlineStudents.map(s => {
      const rs = computeRisk(s);
      return { ...s, dropout_risk_score: Math.round(rs * 100), risk_level: riskLevel(rs) };
    });
  }
  renderTable(studentsCache);
  
  // Load schemes
  const schData = await api('/schemes/');
  schemesCache = (schData && schData.schemes) ? schData.schemes : offlineSchemes;
  renderSchemes();
  
  // Load alerts
  const alertData = await api('/alerts/?per_page=10');
  if (alertData && alertData.alerts) renderAlertsFromAPI(alertData.alerts);
  else renderOfflineAlerts();
  
  renderGlobalSHAP();
  renderArchSteps();
}

function loadOfflineData() {
  studentsCache = offlineStudents.map(s => {
    const rs = computeRisk(s);
    return { ...s, dropout_risk_score: Math.round(rs * 100), risk_level: riskLevel(rs) };
  });
  const h = studentsCache.filter(s => s.risk_level === 'High').length;
  const m = studentsCache.filter(s => s.risk_level === 'Medium').length;
  const l = studentsCache.filter(s => s.risk_level === 'Low').length;
  
  document.getElementById('stat-high').textContent = h;
  document.getElementById('stat-med').textContent = m;
  document.getElementById('stat-low').textContent = l;
  document.getElementById('stat-sms').textContent = '—';
  document.getElementById('high-count').textContent = h;
  document.getElementById('med-count').textContent = m;
  document.getElementById('total-badge').textContent = studentsCache.length + ' students';
  
  renderTable(studentsCache);
  schemesCache = offlineSchemes;
  renderSchemes();
  renderOfflineAlerts();
  renderGlobalSHAP();
  renderArchSteps();
  initCharts(h, m, l, []);
}

// ═══════════════════ TABLE ═══════════════════
function renderTable(data) {
  const tbody = document.getElementById('student-tbody');
  document.getElementById('student-count-label').textContent = `${data.length} students · Click Predict to analyze`;
  tbody.innerHTML = data.map(s => {
    const pct = Math.round(s.dropout_risk_score);
    const level = s.risk_level || riskLevel(pct / 100);
    const att = s.attendance_percentage;
    const fillClass = level === 'High' ? 'fill-red' : level === 'Medium' ? 'fill-yellow' : 'fill-green';
    return `<tr>
      <td><strong style="font-size:13.5px">${s.name}</strong><br><span style="font-size:11.5px;color:var(--muted)">${s.student_id}</span></td>
      <td>Grade ${s.grade}</td>
      <td><div style="display:flex;align-items:center;gap:8px"><span style="font-weight:500;font-size:13px;color:${att<50?'var(--accent)':'inherit'}">${att}%</span><div class="progress-bar"><div class="progress-fill ${att<50?'fill-red':att<70?'fill-yellow':'fill-green'}" style="width:${att}%"></div></div></div></td>
      <td>${s.exam_scores}/100</td>
      <td>${s.distance_to_school} km</td>
      <td>₹${Number(s.family_income).toLocaleString()}/mo</td>
      <td><div style="display:flex;align-items:center;gap:7px"><span style="font-family:'DM Mono',monospace;font-size:12px;color:${riskColor(level)};font-weight:500">${pct}%</span><div class="progress-bar"><div class="progress-fill ${fillClass}" style="width:${pct}%"></div></div></div></td>
      <td><span class="risk-pill risk-${level.toLowerCase()}">${level}</span></td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline btn-sm" onclick='loadStudentPredict(${JSON.stringify(s).replace(/'/g,"&#39;")})'>Predict →</button>
          <button class="btn btn-outline btn-sm" style="color:#ef4444;border-color:var(--border);padding:7px;min-width:32px" onclick="deleteStudent(${s.id}, '${s.student_id}')" title="Delete Student">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterStudents(q) { renderTable(studentsCache.filter(s => s.name.toLowerCase().includes(q.toLowerCase()) || s.student_id.includes(q))); }
function filterByRisk(level) { renderTable(level ? studentsCache.filter(s => s.risk_level === level) : studentsCache); }

async function deleteStudent(id, studentId) {
  if (!confirm(`Are you sure you want to delete student ${studentId}?`)) return;
  
  const res = await api(`/students/${id}`, { method: 'DELETE' });
  if (res && res.message) {
    alert('Student deleted successfully');
    loadDashboardData();
  } else {
    // Offline mode update
    const offIdx = offlineStudents.findIndex(s => s.id === id);
    if (offIdx > -1) offlineStudents.splice(offIdx, 1);
    studentsCache = studentsCache.filter(s => s.id !== id);
    renderTable(studentsCache);
    loadOfflineData(); // Update all charts and tags using new offline length
  }
}

async function submitNewStudent(e) {
  e.preventDefault();
  
  const studentData = {
    student_id: document.getElementById('new-id').value,
    name: document.getElementById('new-name').value,
    age: +document.getElementById('new-age').value,
    gender: document.getElementById('new-gender').value,
    grade: +document.getElementById('new-grade').value,
    attendance_percentage: +document.getElementById('new-att').value,
    exam_scores: +document.getElementById('new-score').value,
    distance_to_school: +document.getElementById('new-dist').value,
    family_income: +document.getElementById('new-inc').value,
    parent_education_level: +document.getElementById('new-edu').value,
    health_issues: document.getElementById('new-health').value === '1',
    internet_access: document.getElementById('new-internet').value === '1',
    previous_failures: +document.getElementById('new-fail').value,
    parent_occupation: +document.getElementById('new-occ').value,
    parent_name: document.getElementById('new-pname').value,
    parent_phone: document.getElementById('new-pphone').value
  };

  try {
    const res = await api('/students/', {
      method: 'POST',
      body: JSON.stringify(studentData)
    });
    
    if (res && res.student) {
      alert("Student added successfully!");
      document.getElementById('add-student-form').reset();
      loadDashboardData();
      showPage('students');
    } else {
      // offline mode fallback
      const rs = computeRisk(studentData);
      studentData.dropout_risk_score = Math.round(rs * 100);
      studentData.risk_level = riskLevel(rs);
      studentsCache.unshift(studentData);
      renderTable(studentsCache);
      alert("Student added locally (Offline Mode)");
      document.getElementById('add-student-form').reset();
      
      const h = studentsCache.filter(s => s.risk_level === 'High').length;
      const m = studentsCache.filter(s => s.risk_level === 'Medium').length;
      const l = studentsCache.filter(s => s.risk_level === 'Low').length;
      document.getElementById('stat-high').textContent = h;
      document.getElementById('stat-med').textContent = m;
      document.getElementById('stat-low').textContent = l;
      document.getElementById('total-badge').textContent = studentsCache.length + ' students';
      showPage('students');
    }
  } catch (error) {
    alert("Error adding student. Make sure backend is running.");
  }
}

function loadStudentPredict(s) {
  showPage('predict');
  document.getElementById('f-name').value = s.name;
  document.getElementById('f-age').value = s.age || (s.grade + 10);
  document.getElementById('f-attendance').value = s.attendance_percentage;
  document.getElementById('f-score').value = s.exam_scores;
  document.getElementById('f-distance').value = s.distance_to_school;
  document.getElementById('f-income').value = s.family_income;
  document.getElementById('f-failures').value = s.previous_failures;
  document.getElementById('f-health').value = s.health_issues ? 1 : 0;
  document.getElementById('f-internet').value = s.internet_access ? 1 : 0;
  document.getElementById('f-gender').value = s.gender;
  document.getElementById('f-parent-edu').value = s.parent_education_level;
  runPrediction();
}

// ═══════════════════ PREDICTION ═══════════════════
async function runPrediction() {
  const features = {
    attendance: +document.getElementById('f-attendance').value,
    score: +document.getElementById('f-score').value,
    distance: +document.getElementById('f-distance').value,
    income: +document.getElementById('f-income').value,
    parentEdu: +document.getElementById('f-parent-edu').value,
    health: +document.getElementById('f-health').value,
    internet: +document.getElementById('f-internet').value,
    failures: +document.getElementById('f-failures').value,
    gender: document.getElementById('f-gender').value,
    age: +document.getElementById('f-age').value,
    occupation: +document.getElementById('f-occupation').value
  };
  const name = document.getElementById('f-name').value || 'Student';
  
  // Try API prediction
  let result = await api('/predictions/predict', { method: 'POST', body: JSON.stringify(features) });
  
  let riskScore, level, shapValues, explanation, matchedSchemes;
  
  if (result && result.risk_score !== undefined) {
    riskScore = result.risk_score;
    level = result.risk_level;
    shapValues = result.shap_values;
    explanation = result.explanation;
    matchedSchemes = result.matched_schemes;
  } else {
    // Offline computation
    const rs = computeRisk(features);
    riskScore = Math.round(rs * 100);
    level = riskLevel(rs);
    shapValues = computeOfflineSHAP(features);
    matchedSchemes = matchOfflineSchemes(features, level);
  }
  
  // Display results
  document.getElementById('result-score').textContent = riskScore + '%';
  document.getElementById('result-score').style.color = riskColor(level);
  document.getElementById('result-name-display').textContent = name;
  document.getElementById('result-badge').innerHTML = `<span class="risk-pill risk-${level.toLowerCase()}" style="font-size:13px;padding:5px 14px">${level} Risk</span>`;
  
  // Key factors
  const att = features.attendance, sc = features.score, dist = features.distance, inc = features.income;
  const factors = [
    { label:'📅 Attendance', value:att+'%', bad:att<60 },
    { label:'📝 Exam Score', value:sc+'/100', bad:sc<50 },
    { label:'🏠 Distance', value:dist+' km', bad:dist>6 },
    { label:'💰 Income', value:'₹'+inc.toLocaleString(), bad:inc<10000 },
  ];
  document.getElementById('result-factors').innerHTML = factors.map(f =>
    `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px">
      <span style="color:var(--muted)">${f.label}</span>
      <span style="font-weight:500;color:${f.bad?'var(--accent)':'var(--accent2)'}">${f.value}</span></div>`
  ).join('');
  
  // SHAP bars
  const displayShap = shapValues || computeOfflineSHAP(features);
  document.getElementById('shap-bars').innerHTML = displayShap.slice(0, 8).map(f => {
    const w = Math.round((f.abs_impact || Math.abs(f.impact)) * 250);
    return `<div class="shap-bar"><div class="shap-label">${f.display_name || f.feature}</div>
      <div class="shap-track"><div class="shap-fill shap-fill-pos" style="width:${Math.min(w,100)}%"></div></div>
      <div class="shap-val" style="color:${w>40?'var(--accent)':w>20?'#b5810a':'var(--accent2)'}">+${(f.abs_impact || Math.abs(f.impact)).toFixed(3)}</div></div>`;
  }).join('');
  
  // Schemes
  const schemes = matchedSchemes || matchOfflineSchemes(features, level);
  document.getElementById('result-schemes').innerHTML = schemes.length
    ? schemes.slice(0, 4).map(s => `<div class="scheme-card"><div class="scheme-icon">${s.icon}</div><div><div class="scheme-name">${s.scheme_name}</div><div class="scheme-desc">${s.ministry}</div></div></div>`).join('')
    : '<div style="color:var(--muted);font-size:13px">No schemes matched for this profile.</div>';
  
  // SMS preview
  const teacherMsg = `[VidyaRaksha Alert] Student ${name} (${level} Risk - ${riskScore}%) requires attention. Attendance: ${att}%. Please schedule counseling.`;
  const parentMsg = `[VidyaRaksha] Dear Parent, your child ${name} has ${att}% attendance and is at ${level.toLowerCase()} risk of dropout. Please contact the school.`;
  document.getElementById('sms-teacher-text').textContent = teacherMsg;
  document.getElementById('sms-parent-text').textContent = parentMsg;
  document.getElementById('sms-sent-1').style.display = 'none';
  document.getElementById('sms-sent-2').style.display = 'none';
  
  document.getElementById('result-panel').classList.add('show');
  document.getElementById('result-panel').scrollIntoView({ behavior:'smooth', block:'start' });
}

function computeOfflineSHAP(f) {
  const att = f.attendance || 0, sc = f.score || 0, dist = f.distance || 0, inc = f.income || 0;
  const edu = f.parentEdu || 0, health = f.health || 0, inet = f.internet || 0, fail = f.failures || 0;
  return [
    { feature:'attendance', display_name:'Attendance (%)', impact: Math.max(0,(75-att))/75*0.30, abs_impact: Math.max(0,(75-att))/75*0.30 },
    { feature:'score', display_name:'Exam Score', impact: Math.max(0,(60-sc))/60*0.25, abs_impact: Math.max(0,(60-sc))/60*0.25 },
    { feature:'income', display_name:'Family Income', impact: Math.max(0,(15000-inc))/15000*0.15, abs_impact: Math.max(0,(15000-inc))/15000*0.15 },
    { feature:'distance', display_name:'Distance to School', impact: Math.min(dist/20,1)*0.10, abs_impact: Math.min(dist/20,1)*0.10 },
    { feature:'parentEdu', display_name:'Parent Education', impact: Math.max(0,(2-edu))/2*0.08, abs_impact: Math.max(0,(2-edu))/2*0.08 },
    { feature:'health', display_name:'Health Issues', impact: health*0.05, abs_impact: health*0.05 },
    { feature:'internet', display_name:'Internet Access', impact: (1-inet)*0.04, abs_impact: (1-inet)*0.04 },
    { feature:'failures', display_name:'Previous Failures', impact: Math.min(fail/3,1)*0.03, abs_impact: Math.min(fail/3,1)*0.03 },
  ].sort((a,b) => b.abs_impact - a.abs_impact);
}

function matchOfflineSchemes(f, level) {
  const inc = f.income || 0, dist = f.distance || 0, gender = f.gender || 'M';
  const health = f.health || 0, inet = f.internet || 0;
  return offlineSchemes.filter(s => {
    if (s.scheme_name.includes('Scholarship') && inc < 10000) return true;
    if (s.scheme_name.includes('Bicycle') && dist > 3) return true;
    if (s.scheme_name.includes('Beti') && gender === 'F') return true;
    if (s.scheme_name.includes('Swasthya') && health) return true;
    if (s.scheme_name.includes('eVidya') && !inet) return true;
    if (s.scheme_name.includes('Samagra') && dist > 5) return true;
    if (s.scheme_name.includes('Mid-Day') && (level === 'High' || level === 'Medium')) return true;
    return false;
  });
}

function loadSample() {
  const samples = [
    {name:'Kavya Reddy',att:38,sc:28,dist:14,inc:4500,edu:0,h:1,i:0,f:2,g:'F'},
    {name:'Deepak Nair',att:88,sc:75,dist:2,inc:20000,edu:3,h:0,i:1,f:0,g:'M'},
    {name:'Mohan Yadav',att:44,sc:31,dist:12,inc:5500,edu:0,h:1,i:0,f:3,g:'M'},
  ];
  const s = samples[Math.floor(Math.random()*samples.length)];
  document.getElementById('f-name').value=s.name;
  document.getElementById('f-attendance').value=s.att;
  document.getElementById('f-score').value=s.sc;
  document.getElementById('f-distance').value=s.dist;
  document.getElementById('f-income').value=s.inc;
  document.getElementById('f-parent-edu').value=s.edu;
  document.getElementById('f-health').value=s.h;
  document.getElementById('f-internet').value=s.i;
  document.getElementById('f-failures').value=s.f;
  document.getElementById('f-gender').value=s.g;
  runPrediction();
}

// ═══════════════════ SMS ═══════════════════
async function sendSMS() {
  const phone = prompt("Enter parent's mobile number:");
  if (!phone) return;
  const msg = document.getElementById('sms-parent-text').textContent;
  
  const result = await api('/alerts/send-custom', {
    method: 'POST',
    body: JSON.stringify({ phone, message: msg, student_id: 1 })
  });
  
  if (result && result.message) {
    document.getElementById('sms-sent-1').style.display='block';
    document.getElementById('sms-sent-2').style.display='block';
    alert('SMS alert processed via backend!');
  } else {
    try {
      const tbRes = await fetch('https://textbelt.com/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message: msg, key: 'textbelt' })
      });
      const tbData = await tbRes.json();
      if (tbData.success) {
        document.getElementById('sms-sent-1').style.display='block';
        document.getElementById('sms-sent-2').style.display='block';
        alert('Real SMS sent via built-in Textbelt integration!');
      } else {
        alert('SMS logged locally. Delivery error: ' + tbData.error);
      }
    } catch(e) {
      alert('SMS logged (offline mode)');
    }
  }
}

async function sendCustomAlert() {
  const phone = document.getElementById('alert-phone').value;
  const msg = document.getElementById('alert-msg').value;
  if (!phone) { alert('Enter a phone number'); return; }
  
  const result = await api('/alerts/send-custom', { method:'POST', body: JSON.stringify({ phone, message: msg, student_id: 1 }) });
  
  if (result && result.message) {
    alert(`Alert sent to ${phone}`);
  } else {
    try {
      const tbRes = await fetch('https://textbelt.com/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message: msg, key: 'textbelt' })
      });
      const tbData = await tbRes.json();
      if (tbData.success) {
        alert(`Real SMS sent to ${phone} via built-in Textbelt integration!`);
      } else {
        alert('Delivery failed: ' + tbData.error);
      }
    } catch(e) {
      alert(`Alert logged locally for ${phone}`);
    }
  }
  document.getElementById('alert-msg').value='';
  document.getElementById('alert-phone').value='';
}

// ═══════════════════ CSV UPLOAD ═══════════════════
async function uploadCSV() {
  const fileInput = document.getElementById('csv-file');
  const file = fileInput.files[0];
  if (!file) return;
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const res = await fetch(`${API_BASE}/students/upload-csv`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
      body: formData
    });
    const data = await res.json();
    const el = document.getElementById('upload-result');
    el.style.display='block';
    el.innerHTML = `<div style="background:var(--green-bg);padding:16px;border-radius:8px;text-align:left">
      <strong>✅ ${data.created || 0} students imported</strong>
      ${data.errors?.length ? `<div style="color:var(--accent);font-size:12px;margin-top:8px">${data.errors.join('<br>')}</div>` : ''}
    </div>`;
    loadDashboardData();
  } catch(e) {
    document.getElementById('upload-result').style.display='block';
    document.getElementById('upload-result').innerHTML = `<div style="background:var(--red-bg);padding:16px;border-radius:8px">❌ Upload failed. Make sure backend is running.</div>`;
  }
}

// ═══════════════════ SCHEMES PAGE ═══════════════════
function renderSchemes() {
  document.getElementById('schemes-list').innerHTML = schemesCache.map(s => `
    <div class="card"><div class="card-body" style="display:flex;gap:14px;align-items:flex-start">
      <div style="font-size:32px;flex-shrink:0">${s.icon}</div>
      <div><div style="font-weight:700;font-size:14px;margin-bottom:3px">${s.scheme_name}</div>
        <div style="font-size:11.5px;color:var(--accent);margin-bottom:8px;font-weight:500">${s.ministry}</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.5">${s.description}</div>
        <div style="margin-top:10px"><span class="badge badge-gray" style="font-size:11px">Auto-matched by AI</span></div>
      </div></div></div>`).join('');
}

// ═══════════════════ ALERTS ═══════════════════
function renderAlertsFromAPI(alerts) {
  document.getElementById('alert-month-badge').textContent = `${alerts.length} alerts`;
  const container = document.getElementById('alert-log');
  container.innerHTML = alerts.map(a => `
    <div class="alert-item"><div class="alert-dot" style="background:${a.risk_level==='High'?'var(--accent)':'#e9b63a'}"></div>
      <div><div style="font-weight:500;font-size:13.5px">${a.student_name || 'Student'} — ${a.risk_level} Risk</div>
        <div style="font-size:12px;color:var(--muted)">${a.recipient_type} notified · ${a.status} · ${new Date(a.created_at).toLocaleDateString()}</div></div></div>`).join('');
  renderRecentActivity(alerts.slice(0, 5));
}

function renderOfflineAlerts() {
  const alerts = [
    {name:'Priya Sharma',level:'High',time:'2 hrs ago',type:'Teacher + Parent'},
    {name:'Mohan Yadav',level:'High',time:'5 hrs ago',type:'Teacher'},
    {name:'Kavya Reddy',level:'High',time:'Yesterday',type:'Teacher + Parent'},
    {name:'Meera Iyer',level:'High',time:'Yesterday',type:'Parent'},
    {name:'Suresh Babu',level:'High',time:'2 days ago',type:'Teacher + Parent'},
  ];
  document.getElementById('alert-month-badge').textContent = '5 alerts';
  document.getElementById('alert-log').innerHTML = alerts.map(a => `
    <div class="alert-item"><div class="alert-dot" style="background:${a.level==='High'?'var(--accent)':'#e9b63a'}"></div>
      <div><div style="font-weight:500;font-size:13.5px">${a.name} — ${a.level} Risk</div>
        <div style="font-size:12px;color:var(--muted)">${a.type} notified · ${a.time}</div></div></div>`).join('');
  
  document.getElementById('recent-activity').innerHTML = alerts.slice(0,4).map(a => `
    <div class="alert-item"><div class="alert-dot" style="background:${a.level==='High'?'var(--accent)':'#e9b63a'}"></div>
      <div><div style="font-weight:500;font-size:13.5px">SMS sent to ${a.name}'s ${a.type.toLowerCase()}</div>
        <div style="font-size:12px;color:var(--muted)">${a.level} risk · ${a.time}</div></div></div>`).join('');
}

function renderRecentActivity(alerts) {
  document.getElementById('recent-activity').innerHTML = alerts.map(a => `
    <div class="alert-item"><div class="alert-dot" style="background:${a.risk_level==='High'?'var(--accent)':'#e9b63a'}"></div>
      <div><div style="font-weight:500;font-size:13.5px">${a.student_name || 'Student'} — ${a.recipient_type} alerted</div>
        <div style="font-size:12px;color:var(--muted)">${a.risk_level} risk · ${a.status}</div></div></div>`).join('');
}

// ═══════════════════ GLOBAL SHAP ═══════════════════
function renderGlobalSHAP() {
  const features = [
    {name:'Attendance',val:0.30},{name:'Exam Score',val:0.25},{name:'Family Income',val:0.15},
    {name:'Distance',val:0.10},{name:'Parent Education',val:0.08},{name:'Health Issues',val:0.05},
    {name:'Internet Access',val:0.04},{name:'Previous Failures',val:0.03},
  ];
  document.getElementById('shap-global').innerHTML = features.map(f => `
    <div class="shap-bar"><div class="shap-label" style="font-size:13px">${f.name}</div>
      <div class="shap-track"><div class="shap-fill shap-fill-pos" style="width:${Math.round(f.val*100)}%"></div></div>
      <div class="shap-val" style="color:var(--accent)">${Math.round(f.val*100)}%</div></div>`).join('');
}

function renderArchSteps() {
  const steps = [
    {n:1,title:'Data Collection',desc:'Schools enter attendance, grades, and socio-economic data'},
    {n:2,title:'Preprocessing',desc:'Missing value imputation, normalization, encoding'},
    {n:3,title:'ML Prediction',desc:'Random Forest calculates dropout probability'},
    {n:4,title:'Risk Classification',desc:'Low / Medium / High based on thresholds'},
    {n:5,title:'SHAP Explanation',desc:'Feature contributions make predictions transparent'},
    {n:6,title:'SMS + Scheme Matching',desc:'Automatic notifications and welfare scheme recommendations'},
    {n:7,title:'Dashboard Monitoring',desc:'Admin views risk levels and intervention history'},
  ];
  document.getElementById('arch-steps').innerHTML = steps.map(s => `
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px">
      <div style="width:26px;height:26px;border-radius:50%;background:var(--ink);color:var(--paper);display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:700;flex-shrink:0">${s.n}</div>
      <div><div style="font-weight:600;font-size:13.5px">${s.title}</div><div style="font-size:12px;color:var(--muted)">${s.desc}</div></div></div>`).join('');
}

// ═══════════════════ CHARTS ═══════════════════
let charts = {};
function initCharts(high, med, low, schoolData) {
  // Destroy existing charts
  Object.values(charts).forEach(c => c && c.destroy());
  
  const chartOpts = { responsive: true, maintainAspectRatio: false };
  const fontOpts = { family: 'DM Sans', size: 12 };
  
  charts.risk = new Chart(document.getElementById('riskChart'), {
    type:'doughnut',
    data:{labels:['High Risk','Medium Risk','Low Risk'],
      datasets:[{data:[high||7,med||12,low||63],backgroundColor:['#c84b2f','#e9c46a','#2d6a4f'],borderWidth:2,borderColor:'#fff'}]},
    options:{...chartOpts,cutout:'65%',plugins:{legend:{position:'bottom',labels:{padding:16,font:fontOpts}}}}
  });

  charts.trend = new Chart(document.getElementById('trendChart'), {
    type:'line',
    data:{labels:['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'],
      datasets:[
        {label:'High Risk',data:[3,5,4,6,8,7,9,8,7,high||7],borderColor:'#c84b2f',backgroundColor:'rgba(200,75,47,0.08)',tension:0.4,fill:true,pointRadius:3},
        {label:'Medium Risk',data:[8,10,9,12,14,11,13,14,12,med||12],borderColor:'#e9c46a',backgroundColor:'rgba(233,196,106,0.08)',tension:0.4,fill:true,pointRadius:3},
      ]},
    options:{...chartOpts,plugins:{legend:{position:'bottom',labels:{padding:14,font:fontOpts}}},
      scales:{y:{beginAtZero:true,grid:{color:'rgba(0,0,0,0.05)'}},x:{grid:{display:false}}}}
  });

  const schoolLabels = schoolData.length ? schoolData.map(s=>s.school_name.split(',')[0]) : ['ZP Nandur','Govt Wadgaon','ZP Khalad','Govt Ambegaon'];
  const schoolH = schoolData.length ? schoolData.map(s=>s.high) : [3,2,1,1];
  const schoolM = schoolData.length ? schoolData.map(s=>s.medium) : [4,3,3,2];
  const schoolL = schoolData.length ? schoolData.map(s=>s.low) : [18,15,16,14];

  charts.school = new Chart(document.getElementById('schoolChart'), {
    type:'bar',
    data:{labels:schoolLabels,datasets:[
      {label:'High',data:schoolH,backgroundColor:'#c84b2f'},
      {label:'Medium',data:schoolM,backgroundColor:'#e9c46a'},
      {label:'Low',data:schoolL,backgroundColor:'#2d6a4f'}]},
    options:{...chartOpts,plugins:{legend:{position:'bottom',labels:{padding:14,font:fontOpts}}},
      scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,grid:{color:'rgba(0,0,0,0.05)'}}}}
  });

  charts.alert = new Chart(document.getElementById('alertChart'), {
    type:'bar',
    data:{labels:['Week 1','Week 2','Week 3','Week 4'],
      datasets:[{label:'Teacher',data:[5,8,7,9],backgroundColor:'#c84b2f'},{label:'Parent',data:[3,6,5,6],backgroundColor:'#e9c46a'}]},
    options:{...chartOpts,plugins:{legend:{position:'bottom',labels:{padding:12,font:{family:'DM Sans',size:11}}}},
      scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:'rgba(0,0,0,0.05)'}}}}
  });

  charts.perf = new Chart(document.getElementById('perfChart'), {
    type:'radar',
    data:{labels:['Accuracy','Precision','Recall','F1 Score','AUC-ROC','Specificity'],
      datasets:[{label:'Random Forest',data:[87,84,89,86,91,85],backgroundColor:'rgba(200,75,47,0.15)',borderColor:'#c84b2f',pointBackgroundColor:'#c84b2f',pointRadius:4}]},
    options:{...chartOpts,scales:{r:{min:70,max:100,ticks:{font:{size:10},stepSize:10},grid:{color:'rgba(0,0,0,0.06)'},pointLabels:{font:fontOpts}}},
      plugins:{legend:{position:'bottom',labels:{font:fontOpts}}}}
  });
}

// ═══════════════════ INIT ═══════════════════
(function init() {
  if (AUTH_TOKEN && CURRENT_USER) {
    document.getElementById('login-overlay').classList.add('hidden');
    const nameEl = document.getElementById('topbar-name');
    if (nameEl) nameEl.textContent = CURRENT_USER.full_name || 'System User';
    const avatarEl = document.getElementById('topbar-avatar');
    if (avatarEl) avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(CURRENT_USER.full_name || 'Admin')}&background=4f46e5&color=fff&rounded=true`;
    
    if (document.getElementById('dropdown-name')) document.getElementById('dropdown-name').textContent = CURRENT_USER.full_name || 'System User';
    if (document.getElementById('dropdown-email')) document.getElementById('dropdown-email').textContent = CURRENT_USER.email || 'admin@vidyaraksha.gov';
    if (document.getElementById('dropdown-role')) document.getElementById('dropdown-role').textContent = CURRENT_USER.role || 'Administrator';
    
    loadDashboardData();
  } else {
    // Check if API is available
    fetch(`${API_BASE}/health`).then(r => r.json()).then(() => {
      // API available, show login
    }).catch(() => {
      // No API, auto-enter offline mode
      enterOfflineMode();
    });
  }
})();
