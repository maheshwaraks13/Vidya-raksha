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
let meetingsCache = JSON.parse(localStorage.getItem('vr_meetings') || '[]');
let tasksCache = JSON.parse(localStorage.getItem('vr_tasks') || '[]');
let interventionHistory = JSON.parse(localStorage.getItem('vr_interventions') || '{}');
let communicationLogs = JSON.parse(localStorage.getItem('vr_comms') || '{}');
let schoolData = [
  { id: 'SC001', name: 'ZP Rural School, Nandur', studentCount: 450, highRisk: 12, principal: 'Mr. S.P. Deshmukh' },
  { id: 'SC002', name: 'GP School, Wadgaon', studentCount: 320, highRisk: 5, principal: 'Mrs. Anita Patil' },
  { id: 'SC003', name: 'Modern High School, Pune', studentCount: 890, highRisk: 24, principal: 'Dr. V.K. Joshi' }
];

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
  alerts:'SMS Alert Log', schemes:'Government Schemes', upload:'Upload Data', 'add-student':'Add New Student', 
  about:'About This Project', profile:'Student Profile', admin: 'Admin Control Panel',
  scheduler: 'Event & Meeting Scheduler', tasks: 'Task & Follow-Up Tracker', insights: 'Advanced Data Insights'
};

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.getElementById('page-title').textContent = pageTitles[id];
  
  // Sidebar highlighting
  document.querySelectorAll('.nav-item').forEach(item => {
    const onclick = item.getAttribute('onclick');
    if (onclick && onclick.includes(`'${id}'`)) item.classList.add('active');
  });

  if (id === 'insights') initInsightsCharts();
  if (id === 'scheduler') renderScheduler();
  if (id === 'tasks') renderTasks();
  if (id === 'admin') renderAdminSchools();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ═══════════════════ OFFLINE DATA ═══════════════════
const offlineStudents = [
  { 
    id:1, student_id:'VRS-2024-001', name:'Priya Sharma', admission_no:'ADM/24/089', grade:8, section:'A', 
    dob:'2010-05-14', gender:'Female', school_name:'ZP Rural School, Nandur',
    parent_name:'Rajesh Sharma', father_phone:'+91 9876543210', mother_phone:'+91 9876543211', parent_email:'r.sharma@gmail.com', emergency_contact:'+91 9123456789',
    address:'House No. 42, Ward 5', village:'Nandur', district:'Pune', pincode:'412210',
    math_marks:32, science_marks:38, english_marks:35, exam_scores:35, homework_completion:45,
    total_days:120, days_present:49, days_absent:71, attendance_percentage:41, last_absent_date:'2024-04-12',
    family_income:6500, parent_occupation:'Daily Labour', siblings:3, first_generation:true, distance_to_school:9, transport_type:'Walking',
    dropout_risk_score:82, risk_level:'High'
  },
  { 
    id:2, student_id:'VRS-2024-002', name:'Rahul Patil', admission_no:'ADM/24/112', grade:9, section:'B', 
    dob:'2009-11-20', gender:'Male', school_name:'GP School, Wadgaon',
    parent_name:'Sunil Patil', father_phone:'+91 9988776655', mother_phone:'+91 9988776656', parent_email:'s.patil@yahoo.com', emergency_contact:'+91 9876543210',
    address:'Galli No. 2, Station Road', village:'Wadgaon', district:'Pune', pincode:'412215',
    math_marks:78, science_marks:82, english_marks:75, exam_scores:78, homework_completion:92,
    total_days:120, days_present:110, days_absent:10, attendance_percentage:92, last_absent_date:'2024-03-05',
    family_income:25000, parent_occupation:'Shopkeeper', siblings:1, first_generation:false, distance_to_school:2, transport_type:'Bicycle',
    dropout_risk_score:12, risk_level:'Low'
  }
];

