// Main script
loadData();

// Login functions
const ADMIN_USER = 'admin';
const ADMIN_PASS = '123456';

function checkLogin() {
  const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
  const mainContent = document.getElementById('main-content');
  const loginSection = document.getElementById('login-section');
  
  if (isLoggedIn) {
    mainContent.classList.remove('hidden');
    loginSection.classList.add('hidden');
    showSection('dashboard');
    updateDashboard();
  } else {
    mainContent.classList.add('hidden');
    loginSection.classList.remove('hidden');
  }
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    sessionStorage.setItem('isLoggedIn', 'true');
    checkLogin();
  } else {
    alert('اسم المستخدم أو كلمة السر غير صحيحة!');
  }
}

function logout() {
  if (confirm('هل تريد تسجيل الخروج؟')) {
    sessionStorage.removeItem('isLoggedIn');
    checkLogin();
  }
}

// Init
document.addEventListener('DOMContentLoaded', async () => {
  await window.firebaseReady;
  try {
    await loadData();
  } catch (e) {
    console.error('Initial load failed:', e);
  }
  checkLogin();
  setupEventListeners();
});



function initApp() {
  showSection('dashboard');
  updateDashboard();
  setupEventListeners();
  updateStudentsList();
}

function setupEventListeners() {
  // Login
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  
  // Add student
  document.getElementById('add-student-form').addEventListener('submit', addStudent);

  
  // Attendance
  document.getElementById('attendance-form').addEventListener('submit', registerAttendance);
  
  // Students management search
  document.getElementById('students-search').addEventListener('input', handleStudentsSearch);
  
  // Search
  document.getElementById('search-input').addEventListener('input', handleSearch);
  
  // Mobile sidebar
  document.querySelectorAll('button[onclick^="showSection"]').forEach(btn => {
    btn.addEventListener('click', toggleSidebar);
  });
}


function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  sidebar.classList.toggle('translate-x-full');
  overlay.classList.toggle('invisible');
  overlay.classList.toggle('opacity-0');
}

function showSection(sectionName) {
  if (sessionStorage.getItem('isLoggedIn') !== 'true') {
    alert('يرجى تسجيل الدخول أولاً!');
    return;
  }
  
  document.querySelectorAll('.section:not(#login-section)').forEach(s => s.classList.add('hidden'));
  const targetSection = document.getElementById(`${sectionName}-section`);
  if (targetSection) {
    targetSection.classList.remove('hidden');
  }
  toggleSidebar(); // Close on mobile
  
  if (sectionName === 'attendance') checkDayStatus();
  if (sectionName === 'barcode-page') resetBarcodePartButtons();
  if (sectionName === 'dashboard') updateDashboard();
  if (sectionName === 'students-management') updateStudentsManagementList();
  if (sectionName === 'reports') updateMonthSelect();

}



async function addStudent(e) {
  e.preventDefault();
  const name = document.getElementById('student-name').value.trim();
  const code = parseInt(document.getElementById('student-code').value);
  
  if (!name || isNaN(code)) {
    alert('خطأ: اسم أو كود غير صالح!');
    return;
  }
  
  // Check duplicate code (client-side)
  const existing = students.find(s => s.code === code);
  if (existing) {
    alert('كود الطالب موجود بالفعل!');
    return;
  }
  
  const student = {
    id: generateId(),
    name,
    code,
    createdAt: new Date().toISOString()
  };
  
  try {
    await window.saveStudent(student);
    await loadData(); // Refresh from Firebase
    updateStudentsList();
    updateStudentsManagementList();
    e.target.reset();
    alert('✅ تم إضافة الطالب بنجاح!');
  } catch (error) {
    console.error('Add student error:', error);
    alert('خطأ في الحفظ: ' + error.message + '\nتحقق من Firebase config');
  }
}




function updateStudentsList() {
  const list = document.getElementById('students-list');
  list.innerHTML = students.map(s => `
    <div class="bg-white/20 backdrop-blur-lg rounded-2xl p-6 shadow-xl text-center">
      <h4 class="text-xl font-bold mb-2">${s.name}</h4>
      <p class="text-2xl font-black text-blue-300">كود: ${s.code}</p>
    </div>
  `).join('');
}

let selectedPart = null;

function checkDayStatus() {
  const {dayName, dayNum, allowed} = getCurrentDay();
  document.getElementById('current-day').textContent = dayName;
  
  const allowedEl = document.getElementById('attendance-allowed');
  const blockedEl = document.getElementById('attendance-blocked');
  const partSelector = document.getElementById('part-selector');
  const form = document.getElementById('attendance-form');
  
  if (allowed) {
    allowedEl.classList.remove('hidden');
    blockedEl.classList.add('hidden');
    partSelector.classList.remove('hidden');
    form.classList.add('hidden');
  } else {
    allowedEl.classList.add('hidden');
    blockedEl.classList.remove('hidden');
    partSelector.classList.add('hidden');
    form.classList.add('hidden');
  }
}

