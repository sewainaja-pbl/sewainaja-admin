import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';

const DEFAULT_PROJECT_ID = 'sewainaja-b4834';

type SeedMode = 'emulator' | 'production';

function tryLoadLocalEnvFiles(): void {
  const maybeLoader = (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile;
  if (typeof maybeLoader !== 'function') return;

  try {
    maybeLoader('.env');
  } catch {
    // noop
  }

  try {
    maybeLoader('.env.local');
  } catch {
    // noop
  }
}

function parseServiceAccountFromEnv(): admin.ServiceAccount | null {
  const raw = process.env.SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  const parsed = JSON.parse(raw) as admin.ServiceAccount & { private_key?: string };
  if (parsed.private_key) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }
  return parsed;
}

function readServiceAccountFromFile(): admin.ServiceAccount | null {
  const explicitPath = process.env.SERVICE_ACCOUNT_KEY_PATH || process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
  const googleAppCredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const keyPath = explicitPath || googleAppCredPath;
  if (!keyPath) return null;

  const absolutePath = path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      `File service account tidak ditemukan di "${absolutePath}". ` +
        'Periksa FIREBASE_SERVICE_ACCOUNT_KEY_PATH / GOOGLE_APPLICATION_CREDENTIALS.',
    );
  }

  const fileContent = fs.readFileSync(absolutePath, 'utf8');
  const parsed = JSON.parse(fileContent) as admin.ServiceAccount & { private_key?: string };
  if (parsed.private_key) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }
  return parsed;
}

function getProjectId(serviceAccount: admin.ServiceAccount | null): string {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    serviceAccount?.projectId ||
    DEFAULT_PROJECT_ID
  );
}

export function initializeFirebaseForSeed(): SeedMode {
  tryLoadLocalEnvFiles();

  const useEmulator = process.env.USE_EMULATOR === 'true';

  if (useEmulator) {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8001';
    process.env.FIREBASE_AUTH_EMULATOR_HOST =
      process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9001';

    if (!admin.apps.length) {
      admin.initializeApp({ projectId: getProjectId(null) });
    }

    console.log('Mode: EMULATOR (lokal) - data tidak akan masuk ke cloud\n');
    return 'emulator';
  }

  const serviceAccount = parseServiceAccountFromEnv() || readServiceAccountFromFile();
  const projectId = getProjectId(serviceAccount);

  if (!admin.apps.length) {
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
    } else {
      // Fallback ke ADC (gcloud / cloud runtime), jika tersedia.
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
    }
  }

  console.log('Mode: PRODUCTION - data akan masuk ke Firestore cloud\n');
  return 'production';
}

export function formatSeedError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes('metadata.google.internal') ||
    message.includes('Could not load the default credentials') ||
    message.includes('credential implementation provided to initializeApp')
  ) {
    return [
      'Kredensial Firebase Admin belum valid untuk mode production.',
      'Pilih salah satu cara ini:',
      '1) Set FIREBASE_SERVICE_ACCOUNT_KEY_PATH ke file JSON service account.',
      '2) Set FIREBASE_SERVICE_ACCOUNT_JSON berisi JSON service account (string).',
      '3) Login ADC dengan: gcloud auth application-default login',
      '',
      `Detail asli: ${message}`,
    ].join('\n');
  }

  return message;
}
