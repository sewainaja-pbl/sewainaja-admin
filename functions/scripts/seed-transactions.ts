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

  const batch = db.batch();
  let countTx = 0;
  let countDetails = 0;
  let countPayments = 0;

  // 1. Transactions
  for (const tx of mockTransactions) {
    const docRef = db.collection('transactions').doc(tx.id);
    batch.set(docRef, tx);
    countTx++;
    console.log('Menambahkan transaksi: ' + tx.id);

    // 2. Transaction Details (Subcollection)
    const details = mockTransactionDetails[tx.id as keyof typeof mockTransactionDetails];
    if (details) {
      for (const detail of details) {
        const detailRef = docRef.collection('transaction_details').doc(detail.id);
        batch.set(detailRef, detail);
        countDetails++;
      }
    }
  }

  // 3. Payments
  for (const payment of mockPayments) {
    const docRef = db.collection('payments').doc(payment.id);
    batch.set(docRef, payment);
    countPayments++;
    console.log('Menambahkan pembayaran: ' + payment.id);
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