function selectPart(part) {
  selectedPart = part;
  // Reset all buttons
  ['part1-btn', 'part2-btn', 'part3-btn'].forEach(id => {
    if (document.getElementById(id)) document.getElementById(id).classList.remove('bg-green-600');
  });
  document.getElementById(`part${part}-btn`).classList.add('bg-green-600');
  document.getElementById('attendance-form').classList.remove('hidden');
}


async function registerAttendance(e) {
  e.preventDefault();
  if (!selectedPart) return;
  
  const input = document.getElementById('attendance-name-or-code').value.trim().toLowerCase();
  let student = students.find(s => s.code.toString() === input || s.name.toLowerCase().includes(input));
  
  if (!student) {
    showResult('لا يوجد طالب بهذا الاسم/الكود!', 'error');
    return;
  }
  
  const now = new Date();
  const today = getCurrentDay();
  const weekNum = getWeekNumber(now);
  const monthNum = getMonthNum(now);
  const year = now.getFullYear();
  const monthName = getMonthName(monthNum, year);
  
  // Check rules
  const valid = await window.validateRegistration(student.id, selectedPart, weekNum, today.dayNum);
  if (!valid) {
    showResult('خطأ: لا يمكن تسجيل الجزء الرئيسي الثاني في نفس اليوم! (الجزء 3 مسموح مع أحدهما)', 'error');
    return;
  }
  
  // Check duplicate for this exact part (client cache)
  const duplicate = attendance.some(r => 
    r.studentId === student.id && r.weekNum === weekNum && r.day === today.dayNum && r.part === selectedPart
  );
  
  if (duplicate) {
    showResult('تم تسجيل هذا الجزء بالفعل!', 'error');
    return;
  }
  
  const record = {
    studentId: student.id,
    studentName: student.name,
    studentCode: student.code,
    weekNum,
    day: today.dayNum,
    dayName: today.dayName,
    part: selectedPart,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('ar-SA'),
    status: 'present',
    monthNum,
    monthName,
    year
  };
  
  try {
    await window.saveAttendance(record);
    await loadData(); // Refresh from Firebase
    playSuccessSound();
    showResult(`✅ تم تسجيل ${getPartName(selectedPart)} لـ ${student.name}`, 'success');
    e.target.reset();
    updateDashboard();
  } catch (error) {
    console.error('Register error:', error);
    showResult('خطأ في التسجيل: ' + error.message, 'error');
  }
}



function getPartName(part) {
  const parts = {
    1: 'الجزء الأول',
    2: 'الجزء الثاني', 
    3: 'النوتة الروحية'
  };
  return parts[part] || 'الجزء';
}


function showResult(message, type) {
  const result = document.getElementById('attendance-result');
  const msgEl = document.getElementById('result-message');
  msgEl.textContent = message;
  msgEl.className = `text-2xl font-bold ${type === 'success' ? 'text-green-300' : 'text-red-300'}`;
  result.classList.remove('hidden');
  setTimeout(() => result.classList.add('hidden'), 5000);
}

function playSuccessSound() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
}

function updateDashboard() {
  document.getElementById('total-students').textContent = students.length;
  const todayStats = getTodayStats();
  document.getElementById('today-present').textContent = todayStats.present;
  document.getElementById('today-absent').textContent = todayStats.absent;
  const top = getTopAbsentee();
  document.getElementById('top-absentee').textContent = top.name || '--';
  
// Recent attendance
  const recent = attendance
    .slice(-10)
    .reverse()
    .map(r => {
      const student = students.find(s => s.id === r.studentId);
      const partName = r.part === 1 ? 'الجزء 1' : r.part === 2 ? 'الجزء 2' : 'النوتة';
      return `
        <div class="flex justify-between items-center p-4 bg-white/10 rounded-xl">
          <span>${student ? student.name : 'غير معروف'}</span>
          <span class="text-sm opacity-75">${r.time} - ${partName} - ${r.dayName}</span>
        </div>
      `;
    }).join('');
  document.getElementById('recent-attendance').innerHTML = recent || '<p class="text-center opacity-75">لا توجد سجلات</p>';

}

function handleSearch(e) {
  const query = e.target.value.toLowerCase();
  const results = students.filter(s => 
    s.name.toLowerCase().includes(query) || s.code.toString().includes(query)
  );
  
  const resultEl = document.getElementById('search-result');
  if (results.length === 0) {
    resultEl.innerHTML = '<p class="text-center text-xl py-12 opacity-75">لا توجد نتائج</p>';
    return;
  }
  
  if (results.length === 1) {
    showStudentDetails(results[0]);
  } else {
    resultEl.innerHTML = results.map(s => {
      const stats = getStudentStats(s.id);
      return `
        <div class="bg-white/20 backdrop-blur-lg rounded-2xl p-6 mb-4 shadow-xl cursor-pointer hover:scale-105 transition-all" onclick="showStudentDetails(${JSON.stringify(s).replace(/"/g, '"')})">
          <h3 class="text-2xl font-bold mb-2">${s.name}</h3>
          <p class="text-xl mb-2">كود: ${s.code}</p>
          <p>الحضور: ${stats.percentage}% (${stats.present}/${stats.totalDays})</p>
        </div>
      `;
    }).join('');
  }
}

