import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import app from './firebase';

export const db: Firestore = getFirestore(app);

// Connect to Firestore Emulator if in development
if (process.env.NODE_ENV === 'development') {
  // Use a private property check to prevent double connection during HMR
  if (!(db as any)._settingsFrozen) {
    connectFirestoreEmulator(db, '127.0.0.1', 8001);
    console.log('🔧 Connected to Firestore Emulator');
  }
}
