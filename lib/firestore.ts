import { getFirestore, Firestore } from 'firebase/firestore';
import app from './firebase';

export const db: Firestore = getFirestore(app);