function showStudentDetails(student) {
  const stats = getStudentStats(student.id);
  const records = attendance.filter(r => r.studentId === student.id)
    .sort((a,b) => new Date(b.date) - new Date(a.date));
  
  document.getElementById('search-result').innerHTML = `
    <div class="bg-white/20 backdrop-blur-lg rounded-2xl p-8 shadow-xl mb-8">
      <h3 class="text-3xl font-bold mb-4">${student.name}</h3>
      <p class="text-2xl mb-2">كود: ${student.code}</p>
      <div class="grid grid-cols-2 gap-4 text-xl">
        <span>الحضور: <span class="font-black text-green-300">${stats.present}</span></span>
        <span>الغياب: <span class="font-black text-red-300">${stats.absent}</span></span>
        <span>النسبة: <span class="font-black text-blue-300">${stats.percentage}%</span></span>
        <span>الأيام الكلية: <span class="font-black">${stats.totalDays}</span></span>
      </div>
    </div>
    <div class="bg-white/10 backdrop-blur-lg rounded-2xl p-6 shadow-xl overflow-x-auto">
      <h4 class="text-2xl font-bold mb-4">سجل الحضور</h4>
      <table>
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>الوقت</th>
            <th>اليوم</th>
            <th>الجزء</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(r => `
            <tr>
              <td>${r.date}</td>
              <td>${r.time}</td>
              <td>${r.day === 1 ? 'الخميس' : 'الجمعة'}</td>
              <td>${r.part === 1 ? 'الجزء 1' : 'الجزء 2'}</td>
              <td class="${r.status === 'present' ? 'text-green-300 font-bold' : 'text-red-300 font-bold'}">${r.status === 'present' ? 'حاضر' : 'غائب'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${records.length === 0 ? '<p class="text-center py-8 opacity-75">لا توجد سجلات</p>' : ''}
    </div>
  `;
}

function updateMonthSelect() {
  const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  
  // Filter valid records with year and monthNum
  const validMonths = [...new Set(attendance.filter(r => r.year && r.monthNum && r.monthNum >=1 && r.monthNum <=12)
    .map(r => `${r.year}-${r.monthNum.toString().padStart(2,'0')}`))].sort().reverse();
  
  // Update main reports dropdown
  const mainSelect = document.getElementById('report-month');
  mainSelect.innerHTML = '<option value="">جميع الشهور</option>';
  validMonths.forEach(m => {
    const [year, monthNumStr] = m.split('-');
    const monthNum = parseInt(monthNumStr);
    const monthName = months[monthNum - 1] || `الشهر ${monthNum}`;
    mainSelect.innerHTML += `<option value="${m}">${monthName} ${year}</option>`;
  });
  
  // Update student report dropdown
  const studentSelect = document.getElementById('report-student-month');
  if (studentSelect) {
    studentSelect.innerHTML = '<option value="">اختر الشهر</option>';
    validMonths.forEach(m => {
      const [year, monthNumStr] = m.split('-');
      const monthNum = parseInt(monthNumStr);
      const monthName = months[monthNum - 1] || `الشهر ${monthNum}`;
      studentSelect.innerHTML += `<option value="${m}">${monthName} ${year}</option>`;
    });
  }
}


async function generateStudentWordReport() {
  const code = parseInt(document.getElementById('report-code').value);
  const monthSelectVal = document.getElementById('report-student-month').value || document.getElementById('report-month').value;
  const year = document.getElementById('report-year').value || new Date().getFullYear().toString();
  
  let monthNum;
  if (monthSelectVal) {
    const [_, monthNumStr] = monthSelectVal.split('-');
    monthNum = parseInt(monthNumStr);
  }
  
  const student = students.find(s => s.code === code);
  if (!student) {
    alert('لا يوجد طالب بهذا الكود!');
    return;
  }
  
  const monthName = monthNum ? getMonthName(monthNum, year) : 'جميع الشهور';
  const filename = monthNum ? `تقرير_${student.name.replace(/\\s/g, '_')}_${monthName}_${year}` : `تقرير_${student.name.replace(/\\s/g, '_')}`;
  await generateWordReport(student, null, monthNum, parseInt(year), filename);
}



// Enhanced Word report helpers with mobile-safe download + HTML fallback
async function downloadBlob(blob, filename) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.docx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showDownloadToast(`✅ تم تنزيل ${filename}.docx`, 'success');
  } catch (error) {
    console.error('Word download failed:', error);
    downloadHtmlFallback(filename.replace('.docx', ''), 'Word download failed');
  }
}

function showDownloadToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl text-xl font-bold ${
    type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
  } animate-slide-in`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function downloadHtmlFallback(content, filename) {
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>${filename}</title></head>
<body style="font-family:Arial;padding:20px;">
<h1>${filename}</h1>
${content}
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename + '.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showDownloadToast(`📄 تم تنزيل ${filename}.html (نسخة احتياطية)`, 'info');
}



// Weekly Word report
async function generateWeeklyReport(weekNum) {
  const weekAttendance = attendance.filter(r => r.weekNum == weekNum);
  const weekData = students.map(student => {
    const studentRecords = weekAttendance.filter(r => r.studentId === student.id);
    return {
      name: student.name,
      code: student.code,
      records: studentRecords
    };
  });
  
  await generateWordReportForAll(weekData, `تقرير_الأسبوع_${weekNum}`);
}

// Full Word report
async function generateFullReport() {
  const monthSelectVal = document.getElementById('report-month').value;
  const year = document.getElementById('report-year').value || new Date().getFullYear().toString();
  
  let filteredAttendance = attendance;
  if (monthSelectVal) {
    const [selectedYear, monthNum] = monthSelectVal.split('-');
    filteredAttendance = attendance.filter(r => r.year == selectedYear && r.monthNum == monthNum);
  }
  
  const fullData = students.map(student => {
    const studentRecords = filteredAttendance.filter(r => r.studentId === student.id);
    return {
      name: student.name,
      code: student.code,
      records: studentRecords
    };
  }).filter(data => data.records.length > 0); // Only students with records in period
  
  const monthName = monthSelectVal ? getMonthName(parseInt(monthSelectVal.split('-')[1]), year) : 'كامل';
  const filename = `تقرير_شامل_${monthName}_${year}`;
  await generateWordReportForAll(fullData, filename);
}

async function generateWordReport(student, monthNum, year, filename) {  // records no longer needed, use data.js functions

  try {
    const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, Header, AlignmentType } = docx;
    
    const monthKey = monthNum ? `${year}-${monthNum}` : null;
    const stats = monthKey ? getMonthlyStats(student.id, monthKey) : getStudentStats(student.id);
    const monthData = monthKey ? groupAttendanceByMonth(student.id)[monthKey] || {} : null;
    
    const monthName = monthNum ? getMonthName(monthNum, year) : 'جميع الشهور';
    
    // ✅ Detailed table data using new functions
    const detailedAttendance = monthKey ? getDetailedMonthlyAttendance(student.id, monthNum, year) : [];
    
    const weeks = Object.keys(monthData.weeks || {}).sort((a,b) => a - b).slice(0,4);
    
    // Header
    const doc = new Document({
      sections: [{
        headers: {
          default: new Header({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun("تقرير حضور الطالب الشهري")],
              styling: { headingLevel: 1 }
            })]
          })
        },
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun(`الطالب: ${student.name}`),
              new TextRun({ break: 1 }),
              new TextRun(`الكود: ${student.code}`),
              new TextRun({ break: 1 }),
              new TextRun(`الشهر: ${monthName}`),
            ],
            alignment: AlignmentType.CENTER
          }),
          // Stats summary
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun(`الجزء1: ${stats.part1}/4 (${Math.round(stats.part1/4*100)}%)`),
              new TextRun({ break: 1 }),
              new TextRun(`الجزء2: ${stats.part2}/4 (${Math.round(stats.part2/4*100)}%)`),
              new TextRun({ break: 1 }),
              new TextRun(`النوتة: ${stats.part3}/4 (${Math.round(stats.part3/4*100)}%)`),
              new TextRun({ break: 1 }),
              new TextRun(`الإجمالي: ${stats.total}/12 (${stats.overallPct}%)`)
            ]
          }),
          new Paragraph({ text: '' }) // Space
        ]
      }]
    });

    // ✅ 1. Detailed table: التاريخ | الأسبوع | اليوم | الجزء | الحالة
    if (detailedAttendance.length > 0) {
      const detailRows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph("التاريخ")] }),
            new TableCell({ children: [new Paragraph("الأسبوع")] }),
            new TableCell({ children: [new Paragraph("اليوم")] }),
            new TableCell({ children: [new Paragraph("الجزء")] }),
            new TableCell({ children: [new Paragraph("الحالة")] })
          ]
        })
      ];
      
      detailedAttendance.forEach(session => {
        const partName = getPartName(session.part);
        const statusIcon = session.status === 'حاضر' ? '✅' : '❌';
        detailRows.push(new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(session.date)] }),
            new TableCell({ children: [new Paragraph(`الأسبوع ${session.weekNum}`)] }),
            new TableCell({ children: [new Paragraph(session.dayName)] }),
            new TableCell({ children: [new Paragraph(partName)] }),
            new TableCell({ children: [new Paragraph(statusIcon)] })
          ]
        }));
      });
      
      doc.sections[0].children.push(
        new Paragraph({
          children: [new TextRun("📋 جدول الحضور التفصيلي")],
          styling: { headingLevel: 2 }
        }),
        new Table({ rows: detailRows }),
        new Paragraph({ text: '' })
      );
    }

    // 2. Weekly summary table (existing)
    const summaryRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph("الأسبوع")] }),
          new TableCell({ children: [new Paragraph("اليوم")] }),
          new TableCell({ children: [new Paragraph("الجزء1")] }),
          new TableCell({ children: [new Paragraph("الجزء2")] }),
          new TableCell({ children: [new Paragraph("النوتة")] })
        ]
      })
    ];
    
    weeks.forEach(weekNum => {
      const week = monthData.weeks[weekNum];
      if (week) {
        ['الخميس','الجمعة'].forEach(dayName => {
          const hasPart1 = week[1] ? '✅' : '❌';
          const hasPart2 = week[2] ? '✅' : '❌';
          const hasNote = week[3] ? '✅' : '❌';
          
          summaryRows.push(new TableRow({
            children: [
              new TableCell({ children: [new Paragraph(`الأسبوع ${weekNum}`)] }),
              new TableCell({ children: [new Paragraph(dayName)] }),
              new TableCell({ children: [new Paragraph(hasPart1)] }),
              new TableCell({ children: [new Paragraph(hasPart2)] }),
              new TableCell({ children: [new Paragraph(hasNote)] })
            ]
          }));
        });
      }
    });
    
    doc.sections[0].children.push(
      new Paragraph({
        children: [new TextRun("📊 ملخص أسبوعي")],
        styling: { headingLevel: 2 }
      }),
      new Table({ rows: summaryRows }),
      new Paragraph({
        children: [new TextRun("ملاحظات: كل أسبوع يحتوي على خميس (الجزء1 + النوتة) وجمعة (الجزء2)")],
        alignment: AlignmentType.RIGHT
      })
    );
    
    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, filename);
    
  } catch (error) {
    console.error('Word generation failed:', error);
    
    // Enhanced HTML fallback with detailed table
    const detailedAttendance = monthKey ? getDetailedMonthlyAttendance(student.id, monthNum, year) : [];
    const htmlContent = `
      <h1>تقرير ${student.name} - ${monthName}</h1>
      <h2>الإحصائيات</h2>
      <p><strong>الجزء1:</strong> ${stats.part1}/4 (${Math.round(stats.part1/4*100)}%)</p>
      <p><strong>الجزء2:</strong> ${stats.part2}/4 (${Math.round(stats.part2/4*100)}%)</p>
      <p><strong>النوتة:</strong> ${stats.part3}/4 (${Math.round(stats.part3/4*100)}%)</p>
      <p><strong>الإجمالي:</strong> ${stats.total}/12 (${stats.overallPct}%)</p>
      
      <h2>التفاصيل</h2>
      <table border="1" dir="rtl">
        <tr><th>التاريخ</th><th>الأسبوع</th><th>اليوم</th><th>الجزء</th><th>الحالة</th></tr>
        ${detailedAttendance.map(s => `<tr><td>${s.date}</td><td>الأسبوع ${s.weekNum}</td><td>${s.dayName}</td><td>${getPartName(s.part)}</td><td>${s.status}</td></tr>`).join('')}
      </table>
    `;
    downloadHtmlFallback(htmlContent, filename);
  }
}


