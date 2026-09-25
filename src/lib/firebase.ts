import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
// import { getAnalytics } from "firebase/analytics";

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

// Initialize Cloud Firestore with robust multi-tab persistent cache
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  console.warn("Firestore offline persistence cache is not supported or failed to initialize, falling back to standard memory cache.", e);
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;

// Analytics is optional and sometimes requires a browser context, 
// leaving it out of required exports to prevent SSR/deployment issues on Vercel unless explicitly used.
// export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
