import admin from 'firebase-admin';
import { formatSeedError, initializeFirebaseForSeed } from './_seed-bootstrap';

initializeFirebaseForSeed();

const db = admin.firestore();

async function seedDashboard() {
  console.log('Memulai seeding data dashboard...\n');

  // 1. Seed app_stats/global
  const statsRef = db.collection('app_stats').doc('global');
  await statsRef.set({
    id: 'global',
    totalUsers: 5000,
    totalUsersThisMonth: 120,
    totalUsersPrevMonth: 100,
    totalPendingApprovals: 23,
    totalOpenDisputes: 4,
    totalOverdueDisputes: 2,
    totalActiveRentals: 82,
    totalAvailableItems: 1450,
    totalTransactionsActive: 100,
    totalTransactionsCompleted: 100,
    totalTransactionsCancelled: 500,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('app_stats/global berhasil dibuat');

  // 2. Seed admin_tasks
  const tasksColl = db.collection('admin_tasks');
  const oldTasks = await tasksColl.get();
  const batch1 = db.batch();
  oldTasks.docs.forEach((doc) => batch1.delete(doc.ref));
  await batch1.commit();

  const tasks = [
    {
      type: 'kyc_review',
      title: 'Review KTP for Budi Santoso',
      description: 'ID Verification',
      refId: '123',
      priority: 'normal',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      type: 'dispute_mediation',
      title: 'Resolve dispute TRX-9884',
      description: 'Mediation',
      refId: 'TRX-9884',
      priority: 'urgent',
      status: 'in_progress',
      createdAt: new Date(Date.now() - 2 * 3600000),
    },
    {
      type: 'maintenance',
      title: 'Update system config',
      description: 'Maintenance',
      refId: null,
      priority: 'normal',
      status: 'done',
      createdAt: new Date(Date.now() - 4 * 3600000),
    },
    {
      type: 'report',
      title: 'Weekly report generation',
      description: 'Automated',
      refId: null,
      priority: 'normal',
      status: 'done',
      createdAt: new Date(Date.now() - 12 * 3600000),
    },
  ];

  for (const task of tasks) {
    await tasksColl.add(task);
  }
  console.log('admin_tasks berhasil dibuat');

  // 3. Seed user_activity_logs (7 hari terakhir)
  const logsColl = db.collection('user_activity_logs');
  const oldLogs = await logsColl.get();
  const batch2 = db.batch();
  oldLogs.docs.forEach((doc) => batch2.delete(doc.ref));
  await batch2.commit();

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const monthStr = dateStr.substring(0, 7);
    const yearStr = dateStr.substring(0, 4);

    await logsColl.doc(dateStr).set({
      id: dateStr,
      date: dateStr,
      week: '2026-19',
      month: monthStr,
      year: yearStr,
      activeUsers: 2000 + Math.floor(Math.random() * 500),
      newUsers: 10 + Math.floor(Math.random() * 20),
      newItems: 5 + Math.floor(Math.random() * 10),
      newTransactions: 20 + Math.floor(Math.random() * 30),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  console.log('user_activity_logs berhasil dibuat');

  console.log('\nSEEDING DASHBOARD BERHASIL SELESAI\n');
}

seedDashboard().catch((err) => {
  console.error('Gagal melakukan seeding dashboard:', formatSeedError(err));
  process.exit(1);
});