async function generateWordReportForAll(data, filename) {
  try {
    const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, Header, AlignmentType } = docx;
    
    const allRows = [];
    data.forEach(({ name, code, records }) => {
      records.forEach(r => {
        allRows.push(new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun(name)] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun(code.toString()) ] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun(r.dayName)] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun(getPartName(r.part)) ] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun(r.date)] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun(r.time)] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun(r.status === 'present' ? 'حاضر' : 'غائب')] })] })
          ]
        }));
      });
    });
    
    const doc = new Document({
      sections: [{
        headers: {
          default: new Header({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun("تقرير الحضور الشامل")],
              styling: { headingLevel: 1 }
            })]
          })
        },
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun(filename)]
          }),
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("اسم الطالب")] }),
                  new TableCell({ children: [new Paragraph("الكود")] }),
                  new TableCell({ children: [new Paragraph("اليوم")] }),
                  new TableCell({ children: [new Paragraph("الجزء")] }),
                  new TableCell({ children: [new Paragraph("التاريخ")] }),
                  new TableCell({ children: [new Paragraph("الوقت")] }),
                  new TableCell({ children: [new Paragraph("الحالة")] })
                ]
              }),
              ...allRows
            ]
          })
        ]
      }]
    });
    
    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, filename);
  } catch (error) {
    console.error('Word generation failed:', error);
    const htmlContent = `<h2>${filename}</h2><table border="1"><tr><th>الاسم</th><th>الكود</th><th>اليوم</th><th>الجزء</th><th>التاريخ</th><th>الوقت</th><th>الحالة</th></tr>${data.flatMap(({name, code, records}) => records.map(r => `<tr><td>${name}</td><td>${code}</td><td>${r.dayName}</td><td>${getPartName(r.part)}</td><td>${r.date}</td><td>${r.time}</td><td>${r.status === 'present' ? 'حاضر' : 'غائب'}</td></tr>`)).join('')}</table>`;
    downloadHtmlFallback(htmlContent, filename);
  }
}




