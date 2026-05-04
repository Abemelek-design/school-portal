// State Management
const AppStore = {
  data: JSON.parse(localStorage.getItem('uni_portal_data')),
  currentUser: JSON.parse(localStorage.getItem('uni_current_user')) || null,

  save() {
    localStorage.setItem('uni_portal_data', JSON.stringify(this.data));
    localStorage.setItem('uni_current_user', JSON.stringify(this.currentUser));
  },

  login(email, password) {
    const user = this.data.users.find(u => u.email === email && u.password === password);
    if (user) {
      this.currentUser = user;
      this.save();
      return true;
    }
    return false;
  },

  logout() {
    this.currentUser = null;
    this.save();
  },

  getStudentCourses(studentId) {
    const courseData = this.data.studentCourses[studentId] || { enrolled: [], completed: [] };
    const enrolled = this.data.availableCourses.filter(c => courseData.enrolled.includes(c.id));
    const completed = this.data.availableCourses.filter(c => courseData.completed.includes(c.id));
    return { enrolled, completed, raw: courseData };
  },

  toggleCourse(studentId, courseId) {
    if (!this.data.studentCourses[studentId]) this.data.studentCourses[studentId] = { enrolled: [], completed: [] };
    const courses = this.data.studentCourses[studentId];
    if (courses.completed.includes(courseId)) throw new Error("Cannot modify a completed course");

    const index = courses.enrolled.indexOf(courseId);
    const enrolledData = this.getStudentCourses(studentId).enrolled;
    const currentCredits = enrolledData.reduce((sum, c) => sum + c.credits, 0);
    const courseToAdd = this.data.availableCourses.find(c => c.id === courseId);

    if (index > -1) {
      courses.enrolled.splice(index, 1);
    } else {
      if (currentCredits + courseToAdd.credits > 18) throw new Error("Credit limit exceeded (18 max)");
      courses.enrolled.push(courseId);
    }
    this.save();
  },

  getStudentPayments(studentId) { return this.data.payments.filter(p => p.studentId === studentId); },
  getAllPayments() { return this.data.payments; },

  submitPayment(paymentObj) {
    let flags = [];
    if (this.data.payments.some(p => p.transactionId === paymentObj.transactionId)) flags.push("duplicate_transaction");
    if (Math.abs(15000 - parseFloat(paymentObj.amount)) > 5) flags.push("amount_out_of_range");
    if (!paymentObj.referenceCode || paymentObj.referenceCode !== this.currentUser.referenceCode) flags.push("missing_reference");

    let status = "Valid (Pending Approval)";
    if (flags.length === 1) status = "Needs Review";
    if (flags.length >= 2) status = "High Risk";

    const newPayment = {
      id: "pay_" + Date.now(),
      studentId: this.currentUser.id,
      studentName: this.currentUser.name,
      studentIdDisplay: this.currentUser.studentId,
      programGroup: this.currentUser.programGroup,
      type: paymentObj.type,
      expectedAmount: 15000,
      submittedAmount: parseFloat(paymentObj.amount),
      transactionId: paymentObj.transactionId,
      referenceCode: paymentObj.referenceCode,
      date: new Date().toISOString().split('T')[0],
      status: status,
      flags: flags,
      receiptImage: paymentObj.receiptImage
    };

    this.data.payments.push(newPayment);
    this.save();
    return newPayment;
  },

  updatePaymentStatus(paymentId, newStatus) {
    const p = this.data.payments.find(p => p.id === paymentId);
    if (p) {
      p.status = newStatus;
      this.save();
    }
  },

  getNotifications(userId) { return this.data.notifications[userId] || []; },
  markAllNotificationsRead(userId) {
    if (this.data.notifications[userId]) {
      this.data.notifications[userId].forEach(n => n.isRead = true);
      this.save();
    }
  }
};

