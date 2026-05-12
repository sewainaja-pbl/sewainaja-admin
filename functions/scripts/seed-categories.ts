/**
 * Script untuk membuat data dummy kategori barang di Firebase.
 *
 * UNTUK EMULATOR (lokal):
 *   $env:USE_EMULATOR='true'; npx ts-node scripts/seed-categories.ts
 *
 * UNTUK PRODUCTION (cloud):
 *   npx ts-node scripts/seed-categories.ts
 */

import admin from 'firebase-admin';
import { formatSeedError, initializeFirebaseForSeed } from './_seed-bootstrap';

initializeFirebaseForSeed();

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
  console.log('Menyiapkan seeding kategori barang...\n');

  const batch = db.batch();
  let count = 0;

  for (const cat of CATEGORIES) {
    const docRef = db.collection('item_categories').doc(cat.id);
    batch.set(docRef, cat);
    count++;
    console.log('Menambahkan kategori: ' + cat.category + ' (' + cat.code + ')');
  }

  await batch.commit();

  console.log('SEEDING KATEGORI BERHASIL: ' + count + ' data');
}

seedCategories().catch((err) => {
  console.error('Gagal membuat kategori:', formatSeedError(err));
  process.exit(1);
});