/* PDF functions removed per user request - Word only with HTML fallback */



// Students Management Functions
let studentsSearchQuery = '';

function updateStudentsManagementList() {
  const list = document.getElementById('students-management-list');
  const searchInput = document.getElementById('students-search').value.toLowerCase();
  studentsSearchQuery = searchInput;
  
  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchInput) || 
    s.code.toString().includes(searchInput)
  );
  
  if (filteredStudents.length === 0) {
    list.innerHTML = '<p class="col-span-full text-center text-2xl py-12 opacity-75">لا توجد طلاب مطابقة للبحث</p>';
    return;
  }
  
  list.innerHTML = filteredStudents.map(s => {
    const stats = getStudentStats(s.id);
    const percentageClass = stats.percentage > 80 ? 'text-green-400' : stats.percentage > 50 ? 'text-yellow-400' : 'text-red-400';
    return `
      <div class="bg-white/20 backdrop-blur-lg rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] border border-white/20 group">
        <h4 class="text-2xl font-bold mb-2 text-center">${s.name}</h4>
        <p class="text-xl mb-4 text-center font-black text-blue-300">كود: ${s.code}</p>
        <div class="space-y-3 mb-6">
          <div class="flex justify-between text-lg">
            <span>الحضور:</span>
            <span class="font-black ${percentageClass}">${stats.percentage}%</span>
          </div>
          <div class="flex justify-between text-lg">
            <span>الأيام:</span>
            <span class="font-bold">${stats.present}/${stats.totalDays}</span>
          </div>
        </div>
        <div class="flex gap-3 pt-4 border-t border-white/20">
          <button onclick="showStudentModal('${s.id}')" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all duration-200 text-sm">👁️ تفاصيل</button>
          <button onclick="deleteStudent('${s.id}')" class="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all duration-200 text-sm">🗑️ حذف</button>
        </div>
      </div>
    `;
  }).join('');
}

