# إعداد Firebase (5 دقائق فقط) 🚀

## 1. إنشاء المشروع
1. اذهب إلى [Firebase Console](https://console.firebase.google.com/)
2. اضغط **Create a project**
3. اسم: `attendance-students`
4. ✅ Disable Google Analytics
5. **Create project**

## 2. تفعيل Firestore
1. في المشروع الجديد → **Firestore Database**
2. **Create database**
3. **Start in test mode** (30 يوم مجاني)
4. **Next** → **Done**

## 3. إضافة Web App
1. **Project settings** (⚙️)
2. **General** → **Add app** → **Web icon </>**
3. App nickname: `attendance-web`
4. **Register app**

## 4. نسخ الـ Config
انسخ الكود التالي بالضبط ولصقه في `firebase.js`:

```js
const firebaseConfig = {
  apiKey: \"[YOUR_apiKey]\",
  authDomain: \"[YOUR_project].firebaseapp.com\",
  projectId: \"[YOUR_project-id]\",
  storageBucket: \"[YOUR_project].appspot.com\",
  messagingSenderId: \"[YOUR_senderId]\",
  appId: \"[YOUR_appId]\"
};
```

## 5. تشغيل التطبيق
```
npx live-server attendance-app
```

**الآن البيانات محفوظة في السحابة! ☁️ يعمل على أي جهاز.**

Firestore Rules (test mode auto):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

