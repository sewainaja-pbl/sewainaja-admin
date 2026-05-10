/**
 * Script untuk membuat akun admin pertama di Firebase.
 *
 * UNTUK EMULATOR (lokal):
 *   $env:USE_EMULATOR="true"; npx ts-node scripts/seed-admin.ts
 *
 * UNTUK PRODUCTION (cloud):
 *   npx ts-node scripts/seed-admin.ts
 */

import admin from 'firebase-admin';

// ─── KONFIGURASI AKUN ADMIN ────────────────────────────────────────────────
// Ganti nilai di bawah ini sebelum menjalankan script!
const ADMIN_NAME = 'Super Admin';
const ADMIN_EMAIL = 'admin@sewainaja.com';
const ADMIN_PASSWORD = 'Admin@SewainAja2025!'; // minimal 8 karakter
const ADMIN_PHONE = '+6281234567890'; // format +62xxx
// ──────────────────────────────────────────────────────────────────────────

const USE_EMULATOR = process.env.USE_EMULATOR === 'true';

if (USE_EMULATOR) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8001';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9001';
  console.log('🔧 Mode: EMULATOR (lokal) — data tidak akan masuk ke cloud\n');
} else {
  console.log('🚀 Mode: PRODUCTION — data akan masuk ke Firestore cloud!\n');
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'sewainaja-b4834' });
}

const auth = admin.auth();
const db = admin.firestore();

async function seedAdmin() {
  console.log(`Membuat akun admin untuk: ${ADMIN_EMAIL}...`);

  // 1. Cek apakah email sudah ada
  const existing = await auth.getUserByEmail(ADMIN_EMAIL).catch(() => null);
  if (existing) {
    console.log(`⚠️  Email ${ADMIN_EMAIL} sudah terdaftar (uid: ${existing.uid}).`);
    console.log('   Memperbarui dokumen Firestore-nya menjadi admin...\n');

    await auth.setCustomUserClaims(existing.uid, { admin: true });
    
    await db.collection('users').doc(existing.uid).set(
      {
        isAdmin: true,
        status: 'active',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    console.log('✅ Dokumen Firestore & Custom Claims diperbarui! User sekarang adalah admin.');
    return;
  }

  // 2. Buat user baru di Firebase Auth
  const userRecord = await auth.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    displayName: ADMIN_NAME,
    phoneNumber: ADMIN_PHONE,
  });

  console.log(`✔  User Auth berhasil dibuat (uid: ${userRecord.uid})`);

  // 3. Set Custom Claims (untuk Security Rules)
  await auth.setCustomUserClaims(userRecord.uid, { admin: true });
  console.log('✔  Custom claims (admin: true) berhasil disematkan');

  // 4. Buat dokumen profil di Firestore dengan isAdmin: true
  await db.collection('users').doc(userRecord.uid).set({
    id: userRecord.uid,
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    phone: ADMIN_PHONE,
    isOwner: false,
    isRenter: false,
    isAdmin: true,
    status: 'active', // langsung active, tidak perlu verifikasi
    ktpPhotoUrl: '',
    selfiePhotoUrl: '',
    avgRatingAsRenter: 0,
    avgRatingAsOwner: 0,
    totalTransactions: 0,
    fcmToken: '',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log('✔  Dokumen profil Firestore berhasil dibuat');
  console.log('\n─────────────────────────────────────────');
  console.log('🎉 AKUN ADMIN BERHASIL DIBUAT!');
  console.log('─────────────────────────────────────────');
  console.log(`   Email    : ${ADMIN_EMAIL}`);
  console.log(`   Password : ${ADMIN_PASSWORD}`);
  console.log(`   UID      : ${userRecord.uid}`);
  console.log('─────────────────────────────────────────\n');
}

seedAdmin().catch((err) => {
  console.error('❌ Gagal membuat admin:', err.message ?? err);
  process.exit(1);
});
