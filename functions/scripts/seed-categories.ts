/**
 * Script untuk membuat data dummy Kategori Barang di Firebase.
 *
 * UNTUK EMULATOR (lokal):
 *   $env:USE_EMULATOR="true"; npx ts-node scripts/seed-categories.ts
 *
 * UNTUK PRODUCTION (cloud):
 *   npx ts-node scripts/seed-categories.ts
 */

import admin from 'firebase-admin';

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

const db = admin.firestore();

const CATEGORIES = [
  {
    id: '001',
    category: 'Elektronik',
    code: 'ELEC',
    photoUrl: 'https://cdn-icons-png.flaticon.com/512/3616/3616180.png',
    subcategories: ['TV', 'Speaker', 'Proyektor', 'Lainnya'],
  },
  {
    id: '002',
    category: 'Kamera & Lensa',
    code: 'CAM',
    photoUrl: 'https://cdn-icons-png.flaticon.com/512/3178/3178168.png',
    subcategories: ['DSLR', 'Mirrorless', 'Action Cam', 'Lensa', 'Lainnya'],
  },
  {
    id: '003',
    category: 'Alat Camping',
    code: 'CAMP',
    photoUrl: 'https://cdn-icons-png.flaticon.com/512/2972/2972166.png',
    subcategories: ['Tenda', 'Sleeping Bag', 'Kompor', 'Tas Carrier', 'Lainnya'],
  },
  {
    id: '004',
    category: 'Konsol Game',
    code: 'GAME',
    photoUrl: 'https://cdn-icons-png.flaticon.com/512/1368/1368147.png',
    subcategories: ['PlayStation', 'Nintendo', 'Xbox', 'VR', 'Lainnya'],
  },
];

async function seedCategories() {
  console.log('Menyiapkan seeding Kategori Barang...\n');

  const batch = db.batch();
  let count = 0;

  for (const cat of CATEGORIES) {
    const docRef = db.collection('item_categories').doc(cat.id);
    batch.set(docRef, cat);
    count++;
    console.log(`Menambahkan kategori: ${cat.category} (${cat.code})`);
  }

  await batch.commit();

  console.log('\n─────────────────────────────────────────');
  console.log(`🎉 BERHASIL MENAMBAHKAN ${count} KATEGORI BARANG!`);
  console.log('─────────────────────────────────────────\n');
}

seedCategories().catch((err) => {
  console.error('❌ Gagal membuat kategori:', err.message ?? err);
  process.exit(1);
});
