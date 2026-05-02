const MOCK_DATA = {
  departments: [
    { group: "BA Regular", programs: ["Aviation Management", "Marketing Management", "Hotel Management"] },
    { group: "MSC", programs: ["International Trade & Economics"] },
    { group: "MBA", programs: ["Logistics & Supply Chain Management"] },
    { group: "BSC Regular", programs: ["Aviation Management", "Pharmacy", "Nursing", "Computer Science"] },
    { group: "BA Distance", programs: ["Marketing Management", "Business Management", "Accounting & Finance"] },
    { group: "TVET Programs", programs: ["Marketing and Sales Management (Level IV)", "Accounting and Finance (Level IV)", "Front Office Service (Level IV)", "Food & Beverage Service (Level IV)", "Hardware & Networking Service (Level IV)", "Nursing (Level IV)", "Pharmacy (Level IV)"] },
    { group: "Certification Programs", programs: ["Ticketing and Reservation", "Airline Cabin Crew", "Airport Operations", "Cargo Operations", "Dangerous Goods Regulation", "Airline Customer Service", "Flight Operation Officer", "Crew Resource Management", "Aircraft Maintenance Technician", "Instructor Development Program"] }
  ],

  users: [
    {
      id: "u_student1",
      studentId: "STU-2024-001",
      email: "student@demo.com",
      password: "demo123",
      role: "student",
      name: "Abebe Kebede",
      profileImage: "https://i.pravatar.cc/150?u=student1",
      programGroup: "BSC Regular",
      programName: "Computer Science",
      year: "Year 3",
      semester: "Semester 1, 2026",
      cgpa: 3.45,
      gpa: 3.6,
      referenceCode: "UNI-2026-SEM1-A8F2",
      academicStatus: "Active"
    },
    {
      id: "u_admin1",
      email: "admin@demo.com",
      password: "demo123",
      role: "admin",
      name: "Finance Manager",
      profileImage: "https://i.pravatar.cc/150?u=admin"
    }
  ],
  
  availableCourses: [
    { id: "c1", code: "CS101", name: "Introduction to Computer Science", credits: 4, department: "Computer Science" },
    { id: "c2", code: "MATH201", name: "Calculus II", credits: 3, department: "Mathematics" },
    { id: "c3", code: "PHY101", name: "General Physics", credits: 4, department: "Physics" },
    { id: "c4", code: "ENG102", name: "Academic Writing", credits: 3, department: "English" }
  ],

  studentCourses: {
    "u_student1": {
      enrolled: ["c1", "c2"],
      completed: ["c3", "c4"]
    }
  },

  payments: [
    {
      id: "pay_1",
      studentId: "u_student1",
      studentName: "Abebe Kebede",
      studentIdDisplay: "STU-2024-001",
      programGroup: "BSC Regular",
      type: "tuition",
      expectedAmount: 15000,
      submittedAmount: 15000,
      transactionId: "FT92384729",
      referenceCode: "UNI-2026-SEM1-A8F2",
      date: "2026-05-01",
      status: "Paid",
      flags: [],
      receiptImage: "https://images.unsplash.com/photo-1620052581699-2a9db2ea06ce?auto=format&fit=crop&w=400&q=80"
    }
  ],

  library: [
    { id: "lib_1", title: "Introduction to Computer Science (Chapter 1-3)", type: "Lecture notes", courseTag: "CS101", size: "2.4 MB" },
    { id: "lib_2", title: "Calculus II Formula Sheet", type: "PDFs", courseTag: "MATH201", size: "1.1 MB" }
  ],

  calendarEvents: [
    // Student specific
    { id: "ev_1", title: "Tuition Payment Deadline", date: "2026-05-08", type: "deadline", scope: "global" },
    { id: "ev_2", title: "Database Systems Exam", date: "2026-05-12", type: "exam", scope: "student" },
    { id: "ev_3", title: "Calculus II Midterm", date: "2026-05-15", type: "exam", scope: "student" },
    { id: "ev_4", title: "National Independence Day", date: "2026-05-28", type: "holiday", scope: "global" },
    // Admin specific
    { id: "ev_5", title: "TVET Level IV Final Exams", date: "2026-05-14", type: "exam", scope: "admin" },
    { id: "ev_6", title: "End of Late Registration", date: "2026-05-10", type: "deadline", scope: "global" },
    { id: "ev_7", title: "System Maintenance window", date: "2026-05-20", type: "holiday", scope: "admin" } // Holiday color for no-class/system
  ],

  notifications: {
    "u_student1": [
      { id: "n_1", title: "Exam Scheduled", desc: "Your Database Systems exam is scheduled on May 12.", timestamp: "2 hours ago", category: "academic", isRead: false },
      { id: "n_2", title: "Payment Approaching", desc: "Reminder: Tuition deadline is on May 8. Please complete your payment.", timestamp: "1 day ago", category: "payments", isRead: false, actionUrl: "student-payment" },
      { id: "n_3", title: "Payment Approved", desc: "Your tuition payment (FT92384729) was verified.", timestamp: "3 days ago", category: "payments", isRead: true },
      { id: "n_4", title: "Profile Update", desc: "Your semester registration is complete.", timestamp: "1 week ago", category: "system", isRead: true }
    ],
    "u_admin1": [
      { id: "n_a1", title: "Pending Verification Spike", desc: "50+ new payments have been submitted in the last hour.", timestamp: "10 mins ago", category: "payments", isRead: false, actionUrl: "admin-payments" },
      { id: "n_a2", title: "High-Risk Flag", desc: "Duplicate transaction ID detected for FT92384729.", timestamp: "1 hour ago", category: "payments", isRead: false, actionUrl: "admin-payments" },
      { id: "n_a3", title: "Exam Schedules Published", desc: "TVET Level IV exams have been added to the calendar.", timestamp: "5 hours ago", category: "academic", isRead: true, actionUrl: "admin-calendar" }
    ]
  }
};