function handleStudentsSearch(e) {
  updateStudentsManagementList();
}

function showStudentModal(studentId) {
  const student = students.find(s => s.id === studentId);
  if (!student) return;
  
  document.getElementById('modal-student-name').textContent = student.name;
  const stats = getStudentStats(student.id);
  const records = attendance.filter(r => r.studentId === student.id)
    .sort((a,b) => new Date(b.date) - new Date(a.date));
  
  document.getElementById('modal-student-content').innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 p-6 bg-white/10 rounded-2xl">
      <div>
        <p class="text-xl mb-2"><strong>الكود:</strong> ${student.code}</p>
        <p class="text-xl mb-4"><strong>إجمالي الأيام:</strong> ${stats.totalDays}</p>
      </div>
      <div class="space-y-2">
        <p><strong>الحضور:</strong> <span class="text-2xl font-black text-green-400">${stats.present}</span></p>
        <p><strong>الغياب:</strong> <span class="text-2xl font-black text-red-400">${stats.absent}</span></p>
        <p><strong>النسبة:</strong> <span class="text-2xl font-black ${stats.percentage > 80 ? 'text-green-400' : stats.percentage > 50 ? 'text-yellow-400' : 'text-red-400'}">${stats.percentage}%</span></p>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full bg-white/10 rounded-2xl overflow-hidden">
        <thead>
          <tr class="bg-white/20">
            <th class="p-4 text-right">التاريخ</th>
            <th class="p-4 text-right">الوقت</th>
            <th class="p-4 text-right">اليوم</th>
            <th class="p-4 text-right">الجزء</th>
            <th class="p-4 text-right">الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${records.slice(0, 20).map(r => `
            <tr class="hover:bg-white/10 transition-colors border-b border-white/10">
              <td class="p-4">${r.date}</td>
              <td class="p-4">${r.time}</td>
              <td class="p-4">${r.day === 1 ? 'الخميس' : 'الجمعة'}</td>
              <td class="p-4">${r.part === 1 ? 'الجزء 1' : 'الجزء 2'}</td>
              <td class="p-4 font-bold ${r.status === 'present' ? 'text-green-400' : 'text-red-400'}">${r.status === 'present' ? '✅ حاضر' : '❌ غائب'}</td>
            </tr>
          `).join('')}
          ${records.length === 0 ? '<tr><td colspan="5" class="p-12 text-center text-xl opacity-75">لا توجد سجلات حضور</td></tr>' : records.length > 20 ? '<tr><td colspan="5" class="p-4 text-center text-sm opacity-75 bg-white/10">... و ${records.length - 20} سجل آخر</td></tr>' : ''}
        </tbody>
      </table>
    </div>
  `;
  
  document.getElementById('student-modal').classList.remove('hidden');
}

function closeStudentModal() {
  document.getElementById('student-modal').classList.add('hidden');
}

function deleteStudent(studentId) {
  if (!confirm('هل أنت متأكد من حذف هذا الطالب؟\\nالسجلات ستظل محفوظة.')) return;
  
  students = students.filter(s => s.id !== studentId);
  saveData();
  updateStudentsManagementList();
  updateStudentsList();
  updateDashboard();
  alert('تم حذف الطالب بنجاح!');
}

// Service Worker for PWA (optional beneficial feature)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

// Barcode Full Screen Functions - Complete Implementation
let currentScannerMode = 'normal'; // 'normal' or 'full'
let barcodeSelectedPart = null;
let quaggaInstance = null;
let isScanning = false;

// Show dedicated full-screen barcode page
function showBarcodePage() {
  if (sessionStorage.getItem('isLoggedIn') !== 'true') {
    alert('يرجى تسجيل الدخول أولاً!');
    return;
  }
  
  document.querySelectorAll('.section:not(#login-section)').forEach(s => s.classList.add('hidden'));
  document.getElementById('barcode-page-section').classList.remove('hidden');
  toggleSidebar(); // Close sidebar
  
  // Reset state
  barcodeSelectedPart = null;
  resetBarcodePartButtons();
  updateBarcodeStatus('اختر الجزء ثم اضغط ابدأ المسح', 'yellow');
  document.getElementById('barcode-result-full').classList.add('hidden');
  currentScannerMode = 'full';
  
  if (quaggaInstance) stopBarcodeFullScanner();
}

// Reset barcode part buttons
function resetBarcodePartButtons() {
  ['barcode-part1-btn', 'barcode-part2-btn', 'barcode-part3-btn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.classList.remove('bg-green-600', 'ring-4', 'ring-green-400/50');
      btn.classList.add('shadow-xl');
    }
  });
}

// Select part for barcode page
function selectBarcodePart(part) {
  barcodeSelectedPart = part;
  resetBarcodePartButtons();
  const btn = document.getElementById(`barcode-part${part}-btn`);
  btn.classList.add('bg-green-600', 'ring-4', 'ring-green-400/50');
  btn.classList.remove('shadow-xl');
  
  updateBarcodeStatus('اضغط ابدأ المسح لقراءة الباركود', 'green');
  document.getElementById('start-scan-full-btn').classList.remove('hidden');
}

// Update barcode status helper
function updateBarcodeStatus(message, color = 'yellow') {
  const status = document.getElementById('barcode-status');
  status.textContent = message;
  const colors = {
    'green': 'text-green-300 animate-pulse',
    'yellow': 'text-yellow-300',
    'red': 'text-red-300 animate-shake'
  };
  status.className = `text-2xl font-bold py-4 px-8 bg-black/50 rounded-2xl ${colors[color] || colors.yellow}`;
}

// Start full screen scanner
async function startBarcodeFullScanner() {
  if (!barcodeSelectedPart) {
    alert('يرجى اختيار الجزء أولاً!');
    return;
  }
  
  updateBarcodeStatus('جاري تشغيل الكاميرا...', 'yellow');
  
  try {
    await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 }, focusMode: 'continuous' }
    });
  } catch (err) {
    console.error('Camera permission denied:', err);
    updateBarcodeStatus('يجب السماح بالكاميرا! 🎥', 'red');
    setTimeout(() => updateBarcodeStatus('اختر الجزء ثم اضغط ابدأ المسح', 'yellow'), 2000);
    return;
  }
  
  const container = document.getElementById('barcode-scanner-full');
  const startBtn = document.getElementById('start-scan-full-btn');
  const stopBtn = document.getElementById('stop-scan-full-btn');
  
  updateBarcodeStatus('جاري المسح... وجه الباركود للإطار الأخضر 🎯', 'blue');
  startBtn.classList.add('hidden');
  stopBtn.classList.remove('hidden');
  document.getElementById('scan-line').classList.remove('opacity-0');
  
  let scanned = false;
  let lastCode = null;
  let lastTime = 0;
  
  try {
    quaggaInstance = Quagga.init({
      inputStream: {
        type: "LiveStream",
        target: container,
        constraints: {
          facingMode: "environment",
          focusMode: "continuous",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      },
      locator: {
        patchSize: "large",
        halfSample: false
      },
      numOfWorkers: navigator.hardwareConcurrency || 4,
      frequency: 10,
      decoder: {
        readers: [
          "code_128_reader",
          "ean_reader",
          "ean_8_reader"
        ],
        multiple: false
      },
      locate: true
    }, function(err) {
      if (err) {
        throw err;
      }
      Quagga.start();
      isScanning = true;
      console.log("Enhanced full screen scanner started");
    });
    
    Quagga.onDetected(function(result) {
      const code = result.codeResult.code;
      const now = Date.now();
      
      if (scanned || !code) return;
      
      if (code !== lastCode || now - lastTime > 2000) {
        lastCode = code;
        lastTime = now;
        scanned = true;
        onBarcodeDetected(result);
      }
    });
  } catch (err) {
    console.error('Quagga failed:', err);
    updateBarcodeStatus('خطأ في الماسح! حاول مرة أخرى 🔄', 'red');
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    document.getElementById('scan-line').classList.add('opacity-0');
    scanned = false;
  }
}


// Stop full screen scanner
function stopBarcodeFullScanner() {
  if (Quagga.hasListeners()) {
    Quagga.offDetected(onBarcodeDetected);
    Quagga.stop();
  }
  quaggaInstance = null;
  isScanning = false;
  
  const status = document.getElementById('barcode-status');
  const startBtn = document.getElementById('start-scan-full-btn');
  const stopBtn = document.getElementById('stop-scan-full-btn');
  
  updateBarcodeStatus('تم إيقاف المسح');
  startBtn.classList.remove('hidden');
  stopBtn.classList.add('hidden');
  document.getElementById('scan-line').classList.add('opacity-0');
}

// Barcode detection handler
async function onBarcodeDetected(result) {
  if (!isScanning || !barcodeSelectedPart) return;
  
  const code = result.codeResult.code;
  console.log('Barcode detected:', code);
  
  stopBarcodeFullScanner();
  
  // Create or find student (allow new students from barcode)
  let student = students.find(s => s.code.toString() === code);
  if (!student) {
    // Create new student with code as name (placeholder)
    student = {
      id: generateId(),
      name: `طالب ${code}`,
      code: parseInt(code),
      createdAt: new Date().toISOString()
    };
    // Save new student
    try {
      await window.saveStudent(student);
      await loadData(); // Refresh students list
      updateStudentsList();
      updateStudentsManagementList();
      updateDashboard();
    } catch (error) {
      console.error('New student error:', error);
      updateBarcodeStatus(`❌ خطأ في إضافة الطالب: ${code}`, 'red');
      setTimeout(() => document.getElementById('start-scan-full-btn').classList.remove('hidden'), 2500);
      return;
    }
  }
  
  // Register attendance
  await registerBarcodeAttendance(student);
}

// Register barcode attendance
async function registerBarcodeAttendance(student) {
  const now = new Date();
  const today = getCurrentDay();
  const weekNum = getWeekNumber(now);
  const monthNum = getMonthNum(now);
  const year = now.getFullYear();
  const monthName = getMonthName(monthNum, year);
  
  // Validate rules
  const valid = await window.validateRegistration(student.id, barcodeSelectedPart, weekNum, today.dayNum);
  if (!valid) {
    updateBarcodeStatus('❌ خطأ في الجزء المختار!', 'red');
    setTimeout(startBarcodeFullScanner, 2000);
    return;
  }
  
  // Check duplicate
  const duplicate = attendance.some(r => 
    r.studentId === student.id && 
    r.weekNum === weekNum && 
    r.day === today.dayNum && 
    r.part === barcodeSelectedPart
  );
  
  if (duplicate) {
    updateBarcodeStatus(`⚠️ ${student.name} مسجل ${getPartName(barcodeSelectedPart)} اليوم`, 'yellow');
    setTimeout(startBarcodeFullScanner, 2000);
    return;
  }
  
  const record = {
    studentId: student.id,
    studentName: student.name,
    studentCode: student.code,
    weekNum,
    day: today.dayNum,
    dayName: today.dayName,
    part: barcodeSelectedPart,
    date: now.toISOString().split('T')[0],
    time: now.toLocaleTimeString('ar-SA'),
    status: 'present',
    monthNum,
    monthName,
    year
  };
  
  try {
    await window.saveAttendance(record);
    await loadData();
    playSuccessSound();
    
    const result = document.getElementById('barcode-result-full');
    result.innerHTML = `✅ نجح!<br>${student.name}<br>${getPartName(barcodeSelectedPart)}<br>${record.time}`;
    result.className = 'text-3xl font-black text-green-400 py-8 px-12 bg-green-500/30 rounded-3xl animate-bounce';
    result.classList.remove('hidden');
    
    updateDashboard();
    
    // Return to attendance after success
    setTimeout(() => showSection('attendance'), 3000);
  } catch (error) {
    console.error('Save error:', error);
    updateBarcodeStatus('❌ خطأ في الحفظ!', 'red');
    setTimeout(startBarcodeFullScanner, 2000);
  }
}


// Legacy functions (redirect to new page)
function toggleBarcodeScanner() { showBarcodePage(); }
function startBarcodeScanner() { showBarcodePage(); }
function initQuaggaScanner() { console.log('Use full screen scanner'); }
function stopBarcodeScanner() { console.log('Use full screen scanner'); }

function fillMonthSelect() {
  const select = document.getElementById("report-month");
  if (!select) return;

  const months = [
    "يناير","فبراير","مارس","ابريل",
    "مايو","يونيو","يوليو","اغسطس",
    "سبتمبر","اكتوبر","نوفمبر","ديسمبر"
  ];

  months.forEach((month, i) => {
    const option = document.createElement("option");
    option.value = i + 1;
    option.textContent = month;
    select.appendChild(option);
  });
}

setTimeout(fillMonthSelect, 500);

