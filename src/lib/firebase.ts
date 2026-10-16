import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  disableNetwork,
  getDocFromServer,
  doc
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

// Validate Connection to Firestore on boot to handle offline/unreachable states immediately
async function testConnection() {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("Connection timeout")), 2000)
  );
  try {
    const testDoc = doc(db, 'test', 'connection');
    await Promise.race([
      getDocFromServer(testDoc),
      timeoutPromise
    ]);
    console.log("Firestore successfully connected to the backend.");
  } catch (error) {
    console.warn("Could not reach Cloud Firestore backend. Switching to offline-only mode.", error);
    try {
      await disableNetwork(db);
      console.log("Firestore network disabled successfully. Serving from local cache/local storage.");
    } catch (disableError) {
      console.error("Error disabling Firestore network:", disableError);
    }
  }
}

// Call testConnection to validate connectivity and handle offline fallback gracefully
testConnection();

// Analytics is optional and sometimes requires a browser context, 
// leaving it out of required exports to prevent SSR/deployment issues on Vercel unless explicitly used.
// export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
