/**
 * Script untuk membuat data dummy barang di Firebase.
 *
 * UNTUK EMULATOR (lokal):
 *   $env:USE_EMULATOR='true'; npx ts-node scripts/seed-items.ts
 *
 * UNTUK PRODUCTION (cloud):
 *   npx ts-node scripts/seed-items.ts
 */

import admin from 'firebase-admin';
import { formatSeedError, initializeFirebaseForSeed } from './_seed-bootstrap';

initializeFirebaseForSeed();

const db = admin.firestore();

const mockItems = [
  {
    id: 'item1',
    ownerId: 'user2',
    ownerName: 'Siti Aminah',
    ownerRating: 4.8,
    categoryId: '003',
    categoryName: 'Alat Camping',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/2972/2972166.png',
    name: 'Tenda Dome 4 Orang',
    description: 'Tenda camping berkualitas tinggi dengan kapasitas 4 orang. Material tahan air dan tahan cuaca ekstrem. Dilengkapi dengan grommet dan ventilasi yang baik.',
    pricePerHour: 75000,
    estimatedValue: 2500000,
    status: 'available',
    condition: 'like-new',
    photos: [],
    qrCodeToken: 'QR_TOKEN_001',
    address: {
      addressId: 'addr1',
      label: 'Rumah',
      fullAddress: 'Jl. Merdeka No. 123, Yogyakarta, DI Yogyakarta 55123',
      coordinat: new admin.firestore.GeoPoint(-7.7956, 110.3695),
      geohash: 'qq24uj7k9x',
    },
    createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-01T08:00:00Z')),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-19T14:30:00Z')),
  },
  {
    id: 'item2',
    ownerId: 'user2',
    ownerName: 'Siti Aminah',
    ownerRating: 4.8,
    categoryId: '002',
    categoryName: 'Kamera & Lensa',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/3178/3178168.png',
    name: 'Kamera Mirrorless Sony A6000',
    description: 'Kamera mirrorless profesional dengan sensor APS-C 24MP. Dilengkapi autofocus cepat dan video 1080p. Kondisi prima, jarang dipakai.',
    pricePerHour: 100000,
    estimatedValue: 8000000,
    status: 'available',
    condition: 'new',
    photos: [],
    qrCodeToken: 'QR_TOKEN_002',
    address: {
      addressId: 'addr1',
      label: 'Rumah',
      fullAddress: 'Jl. Merdeka No. 123, Yogyakarta, DI Yogyakarta 55123',
      coordinat: new admin.firestore.GeoPoint(-7.7956, 110.3695),
      geohash: 'qq24uj7k9x',
    },
    createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-02T09:15:00Z')),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-18T10:45:00Z')),
  },
  {
    id: 'item3',
    ownerId: 'user2',
    ownerName: 'Siti Aminah',
    ownerRating: 4.8,
    categoryId: '002',
    categoryName: 'Kamera & Lensa',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/3178/3178168.png',
    name: 'Lensa Fix 50mm f/1.8',
    description: 'Lensa prime berkualitas tinggi dengan bukaan f/1.8. Cocok untuk fotografi potrait dan low light. Mount Sony E.',
    pricePerHour: 50000,
    estimatedValue: 3500000,
    status: 'available',
    condition: 'like-new',
    photos: [],
    qrCodeToken: 'QR_TOKEN_003',
    address: {
      addressId: 'addr1',
      label: 'Rumah',
      fullAddress: 'Jl. Merdeka No. 123, Yogyakarta, DI Yogyakarta 55123',
      coordinat: new admin.firestore.GeoPoint(-7.7956, 110.3695),
      geohash: 'qq24uj7k9x',
    },
    createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-03T10:00:00Z')),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-19T08:20:00Z')),
  },
  {
    id: 'item4',
    ownerId: 'user5',
    ownerName: 'Ahmad Fauzi',
    ownerRating: 4.5,
    categoryId: '001',
    categoryName: 'Elektronik',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/3616/3616180.png',
    name: 'Proyektor Mini Portable',
    description: 'Proyektor portabel dengan brightness 2000 lumen. Dilengkapi speaker built-in dan USB/HDMI input. Ideal untuk presentasi dan hiburan outdoor.',
    pricePerHour: 37500,
    estimatedValue: 3000000,
    status: 'available',
    condition: 'fair',
    photos: [],
    qrCodeToken: 'QR_TOKEN_004',
    address: {
      addressId: 'addr2',
      label: 'Kantor',
      fullAddress: 'Jl. Sudirman No. 456, Jakarta Selatan, DKI Jakarta 12190',
      coordinat: new admin.firestore.GeoPoint(-6.2175, 106.8272),
      geohash: 'qqh1kkf6mu',
    },
    createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-05T11:30:00Z')),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-19T09:00:00Z')),
  },
  {
    id: 'item5',
    ownerId: 'user5',
    ownerName: 'Ahmad Fauzi',
    ownerRating: 4.5,
    categoryId: '004',
    categoryName: 'Konsol Game',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/1368/1368147.png',
    name: 'PlayStation 5',
    description: 'Konsol gaming PS5 dengan 2 controller. Sudah include beberapa game premium. Controller berfungsi sempurna.',
    pricePerHour: 225000,
    estimatedValue: 5500000,
    status: 'inactive',
    condition: 'fair',
    photos: [],
    qrCodeToken: 'QR_TOKEN_005',
    address: {
      addressId: 'addr2',
      label: 'Kantor',
      fullAddress: 'Jl. Sudirman No. 456, Jakarta Selatan, DKI Jakarta 12190',
      coordinat: new admin.firestore.GeoPoint(-6.2175, 106.8272),
      geohash: 'qqh1kkf6mu',
    },
    createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-04-28T13:45:00Z')),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-15T16:20:00Z')),
  },
  {
    id: 'item6',
    ownerId: 'user3',
    ownerName: 'Andi Saputra',
    ownerRating: 4.9,
    categoryId: '003',
    categoryName: 'Alat Camping',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/2972/2972166.png',
    name: 'Sleeping Bag Premium',
    description: 'Sleeping bag thermal dengan suhu comfort hingga -5°C. Material polyester berkualitas. Cocok untuk camping di daerah dingin.',
    pricePerHour: 25000,
    estimatedValue: 1200000,
    status: 'available',
    condition: 'new',
    photos: [],
    qrCodeToken: 'QR_TOKEN_006',
    address: {
      addressId: 'addr3',
      label: 'Kos',
      fullAddress: 'Jl. Ahmad Yani No. 789, Bandung, Jawa Barat 40123',
      coordinat: new admin.firestore.GeoPoint(-6.9175, 107.6062),
      geohash: 'qq3n14lz5c',
    },
    createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-10T07:00:00Z')),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-19T12:15:00Z')),
  },
  {
    id: 'item7',
    ownerId: 'user3',
    ownerName: 'Andi Saputra',
    ownerRating: 4.9,
    categoryId: '001',
    categoryName: 'Elektronik',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/3616/3616180.png',
    name: 'Speaker Bluetooth Bose',
    description: 'Speaker portabel premium dengan kualitas suara studio. Bass dalam dan treble jernih. Daya tahan baterai hingga 12 jam.',
    pricePerHour: 60000,
    estimatedValue: 4500000,
    status: 'available',
    condition: 'like-new',
    photos: [],
    qrCodeToken: 'QR_TOKEN_007',
    address: {
      addressId: 'addr3',
      label: 'Kos',
      fullAddress: 'Jl. Ahmad Yani No. 789, Bandung, Jawa Barat 40123',
      coordinat: new admin.firestore.GeoPoint(-6.9175, 107.6062),
      geohash: 'qq3n14lz5c',
    },
    createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-08T14:20:00Z')),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-19T11:30:00Z')),
  },
  {
    id: 'item8',
    ownerId: 'user4',
    ownerName: 'Dewi Lestari',
    ownerRating: 4.7,
    categoryId: '003',
    categoryName: 'Alat Camping',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/2972/2972166.png',
    name: 'Tas Hiking 60L',
    description: 'Tas carrier profesional 60 liter dengan sistem support ergonomis. Waterproof dan banyak kompartemen. Cocok untuk pendakian multi-hari.',
    pricePerHour: 40000,
    estimatedValue: 2800000,
    status: 'available',
    condition: 'fair',
    photos: [],
    qrCodeToken: 'QR_TOKEN_008',
    address: {
      addressId: 'addr4',
      label: 'Rumah',
      fullAddress: 'Jl. Gatot Subroto No. 321, Surabaya, Jawa Timur 60281',
      coordinat: new admin.firestore.GeoPoint(-7.2504, 112.7508),
      geohash: 'qqgzw6ygs6',
    },
    createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-06T15:10:00Z')),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-19T13:45:00Z')),
  },
  {
    id: 'item9',
    ownerId: 'user4',
    ownerName: 'Dewi Lestari',
    ownerRating: 4.7,
    categoryId: '002',
    categoryName: 'Kamera & Lensa',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/3178/3178168.png',
    name: 'Tripod Kamera Professional',
    description: 'Tripod aluminum dengan kepala ball untuk fotografi dan videografi. Ketinggian maksimal 1.7m dan dapat menahan beban hingga 5kg.',
    pricePerHour: 30000,
    estimatedValue: 1500000,
    status: 'available',
    condition: 'like-new',
    photos: [],
    qrCodeToken: 'QR_TOKEN_009',
    address: {
      addressId: 'addr4',
      label: 'Rumah',
      fullAddress: 'Jl. Gatot Subroto No. 321, Surabaya, Jawa Timur 60281',
      coordinat: new admin.firestore.GeoPoint(-7.2504, 112.7508),
      geohash: 'qqgzw6ygs6',
    },
    createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-12T16:00:00Z')),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-19T10:20:00Z')),
  },
  {
    id: 'item10',
    ownerId: 'user1',
    ownerName: 'Budi Santoso',
    ownerRating: 4.6,
    categoryId: '001',
    categoryName: 'Elektronik',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/3616/3616180.png',
    name: 'Tablet iPad Air 2024',
    description: 'iPad Air terbaru dengan layar 11 inch. Prosesor M2 dan 8GB RAM. Dilengkapi Apple Pencil dan keyboard case.',
    pricePerHour: 85000,
    estimatedValue: 12000000,
    status: 'blocked',
    condition: 'new',
    photos: [],
    qrCodeToken: 'QR_TOKEN_010',
    address: {
      addressId: 'addr5',
      label: 'Rumah',
      fullAddress: 'Jl. Diponegoro No. 654, Medan, Sumatera Utara 20213',
      coordinat: new admin.firestore.GeoPoint(3.1521, 101.6868),
      geohash: 'qqvn6w9dh0',
    },
    createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-04-15T09:30:00Z')),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-19T14:50:00Z')),
  },
];

