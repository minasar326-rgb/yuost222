// Firebase configuration - UPDATE WITH YOUR PROJECT CONFIG from firebase-setup-instructions.md
// Go to https://console.firebase.google.com/ → Create project → Web app → Copy config here

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, query, where, onSnapshot, doc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';


  // Import the functions you need from the SDKs you need
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBO5_0gqXZfEr8ryB_4hFv74OtLP5LLp8k",
  authDomain: "mina-70ecf.firebaseapp.com",
  projectId: "mina-70ecf",
  storageBucket: "mina-70ecf.firebasestorage.app",
  messagingSenderId: "826492545457",
  appId: "1:826492545457:web:6fc429260fd5e0c625f590",
  measurementId: "G-H6WPMRMYSH"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Make functions GLOBAL for script.js access (bridge ES module to classic scripts)
window.db = db;

// Firebase ready promise
window.firebaseReady = new Promise((resolve) => {
  const checkReady = () => {
    if (window.loadStudents && window.loadAttendance && window.saveStudent) {
      console.log('✅ Firebase bridge fully loaded');
      resolve();
    } else {
      setTimeout(checkReady, 100);
    }
  };
  checkReady();
});

window.loadStudents = async function() {
  try {
    const snapshot = await getDocs(collection(db, 'students'));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('loadStudents error:', error);
    return [];
  }
};


window.loadAttendance = async function() {
  try {
    const snapshot = await getDocs(collection(db, 'attendance'));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('loadAttendance error:', error);
    return [];
  }
};

window.saveStudent = async function(student) {
  try {
    await addDoc(collection(db, 'students'), student);
    return true;
  } catch (error) {
    console.error('saveStudent error:', error);
    throw error;
  }
};

window.saveAttendance = async function(record) {
  try {
    await addDoc(collection(db, 'attendance'), record);
    return true;
  } catch (error) {
    console.error('saveAttendance error:', error);
    throw error;
  }
};

window.deleteStudent = async function(id) {
  try {
    await deleteDoc(doc(db, 'students', id));
    return true;
  } catch (error) {
    console.error('deleteStudent error:', error);
    throw error;
  }
};

window.findStudentByCode = async function(code) {
  try {
    const q = query(collection(db, 'students'), where('code', '==', code));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('findStudentByCode error:', error);
    return [];
  }
};

window.validateRegistration = async function(studentId, part, weekNum, dayNum) {
  try {
    const snapshot = await getDocs(collection(db, 'attendance'));
    const attendance = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const todayRecords = attendance.filter(r => 
      r.studentId === studentId && 
      r.weekNum === weekNum && 
      r.day === dayNum
    );
    
    const hasPart1 = todayRecords.some(r => r.part === 1);
    const hasPart2 = todayRecords.some(r => r.part === 2);
    
    if (part === 3) return true;
    
    return !( (part === 1 && hasPart2) || (part === 2 && hasPart1) );
  } catch (error) {
    console.error('validateRegistration error:', error);
    return true;
  }
};

console.log('Firebase bridge loaded - functions on window object');