// UI Controller
const app = {
  currentView: 'login',
  activeAdminDept: null,
  currentDate: new Date('2026-05-10'), // Mocked "Today" for demo (after deadline to show late fee)
  calendarMonth: new Date('2026-05-01'),

  init() {
    this.bindEvents();
    
    // Check for remembered credentials
    const remembered = JSON.parse(localStorage.getItem('uni_remembered'));
    if (remembered) {
      document.getElementById('email').value = remembered.e;
      document.getElementById('password').value = remembered.p;
      document.getElementById('remember-me').checked = true;
    }

    if (AppStore.currentUser) {
      this.renderSidebar();
      this.setupHeader();
      this.navigate(AppStore.currentUser.role === 'student' ? 'student-dashboard' : 'admin-dashboard');
    } else {
      this.navigate('login');
    }
  },

  bindEvents() {
    document.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const pass = document.getElementById('password').value;
      const remember = document.getElementById('remember-me').checked;

      if (AppStore.login(email, pass)) {
        if (remember) {
          localStorage.setItem('uni_remembered', JSON.stringify({e: email, p: pass}));
        } else {
          localStorage.removeItem('uni_remembered');
        }
        this.showToast("Login successful!", "success");
        this.renderSidebar();
        this.setupHeader();
        this.navigate(AppStore.currentUser.role === 'student' ? 'student-dashboard' : 'admin-dashboard');
      } else {
        this.showToast("Invalid credentials", "error");
      }
    });

    document.getElementById('logout-btn').addEventListener('click', () => { AppStore.logout(); this.navigate('login'); });

    document.getElementById('payment-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('receipt-file');
      if (fileInput.files.length === 0) return this.showToast("Upload a receipt", "error");
      AppStore.submitPayment({
        type: document.getElementById('pay-type').value,
        transactionId: document.getElementById('tx-id').value,
        amount: document.getElementById('pay-amount').value,
        referenceCode: AppStore.currentUser.referenceCode,
        receiptImage: URL.createObjectURL(fileInput.files[0])
      });
      this.showToast("Payment submitted", "success");
      e.target.reset();
      document.getElementById('file-preview').classList.add('hidden');
      this.renderStudentPaymentView();
    });
    document.getElementById('receipt-file').addEventListener('change', (e) => {
      if (e.target.files[0]) {
        document.getElementById('file-preview').innerHTML = `<img src="${URL.createObjectURL(e.target.files[0])}">`;
        document.getElementById('file-preview').classList.remove('hidden');
      }
    });

    document.getElementById('course-filter').addEventListener('change', () => this.renderStudentCourses());
    document.getElementById('lib-filter').addEventListener('change', () => this.renderLibrary());
    document.getElementById('lib-search').addEventListener('input', () => this.renderLibrary());
    document.getElementById('admin-filter-status').addEventListener('change', () => this.renderAdminPayments());
    document.getElementById('admin-filter-dept').addEventListener('change', () => this.renderAdminPayments());

    document.getElementById('admin-global-search').addEventListener('input', (e) => this.handleAdminGlobalSearch(e.target.value));
    
    // Notifications toggle
    document.getElementById('notif-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('notif-dropdown').classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#notif-dropdown') && !e.target.closest('#notif-btn')) {
        document.getElementById('notif-dropdown').classList.add('hidden');
      }
      if (!e.target.closest('#admin-global-header') && document.getElementById('search-results-dropdown')) {
        document.getElementById('search-results-dropdown').classList.add('hidden');
      }
    });

    // Notification filters
    document.querySelectorAll('.notif-filter').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.notif-filter').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.renderNotifications(e.target.dataset.category);
      });
    });

    // Mark all read
    document.getElementById('mark-all-read-btn').addEventListener('click', () => {
      AppStore.markAllNotificationsRead(AppStore.currentUser.id);
      this.renderNotifications('all');
    });

    // Calendar
    document.getElementById('cal-prev').addEventListener('click', () => {
      this.calendarMonth.setMonth(this.calendarMonth.getMonth() - 1);
      this.renderCalendar();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
      this.calendarMonth.setMonth(this.calendarMonth.getMonth() + 1);
      this.renderCalendar();
    });

    document.getElementById('admin-cal-prev').addEventListener('click', () => {
      this.calendarMonth.setMonth(this.calendarMonth.getMonth() - 1);
      this.renderAdminCalendar();
    });
    document.getElementById('admin-cal-next').addEventListener('click', () => {
      this.calendarMonth.setMonth(this.calendarMonth.getMonth() + 1);
      this.renderAdminCalendar();
    });
    
    document.getElementById('admin-student-filter').addEventListener('change', () => this.renderAdminStudentsGlobal());
    document.getElementById('admin-student-search').addEventListener('input', () => this.renderAdminStudentsGlobal());

    document.querySelector('.close-modal').addEventListener('click', () => document.getElementById('image-modal').classList.add('hidden'));
  },

  navigate(viewId) {
    document.querySelectorAll('.view').forEach(v => { v.classList.add('hidden'); v.classList.remove('active'); });
    const targetView = document.getElementById(`${viewId}-view`);
    if(targetView) { targetView.classList.remove('hidden'); targetView.classList.add('active'); }

    if (viewId === 'login') {
      document.getElementById('sidebar').classList.add('hidden');
      document.getElementById('top-nav-bar').classList.add('hidden');
      document.getElementById('student-profile-header').classList.add('hidden');
    } else {
      document.getElementById('sidebar').classList.remove('hidden');
      document.getElementById('top-nav-bar').classList.remove('hidden');
    }

    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.remove('active');
      if (n.dataset.view === viewId) n.classList.add('active');
    });

    this.currentView = viewId;
    this.renderView(viewId);
    // Auto-close mobile sidebar after navigating
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
  },

  setupHeader() {
    const user = AppStore.currentUser;
    if (user.role === 'admin') {
      document.getElementById('admin-global-search-container').classList.remove('hidden');
      document.getElementById('student-profile-header').classList.add('hidden');
      document.getElementById('notification-container').classList.remove('hidden');
      this.renderNotifications('all');
    } else {
      document.getElementById('admin-global-search-container').classList.add('hidden');
      document.getElementById('student-profile-header').classList.remove('hidden');
      document.getElementById('notification-container').classList.remove('hidden');
      
      document.getElementById('sph-avatar').src = user.profileImage;
      document.getElementById('sph-name').innerText = user.name;
      document.getElementById('sph-id').innerText = user.studentId;
      document.getElementById('sph-program').innerText = `${user.programName} - ${user.year}`;
      
      this.renderNotifications('all');
    }
  },

  renderNotifications(category = 'all') {
    const notifs = AppStore.getNotifications(AppStore.currentUser.id);
    const unreadCount = notifs.filter(n => !n.isRead).length;
    
    const badge = document.getElementById('notif-badge');
    if (unreadCount > 0) {
      badge.innerText = unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    let filtered = notifs;
    if (category !== 'all') filtered = notifs.filter(n => n.category === category);

    const list = document.getElementById('notif-list');
    if (filtered.length === 0) {
      list.innerHTML = `<div class="p-4 text-center text-muted" style="font-size:13px">No notifications in this category.</div>`;
      return;
    }

    list.innerHTML = filtered.map(n => `
      <div class="notif-item ${n.isRead ? '' : 'unread'}">
        <div class="notif-icon ${n.category}">
          ${n.category === 'academic' ? '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' : ''}
          ${n.category === 'payments' ? '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>' : ''}
          ${n.category === 'system' ? '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/></svg>' : ''}
        </div>
        <div class="notif-content">
          <div class="notif-title">${n.title}</div>
          <div class="notif-desc">${n.desc}</div>
          <div class="notif-meta">
            <span>${n.timestamp}</span>
            ${n.actionUrl && !n.isRead ? `<button class="notif-action-btn" onclick="app.navigate('${n.actionUrl}')">View</button>` : ''}
          </div>
        </div>
      </div>
    `).join('');
  },

  renderSidebar() {
    const user = AppStore.currentUser;
    const navMenu = document.getElementById('nav-menu');
    if (user.role === 'student') {
      navMenu.innerHTML = `
        <a class="nav-item" data-view="student-dashboard" onclick="app.navigate('student-dashboard')"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>Dashboard</a>
        <a class="nav-item" data-view="student-courses" onclick="app.navigate('student-courses')"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>Courses</a>
        <a class="nav-item" data-view="student-grades" onclick="app.navigate('student-grades')"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>Grades</a>
        <a class="nav-item" data-view="student-library" onclick="app.navigate('student-library')"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>Library</a>
        <a class="nav-item" data-view="student-payment" onclick="app.navigate('student-payment')"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>Payments</a>
        <a class="nav-item" data-view="student-settings" onclick="app.navigate('student-settings')"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Settings</a>
      `;
    } else {
      navMenu.innerHTML = `
        <a class="nav-item" data-view="admin-dashboard" onclick="app.navigate('admin-dashboard')"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>Dashboard</a>
        <a class="nav-item" data-view="admin-programs" onclick="app.navigate('admin-programs')"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>Programs & Departments</a>
        <a class="nav-item" data-view="admin-students" onclick="app.navigate('admin-students')"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>Students</a>
        <a class="nav-item" data-view="admin-payments" onclick="app.navigate('admin-payments')"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>Payment Verification</a>
        <a class="nav-item" data-view="admin-notifications" onclick="app.navigate('admin-notifications')"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>Notifications</a>
        <a class="nav-item" data-view="admin-settings" onclick="app.navigate('admin-settings')"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Settings</a>
      `;
    }
  },

  renderView(viewId) {
    if (viewId === 'student-dashboard') { this.renderStudentDashboard(); this.renderCalendar(); this.renderAgenda(); }
    if (viewId === 'student-courses') this.renderStudentCourses();
    if (viewId === 'student-library') this.renderLibrary();
    if (viewId === 'student-payment') {
      // Reset bank selector on each visit
      const bankSel = document.getElementById('bank-selector');
      if (bankSel) {
        bankSel.value = '';
        bankSel.style.borderColor = '';
      }
      const panel = document.getElementById('bank-details-panel');
      const ph = document.getElementById('bank-select-placeholder');
      if (panel) panel.classList.add('hidden');
      if (ph) ph.style.display = 'block';
      this.renderStudentPaymentView();
    }
    if (viewId === 'admin-dashboard') { this.renderAdminDashboard(); this.renderAdminCalendar(); this.renderAdminAgenda(); }
    if (viewId === 'admin-programs') this.renderAdminPrograms();
    if (viewId === 'admin-students') this.renderAdminStudentsGlobal();
    if (viewId === 'admin-payments') this.renderAdminPayments();
  },

  // --- STUDENT DASHBOARD + PHASE 3 ---

  renderStudentDashboard() {
    const user = AppStore.currentUser;
    document.getElementById('dash-gpa').innerText = user.gpa;
    document.getElementById('dash-cgpa').innerText = user.cgpa;
    
    const payments = AppStore.getStudentPayments(user.id);
    const latestPayment = payments[payments.length - 1];
    const statusEl = document.getElementById('dash-payment-status');
    if (latestPayment) {
      statusEl.innerText = latestPayment.status;
      statusEl.className = 'metric-value badge ' + this.getStatusBadgeClass(latestPayment.status);
    } else {
      statusEl.innerText = "Unpaid";
      statusEl.className = 'metric-value badge badge-danger';
    }
    const { enrolled } = AppStore.getStudentCourses(user.id);
    document.getElementById('dash-active-courses').innerText = enrolled.length;
  },

  renderCalendar() {
    const monthYear = this.calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
    document.getElementById('cal-month-year').innerText = monthYear;

    const year = this.calendarMonth.getFullYear();
    const month = this.calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const todayStr = this.currentDate.toISOString().split('T')[0];

    let html = '';
    for (let i = 0; i < firstDay; i++) {
      html += `<div class="cal-day empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const isToday = dateStr === todayStr;
      
      const dayEvents = AppStore.data.calendarEvents.filter(e => e.date === dateStr);
      let dotsHtml = dayEvents.map(e => `<div class="cal-event-label ${e.type}" title="${e.title}">${e.title}</div>`).join('');

      html += `
        <div class="cal-day ${isToday ? 'today' : ''}" title="${dayEvents.map(e=>e.title).join(', ')}">
          <div class="day-num">${day}</div>
          <div class="cal-events">${dotsHtml}</div>
        </div>
      `;
    }
    document.getElementById('cal-days-body').innerHTML = html;
  },

  renderAgenda() {
    const today = this.currentDate;
    const limit = new Date(today);
    limit.setDate(today.getDate() + 14); // Next 14 days

    const events = AppStore.data.calendarEvents.filter(e => {
      const eDate = new Date(e.date);
      return eDate >= today && eDate <= limit;
    }).sort((a,b) => new Date(a.date) - new Date(b.date));

    const list = document.getElementById('agenda-list');
    if (events.length === 0) {
      list.innerHTML = `<div class="p-4 text-center text-muted" style="font-size:13px">No upcoming events in the next 14 days.</div>`;
      return;
    }

    list.innerHTML = events.map(e => {
      const d = new Date(e.date);
      const month = d.toLocaleString('default', { month: 'short' });
      const day = d.getDate();
      return `
        <div class="agenda-item">
          <div class="agenda-date-box">
            <div class="ad-month">${month}</div>
            <div class="ad-day">${day}</div>
          </div>
          <div class="agenda-content">
            <div class="agenda-title">${e.title}</div>
            <div class="agenda-type"><span class="dot ${e.type}"></span> ${e.type.charAt(0).toUpperCase() + e.type.slice(1)}</div>
          </div>
          ${e.type === 'deadline' ? `<button class="btn-primary btn-sm" onclick="app.navigate('student-payment')">Action</button>` : ''}
        </div>
      `;
    }).join('');
  },

  renderStudentCourses() {
    const user = AppStore.currentUser;
    document.getElementById('scv-program').innerText = user.programName;
    document.getElementById('scv-year').innerText = user.year;
    document.getElementById('scv-sem').innerText = user.semester;

    const filter = document.getElementById('course-filter').value;
    const { enrolled, completed, raw } = AppStore.getStudentCourses(user.id);
    
    let displayCourses = AppStore.data.availableCourses;
    if (filter === 'enrolled') displayCourses = enrolled;
    if (filter === 'completed') displayCourses = completed;

    document.getElementById('student-courses-table').innerHTML = displayCourses.map(c => {
      const isEnrolled = raw.enrolled.includes(c.id);
      const isCompleted = raw.completed.includes(c.id);
      let statusHtml = `<span class="badge badge-info">Available</span>`;
      let actionHtml = `<button class="btn-success btn-sm" onclick="app.toggleCourse('${c.id}')">Enroll</button>`;
      
      if (isEnrolled) {
        statusHtml = `<span class="badge badge-warning" style="background:#fef3c7;color:#d97706">Enrolled</span>`;
        actionHtml = `<button class="btn-danger btn-sm" onclick="app.toggleCourse('${c.id}')">Drop</button>`;
      } else if (isCompleted) {
        statusHtml = `<span class="badge badge-success">Completed</span>`;
        actionHtml = `<span class="text-muted" style="font-size:12px">Earned</span>`;
      }

      return `<tr><td><div class="fw-bold">${c.name}</div><div class="font-mono text-muted" style="font-size:12px">${c.code}</div></td><td>${c.credits}</td><td>${statusHtml}</td><td class="text-right">${actionHtml}</td></tr>`;
    }).join('');
  },

  toggleCourse(courseId) {
    try {
      AppStore.toggleCourse(AppStore.currentUser.id, courseId);
      this.renderStudentCourses();
      this.renderStudentDashboard();
      this.showToast("Course list updated", "success");
    } catch (e) {
      this.showToast(e.message, "error");
    }
  },

  renderLibrary() {
    const search = document.getElementById('lib-search').value.toLowerCase();
    const filter = document.getElementById('lib-filter').value;
    let items = AppStore.data.library;
    if (filter !== 'all') items = items.filter(i => i.type === filter);
    if (search) items = items.filter(i => i.title.toLowerCase().includes(search) || i.courseTag.toLowerCase().includes(search));

    const grid = document.getElementById('library-grid');
    if (items.length === 0) {
      grid.innerHTML = `<div class="text-center text-muted full-width mt-6" style="grid-column: 1/-1">No materials found.</div>`;
      return;
    }
    grid.innerHTML = items.map(item => `
      <div class="lib-card">
        <div class="lib-type-icon"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
        <div class="badge badge-info mb-2" style="align-self:flex-start">${item.courseTag}</div>
        <h3>${item.title}</h3>
        <div class="lib-meta"><span>${item.type} • ${item.size}</span><button class="btn-primary btn-sm" onclick="app.mockDownload('${item.title}')"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></button></div>
      </div>
    `).join('');
  },
  mockDownload(title) { this.showToast(`Downloading: ${title}`, "success"); },

  // Bank account info per bank
  bankInfo: {
    'CBE': {
      name: 'Commercial Bank of Ethiopia (CBE)',
      accountName: 'Atomic University Finance Office',
      accountNo: '1000284739284'
    },
    'Amhara Bank': {
      name: 'Amhara Bank',
      accountName: 'Atomic University Finance Office',
      accountNo: '2100938475610'
    },
    'Awash Bank': {
      name: 'Awash Bank',
      accountName: 'Atomic University Finance Office',
      accountNo: '0132847592016'
    },
    'Coop': {
      name: 'Cooperative Bank of Oromia (Coop)',
      accountName: 'Atomic University Finance Office',
      accountNo: '3200748291034'
    },
    'Oromia Bank': {
      name: 'Oromia Bank',
      accountName: 'Atomic University Finance Office',
      accountNo: '4019283746510'
    }
  },

  getLateFeeInfo() {
    // Deadline is the first 'deadline' type event in the calendar
    const deadlineEvent = AppStore.data.calendarEvents.find(e => e.type === 'deadline' && e.title.toLowerCase().includes('tuition'));
    if (!deadlineEvent) return { isLate: false, daysLate: 0, lateFee: 0, totalDue: 15000 };

    const deadline = new Date(deadlineEvent.date);
    const today = this.currentDate;
    // Compare date only (strip time)
    deadline.setHours(0, 0, 0, 0);
    const todayMidnight = new Date(today);
    todayMidnight.setHours(0, 0, 0, 0);

    const msPerDay = 1000 * 60 * 60 * 24;
    const daysLate = Math.max(0, Math.floor((todayMidnight - deadline) / msPerDay));
    const lateFee = daysLate * 50;
    const totalDue = 15000 + lateFee;
    return { isLate: daysLate > 0, daysLate, lateFee, totalDue, deadlineDate: deadlineEvent.date };
  },

  renderStudentPaymentView() {
    // Late fee calculation
    const { isLate, daysLate, lateFee, totalDue, deadlineDate } = this.getLateFeeInfo();
    const banner = document.getElementById('late-fee-banner');
    const lateText = document.getElementById('late-fee-text');
    if (isLate) {
      lateText.innerHTML = `The payment deadline was <strong>${deadlineDate}</strong>. You are <strong>${daysLate} day${daysLate > 1 ? 's' : ''}</strong> late.<br>A late fee of <strong>50 ETB × ${daysLate} = ${lateFee.toLocaleString()} ETB</strong> has been added.<br>Total amount due: <strong style="font-size:15px;">${totalDue.toLocaleString()} ETB</strong>`;
      banner.classList.remove('hidden');
      banner.style.display = 'flex';
    } else {
      banner.classList.add('hidden');
      banner.style.display = 'none';
    }

    // Store totalDue for bank panel
    this._currentTotalDue = totalDue;

    // Update amount due in bank panel if a bank is already selected
    const selectedBank = document.getElementById('bank-selector').value;
    if (selectedBank) this.onBankSelect(selectedBank);

    // Ref code
    const refEl = document.getElementById('payment-ref-code');
    if (refEl) refEl.innerText = AppStore.currentUser.referenceCode;

    // Payment history
    const payments = AppStore.getStudentPayments(AppStore.currentUser.id);
    const tbody = document.getElementById('student-payment-history');
    if (payments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center">No payment history.</td></tr>`;
    } else {
      tbody.innerHTML = payments.slice().reverse().map(p => `<tr><td>${p.date}</td><td style="text-transform: capitalize">${p.type}</td><td class="font-mono">${p.transactionId}</td><td class="fw-bold">${p.submittedAmount} ETB</td><td><span class="badge ${this.getStatusBadgeClass(p.status)}">${p.status}</span></td></tr>`).join('');
    }
  },

  onBankSelect(bankKey) {
    const panel = document.getElementById('bank-details-panel');
    const placeholder = document.getElementById('bank-select-placeholder');
    const selector = document.getElementById('bank-selector');

    if (!bankKey) {
      panel.classList.add('hidden');
      placeholder.style.display = 'block';
      return;
    }

    const info = this.bankInfo[bankKey];
    if (!info) return;

    document.getElementById('bd-bank-name').innerText = info.name;
    document.getElementById('bd-account-name').innerText = info.accountName;
    document.getElementById('bd-account-no').innerText = info.accountNo;
    document.getElementById('payment-ref-code').innerText = AppStore.currentUser ? AppStore.currentUser.referenceCode : '---';

    const totalDue = this._currentTotalDue || 15000;
    document.getElementById('bd-amount-due').innerText = totalDue.toLocaleString() + ' ETB';

    // Style amount red if late fee applies
    const amountEl = document.getElementById('bd-amount-due');
    if (totalDue > 15000) {
      amountEl.style.color = '#dc2626';
      document.getElementById('bd-amount-due').closest('.detail-row').style.background = '#fef2f2';
      document.getElementById('bd-amount-due').closest('.detail-row').style.borderColor = '#fca5a5';
    } else {
      amountEl.style.color = '#15803d';
      document.getElementById('bd-amount-due').closest('.detail-row').style.background = '#f0fdf4';
      document.getElementById('bd-amount-due').closest('.detail-row').style.borderColor = '#bbf7d0';
    }

    // Animate selector border
    selector.style.borderColor = 'var(--primary)';

    panel.classList.remove('hidden');
    placeholder.style.display = 'none';
  },

  // --- ADMIN METHODS ---
  handleAdminGlobalSearch(query) {
    const dropdown = document.getElementById('search-results-dropdown');
    if (!query || query.length < 2) return dropdown.classList.add('hidden');
    
    const q = query.toLowerCase();
    let results = [];
    
    AppStore.data.users.filter(u => u.role === 'student').forEach(s => {
      if (s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || s.programName.toLowerCase().includes(q)) {
        results.push({ type: 'Student', title: s.name, subtitle: `${s.studentId} • ${s.programName}`, action: `app.renderAdminStudentDetail('${s.id}')` });
      }
    });

    AppStore.data.payments.forEach(p => {
      if (p.transactionId.toLowerCase().includes(q) || p.referenceCode.toLowerCase().includes(q)) {
        results.push({ type: 'Payment', title: p.transactionId, subtitle: `From: ${p.studentName} • ${p.status}`, action: `app.navigate('admin-payments')` });
      }
    });

    if (results.length === 0) {
      dropdown.innerHTML = `<div class="p-4 text-center text-muted">No results found for "${query}"</div>`;
    } else {
      dropdown.innerHTML = results.slice(0, 8).map(r => `<div class="search-result-item" onclick="document.getElementById('search-results-dropdown').classList.add('hidden'); ${r.action}"><div><div class="sr-type">${r.type}</div><div class="sr-title">${r.title}</div><div class="sr-subtitle">${r.subtitle}</div></div><svg width="16" height="16" fill="none" stroke="var(--secondary)" stroke-width="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></div>`).join('');
    }
    dropdown.classList.remove('hidden');
  },

  renderAdminDashboard() {
    const students = AppStore.data.users.filter(u => u.role === 'student');
    const allPayments = AppStore.getAllPayments();
    
    document.getElementById('admin-total-students').innerText = students.length;
    document.getElementById('admin-pending-payments').innerText = allPayments.filter(p => p.status === 'Pending Approval' || p.status === 'Needs Review').length;
    document.getElementById('admin-approved-payments').innerText = allPayments.filter(p => p.status === 'Paid').length;
    document.getElementById('admin-rejected-payments').innerText = allPayments.filter(p => p.status === 'Rejected' || p.status === 'High Risk').length;
  },

  renderAdminPrograms() {
    const students = AppStore.data.users.filter(u => u.role === 'student');
    document.getElementById('admin-programs-grid').innerHTML = AppStore.data.departments.map(dept => {
      const count = students.filter(s => s.programGroup === dept.group).length;
      return `<div class="dept-card" onclick="app.renderAdminDepartments('${dept.group}')"><div class="dept-group">PROGRAM</div><div class="dept-title">${dept.group}</div><div class="dept-stats"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>${dept.programs.length} Departments | ${count} Students</div></div>`;
    }).join('');
  },

  renderAdminDepartments(groupName) {
    const students = AppStore.data.users.filter(u => u.role === 'student');
    const dept = AppStore.data.departments.find(d => d.group === groupName);
    document.getElementById('adv-title').innerText = groupName;
    
    document.getElementById('admin-dept-grid').innerHTML = dept.programs.map(prog => {
      const count = students.filter(s => s.programGroup === groupName && s.programName === prog).length;
      return `<div class="dept-card" onclick="app.renderAdminDeptList('${prog}', '${groupName}')"><div class="dept-group">${groupName}</div><div class="dept-title">${prog}</div><div class="dept-stats"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>${count} Students</div></div>`;
    }).join('');
    this.navigate('admin-departments');
  },

  renderAdminDeptList(programName, groupName) {
    this.activeAdminDept = { programName, groupName };
    document.getElementById('aps-title').innerText = programName;
    document.getElementById('aps-subtitle').innerText = groupName;
    
    const students = AppStore.data.users.filter(u => u.role === 'student' && u.programName === programName && u.programGroup === groupName);
    const tbody = document.getElementById('aps-table');
    
    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center">No students registered in this program yet.</td></tr>`;
    } else {
      tbody.innerHTML = students.map(s => {
        const p = AppStore.getStudentPayments(s.id).pop();
        const payStatusHtml = p ? `<span class="badge ${this.getStatusBadgeClass(p.status)}">${p.status}</span>` : `<span class="badge badge-danger">Unpaid</span>`;
        return `<tr><td><div class="fw-bold">${s.name}</div><div class="text-muted" style="font-size:12px">${s.email}</div></td><td class="font-mono">${s.studentId}</td><td>${payStatusHtml}</td><td><span class="badge badge-info">${s.academicStatus}</span></td><td class="text-right"><button class="btn-primary btn-sm" onclick="app.renderAdminStudentDetail('${s.id}')">View Details</button></td></tr>`;
      }).join('');
    }
    this.navigate('admin-program-students');
  },

  navigateToPayments(status) {
    const filterSelect = document.getElementById('admin-filter-status');
    if (filterSelect) {
      if (status) filterSelect.value = status;
      else filterSelect.value = 'all';
    }
    this.navigate('admin-payments');
  },

  renderAdminStudentsGlobal() {
    const filter = document.getElementById('admin-student-filter').value;
    const search = document.getElementById('admin-student-search').value.toLowerCase();
    let students = AppStore.data.users.filter(u => u.role === 'student');
    
    if (filter !== 'all') students = students.filter(s => s.programGroup === filter);
    if (search) students = students.filter(s => s.name.toLowerCase().includes(search) || s.studentId.toLowerCase().includes(search));

    const tbody = document.getElementById('admin-students-table');
    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center">No students found.</td></tr>`;
    } else {
      tbody.innerHTML = students.map(s => {
        const p = AppStore.getStudentPayments(s.id).pop();
        const payStatusHtml = p ? `<span class="badge ${this.getStatusBadgeClass(p.status)}">${p.status}</span>` : `<span class="badge badge-danger">Unpaid</span>`;
        return `<tr><td><div class="fw-bold">${s.name}</div><div class="text-muted" style="font-size:12px">${s.email}</div></td><td class="font-mono">${s.studentId}</td><td><div class="fw-bold">${s.programName}</div><div class="text-muted" style="font-size:11px">${s.programGroup}</div></td><td>${payStatusHtml}</td><td class="text-right"><button class="btn-primary btn-sm" onclick="app.renderAdminStudentDetail('${s.id}')">View Details</button></td></tr>`;
      }).join('');
    }

    const deptSelect = document.getElementById('admin-student-filter');
    if (deptSelect.options.length === 1) {
      AppStore.data.departments.forEach(d => deptSelect.add(new Option(d.group, d.group)));
    }
  },

  renderAdminCalendar() {
    const monthYear = this.calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
    document.getElementById('admin-cal-month-year').innerText = monthYear;

    const year = this.calendarMonth.getFullYear();
    const month = this.calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const todayStr = this.currentDate.toISOString().split('T')[0];

    let html = '';
    for (let i = 0; i < firstDay; i++) {
      html += `<div class="cal-day empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const isToday = dateStr === todayStr;
      
      const dayEvents = AppStore.data.calendarEvents.filter(e => e.date === dateStr && (e.scope === 'global' || e.scope === 'admin'));
      let dotsHtml = dayEvents.map(e => `<div class="cal-event-label ${e.type}" title="${e.title}">${e.title}</div>`).join('');

      html += `
        <div class="cal-day ${isToday ? 'today' : ''}" title="${dayEvents.map(e=>e.title).join(', ')}">
          <div class="day-num">${day}</div>
          <div class="cal-events">${dotsHtml}</div>
        </div>
      `;
    }
    document.getElementById('admin-cal-days-body').innerHTML = html;
  },

  renderAdminAgenda() {
    const today = this.currentDate;
    const limit = new Date(today);
    limit.setDate(today.getDate() + 14); // Next 14 days

    const events = AppStore.data.calendarEvents.filter(e => {
      const eDate = new Date(e.date);
      return eDate >= today && eDate <= limit && (e.scope === 'global' || e.scope === 'admin');
    }).sort((a,b) => new Date(a.date) - new Date(b.date));

    const list = document.getElementById('admin-agenda-list');
    if (events.length === 0) {
      list.innerHTML = `<div class="p-4 text-center text-muted" style="font-size:13px">No upcoming events in the next 14 days.</div>`;
      return;
    }

    list.innerHTML = events.map(e => {
      const d = new Date(e.date);
      const month = d.toLocaleString('default', { month: 'short' });
      const day = d.getDate();
      return `
        <div class="agenda-item">
          <div class="agenda-date-box">
            <div class="ad-month">${month}</div>
            <div class="ad-day">${day}</div>
          </div>
          <div class="agenda-content">
            <div class="agenda-title">${e.title}</div>
            <div class="agenda-type"><span class="dot ${e.type}"></span> ${e.type.charAt(0).toUpperCase() + e.type.slice(1)}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  goBackFromStudentDetail() {
    if (this.activeAdminDept) this.navigate('admin-program-students');
    else this.navigate('admin-students');
  },

  renderAdminStudentDetail(studentId) {
    const student = AppStore.data.users.find(u => u.id === studentId);
    if (!student) return;

    document.getElementById('asd-avatar').src = student.profileImage;
    document.getElementById('asd-name').innerText = student.name;
    document.getElementById('asd-id').innerText = student.studentId;
    document.getElementById('asd-program').innerText = `${student.programName} - ${student.year}`;
    document.getElementById('asd-status').innerText = student.academicStatus;
    document.getElementById('asd-status').className = 'badge ' + (student.academicStatus === 'Active' ? 'badge-success' : 'badge-warning');

    document.getElementById('asd-gpa').innerText = student.gpa;
    document.getElementById('asd-cgpa').innerText = student.cgpa;

    const { enrolled, completed } = AppStore.getStudentCourses(student.id);
    const allC = [...enrolled.map(c => ({...c, st: 'Enrolled', cls: 'badge-warning'})), ...completed.map(c => ({...c, st: 'Completed', cls: 'badge-success'}))];
    document.getElementById('asd-courses').innerHTML = allC.length === 0 ? `<tr><td colspan="3" class="text-center text-muted">No courses</td></tr>` : allC.map(c => `<tr><td><div class="fw-bold">${c.name}</div><div class="font-mono text-muted" style="font-size:11px">${c.code}</div></td><td>${c.credits}</td><td><span class="badge ${c.cls}">${c.st}</span></td></tr>`).join('');

    const payments = AppStore.getStudentPayments(student.id);
    document.getElementById('asd-payments').innerHTML = payments.length === 0 ? `<tr><td colspan="5" class="text-center text-muted">No payments</td></tr>` : payments.reverse().map(p => `<tr><td>${p.date}</td><td style="text-transform:capitalize">${p.type}</td><td><div class="font-mono fw-bold">${p.transactionId}</div><div class="font-mono text-muted" style="font-size:11px">${p.referenceCode}</div></td><td class="fw-bold">${p.submittedAmount} ETB</td><td><span class="badge ${this.getStatusBadgeClass(p.status)} mb-1">${p.status}</span></td></tr>`).join('');

    this.navigate('admin-student-detail');
  },

  renderAdminPayments() {
    const allPayments = AppStore.getAllPayments();
    const filterStatus = document.getElementById('admin-filter-status').value;
    const filterDept = document.getElementById('admin-filter-dept').value;

    let filtered = allPayments;
    if (filterStatus !== 'all') filtered = filtered.filter(p => p.status === filterStatus);
    if (filterDept !== 'all') {
      const studentsInDept = AppStore.data.users.filter(u => u.programName === filterDept).map(u => u.id);
      filtered = filtered.filter(p => studentsInDept.includes(p.studentId));
    }

    const tbody = document.getElementById('admin-payments-table');
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center">No payments found.</td></tr>`;
    } else {
      tbody.innerHTML = filtered.reverse().map(p => `<tr><td><div class="fw-bold">${p.studentName}</div><div class="font-mono text-muted" style="font-size:11px">${p.studentIdDisplay}</div></td><td><div class="font-mono fw-bold">${p.transactionId}</div><div class="font-mono text-muted" style="font-size:11px">${p.referenceCode}</div></td><td>${p.expectedAmount}</td><td class="${p.expectedAmount !== p.submittedAmount ? 'text-danger fw-bold' : ''}">${p.submittedAmount}</td><td><span class="badge ${this.getStatusBadgeClass(p.status)} mb-1">${p.status}</span></td><td><img src="${p.receiptImage}" class="receipt-thumb" onclick="app.showImageModal('${p.receiptImage}')" alt="Receipt"></td><td class="action-btns"><button class="btn-primary btn-sm" onclick="app.openPaymentDetail('${p.id}')">Review</button></td></tr>`).join('');
    }
  },

  openPaymentDetail(paymentId) {
    const p = AppStore.data.payments.find(x => x.id === paymentId);
    if (!p) return;
    
    let flagsHtml = p.flags.length > 0 ? `<div class="mb-4" style="border-radius:8px; background:#fef2f2; color:#ef4444; border: 1px solid #fca5a5; padding: 1rem; font-size: 13px;"><b><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align: middle; margin-right: 4px; margin-top:-2px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg> High Risk Flags:</b> ${p.flags.join(', ').replace(/_/g, ' ')}</div>` : '';
    
    let actionsHtml = !['Paid', 'Rejected'].includes(p.status) ? 
      `<button style="flex:1; padding: 0.8rem; font-size: 14px; font-weight: 600; border-radius: 8px; background: var(--success); color: white; border: none; cursor: pointer; transition: 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'" onclick="app.updatePaymentStatus('${p.id}', 'Paid'); document.getElementById('payment-detail-modal').classList.add('hidden')">Approve Payment</button>
       <button style="flex:1; padding: 0.8rem; font-size: 14px; font-weight: 600; border-radius: 8px; background: var(--danger); color: white; border: none; cursor: pointer; transition: 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'" onclick="app.updatePaymentStatus('${p.id}', 'Rejected'); document.getElementById('payment-detail-modal').classList.add('hidden')">Reject Payment</button>` : 
      `<div class="text-center full-width text-muted" style="padding: 1rem; background: #f1f5f9; border-radius: 8px; font-weight: 500;">This payment has been marked as <b style="color: ${p.status === 'Paid' ? 'var(--success)' : 'var(--danger)'}">${p.status}</b></div>`;

    document.getElementById('pdm-body').innerHTML = `
      ${flagsHtml}
      <div style="display: flex; flex-wrap: wrap; gap: 1.5rem; margin-bottom: 1.5rem;">
        <div style="flex: 1; min-width: 200px;">
          <h4 class="text-muted mb-2" style="font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Student Information</h4>
          <div class="fw-bold" style="font-size:16px;">${p.studentName}</div>
          <div class="font-mono text-muted" style="font-size:13px; margin-top:2px;">${p.studentIdDisplay}</div>
          <div class="text-muted mt-1" style="font-size:13px;">${p.programGroup}</div>
          <button class="btn-ghost btn-sm mt-3" style="width:100%; border-color:var(--primary); color:var(--primary);" onclick="document.getElementById('payment-detail-modal').classList.add('hidden'); app.renderAdminStudentDetail('${p.studentId}')">View Full Profile</button>
        </div>
        <div style="flex: 1; min-width: 200px;">
          <h4 class="text-muted mb-2" style="font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Transaction Details</h4>
          <div class="detail-row" style="padding:0.4rem 0;"><span class="label text-muted">Date:</span> <span class="val fw-bold">${p.date}</span></div>
          <div class="detail-row" style="padding:0.4rem 0;"><span class="label text-muted">TX ID:</span> <span class="val font-mono fw-bold">${p.transactionId}</span></div>
          <div class="detail-row" style="padding:0.4rem 0;"><span class="label text-muted">Ref Code:</span> <span class="val font-mono">${p.referenceCode}</span></div>
          <div class="detail-row" style="padding:0.4rem 0; border:none;"><span class="label text-muted">Type:</span> <span class="val" style="text-transform:capitalize; font-weight:500;">${p.type} Fee</span></div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; background:#f8fafc; padding: 1.25rem; border-radius: 8px; border: 1px solid var(--border);">
        <div class="text-center" style="border-right: 1px solid var(--border);">
          <div class="text-muted" style="font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Expected Amount</div>
          <div class="fw-bold" style="font-size:1.4rem;">${p.expectedAmount} <span style="font-size:14px; font-weight:500; color:var(--text-muted);">ETB</span></div>
        </div>
        <div class="text-center">
          <div class="text-muted" style="font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Submitted Amount</div>
          <div class="fw-bold ${p.expectedAmount !== p.submittedAmount ? 'text-danger' : 'text-success'}" style="font-size:1.4rem;">${p.submittedAmount} <span style="font-size:14px; font-weight:500;">ETB</span></div>
        </div>
      </div>
      <div class="mb-6">
        <h4 class="text-muted mb-2" style="font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Uploaded Receipt</h4>
        <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem; text-align: center;">
          <img src="${p.receiptImage}" style="max-width:100%; border-radius:4px; max-height:220px; object-fit:contain; cursor:zoom-in; transition: 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'" onclick="app.showImageModal('${p.receiptImage}')" title="Click to enlarge">
        </div>
      </div>
      <div style="display: flex; gap: 1rem; margin-top: 2rem;">
        ${actionsHtml}
      </div>
    `;
    
    document.getElementById('payment-detail-modal').classList.remove('hidden');
  },

  updatePaymentStatus(paymentId, status) {
    AppStore.updatePaymentStatus(paymentId, status);
    this.renderAdminPayments();
    this.renderAdminDashboard();
    this.showToast(`Payment marked as ${status}`, "success");
  },

  getStatusBadgeClass(status) {
    if (status === 'Paid') return 'badge-success';
    if (status === 'Rejected' || status === 'High Risk') return 'badge-danger';
    if (status === 'Needs Review') return 'badge-warning';
    return 'badge-info';
  },

  showImageModal(src) {
    document.getElementById('modal-image').src = src;
    document.getElementById('image-modal').classList.remove('hidden');
  },

  showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => { app.init(); });
