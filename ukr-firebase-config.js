/* =========================================================
   Налаштування Firebase.
   1. Створіть безкоштовний проєкт на https://console.firebase.google.com
   2. Додайте веб-застосунок (Web app) — Firebase покаже вам об'єкт
      firebaseConfig приблизно такого вигляду. Скопіюйте свої значення
      і вставте їх сюди замість прикладу.
   3. У розділі Build → Firestore Database натисніть "Create database"
      (режим "test mode" достатньо для старту).
   Детальна інструкція — у README.md цього проєкту.
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyBeRnIcvSCgK_tVz3-4fG9EvFLGDit680o",
  authDomain: "ukrainian-d0a6f.firebaseapp.com",
  projectId: "ukrainian-d0a6f",
  storageBucket: "ukrainian-d0a6f.firebasestorage.app",
  messagingSenderId: "118472089053",
  appId: "1:118472089053:web:0b1a886bb92156182f2a34"
};

// --- нижче нічого міняти не потрібно ---
try {
  firebase.initializeApp(firebaseConfig);
  window.db = firebase.firestore();
} catch (e) {
  console.warn("Firebase не налаштовано — прогрес не буде зберігатися онлайн.", e);
}
