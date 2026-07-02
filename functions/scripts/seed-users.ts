/**
 * Script untuk membuat akun user uji coba (seeder) di Firebase.
 *
 * UNTUK EMULATOR (lokal):
 *   $env:USE_EMULATOR='true'; npx ts-node scripts/seed-users.ts
 *
 * UNTUK PRODUCTION (cloud):
 *   npx ts-node scripts/seed-users.ts
 */

import admin from 'firebase-admin';
import { formatSeedError, initializeFirebaseForSeed } from './_seed-bootstrap';

initializeFirebaseForSeed();

const auth = admin.auth();
const db = admin.firestore();

interface SeedAddress {
  label: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
}

interface SeedUser {
  name: string;
  email: string;
  phone: string;
  password: string;
  isOwner: boolean;
  isRenter: boolean;
  status: 'pending' | 'verified' | 'suspended';
  selfiePhotoUrl?: string;
  addresses?: SeedAddress[];
}

const SEED_USERS: SeedUser[] = [
  {
    name: 'Andi Penyewa',
    email: 'andi@renter.com',
    phone: '+6281211111111',
    password: 'Password123!',
    isOwner: false,
    isRenter: true,
    status: 'verified',
    addresses: [
      {
        label: 'Kost Sejahtera',
        fullAddress: 'Kost Sejahtera No. 12, Lowokwaru, Malang',
        latitude: -7.942,
        longitude: 112.615,
        isDefault: true,
      },
    ],
  },
  {
    name: 'Budi Pemilik',
    email: 'budi@owner.com',
    phone: '+6281222222222',
    password: 'Password123!',
    isOwner: true,
    isRenter: false,
    status: 'verified',
    addresses: [
      {
        label: 'Rumah Utama',
        fullAddress: 'Perumahan Asri Blok C-4, Sukun, Malang',
        latitude: -7.982,
        longitude: 112.63,
        isDefault: true,
      },
    ],
  },
  {
    name: 'Chandra Dual',
    email: 'chandra@dual.com',
    phone: '+6281233333333',
    password: 'Password123!',
    isOwner: true,
    isRenter: true,
    status: 'verified',
    addresses: [
      {
        label: 'Toko/Apartemen',
        fullAddress: 'Jl. Soekarno Hatta No. 45, Lowokwaru, Malang',
        latitude: -7.946,
        longitude: 112.622,
        isDefault: true,
      },
    ],
  },
  {
    name: 'Dewi Pending',
    email: 'dewi@pending.com',
    phone: '+6281244444444',
    password: 'Password123!',
    isOwner: false,
    isRenter: true,
    status: 'pending',
    selfiePhotoUrl:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=250&auto=format&fit=crop',
    addresses: [],
  },
];

async function seedUsers() {
  console.log('Memulai seeding data user...\n');

  for (const user of SEED_USERS) {
    console.log('Mengolah user: ' + user.email + '...');

    // 1. Cek apakah email sudah terdaftar di Firebase Auth
    let uid = '';
    const existing = await auth.getUserByEmail(user.email).catch(() => null);

    if (existing) {
      console.log(
        'Email ' + user.email + ' sudah ada (uid: ' + existing.uid + '). Mengupdate profil Firestore...',
      );
      uid = existing.uid;
    } else {
      // Buat user baru di Firebase Auth
      const userRecord = await auth.createUser({
        email: user.email,
        password: user.password,
        displayName: user.name,
        phoneNumber: user.phone,
      });
      console.log('User Auth berhasil dibuat (uid: ' + userRecord.uid + ')');
      uid = userRecord.uid;
    }

    // 2. Buat / overwrite dokumen Firestore
    const userDocRef = db.collection('users').doc(uid);
    await userDocRef.set({
      id: uid,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isOwner: user.isOwner,
      isRenter: user.isRenter,
      isAdmin: false,
      status: user.status,
      ktpPhotoUrl: '',
      selfiePhotoUrl: user.selfiePhotoUrl ?? '',
      avgRatingAsRenter: 0,
      avgRatingAsOwner: 0,
      totalTransactions: 0,
      fcmToken: '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('Dokumen profil Firestore berhasil dibuat');

    // 3. Tambah subcollection addresses jika ada
    if (user.addresses && user.addresses.length > 0) {
      const addrCollRef = userDocRef.collection('addresses');

      // Bersihkan alamat lama terlebih dahulu
      const oldAddresses = await addrCollRef.get();
      const batch = db.batch();
      oldAddresses.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      for (const addr of user.addresses) {
        const addrDocRef = addrCollRef.doc();
        await addrDocRef.set({
          id: addrDocRef.id,
          label: addr.label,
          fullAddress: addr.fullAddress,
          coordinat: new admin.firestore.GeoPoint(addr.latitude, addr.longitude),
          isDefault: addr.isDefault,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('Alamat "' + addr.label + '" berhasil dibuat');
      }
    }

    console.log();
  }

  console.log('SEEDING USER BERHASIL SELESAI');
  SEED_USERS.forEach((user) => {
    console.log(
      'User: ' +
        user.name.padEnd(15) +
        ' | Email: ' +
        user.email.padEnd(18) +
        ' | Pass: ' +
        user.password,
    );
  });
}

seedUsers().catch((err) => {
  console.error('Gagal melakukan seeding user:', formatSeedError(err));
  process.exit(1);
});
