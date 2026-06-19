import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { db, now } from '../lib/firebase-admin';
import admin from 'firebase-admin';

const isOpen = (status: string) => ['open', 'under_review'].includes(status);

export const onDisputeCreated = onDocumentCreated('disputes/{disputeId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const data = snap.data();
  const disputeId = snap.id;
  const status = data.status || 'open';

  const batch = db.batch();
  const statsRef = db.collection('app_stats').doc('global');

  if (isOpen(status)) {
    batch.set(
      statsRef,
      {
        totalOpenDisputes: admin.firestore.FieldValue.increment(1),
        ...(data.isOverdue ? { totalOverdueDisputes: admin.firestore.FieldValue.increment(1) } : {}),
        lastUpdated: now(),
      },
      { merge: true }
    );

    const taskRef = db.collection('admin_tasks').doc();
    batch.set(taskRef, {
      id: taskRef.id,
      type: 'dispute_mediation',
      title: `Resolve dispute ${disputeId}`,
      description: data.description || 'Mediation',
      refId: disputeId,
      refType: 'transaction',
      priority: data.priority || 'urgent',
      status: 'pending',
      assignedTo: null,
      createdAt: now(),
      updatedAt: now(),
      doneAt: null,
    });
  }

  await batch.commit();
});

export const onDisputeUpdated = onDocumentUpdated('disputes/{disputeId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const beforeData = snap.before.data();
  const afterData = snap.after.data();
  const disputeId = snap.after.id;

  const beforeOpen = isOpen(beforeData.status || 'open');
  const afterOpen = isOpen(afterData.status || 'open');

  const beforeOverdue = beforeData.isOverdue === true;
  const afterOverdue = afterData.isOverdue === true;

  if (beforeOpen === afterOpen && beforeOverdue === afterOverdue) return;

  const batch = db.batch();
  const statsRef = db.collection('app_stats').doc('global');
  const updates: Record<string, any> = {
    lastUpdated: now(),
  };

  let hasChanges = false;

  // Open/Close Dispute changes
  if (beforeOpen && !afterOpen) {
    updates.totalOpenDisputes = admin.firestore.FieldValue.increment(-1);
    hasChanges = true;

    // Resolve task
    const tasksSnapshot = await db
      .collection('admin_tasks')
      .where('refId', '==', disputeId)
      .where('type', '==', 'dispute_mediation')
      .where('status', '!=', 'done')
      .get();

    for (const doc of tasksSnapshot.docs) {
      batch.update(doc.ref, {
        status: 'done',
        doneAt: now(),
        updatedAt: now(),
      });
    }
  } else if (!beforeOpen && afterOpen) {
    updates.totalOpenDisputes = admin.firestore.FieldValue.increment(1);
    hasChanges = true;
  }

  // Overdue changes
  if (beforeOverdue && !afterOverdue) {
    updates.totalOverdueDisputes = admin.firestore.FieldValue.increment(-1);
    hasChanges = true;
  } else if (!beforeOverdue && afterOverdue) {
    updates.totalOverdueDisputes = admin.firestore.FieldValue.increment(1);
    hasChanges = true;
  }

  if (hasChanges) {
    batch.set(statsRef, updates, { merge: true });
    await batch.commit();
  }
});