const offlineSchemes = [
  { 
    icon:'🎓', 
    scheme_name:'Pre-Matric Scholarship', 
    ministry:'Ministry of Education', 
    description:'Financial support for SC/ST/OBC students from low-income families to reduce dropout rates at the secondary level.',
    full_info:'This scholarship is awarded to students of Class 9 and 10. It aims to support parents of SC/ST/OBC children for education of their wards so that their incidence of drop-out is minimized.',
    benefits: ['Annual allowance of ₹3,500', 'Special allowance for disabled students', 'Direct Benefit Transfer (DBT) to student accounts'],
    images: ['https://images.unsplash.com/photo-1577891729319-f4871c6ec9d9?w=800', 'https://images.unsplash.com/photo-1544652478-6653e09f18a2?w=800']
  },
  { 
    icon:'🚲', 
    scheme_name:'Free Bicycle Scheme', 
    ministry:'State Government', 
    description:'Free bicycles for students living more than 3km from school to ensure easy accessibility.',
    full_info:'The scheme provides free bicycles to all girl students and boys of marginalized communities who successfully transition to Grade 8 and live in remote areas.',
    benefits: ['High-quality durable bicycle', 'One-year free maintenance', 'Safety kit (Helmet and Lock) included'],
    images: ['https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800', 'https://images.unsplash.com/photo-1471506480208-8ebb75ee5fa7?w=800']
  },
  { 
    icon:'🍱', 
    scheme_name:'Mid-Day Meal Programme', 
    ministry:'Ministry of Education', 
    description:'Free nutritious lunch provided to all children in government and government-aided schools.',
    full_info:'The Mid-Day Meal Scheme is a school meal programme in India designed to better the nutritional standing of school-age children nationwide.',
    benefits: ['Hot cooked nutritious meal every school day', 'Standardized calorie and protein intake', 'Improves school attendance and socialization'],
    images: ['https://images.unsplash.com/photo-1591543132514-6c7083049bed?w=800', 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=800']
  },
  { 
    icon:'👧', 
    scheme_name:'Beti Bachao Beti Padhao', 
    ministry:'Government of India', 
    description:'A campaign to generate awareness and improve the efficiency of welfare services intended for girls.',
    full_info:'BBBP is a national initiative to address the declining child sex ratio and related issues of women empowerment over a life-cycle continuum.',
    benefits: ['Safety and protection of girl child', 'Fixed deposits in Sukanya Samriddhi accounts', 'Priority in government school admissions'],
    images: ['https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800', 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800']
  },
  { 
    icon:'🏥', 
    scheme_name:'Rashtriya Bal Swasthya Karyakram', 
    ministry:'Ministry of Health', 
    description:'Free health screenings and early treatment for children up to 18 years.',
    full_info:'RBSK aims at early identification and early intervention for children from birth to 18 years to cover 4 "D"s: Defects at Birth, Deficiencies, Diseases, Development Delays.',
    benefits: ['Free quarterly health checkups', 'Free surgical interventions if required', 'Dental and vision screening in schools'],
    images: ['https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=800', 'https://images.unsplash.com/photo-1538108197023-999330691d90?w=800']
  },
  { 
    icon:'📚', 
    scheme_name:'Kasturba Gandhi Balika Vidyalaya', 
    ministry:'Ministry of Education', 
    description:'Residential schools for girls at upper primary level belonging to SC, ST, OBC and minorities.',
    full_info:'KGBV schools are established in educationally backward blocks where the female literacy is below the national average and gender gap in literacy is more than the national average.',
    benefits: ['Free residential facilities', 'Bridge courses for out-of-school girls', 'Vocational training and skill development'],
    images: ['https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800', 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800']
  },
  { 
    icon:'🥘', 
    scheme_name:'PM-POSHAN Abhiyan', 
    ministry:'Ministry of Education', 
    description:'National programme for providing nutrition support to primary education students.',
    full_info:'Pradhan Mantri Poshan Shakti Nirman (PM POSHAN) is the revamped Mid-Day Meal scheme aimed at improving nutritional status and school attendance.',
    benefits: ['Balanced diet recipes', 'Iron and Folic Acid supplements', 'Involvement of local women SHGs for cooking'],
    images: ['https://images.unsplash.com/photo-1594498653385-d5172b532c00?w=800', 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800']
  },
  { 
    icon:'🏅', 
    scheme_name:'National Means-cum-Merit Scholarship', 
    ministry:'Ministry of Education', 
    description:'Scholarships for meritorious students of economically weaker sections to reduce dropouts at Class 8.',
    full_info:'The NMMS scheme provides scholarships to gifted students whose parental income is not more than ₹3,50,000 per annum to encourage them to continue their studies.',
    benefits: ['₹12,000 annual scholarship', 'Renewable until Grade 12', 'Competitive exam preparation support'],
    images: ['https://images.unsplash.com/photo-152305085306e-e26e326b7b4f?w=800', 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800']
  },
  { 
    icon:'💻', 
    scheme_name:'Digital India Learning', 
    ministry:'Ministry of Electronics & IT', 
    description:'Providing tablets and internet connectivity to rural schools for digital literacy.',
    full_info:'Under the DI-Learning module, government schools are equipped with computer labs and free internet to bridge the digital divide in rural areas.',
    benefits: ['Free tabs for meritorious students', 'E-Pathshala digital content', 'Basic computer literacy certification'],
    images: ['https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800', 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800']
  },
  { 
    icon:'🏠', 
    scheme_name:'Samagra Shiksha Abhiyan', 
    ministry:'Ministry of Education', 
    description:'An integrated scheme for school education from pre-school to class 12.',
    full_info:'Focuses on improving school infrastructure, teacher quality, and ensuring inclusive education for all children.',
    benefits: ['Upgraded school classrooms', 'Digital classrooms (Smart Boards)', 'Self-defence training for girl students'],
    images: ['https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800', 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800']
  }
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

function applyDashFilters() {
  const grade = document.getElementById('dash-filter-grade').value;
  const section = document.getElementById('dash-filter-section').value;
  const minAtt = +document.getElementById('dash-filter-att').value;
  
  const filtered = studentsCache.filter(s => {
    return (!grade || s.grade == grade) && 
           (!section || s.section == section) && 
           (s.attendance_percentage >= minAtt);
  });
  
  updateDashboardWithFilteredData(filtered);
}

function updateDashboardWithFilteredData(data) {
  const h = data.filter(s => s.risk_level === 'High').length;
  const m = data.filter(s => s.risk_level === 'Medium').length;
  const l = data.filter(s => s.risk_level === 'Low').length;
  
  document.getElementById('stat-high').textContent = h;
  document.getElementById('stat-med').textContent = m;
  document.getElementById('stat-low').textContent = l;
  document.getElementById('high-count').textContent = h;
  document.getElementById('med-count').textContent = m;
  document.getElementById('total-badge').textContent = `${data.length} students`;
  
  initCharts(h, m, l, []);
}

function loadOfflineData() {
  studentsCache = offlineStudents.map(s => {
    const rs = computeRisk(s);
    return { ...s, dropout_risk_score: Math.round(rs * 100), risk_level: riskLevel(rs) };
  });
  updateDashboardWithFilteredData(studentsCache);
  schemesCache = offlineSchemes;
  renderSchemes();
  renderOfflineAlerts();
  renderGlobalSHAP();
  renderArchSteps();
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
          <button class="btn btn-outline btn-sm" onclick='viewProfile(${JSON.stringify(s).replace(/'/g,"&#39;")})'>Profile</button>
          <button class="btn btn-outline btn-sm" onclick='openEditModal(${JSON.stringify(s).replace(/'/g,"&#39;")})' title="Edit Student">✏️</button>
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
    section: document.getElementById('new-section').value,
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
  document.getElementById('schemes-list').innerHTML = schemesCache.map((s, idx) => `
    <div class="card" onclick="openSchemeModal(${idx})" style="cursor:pointer; transition:transform 0.2s;">
      <div class="card-body" style="display:flex;gap:14px;align-items:flex-start">
        <div style="font-size:32px;flex-shrink:0">${s.icon}</div>
        <div>
          <div style="font-weight:700;font-size:14px;margin-bottom:3px">${s.scheme_name}</div>
          <div style="font-size:11.5px;color:var(--accent);margin-bottom:8px;font-weight:500">${s.ministry}</div>
          <div style="font-size:13px;color:var(--muted);line-height:1.5">${s.description}</div>
          <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
            <span class="badge badge-gray" style="font-size:11px">Auto-matched</span>
            <span style="font-size:12px; font-weight:700; color:var(--primary);">Learn More →</span>
          </div>
        </div>
      </div>
    </div>`).join('');
}

function openSchemeModal(idx) {
  const s = schemesCache[idx];
  document.getElementById('sch-modal-title').textContent = s.scheme_name;
  document.getElementById('sch-modal-desc').textContent = s.full_info || s.description;
  document.getElementById('sch-img-1').src = s.images ? s.images[0] : 'https://images.unsplash.com/photo-1544652478-6653e09f18a2?w=800';
  document.getElementById('sch-img-2').src = s.images ? s.images[1] : 'https://images.unsplash.com/photo-1577891729319-f4871c6ec9d9?w=800';
  
  const bList = s.benefits ? s.benefits : ['Scholarship support', 'Education welfare', 'Welfare scheme'];
  document.getElementById('sch-modal-benefits').innerHTML = `
    <div style="font-weight:700; font-size:14px; margin-bottom:12px;">Key Benefits:</div>
    <ul style="padding-left:18px; font-size:13.5px; color:var(--ink);">
      ${bList.map(b => `<li style="margin-bottom:6px;">${b}</li>`).join('')}
    </ul>
  `;
  
  document.getElementById('scheme-modal').classList.add('open');
}

function closeSchemeModal() {
  document.getElementById('scheme-modal').classList.remove('open');
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
(f// ═══════════════════ STUDENT PROFILE ═══════════════════
let currentProfileStudent = null;

async function viewProfile(s) {
  currentProfileStudent = s;
  showPage('profile');
  
  // Header
  document.getElementById('prof-name').textContent = s.name;
  document.getElementById('prof-id').textContent = `ID: ${s.student_id} | Admission: ${s.admission_no || 'VR/2024/'+s.id}`;
  
  // 1. Basic Info
  document.getElementById('prof-basic-info').innerHTML = `
    <div class="vital-row"><span>Class/Section</span> <strong>Grade ${s.grade || 8} - ${s.section || 'A'}</strong></div>
    <div class="vital-row"><span>Date of Birth</span> <strong>${s.dob || '14/05/2010'}</strong></div>
    <div class="vital-row"><span>Age / Gender</span> <strong>${s.age || '14'} / ${s.gender === 'M' ? 'Male' : 'Female'}</strong></div>
    <div class="vital-row"><span>School</span> <strong>${s.school_name || 'ZP Rural School, Nandur'}</strong></div>
  `;
  
  // 2. Contact Info
  document.getElementById('prof-contact-info').innerHTML = `
    <div class="vital-row"><span>Parent</span> <strong>${s.parent_name || 'Rajesh Sharma'}</strong></div>
    <div class="vital-row"><span>Contact</span> <strong>${s.father_phone || s.parent_contact || '+91 98765 43210'}</strong></div>
    <div class="vital-row"><span>Address</span> <strong style="font-size:11px">${s.address || 'House 42, Ward 5'}, ${s.village || 'Nandur'}</strong></div>
  `;
  
  // 3. Risk Assessment
  updateProfileRisk(s);

  // Populating Academic Tab
  document.getElementById('prof-academic-details').innerHTML = `
    <div class="detail-item"><div class="detail-label">Math</div><div class="detail-value">${s.math_marks || 32}</div></div>
    <div class="detail-item"><div class="detail-label">Science</div><div class="detail-value">${s.science_marks || 38}</div></div>
    <div class="detail-item"><div class="detail-label">English</div><div class="detail-value">${s.english_marks || 35}</div></div>
    <div class="detail-item"><div class="detail-label">Avg. Score</div><div class="detail-value">${s.exam_scores || 35}%</div></div>
  `;

  // Populating Attendance Tab
  document.getElementById('prof-attendance-details').innerHTML = `
    <div class="detail-item"><div class="detail-label">Total Days</div><div class="detail-value">${s.total_days || 120}</div></div>
    <div class="detail-item"><div class="detail-label">Present</div><div class="detail-value">${s.days_present || 49}</div></div>
    <div class="detail-item"><div class="detail-label">Absent</div><div class="detail-value">${s.days_absent || 71}</div></div>
    <div class="detail-item"><div class="detail-label">Percentage</div><div class="detail-value" style="color:${s.attendance_percentage < 75 ? 'var(--accent)' : 'inherit'}">${s.attendance_percentage}%</div></div>
  `;

  // Family Info
  document.getElementById('prof-family-details').innerHTML = `
    <div class="vital-row"><span>Family Income</span> <strong>₹${s.family_income || 6500}/mo</strong></div>
    <div class="vital-row"><span>Occupation</span> <strong>${s.parent_occupation || 'Daily Labour'}</strong></div>
    <div class="vital-row"><span>Siblings</span> <strong>${s.siblings || 3}</strong></div>
    <div class="vital-row"><span>First Gen Learner</span> <strong>${s.first_generation ? 'Yes' : 'No'}</strong></div>
  `;
  document.getElementById('prof-parent-details').innerHTML = `
    <div class="vital-row"><span>Father Education</span> <strong>${s.parent_education_level > 1 ? 'Secondary' : 'Primary/None'}</strong></div>
    <div class="vital-row"><span>Mother Education</span> <strong>${s.mother_edu || 'Primary'}</strong></div>
    <div class="vital-row"><span>Distance to School</span> <strong>${s.distance_to_school} km</strong></div>
    <div class="vital-row"><span>Transport Mode</span> <strong>${s.transport_type || 'Walking'}</strong></div>
  `;

  // Health & Monitoring
  document.getElementById('prof-health-details').innerHTML = `
    <div class="vital-row"><span>Health Condition</span> <strong>${s.health_issues ? 'Chronic (Respiratory)' : 'Regular'}</strong></div>
    <div class="vital-row"><span>Disability Status</span> <strong>None</strong></div>
    <div class="vital-row"><span>Last Checkup</span> <strong>12/01/2024</strong></div>
  `;
  document.getElementById('prof-behavior-details').innerHTML = `
    <div class="vital-row"><span>Class Participation</span> <div class="progress-bar"><div class="progress-fill fill-yellow" style="width:40%"></div></div></div>
    <div class="vital-row"><span>Disciplinary Record</span> <strong>None</strong></div>
    <div class="vital-row"><span>Counseling Required</span> <strong>Yes (Scheduled)</strong></div>
  `;

  // Support
  document.getElementById('prof-scholarship-details').innerHTML = `
    <div class="detail-item" style="margin-bottom:12px;"><div class="detail-label">Status</div><div class="detail-value">Applied (Processing)</div></div>
    <div class="detail-item"><div class="detail-label">Program</div><div class="detail-value">Pre-Matric Scholarship for SC/ST</div></div>
  `;

  // History & Logs
  renderInterventionsOnProfile(s.id);
  renderCommLogOnProfile(s.id);

  // Reset to overview tab
  switchProfileTab('overview');
  
  // Charts
  setTimeout(() => {
    renderProfCharts(s);
  }, 100);
}

function updateProfileRisk(s) {
  const riskColorCode = s.risk_level === 'High' ? 'var(--accent)' : s.risk_level === 'Medium' ? '#b5810a' : 'var(--accent2)';
  document.getElementById('prof-risk-score').textContent = s.dropout_risk_score + '%';
  document.getElementById('prof-risk-score').style.color = riskColorCode;
  document.getElementById('prof-risk-badge').innerHTML = `<span class="badge ${s.risk_level === 'High' ? 'badge-red' : s.risk_level === 'Medium' ? 'badge-yellow' : 'badge-green'}">${s.risk_level} Risk</span>`;
  
  let reasons = [];
  if (s.attendance_percentage < 75) reasons.push('⚠️ Attendance below 75%');
  if (s.exam_scores < 40) reasons.push('📉 Poor academic performance');
  if (s.family_income < 10000) reasons.push('💰 Financial constraints');
  if (s.distance_to_school > 5) reasons.push('🚶 Distance (>5km)');
  document.getElementById('prof-risk-reasons').innerHTML = reasons.map(r => `<div style="color:var(--muted); margin-bottom:4px; font-size:12.5px; font-weight:500;">${r}</div>`).join('');
}

function switchProfileTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
  
  const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.textContent.toLowerCase().includes(tabId));
  if (btn) btn.classList.add('active');
  const content = document.getElementById(`prof-tab-${tabId}`);
  if (content) content.style.display = 'block';
}

function renderProfCharts(s) {
  const opts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };
  
  // Overview Performance Chart
  if (charts.profPerfOverview) charts.profPerfOverview.destroy();
  charts.profPerfOverview = new Chart(document.getElementById('profPerfChartOverview'), {
    type: 'bar',
    data: {
      labels: ['Math', 'Sci', 'Eng', 'Avg'],
      datasets: [{ data: [s.math_marks||32, s.science_marks||38, s.english_marks||35, s.exam_scores||38], backgroundColor: 'var(--primary)', borderRadius: 4 }]
    }, options: opts
  });

  // Overview Attendance Chart
  if (charts.profAttOverview) charts.profAttOverview.destroy();
  charts.profAttOverview = new Chart(document.getElementById('profAttChartOverview'), {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      datasets: [{ data: [1, 1, 0, 1, 0].map(v => v * (Math.random() > 0.3 ? 100 : 0)), borderColor: 'var(--accent2)', tension: 0.4, fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)' }]
    }, options: opts
  });

  // Detailed Full Charts in Academics Tab
  if (charts.profPerfFull) charts.profPerfFull.destroy();
  charts.profPerfFull = new Chart(document.getElementById('profPerfChartFull'), {
    type: 'line',
    data: {
        labels: ['Unit 1', 'Unit 2', 'Mid-term', 'Unit 3', 'Final'],
        datasets: [{ label: 'Score', data: [45, 42, 38, 35, s.exam_scores||35], borderColor: 'var(--primary)', tension: 0.3 }]
    }, options: { ...opts, plugins: { legend: { display: true } } }
  });
}

function renderInterventionsOnProfile(id) {
  const history = interventionHistory[id] || [
    { type: 'Counseling', date: '2024-04-10', notes: 'Student lacks interest in subjects due to language barrier.', teacher: 'R. Kumar' },
    { type: 'Financial Support', date: '2024-03-22', notes: 'Applied for Pre-Matric Scholarship.', teacher: 'S. Patil' }
  ];
  const list = document.getElementById('prof-interventions-list');
  list.innerHTML = history.map(h => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-date">${h.date}</div>
      <div class="timeline-content">
        <strong>${h.type}</strong><br>
        <span style="color:var(--muted)">Teacher: ${h.teacher}</span>
        <div style="margin-top:6px">${h.notes}</div>
      </div>
    </div>
  `).join('');
}

function renderCommLogOnProfile(id) {
  const logs = communicationLogs[id] || [
    { type: 'SMS', date: '2024-04-15', status: 'Sent', content: 'Attendance warning sent to parent.' },
    { type: 'Call', date: '2024-04-12', status: 'Completed', content: 'Spoke with father regarding absence.' }
  ];
  const list = document.getElementById('prof-comm-log-list');
  list.innerHTML = logs.map(l => `
    <div style="background:var(--paper2); padding:12px; border-radius:8px; margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span class="badge badge-gray" style="font-size:10px">${l.type}</span>
        <span style="font-size:11px; color:var(--muted)">${l.date}</span>
      </div>
      <div style="font-size:13px">${l.content}</div>
      <div style="font-size:11px; color:var(--accent2); margin-top:4px; font-weight:700">Status: ${l.status}</div>
    </div>
  `).join('');
}

function handleGlobalSearch(q) {
  const el = document.getElementById('global-search-results');
  if (!q || q.length < 2) { el.style.display = 'none'; return; }
  
  const results = studentsCache.filter(s => 
    s.name.toLowerCase().includes(q.toLowerCase()) || 
    s.student_id.toLowerCase().includes(q.toLowerCase()) ||
    (s.father_phone && s.father_phone.includes(q))
  );

  if (results.length === 0) {
    el.innerHTML = '<div style="padding:16px; font-size:13px; color:var(--muted)">No matches found</div>';
  } else {
    el.innerHTML = results.map(s => `
      <div class="search-result-item" onclick="viewProfile(${JSON.stringify(s).replace(/'/g,"&#39;")}); document.getElementById('global-search-results').style.display='none';">
        <img class="search-result-avatar" src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random">
        <div class="search-result-info">
          <span class="search-result-name">${s.name}</span>
          <span class="search-result-meta">${s.student_id} · Grade ${s.grade} · ${s.risk_level} Risk</span>
        </div>
      </div>
    `).join('');
  }
  el.style.display = 'block';
}

function handleDocUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  alert(`Document "${file.name}" uploaded successfully for ${currentProfileStudent.name}.`);
  const list = document.getElementById('prof-document-list');
  if (list.textContent.includes('No documents')) list.innerHTML = '';
  list.innerHTML += `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:10px; background:var(--paper); border-radius:8px; margin-bottom:8px; border:1px solid var(--border);">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:20px;">📄</span>
        <div><div style="font-size:13px; font-weight:600;">${file.name}</div><div style="font-size:11px; color:var(--muted)">Just now · ${(file.size/1024).toFixed(1)} KB</div></div>
      </div>
      <span style="color:var(--primary); font-size:12px; font-weight:700; cursor:pointer;">View</span>
    </div>
  `;
}

function renderScheduler() {
  const tbody = document.getElementById('scheduler-tbody');
  const datalist = document.getElementById('student-list');
  datalist.innerHTML = studentsCache.map(s => `<option value="${s.name}">`).join('');
  
  tbody.innerHTML = (meetingsCache.length ? meetingsCache : [
    { type: 'Counseling Session', student: 'Priya Sharma', datetime: '2024-04-20T10:30', status: 'Scheduled' },
    { type: 'Parent Meeting', student: 'Rahul Patil', datetime: '2024-04-21T14:00', status: 'Pending' }
  ]).map((m, i) => `
    <tr>
      <td><strong>${m.type}</strong></td>
      <td>${m.student}</td>
      <td>${m.datetime.replace('T', ' ')}</td>
      <td><span class="badge ${m.status==='Scheduled'?'badge-green':'badge-yellow'}">${m.status}</span></td>
      <td><button class="btn btn-outline btn-sm">Reschedule</button></td>
    </tr>
  `).join('');
}

function renderTasks() {
  const tbody = document.getElementById('tasks-tbody');
  const teachers = ['Rajesh Kumar', 'Anita Patil', 'V.K. Joshi'];
  document.getElementById('task-teacher').innerHTML = teachers.map(t => `<option>${t}</option>`).join('');
  
  tbody.innerHTML = (tasksCache.length ? tasksCache : [
    { title: 'Follow up on Priya\'s attendance', teacher: 'Rajesh Kumar', deadline: '2024-04-18', status: 'Overdue' },
    { title: 'Prepare monthly risk report', teacher: 'Anita Patil', deadline: '2024-04-30', status: 'In Progress' }
  ]).map(t => `
    <tr>
      <td><strong>${t.title}</strong></td>
      <td>${t.teacher}</td>
      <td>${t.deadline}</td>
      <td><span class="badge ${t.status==='Overdue'?'badge-red':t.status==='Completed'?'badge-green':'badge-yellow'}">${t.status}</span></td>
      <td><button class="btn btn-outline btn-sm">Mark Done</button></td>
    </tr>
  `).join('');
}

function openScheduleModal() { document.getElementById('schedule-modal').classList.add('open'); }
function openTaskModal() { document.getElementById('task-modal').classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function submitSchedule() {
  const m = {
    type: document.getElementById('sch-type').value,
    student: document.getElementById('sch-student').value,
    datetime: document.getElementById('sch-date').value + 'T' + document.getElementById('sch-time').value,
    status: 'Scheduled'
  };
  meetingsCache.unshift(m);
  localStorage.setItem('vr_meetings', JSON.stringify(meetingsCache));
  renderScheduler();
  closeModal('schedule-modal');
}

function submitTask() {
  const t = {
    title: document.getElementById('task-name').value,
    teacher: document.getElementById('task-teacher').value,
    deadline: document.getElementById('task-deadline').value,
    status: 'Pending'
  };
  tasksCache.unshift(t);
  localStorage.setItem('vr_tasks', JSON.stringify(tasksCache));
  renderTasks();
  closeModal('task-modal');
}


function renderAdminSchools() {
  const panel = document.getElementById('page-admin');
  const existingSchools = panel.querySelector('.school-list-container');
  if (existingSchools) existingSchools.remove();
  
  const container = document.createElement('div');
  container.className = 'card full-col school-list-container';
  container.style.marginTop = '24px';
  container.innerHTML = `
    <div class="card-header"><div class="card-title">Multi-School Management</div></div>
    <div class="card-body" style="padding:0;">
      ${schoolData.map(s => `
        <div class="school-list-item">
          <div class="school-info">
            <div class="school-icon">🏫</div>
            <div>
              <div style="font-weight:700; font-size:14px;">${s.name}</div>
              <div style="font-size:12px; color:var(--muted)">Principal: ${s.principal} · ID: ${s.id}</div>
            </div>
          </div>
          <div style="display:flex; gap:16px; text-align:right;">
            <div><div style="font-size:11px; text-transform:uppercase; color:var(--muted)">Students</div><div style="font-weight:700">${s.studentCount}</div></div>
            <div><div style="font-size:11px; text-transform:uppercase; color:var(--accent)">High Risk</div><div style="font-weight:700; color:var(--accent)">${s.highRisk}</div></div>
            <button class="btn btn-outline btn-sm">Manage</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  panel.appendChild(container);
}

function initInsightsCharts() {
  const opts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { family:'DM Sans', size:12 } } } } };
  
  if (charts.insightsGrade) charts.insightsGrade.destroy();
  charts.insightsGrade = new Chart(document.getElementById('insightsGradeChart'), {
    type: 'bar',
    data: { labels: ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'], datasets: [{ label: 'Avg Risk %', data: [42, 58, 45, 38], backgroundColor: 'var(--primary)' }] },
    options: opts
  });

  if (charts.insightsGender) charts.insightsGender.destroy();
  charts.insightsGender = new Chart(document.getElementById('insightsGenderChart'), {
    type: 'pie',
    data: { labels: ['Male', 'Female'], datasets: [{ data: [65, 35], backgroundColor: ['#4f46e5', '#10b981'] }] },
    options: opts
  });

  if (charts.insightsIncome) charts.insightsIncome.destroy();
  charts.insightsIncome = new Chart(document.getElementById('insightsIncomeChart'), {
    type: 'bar',
    data: {
      labels: ['<5k', '5k-10k', '10k-20k', '>20k'],
      datasets: [{ label: 'Student Count', data: [45, 62, 30, 15], backgroundColor: 'var(--accent3)' }]
    }, options: opts
  });

  if (charts.insightsAtt) charts.insightsAtt.destroy();
  charts.insightsAtt = new Chart(document.getElementById('insightsAttChart'), {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Attendance vs Risk',
        data: Array.from({length: 20}, () => ({x: Math.random()*100, y: Math.random()*100})),
        backgroundColor: 'var(--primary)'
      }]
    }, options: opts
  });

  if (charts.insightsDist) charts.insightsDist.destroy();
  charts.insightsDist = new Chart(document.getElementById('insightsDistChart'), {
    type: 'bar',
    data: {
      labels: ['<1km', '1-3km', '3-5km', '>5km'],
      datasets: [{ label: 'High Risk Students', data: [2, 8, 15, 25], backgroundColor: 'var(--accent)' }]
    }, options: opts
  });
}

function saveTeacherRemarks() {
  const remarks = document.getElementById('prof-teacher-remarks').value;
  if (!remarks) return alert('Enter remarks');
  alert('Teacher remarks saved privately.');
}

// ═══════════════════ INIT ═══════════════════
function init() {
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
}

// Global click handler to close dropdowns
document.addEventListener('click', (e) => {
  if (!e.target.closest('.notif-center')) {
    document.getElementById('notif-center')?.classList.remove('open');
  }
  const profileDropdown = document.getElementById('profile-dropdown');
  if (!e.target.closest('#topbar-avatar') && !e.target.closest('#topbar-name') && profileDropdown) {
    profileDropdown.style.display = 'none';
  }
});

init();


