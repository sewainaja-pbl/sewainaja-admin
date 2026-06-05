/**
 * Script untuk membuat data dummy barang di Firebase dengan gambar yang di-upload ke Firebase Storage.
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

// Daftar UID yang benar dari user
const correctUids = [
  '20rcWINNGkQWOURhJTfQ2unRS053',
  '2Z6c6ovqnvSVbKRYRgk9ok0k5v2',
  '34wfmf8cwGawDVWSmy6Iy13VHJ23',
  '3b8m1xRFK6DkVnhr09io',
  '8an5ryUuoTQJ01IuEzvBLUgv4xa2',
  'DUsk77tWNTwayGmxbmGenNUyPrr2',
  'I49LFsSxizZyu3NhPwfH',
  'LyEM1xkbjhQnVN5zMaRVgdp9DGf1',
  'QLBq6C7tZ0cMTY5m76xUWmsk2h32',
  'Vb6dIh3nDNVNQNFPgsvuAi0Jnd63',
  'rwFUdAu70GObZlLXP2vOr7EtUH22',
  'tMHLEgLbi7VdhTTMFylFi3JSnk2',
  'uY6FPn2VMSYyBpifwtEbbFIUUps1',
  'zJaWAmak7FYcItz3nJwkglcCOXD3',
  'zglbhUkGVqRzuXXesM5uJnE1JxN2'
];

const mockItems = [
  {
    id: 'item1',
    categoryId: '003',
    categoryName: 'Alat Camping',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/2972/2972166.png',
    name: 'Tenda Dome 4 Orang',
    description: 'Tenda camping berkualitas tinggi dengan kapasitas 4 orang. Material tahan air dan tahan cuaca ekstrem. Dilengkapi dengan grommet dan ventilasi yang baik.',
    pricePerHour: 75000,
    estimatedValue: 2500000,
    status: 'available',
    condition: 'like-new',
    imageMapping: ['tenda_camping.png', 'matras_camping.png'],
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
    categoryId: '002',
    categoryName: 'Kamera & Lensa',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/3178/3178168.png',
    name: 'Kamera Mirrorless Sony A6000',
    description: 'Kamera mirrorless profesional dengan sensor APS-C 24MP. Dilengkapi autofocus cepat dan video 1080p. Kondisi prima, jarang dipakai.',
    pricePerHour: 100000,
    estimatedValue: 8000000,
    status: 'available',
    condition: 'new',
    imageMapping: ['camera_sony.jpg', 'sony_camera.png'],
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
    categoryId: '002',
    categoryName: 'Kamera & Lensa',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/3178/3178168.png',
    name: 'Lensa Fix 50mm f/1.8',
    description: 'Lensa prime berkualitas tinggi dengan bukaan f/1.8. Cocok untuk fotografi potrait dan low light. Mount Sony E.',
    pricePerHour: 50000,
    estimatedValue: 3500000,
    status: 'available',
    condition: 'like-new',
    imageMapping: ['camera_nikon.jpg'],
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
    categoryId: '001',
    categoryName: 'Elektronik',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/3616/3616180.png',
    name: 'Proyektor Mini Portable',
    description: 'Proyektor portabel dengan brightness 2000 lumen. Dilengkapi speaker built-in dan USB/HDMI input. Ideal untuk presentasi dan hiburan outdoor.',
    pricePerHour: 37500,
    estimatedValue: 3000000,
    status: 'available',
    condition: 'fair',
    imageMapping: ['camera_canon.jpg'],
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
    categoryId: '004',
    categoryName: 'Konsol Game',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/1368/1368147.png',
    name: 'PlayStation 5',
    description: 'Konsol gaming PS5 dengan 2 controller. Sudah include beberapa game premium. Controller berfungsi sempurna.',
    pricePerHour: 225000,
    estimatedValue: 5500000,
    status: 'inactive',
    condition: 'fair',
    imageMapping: ['ps5_controller.png'],
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
    categoryId: '003',
    categoryName: 'Alat Camping',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/2972/2972166.png',
    name: 'Sleeping Bag Premium',
    description: 'Sleeping bag thermal dengan suhu comfort hingga -5°C. Material polyester berkualitas. Cocok untuk camping di daerah dingin.',
    pricePerHour: 25000,
    estimatedValue: 1200000,
    status: 'available',
    condition: 'new',
    imageMapping: ['sleeping_bag.png'],
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
    categoryId: '001',
    categoryName: 'Elektronik',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/3616/3616180.png',
    name: 'Speaker Bluetooth Bose',
    description: 'Speaker portabel premium dengan kualitas suara studio. Bass dalam dan treble jernih. Daya tahan baterai hingga 12 jam.',
    pricePerHour: 60000,
    estimatedValue: 4500000,
    status: 'available',
    condition: 'like-new',
    imageMapping: ['airpods_max.png'],
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
    categoryId: '003',
    categoryName: 'Alat Camping',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/2972/2972166.png',
    name: 'Tas Hiking 60L',
    description: 'Tas carrier profesional 60 liter dengan sistem support ergonomis. Waterproof dan banyak kompartemen. Cocok untuk pendakian multi-hari.',
    pricePerHour: 40000,
    estimatedValue: 2800000,
    status: 'available',
    condition: 'fair',
    imageMapping: ['tas_carrier.png'],
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
    categoryId: '002',
    categoryName: 'Kamera & Lensa',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/3178/3178168.png',
    name: 'Tripod Kamera Professional',
    description: 'Tripod aluminum dengan kepala ball untuk fotografi dan videografi. Ketinggian maksimal 1.7m dan dapat menahan beban hingga 5kg.',
    pricePerHour: 30000,
    estimatedValue: 1500000,
    status: 'available',
    condition: 'like-new',
    imageMapping: ['lentera_camping.png', 'kompor_camping.png'],
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
    categoryId: '001',
    categoryName: 'Elektronik',
    categoryPhotoUrl: 'https://cdn-icons-png.flaticon.com/512/3616/3616180.png',
    name: 'Tablet iPad Air 2024',
    description: 'iPad Air terbaru dengan layar 11 inch. Prosesor M2 dan 8GB RAM. Dilengkapi Apple Pencil dan keyboard case.',
    pricePerHour: 85000,
    estimatedValue: 12000000,
    status: 'blocked',
    condition: 'new',
    imageMapping: ['hp_asus.jpg', 'hp_realme.jpg'],
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
  console.log('Menyiapkan seeding barang dengan aturan folder uploads...\n');

  // Ambil user yang valid di Firestore
  const usersSnap = await db.collection('users').get();
  if (usersSnap.empty) {
    throw new Error('Tidak ada user di database Firestore. Jalankan seed:users terlebih dahulu.');
  }

  // Filter user yang UID nya ada di correctUids
  const validOwners = usersSnap.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as any))
    .filter(u => correctUids.includes(u.id));

  // Jika tidak ada user database yang cocok dengan correctUids, gunakan semua user owner yang ada
  const finalOwners = validOwners.length > 0 
    ? validOwners 
    : usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

  console.log(`Ditemukan ${finalOwners.length} owners yang valid untuk dipetakan.`);

  // Inisialisasi Storage Bucket
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'sewainaja-b4834.firebasestorage.app';
  console.log(`Menggunakan Storage Bucket: ${bucketName}`);
  const bucket = admin.storage().bucket(bucketName);

  const batch = db.batch();
  let count = 0;

  for (const item of mockItems) {
    const randomOwner = finalOwners[Math.floor(Math.random() * finalOwners.length)];
    const docRef = db.collection('items').doc();
    const itemId = docRef.id;

    const isBlocked = item.status === 'blocked';
    const photos: string[] = [];
    const timestamp = Date.now();

    // Salin foto dummy di Firebase Storage ke path terstruktur:
    // items/{itemId}/photos/{timestamp}_{index}.jpg
    if (item.imageMapping) {
      for (let i = 0; i < item.imageMapping.length; i++) {
        const sourceFilename = item.imageMapping[i];
        const sourcePath = `items/dummy_assets/${sourceFilename}`;
        const destPath = `items/${itemId}/photos/${timestamp}_${i + 1}.jpg`;

        const sourceFile = bucket.file(sourcePath);
        const destFile = bucket.file(destPath);

        try {
          // Cek apakah file sumber ada
          const [exists] = await sourceFile.exists();
          if (exists) {
            console.log(`Copying storage file: ${sourcePath} -> ${destPath}`);
            await sourceFile.copy(destFile);

            // Tentukan contentType agar browser bisa me-render
            const mimeType = sourceFilename.endsWith('.png') ? 'image/png' : 'image/jpeg';
            await destFile.setMetadata({
              contentType: mimeType,
              metadata: {
                source: 'seeder-script',
                itemId: itemId,
              }
            });

            const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(destPath)}?alt=media`;
            photos.push(downloadUrl);
          } else {
            console.warn(`⚠ File sumber tidak ditemukan di storage: ${sourcePath}`);
          }
        } catch (copyErr) {
          console.error(`✗ Gagal menyalin file ${sourcePath} ke ${destPath}:`, copyErr);
        }
      }
    }

    const { imageMapping, ...cleanItem } = item as any;

    const itemData = {
      ...cleanItem,
      id: itemId,
      ownerId: randomOwner.id,
      ownerName: randomOwner.name || 'Owner SewaIn',
      ownerRating: randomOwner.avgRatingAsOwner || 4.7,
      blockedReason: isBlocked ? 'Melanggar aturan platform (Barang terindikasi palsu)' : null,
      blockedBy: isBlocked ? 'admin-system' : null,
      blockedAt: isBlocked ? admin.firestore.FieldValue.serverTimestamp() : null,
      photos: photos,
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
      `Menambahkan barang ke Firestore: ${itemData.name} (${itemData.categoryName}) - ID: ${itemId} dengan ${photos.length} foto`
    );
  }

  await batch.commit();
  console.log(`\n✓ SEEDING BARANG BERHASIL: ${count} data ditambahkan ke Firestore.`);
}

seedItems().catch((err) => {
  console.error('Gagal membuat barang:', formatSeedError(err));
  process.exit(1);
});