async function seedItems() {
  console.log('Menyiapkan seeding barang...\n');

  const usersSnap = await db.collection('users').where('isOwner', '==', true).get();
  if (usersSnap.empty) {
    throw new Error('Tidak ada user dengan isOwner == true. Jalankan seed:users terlebih dahulu.');
  }
  const owners = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

  const batch = db.batch();
  let count = 0;

  for (const item of mockItems) {
    const randomOwner = owners[Math.floor(Math.random() * owners.length)];
    const docRef = db.collection('items').doc();

    const isBlocked = item.status === 'blocked';
    const itemData = {
      ...item,
      id: docRef.id,
      ownerId: randomOwner.id,
      ownerName: randomOwner.name,
      ownerRating: randomOwner.avgRatingAsOwner || 0,
      blockedReason: isBlocked ? 'Melanggar aturan platform (Barang terindikasi palsu)' : null,
      blockedBy: isBlocked ? 'admin-system' : null,
      blockedAt: isBlocked ? admin.firestore.FieldValue.serverTimestamp() : null,
      address: {
        ...item.address,
        coordinat: new admin.firestore.GeoPoint(
          (item.address.coordinat as admin.firestore.GeoPoint).latitude,
          (item.address.coordinat as admin.firestore.GeoPoint).longitude
        ),
      },
    };

    batch.set(docRef, itemData);
    count++;
    console.log(
      `Menambahkan barang: ${itemData.name} (${itemData.categoryName}) - ${itemData.status} (Owner: ${itemData.ownerName})`
    );
  }

  await batch.commit();

  console.log('\nSEEDING BARANG BERHASIL: ' + count + ' data');
  console.log('💡 Catatan: Silakan tambahkan foto barang melalui Firebase Storage');
  console.log('   Path: items/{itemId}/photos/');
}

seedItems().catch((err) => {
  console.error('Gagal membuat barang:', formatSeedError(err));
  process.exit(1);
});
