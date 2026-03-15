// Data models and helpers - Firebase enabled
let students = [];
let attendance = [];

// Firebase functions (imported automatically)
async function loadData() {
  try {
    await window.firebaseReady;
    students = await window.loadStudents?.() || [];
    attendance = await window.loadAttendance?.() || [];
  } catch (error) {
    console.error('Firebase load error:', error);
    // Fallback to localStorage
    const studentsData = localStorage.getItem('attendance_students');
    const attendanceData = localStorage.getItem('attendance_records');
    if (studentsData) students = JSON.parse(studentsData);
    if (attendanceData) attendance = JSON.parse(attendanceData);
  }
}


async function saveData() {
  // No need, individual saves handle it
}


// Get current week number (ISO week) - kept for legacy
function getWeekNumber(date = new Date()) {
  date = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

// Month helpers
function getMonthNum(date = new Date()) {
  return date.getMonth() + 1; // 1-12
}

function getMonthName(monthNum, year) {
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  return months[monthNum - 1];
}

// Group attendance by month/week/part
function groupAttendanceByMonth(studentId) {
  const records = attendance.filter(r => r.studentId === studentId);
  const groups = {};
  records.forEach(r => {
    const monthKey = `${r.year}-${r.monthNum}`;
    if (!groups[monthKey]) groups[monthKey] = { monthName: r.monthName, weeks: {} };
    const weekKey = r.weekNum;
    if (!groups[monthKey].weeks[weekKey]) groups[monthKey].weeks[weekKey] = {1: false, 2: false, 3: false};
    groups[monthKey].weeks[weekKey][r.part] = r.status === 'present';
  });
  return groups;
}

// Get monthly stats
function getMonthlyStats(studentId, monthKey) {
  const groups = groupAttendanceByMonth(studentId);
  const monthData = groups[monthKey];
  if (!monthData) return { part1: 0, part2: 0, part3: 0, total: 0, max: 12 };
  
  let part1 = 0, part2 = 0, part3 = 0;
  Object.values(monthData.weeks).forEach(week => {
    if (week[1]) part1++;
    if (week[2]) part2++;
    if (week[3]) part3++;
  });
  
  const total = part1 + part2 + part3;
  return { part1, part2, part3, total, max: 12, overallPct: Math.round((total / 12) * 100) };
}

// ✅ TODO Step 1&2 Complete: Generate expected 12 sessions + detailed status
function generateExpectedMonthlySessions(monthNum, year) {
  const sessions = [];
  const monthStart = new Date(year, monthNum - 1, 1);
  let currentThu = new Date(monthStart);
  
  // Align to first Thursday in/at start of month
  const dayOfWeek = monthStart.getDay();
  currentThu.setDate(monthStart.getDate() + (4 - dayOfWeek + 7) % 7);
  
  for (let week = 1; week <= 4; week++) {
    const thuDate = currentThu.toISOString().split('T')[0];
    const friDate = new Date(currentThu.getTime() + 86400000).toISOString().split('T')[0];
    const weekNum = getWeekNumber(currentThu);
    
    // Part 1: Thursday
    sessions.push({ date: thuDate, weekNum, dayName: 'الخميس', part: 1 });
    // Part 2: Friday  
    sessions.push({ date: friDate, weekNum, dayName: 'الجمعة', part: 2 });
    // Part 3: Note (assign to Thu for table consistency)
    sessions.push({ date: thuDate, weekNum, dayName: 'الخميس', part: 3 });
    
    // Next Thursday
    currentThu.setDate(currentThu.getDate() + 7);
  }
  
  return sessions; // Exactly 12
}

function getDetailedMonthlyAttendance(studentId, monthNum, year) {
  const expected = generateExpectedMonthlySessions(monthNum, year);
  const records = attendance.filter(r => r.studentId === studentId && r.monthNum === monthNum && r.year == year);
  
  return expected.map(session => {
    const present = records.some(r => 
      r.date === session.date && 
      r.part === session.part && 
      r.weekNum === session.weekNum
    );
    return { ...session, status: present ? 'حاضر' : 'غائب' };
  });
}


// Get Arabic day name - ALLOW ALL DAYS
function getCurrentDay() {
  const date = new Date();
  const formatter = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' });
  const dayName = formatter.format(date);
  
  const dayMap = {
    'الأحد': 1,
    'الإثنين': 2,
    'الثلاثاء': 3,
    'الأربعاء': 4,
    'الخميس': 5,
    'الجمعة': 6,
    'السبت': 7
  };
  const dayNum = dayMap[dayName] || 1;
  
  return { dayName, dayNum, allowed: true }; // Always allowed
}


// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Calculate student stats (client-side cache)
function getStudentStats(studentId) {
  const records = attendance.filter(r => r.studentId === studentId);
  const totalDays = new Set(records.map(r => `${r.weekNum}-${r.day}-${r.part}`)).size;
  const present = records.filter(r => r.status === 'present').length;
  const absent = totalDays - present;
  const percentage = totalDays > 0 ? Math.round((present / totalDays) * 100) : 0;
  return { totalDays, present, absent, percentage };
}

// Validate part registration rules
async function validateRegistration(studentId, part, weekNum, dayNum) {
  const todayRecords = attendance.filter(r => 
    r.studentId === studentId && 
    r.weekNum === weekNum && 
    r.day === dayNum
  );
  
  const hasPart1 = todayRecords.some(r => r.part === 1);
  const hasPart2 = todayRecords.some(r => r.part === 2);
  
  if (part === 3) {
    // Part3 allowed with Part1 or Part2 or alone
    return true;
  }
  
  if ((part === 1 && hasPart2) || (part === 2 && hasPart1)) {
    return false; // Cannot register both main parts same day
  }
  
  return true;
}


// Get today's stats
function getTodayStats() {
  const today = getCurrentDay();
  if (!today.allowed) return { present: 0, absent: 0 };
  
  const todayKey = `${getWeekNumber()}-${today.dayNum}`;
  const todayAttendance = attendance.filter(r => 
    `${r.weekNum}-${r.day}-${r.part}`.startsWith(todayKey)
  );
  
  const presentStudents = new Set(todayAttendance.filter(r => r.status === 'present').map(r => r.studentId));
  const totalStudents = students.length;
  const present = presentStudents.size;
  const absent = totalStudents - present;
  return { present, absent };
}

// Top absentee
function getTopAbsentee() {
  const stats = students.map(s => ({...getStudentStats(s.id), ...s}));
  return stats.sort((a, b) => b.absent - a.absent)[0] || {name: '--'};
}