// --- AUTO-GENERATOR FOR 700 STUDENTS ---
const generateStudents = (count) => {
  const firstNames = ["Abebe", "Kebede", "Chala", "Hana", "Kidist", "Dawit", "Natnael", "Sara", "Betelhem", "Ephrem", "Meron", "Yonas", "Fasil", "Selam", "Tigist", "Biniam", "Kalkidan", "Ermias", "Mahlet", "Biruk", "Aman", "Robel", "Lidet", "Feven", "Nardos"];
  const lastNames = ["Tadesse", "Alemu", "Bekele", "Tesfaye", "Mekonnen", "Haile", "Girma", "Assefa", "Zewde", "Worku", "Getachew", "Demissie", "Tilahun", "Belay", "Negash", "Tefera", "Mengistu", "Alemayehu", "Hailu", "Desta"];
  
  const statuses = ["Paid", "Unpaid", "Pending Approval", "Needs Review", "High Risk"];
  const academicStatuses = ["Active", "Active", "Active", "Probation", "Inactive"]; // Weighted towards active
  const years = ["Year 1", "Year 2", "Year 3", "Year 4"];
  const semesters = ["Semester 1, 2026", "Semester 2, 2026"];

  let allPrograms = [];
  MOCK_DATA.departments.forEach(dept => {
    dept.programs.forEach(prog => {
      allPrograms.push({ group: dept.group, program: prog });
    });
  });

  for (let i = 0; i < count; i++) {
    const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const progObj = allPrograms[i % allPrograms.length]; // Distribute evenly
    
    const sId = "u_gen_" + i;
    const studentId = "STU-2026-" + String(i + 100).padStart(4, '0');
    
    const user = {
      id: sId,
      studentId: studentId,
      email: fName.toLowerCase() + "." + lName.toLowerCase() + i + "@demo.com",
      password: "demo",
      role: "student",
      name: fName + " " + lName,
      profileImage: "https://i.pravatar.cc/150?u=" + sId,
      programGroup: progObj.group,
      programName: progObj.program,
      year: years[Math.floor(Math.random() * years.length)],
      semester: semesters[Math.floor(Math.random() * semesters.length)],
      cgpa: (Math.random() * 1.5 + 2.5).toFixed(2), // 2.5 to 4.0
      gpa: (Math.random() * 1.5 + 2.5).toFixed(2),
      referenceCode: "UNI-2026-GEN-" + i,
      academicStatus: academicStatuses[Math.floor(Math.random() * academicStatuses.length)]
    };
    MOCK_DATA.users.push(user);

    MOCK_DATA.studentCourses[sId] = { enrolled: ["c1"], completed: [] };

    const pStatus = statuses[Math.floor(Math.random() * statuses.length)];
    if (pStatus !== "Unpaid") {
      MOCK_DATA.payments.push({
        id: "pay_gen_" + i,
        studentId: sId,
        studentName: user.name,
        studentIdDisplay: studentId,
        programGroup: user.programGroup,
        type: "tuition",
        expectedAmount: 15000,
        submittedAmount: pStatus === "Needs Review" ? 14000 : 15000,
        transactionId: "TX" + Date.now() + Math.floor(Math.random()*1000) + i,
        referenceCode: user.referenceCode,
        date: "2026-05-0" + (Math.floor(Math.random() * 8) + 1),
        status: pStatus,
        flags: pStatus === "High Risk" ? ["duplicate_transaction"] : [],
        receiptImage: "https://images.unsplash.com/photo-1620052581699-2a9db2ea06ce?auto=format&fit=crop&w=400&q=80"
      });
    }
  }
};

generateStudents(700);

localStorage.setItem('uni_portal_data', JSON.stringify(MOCK_DATA));
// Ensure remembered credentials persist during reset
const rem = localStorage.getItem('uni_remembered');
localStorage.removeItem('uni_current_user'); 
if(rem) localStorage.setItem('uni_remembered', rem);
