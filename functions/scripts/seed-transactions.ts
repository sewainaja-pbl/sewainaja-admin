/**
 * Script untuk membuat data dummy transaksi di Firebase.
 *
 * UNTUK EMULATOR (lokal):
 *   $env:USE_EMULATOR='true'; npx ts-node scripts/seed-transactions.ts
 *
 * UNTUK PRODUCTION (cloud):
 *   npx ts-node scripts/seed-transactions.ts
 */

import admin from 'firebase-admin';
import { formatSeedError, initializeFirebaseForSeed } from './_seed-bootstrap';

initializeFirebaseForSeed();

const db = admin.firestore();

const mockTransactions = [
  {
    id: 'TX-1001',
    renterId: 'user1',
    ownerId: 'user2',
    totalPrice: 150000,
    totalItems: 1,
    status: 'completed',
    isOverdue: false,
    qrCheckinTokenHash: 'hash1',
    qrCheckinExpiredAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-10T10:00:00Z')),
    qrCheckoutTokenHash: 'hash2',
    qrCheckoutExpiredAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-12T10:00:00Z')),
    checkinAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-10T09:30:00Z')),
    checkoutAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-12T09:45:00Z')),
    createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-09T10:00:00Z')),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-12T09:45:00Z')),
    renterName: 'Budi Santoso',
    ownerName: 'Siti Aminah',
  },
  {
    id: 'TX-1002',
    renterId: 'user3',
    ownerId: 'user2',
    totalPrice: 300000,
    totalItems: 2,
    status: 'ongoing',
    isOverdue: false,
    qrCheckinTokenHash: 'hash3',
    qrCheckinExpiredAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-18T10:00:00Z')),
    qrCheckoutTokenHash: 'hash4',
    qrCheckoutExpiredAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-20T10:00:00Z')),
    checkinAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-18T09:15:00Z')),
    checkoutAt: null,
    createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-17T14:00:00Z')),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-18T09:15:00Z')),
    renterName: 'Andi Saputra',
    ownerName: 'Siti Aminah',
  },
  {
    id: 'TX-1003',
    renterId: 'user4',
    ownerId: 'user5',
    totalPrice: 75000,
    totalItems: 1,
    status: 'pending',
    isOverdue: false,
    qrCheckinTokenHash: 'hash5',
    qrCheckinExpiredAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-25T10:00:00Z')),
    qrCheckoutTokenHash: 'hash6',
    qrCheckoutExpiredAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-27T10:00:00Z')),
    checkinAt: null,
    checkoutAt: null,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
    renterName: 'Dewi Lestari',
    ownerName: 'Ahmad Fauzi',
  },
  {
    id: 'TX-1004',
    renterId: 'user1',
    ownerId: 'user5',
    totalPrice: 450000,
    totalItems: 1,
    status: 'disputed',
    isOverdue: true,
    qrCheckinTokenHash: 'hash7',
    qrCheckinExpiredAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-01T10:00:00Z')),
    qrCheckoutTokenHash: 'hash8',
    qrCheckoutExpiredAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-03T10:00:00Z')),
    checkinAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-01T09:30:00Z')),
    checkoutAt: null,
    createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-04-30T10:00:00Z')),
    updatedAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-04T10:00:00Z')),
    renterName: 'Budi Santoso',
    ownerName: 'Ahmad Fauzi',
  }
];

