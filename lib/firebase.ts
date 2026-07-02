import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const storage = getStorage(app);

// Connect to Emulators if specified in environment configuration
if (process.env.NEXT_PUBLIC_USE_EMULATOR === 'true') {
  // Check if we already connected to emulator to avoid multiple connections during HMR
  if (!(auth as unknown as { _emulatorConfig?: boolean })._emulatorConfig) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9001');
    console.log('🔧 Connected to Firebase Auth Emulator');
  }
  if (!(storage as unknown as { _customHost?: string })._customHost) {
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    console.log('🔧 Connected to Firebase Storage Emulator');
  }
}

// Initialize Analytics safely
let analytics: Analytics | undefined;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { analytics, auth, storage };
export default app;
