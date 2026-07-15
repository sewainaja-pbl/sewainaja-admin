import admin from 'firebase-admin';
import { readFileSync } from 'fs';

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  // Priority: SERVICE_ACCOUNT_JSON > SERVICE_ACCOUNT_KEY_PATH > default
  if (process.env.SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      ...(databaseURL ? { databaseURL } : {}),
      ...(projectId ? { projectId } : {}),
    });
  } else if (process.env.SERVICE_ACCOUNT_KEY_PATH) {
    const serviceAccount = JSON.parse(
      readFileSync(process.env.SERVICE_ACCOUNT_KEY_PATH, 'utf-8'),
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      ...(databaseURL ? { databaseURL } : {}),
      ...(projectId ? { projectId } : {}),
    });
  } else {
    // Default credential: emulator / Firebase runtime
    admin.initializeApp({
      ...(databaseURL ? { databaseURL } : {}),
      ...(projectId ? { projectId } : {}),
    });
  }
}

export const auth = admin.auth();
export const db = admin.firestore();
export const now = () => admin.firestore.FieldValue.serverTimestamp();