const mockTransactionDetails = {
  'TX-1001': [
    {
      id: 'TD-1001-1',
      itemId: 'item1',
      startDate: admin.firestore.Timestamp.fromDate(new Date('2026-05-10T10:00:00Z')),
      endDate: admin.firestore.Timestamp.fromDate(new Date('2026-05-12T10:00:00Z')),
      priceAtBooking: 75000,
      itemNameSnapshot: 'Tenda Dome 4 Orang',
      itemPhotoUrlSnapshot: 'https://cdn-icons-png.flaticon.com/512/2972/2972166.png',
      subtotal: 150000,
    }
  ],
  'TX-1002': [
    {
      id: 'TD-1002-1',
      itemId: 'item2',
      startDate: admin.firestore.Timestamp.fromDate(new Date('2026-05-18T10:00:00Z')),
      endDate: admin.firestore.Timestamp.fromDate(new Date('2026-05-20T10:00:00Z')),
      priceAtBooking: 100000,
      itemNameSnapshot: 'Kamera Mirrorless Sony A6000',
      itemPhotoUrlSnapshot: 'https://cdn-icons-png.flaticon.com/512/3178/3178168.png',
      subtotal: 200000,
    },
    {
      id: 'TD-1002-2',
      itemId: 'item3',
      startDate: admin.firestore.Timestamp.fromDate(new Date('2026-05-18T10:00:00Z')),
      endDate: admin.firestore.Timestamp.fromDate(new Date('2026-05-20T10:00:00Z')),
      priceAtBooking: 50000,
      itemNameSnapshot: 'Lensa Fix 50mm',
      itemPhotoUrlSnapshot: 'https://cdn-icons-png.flaticon.com/512/3178/3178168.png',
      subtotal: 100000,
    }
  ],
  'TX-1003': [
    {
      id: 'TD-1003-1',
      itemId: 'item4',
      startDate: admin.firestore.Timestamp.fromDate(new Date('2026-05-25T10:00:00Z')),
      endDate: admin.firestore.Timestamp.fromDate(new Date('2026-05-27T10:00:00Z')),
      priceAtBooking: 37500,
      itemNameSnapshot: 'Proyektor Mini Portable',
      itemPhotoUrlSnapshot: 'https://cdn-icons-png.flaticon.com/512/3616/3616180.png',
      subtotal: 75000,
    }
  ],
  'TX-1004': [
    {
      id: 'TD-1004-1',
      itemId: 'item5',
      startDate: admin.firestore.Timestamp.fromDate(new Date('2026-05-01T10:00:00Z')),
      endDate: admin.firestore.Timestamp.fromDate(new Date('2026-05-03T10:00:00Z')),
      priceAtBooking: 225000,
      itemNameSnapshot: 'PlayStation 5',
      itemPhotoUrlSnapshot: 'https://cdn-icons-png.flaticon.com/512/1368/1368147.png',
      subtotal: 450000,
    }
  ]
};

const mockPayments = [
  {
    id: 'PAY-1001',
    transactionId: 'TX-1001',
    amount: 150000,
    status: 'paid',
    paymentMethod: 'midtrans',
    midtransOrderId: 'ORDER-1001',
    midtransPaymentType: 'qris',
    paymentProofUrl: null,
    paidAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-09T10:05:00Z')),
    createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-09T10:00:00Z')),
  },
  {
    id: 'PAY-1002',
    transactionId: 'TX-1002',
    amount: 300000,
    status: 'paid',
    paymentMethod: 'midtrans',
    midtransOrderId: 'ORDER-1002',
    midtransPaymentType: 'bank_transfer',
    paymentProofUrl: null,
    paidAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-17T14:10:00Z')),
    createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-05-17T14:00:00Z')),
  },
  {
    id: 'PAY-1003',
    transactionId: 'TX-1003',
    amount: 75000,
    status: 'pending',
    paymentMethod: 'midtrans',
    midtransOrderId: 'ORDER-1003',
    midtransPaymentType: 'gopay',
    paymentProofUrl: null,
    paidAt: null,
    createdAt: admin.firestore.Timestamp.now(),
  },
  {
    id: 'PAY-1004',
    transactionId: 'TX-1004',
    amount: 450000,
    status: 'paid',
    paymentMethod: 'manual_transfer',
    midtransOrderId: null,
    midtransPaymentType: null,
    paymentProofUrl: 'https://example.com/proof.jpg',
    paidAt: admin.firestore.Timestamp.fromDate(new Date('2026-04-30T10:30:00Z')),
    createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-04-30T10:00:00Z')),
  }
];

