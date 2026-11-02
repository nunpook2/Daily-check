import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getDocFromServer,
  doc
} from "firebase/firestore";

// CEO Provided Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAXPq-6PEs7PfKv-RsLmeLB9_t3TNM9q5g",
  authDomain: "daily-check-equipment.firebaseapp.com",
  projectId: "daily-check-equipment",
  storageBucket: "daily-check-equipment.firebasestorage.app",
  messagingSenderId: "270766031534",
  appId: "1:270766031534:web:d96c88c724bfc20952633f",
  measurementId: "G-1GLEE7RJ4R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore with robust multi-tab persistent cache and auto-detecting long-polling for iframe/proxy resilience
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalAutoDetectLongPolling: true,
  });
} catch (e) {
  console.warn("Firestore offline persistence cache is not supported or failed to initialize, falling back to standard memory cache.", e);
  try {
    firestoreDb = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true
    });
  } catch (_) {
    firestoreDb = getFirestore(app);
  }
}

export const db = firestoreDb;

// Validate Connection to Firestore on boot gracefully
async function testConnection() {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return;
  }
  try {
    const testDoc = doc(db, 'test', 'connection');
    // Bound test probe to 3000ms so it never hangs or triggers unhandled unavailable errors
    await Promise.race([
      getDocFromServer(testDoc),
      new Promise((_, reject) => setTimeout(() => reject(new Error('probe_timeout')), 3000))
    ]);
  } catch (error: any) {
    // Normal in offline/intermittent environments; Firestore native offline cache handles requests seamlessly
    if (error?.message === 'probe_timeout' || error?.code === 'unavailable') {
      return;
    }
  }
}

// Call testConnection safely
testConnection().catch(() => {});
