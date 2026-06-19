import admin from 'firebase-admin';
import { formatSeedError, initializeFirebaseForSeed } from './_seed-bootstrap';

initializeFirebaseForSeed();

const db = admin.firestore();

async function recountStats() {
  console.log('Memulai penghitungan ulang data statistik...');

  const [
    totalUsersSnap,
    totalPendingApprovalsSnap,
    totalOpenDisputesSnap,
    totalOverdueDisputesSnap,
    totalActiveRentalsSnap,
    totalAvailableItemsSnap,
    totalTransactionsActiveSnap,
    totalTransactionsCompletedSnap,
    totalTransactionsCancelledSnap
  ] = await Promise.all([
    db.collection('users').count().get(),
    db.collection('users').where('status', '==', 'pending').count().get(),
    db.collection('disputes').where('status', 'in', ['open', 'under_review']).count().get(),
    db.collection('disputes').where('status', 'in', ['open', 'under_review']).where('isOverdue', '==', true).count().get(),
    db.collection('transactions').where('status', '==', 'ongoing').count().get(),
    db.collection('items').where('status', '==', 'available').count().get(),
    db.collection('transactions').where('status', 'in', ['pending', 'approved', 'ongoing', 'disputed', 'waiting_rating']).count().get(),
    db.collection('transactions').where('status', '==', 'completed').count().get(),
    db.collection('transactions').where('status', '==', 'cancelled').count().get()
  ]);

  const stats = {
    totalUsers: totalUsersSnap.data().count,
    totalPendingApprovals: totalPendingApprovalsSnap.data().count,
    totalOpenDisputes: totalOpenDisputesSnap.data().count,
    totalOverdueDisputes: totalOverdueDisputesSnap.data().count,
    totalActiveRentals: totalActiveRentalsSnap.data().count,
    totalAvailableItems: totalAvailableItemsSnap.data().count,
    totalTransactionsActive: totalTransactionsActiveSnap.data().count,
    totalTransactionsCompleted: totalTransactionsCompletedSnap.data().count,
    totalTransactionsCancelled: totalTransactionsCancelledSnap.data().count,
  };

  console.log('Hasil hitungan aktual:', stats);

  // Dapatkan user bulan ini
  const date = new Date();
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const totalUsersThisMonthSnap = await db.collection('users')
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfMonth))
    .count()
    .get();

  const finalStats = {
    ...stats,
    totalUsersThisMonth: totalUsersThisMonthSnap.data().count,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('app_stats').doc('global').set(finalStats, { merge: true });

  console.log('Berhasil mengupdate app_stats/global sesuai data di Firestore.');
}

recountStats().catch((err) => {
  console.error('Gagal melakukan recount:', formatSeedError(err));
  process.exit(1);
});
