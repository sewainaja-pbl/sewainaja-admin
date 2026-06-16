import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db, now } from './lib/firebase-admin';
import { createNotification } from './routes/notifications';

export const checkOverdueTransactions = onSchedule('every 1 minutes', async (event) => {
  const transactionsRef = db.collection('transactions');
  const snapshot = await transactionsRef
    .where('status', '==', 'ongoing')
    .where('isOverdue', '==', false)
    .get();

  if (snapshot.empty) return;

  const batch = db.batch();
  const notifyPromises: Promise<any>[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    // Ambil detail transaksi untuk mendapatkan endDate
    const detailsSnap = await doc.ref.collection('transaction_details').get();
    let maxEndDate = new Date(0);
    let itemName = 'Barang';
    
    for (const detailDoc of detailsSnap.docs) {
      const detail = detailDoc.data();
      const eDate = detail.endDate?.toDate();
      if (eDate && eDate > maxEndDate) {
        maxEndDate = eDate;
        itemName = detail.itemNameSnapshot || 'Barang';
      }
    }

    if (maxEndDate.getTime() > 0 && maxEndDate < new Date()) {
      // Overdue
      batch.update(doc.ref, {
        isOverdue: true,
        updatedAt: now()
      });

      // Notifikasi ke pemilik
      notifyPromises.push(
        createNotification({
          userId: data.ownerId,
          type: 'overdue',
          class: 'transactional',
          title: 'Penyewa Terlambat!',
          body: `Penyewa ${data.renterName} terlambat mengembalikan ${itemName}. Anda sekarang bisa melacak lokasinya secara live.`,
          transactionId: doc.id,
        })
      );
      
      // Notifikasi peringatan ke penyewa
      notifyPromises.push(
        createNotification({
          userId: data.renterId,
          type: 'overdue',
          class: 'transactional',
          title: 'Waktu Sewa Habis',
          body: `Masa sewa ${itemName} telah habis. Segera kembalikan barang. Lokasi GPS Anda sekarang dilacak oleh pemilik.`,
          transactionId: doc.id,
        })
      );
    }
  }

  await batch.commit();
  await Promise.allSettled(notifyPromises);
});
