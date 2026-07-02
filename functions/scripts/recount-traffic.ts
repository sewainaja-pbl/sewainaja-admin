import admin from 'firebase-admin';
import { formatSeedError, initializeFirebaseForSeed } from './_seed-bootstrap';

initializeFirebaseForSeed();

const db = admin.firestore();

const getWeek = (d: Date) => {
  const dCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = dCopy.getUTCDay() || 7;
  dCopy.setUTCDate(dCopy.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(),0,1));
  return Math.ceil((((dCopy.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
};

async function recountTraffic() {
  console.log('Memulai penghitungan ulang riwayat traffic (7 hari terakhir)...');

  const logsColl = db.collection('user_activity_logs');
  const oldLogs = await logsColl.get();
  
  // Hapus log lama (yang berasal dari seeder/dummy)
  const batch = db.batch();
  oldLogs.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  // Generate ulang dari 7 hari lalu sampai hari ini
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const startTimestamp = admin.firestore.Timestamp.fromDate(startOfDay);
    const endTimestamp = admin.firestore.Timestamp.fromDate(endOfDay);

    const [newUsersSnap, newItemsSnap, newTransactionsSnap, activeUsersSnap] = await Promise.all([
      db.collection('users').where('createdAt', '>=', startTimestamp).where('createdAt', '<=', endTimestamp).count().get(),
      db.collection('items').where('createdAt', '>=', startTimestamp).where('createdAt', '<=', endTimestamp).count().get(),
      db.collection('transactions').where('createdAt', '>=', startTimestamp).where('createdAt', '<=', endTimestamp).count().get(),
      db.collection('users').where('updatedAt', '>=', startTimestamp).where('updatedAt', '<=', endTimestamp).count().get()
    ]);

    const monthStr = dateStr.substring(0, 7);
    const yearStr = dateStr.substring(0, 4);
    const weekStr = `${yearStr}-${getWeek(date).toString().padStart(2, '0')}`;

    await logsColl.doc(dateStr).set({
      id: dateStr,
      date: dateStr,
      week: weekStr,
      month: monthStr,
      year: yearStr,
      newUsers: newUsersSnap.data().count,
      newItems: newItemsSnap.data().count,
      newTransactions: newTransactionsSnap.data().count,
      activeUsers: activeUsersSnap.data().count,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`- Data traffic untuk ${dateStr} berhasil dihitung.`);
  }

  console.log('Berhasil mengupdate riwayat traffic sesuai data asli di Firestore.');
}

recountTraffic().catch((err) => {
  console.error('Gagal melakukan recount traffic:', formatSeedError(err));
  process.exit(1);
});