async function seedTransactions() {
  console.log('Menyiapkan seeding transaksi...\n');

  const usersSnap = await db.collection('users').get();
  const allUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
  const renters = allUsers.filter((u: any) => u.isRenter === true);

  if (renters.length === 0) {
    throw new Error('Tidak ada user dengan isRenter == true. Jalankan seed:users terlebih dahulu.');
  }

  const itemsSnap = await db.collection('items').where('status', '==', 'available').get();
  if (itemsSnap.empty) {
    throw new Error('Tidak ada barang yang available. Jalankan seed:items terlebih dahulu.');
  }
  const availableItems = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

  const batch = db.batch();
  let countTx = 0;
  let countDetails = 0;
  let countPayments = 0;

  // Let's create realistic transactions based on the items available
  const numTransactionsToCreate = Math.min(4, availableItems.length);
  
  for (let i = 0; i < numTransactionsToCreate; i++) {
    const item = availableItems[i];
    
    // Pick a renter that is NOT the owner
    const validRenters = renters.filter(u => u.id !== item.ownerId);
    if (validRenters.length === 0) continue; // Skip if no valid renter
    
    const renter = validRenters[Math.floor(Math.random() * validRenters.length)];
    const txRef = db.collection('transactions').doc();
    const txId = txRef.id;
    
    // Calculate dates
    const now = new Date();
    const startDate = new Date(now.getTime() + (i * 24 * 60 * 60 * 1000)); // +i days
    const endDate = new Date(startDate.getTime() + (2 * 24 * 60 * 60 * 1000)); // +2 days from start
    
    const subtotal = item.pricePerHour * 48; // Assume 48 hours (2 days)
    
    const statuses = ['pending', 'approved', 'ongoing', 'completed', 'disputed'];
    const txStatus = statuses[i % statuses.length];
    
    // 1. Transaction Document
    const txData = {
      id: txId,
      renterId: renter.id,
      ownerId: item.ownerId,
      totalPrice: subtotal,
      totalItems: 1,
      status: txStatus,
      isOverdue: txStatus === 'disputed',
      qrCheckinTokenHash: 'hash_in_' + txId,
      qrCheckinExpiredAt: admin.firestore.Timestamp.fromDate(new Date(startDate.getTime() + 3600000)),
      qrCheckoutTokenHash: 'hash_out_' + txId,
      qrCheckoutExpiredAt: admin.firestore.Timestamp.fromDate(new Date(endDate.getTime() + 3600000)),
      checkinAt: ['ongoing', 'completed', 'disputed'].includes(txStatus) ? admin.firestore.Timestamp.fromDate(startDate) : null,
      checkoutAt: ['completed'].includes(txStatus) ? admin.firestore.Timestamp.fromDate(endDate) : null,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      renterName: renter.name,
      ownerName: item.ownerName,
    };
    batch.set(txRef, txData);
    countTx++;
    console.log(`Menambahkan transaksi: ${txId} (${txStatus})`);

    // 2. Transaction Details
    const detailRef = txRef.collection('transaction_details').doc();
    const detailData = {
      id: detailRef.id,
      itemId: item.id,
      startDate: admin.firestore.Timestamp.fromDate(startDate),
      endDate: admin.firestore.Timestamp.fromDate(endDate),
      priceAtBooking: item.pricePerHour,
      itemNameSnapshot: item.name,
      itemPhotoUrlSnapshot: item.categoryPhotoUrl || '',
      subtotal: subtotal,
    };
    batch.set(detailRef, detailData);
    countDetails++;

    // 3. Payment Document
    const paymentRef = db.collection('payments').doc();
    const paymentStatus = ['pending'].includes(txStatus) ? 'pending' : 'paid';
    const paymentData = {
      id: paymentRef.id,
      transactionId: txId,
      amount: subtotal,
      status: paymentStatus,
      paymentMethod: 'midtrans',
      midtransOrderId: 'ORDER-' + txId,
      midtransPaymentType: 'qris',
      paymentProofUrl: null,
      paidAt: paymentStatus === 'paid' ? admin.firestore.Timestamp.now() : null,
      createdAt: admin.firestore.Timestamp.now(),
    };
    batch.set(paymentRef, paymentData);
    countPayments++;
    console.log(`Menambahkan pembayaran: ${paymentRef.id}`);
  }

  await batch.commit();

  console.log('\nSEEDING TRANSAKSI BERHASIL:');
  console.log(`- ${countTx} Transactions`);
  console.log(`- ${countDetails} Transaction Details`);
  console.log(`- ${countPayments} Payments`);
}

seedTransactions().catch((err) => {
  console.error('Gagal membuat transaksi:', formatSeedError(err));
  process.exit(1);
});
