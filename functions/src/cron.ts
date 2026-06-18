import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db, now } from './lib/firebase-admin';
import { createNotification } from './lib/notifications';

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
    let minStartDate = new Date(8640000000000000); // Far future
    let itemName = 'Barang';
    
    for (const detailDoc of detailsSnap.docs) {
      const detail = detailDoc.data();
      const eDate = detail.endDate?.toDate();
      const sDate = detail.startDate?.toDate();
      if (eDate && eDate > maxEndDate) {
        maxEndDate = eDate;
        itemName = detail.itemNameSnapshot || 'Barang';
      }
      if (sDate && sDate < minStartDate) {
        minStartDate = sDate;
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
    } else if (maxEndDate.getTime() > 0) {
      // Logic for Reminders
      const totalDurationMs = maxEndDate.getTime() - minStartDate.getTime();
      const remainingMs = maxEndDate.getTime() - Date.now();
      
      const remindersSent: string[] = data.remindersSent || [];
      const newReminders = [...remindersSent];

      let notifiedThisTick = false;
      const checkAndNotify = (thresholdId: string, msThreshold: number, timeStr: string) => {
        if (totalDurationMs > msThreshold && remainingMs <= msThreshold && remainingMs > 0 && !remindersSent.includes(thresholdId)) {
          newReminders.push(thresholdId);
          if (!notifiedThisTick) {
            notifiedThisTick = true;
            notifyPromises.push(
              createNotification({
                userId: data.renterId,
                type: 'reminder',
                class: 'transactional',
                title: 'Pengingat Masa Sewa',
                body: `Masa sewa ${itemName} Anda tersisa ${timeStr}. Harap bersiap untuk mengembalikan atau memperpanjang sewa.`,
                transactionId: doc.id,
              })
            );
          }
        }
      };

      // Thresholds based on plan, ordered from SMALLEST to LARGEST.
      // This ensures if we missed a threshold, we announce the closest one and silently mark the larger ones as sent.
      const isMultiDay = totalDurationMs > 24 * 60 * 60 * 1000;
      const isMoreThan1Hour = totalDurationMs > 60 * 60 * 1000 && totalDurationMs <= 24 * 60 * 60 * 1000;
      const isMax1Hour = totalDurationMs <= 60 * 60 * 1000;

      if (isMultiDay) {
        checkAndNotify('5m', 5 * 60 * 1000, '5 menit');
        checkAndNotify('15m', 15 * 60 * 1000, '15 menit');
        checkAndNotify('30m', 30 * 60 * 1000, '30 menit');
        checkAndNotify('1h', 1 * 60 * 60 * 1000, '1 jam');
        checkAndNotify('3h', 3 * 60 * 60 * 1000, '3 jam');
        checkAndNotify('1d', 1 * 24 * 60 * 60 * 1000, '1 hari');
        checkAndNotify('2d', 2 * 24 * 60 * 60 * 1000, '2 hari');
      } else if (isMoreThan1Hour) {
        checkAndNotify('5m', 5 * 60 * 1000, '5 menit');
        checkAndNotify('15m', 15 * 60 * 1000, '15 menit');
        checkAndNotify('30m', 30 * 60 * 1000, '30 menit');
        checkAndNotify('1h', 1 * 60 * 60 * 1000, '1 jam');
        checkAndNotify('3h', 3 * 60 * 60 * 1000, '3 jam');
      } else if (isMax1Hour) {
        checkAndNotify('5m', 5 * 60 * 1000, '5 menit');
        checkAndNotify('15m', 15 * 60 * 1000, '15 menit');
        checkAndNotify('30m', 30 * 60 * 1000, '30 menit');
      }

      if (newReminders.length > remindersSent.length) {
        batch.update(doc.ref, { remindersSent: newReminders });
      }
    }
  }

  await batch.commit();
  await Promise.allSettled(notifyPromises);
});
