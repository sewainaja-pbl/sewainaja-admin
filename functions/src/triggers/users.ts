import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { db, now } from '../lib/firebase-admin';
import admin from 'firebase-admin';

export const onUserCreated = onDocumentCreated('users/{userId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const data = snap.data();
  const userId = snap.id;

  const batch = db.batch();
  const statsRef = db.collection('app_stats').doc('global');

  // Increment totalUsers
  batch.set(
    statsRef,
    {
      id: 'global',
      totalUsers: admin.firestore.FieldValue.increment(1),
      totalUsersThisMonth: admin.firestore.FieldValue.increment(1),
      lastUpdated: now(),
    },
    { merge: true }
  );

  // If status is pending, create admin task for KYC review
  if (data.status === 'pending') {
    const taskRef = db.collection('admin_tasks').doc();
    batch.set(taskRef, {
      id: taskRef.id,
      type: 'kyc_review',
      title: `Review KTP for ${data.name || 'User'}`,
      description: 'ID Verification',
      refId: userId,
      refType: 'user',
      priority: 'normal',
      status: 'pending',
      assignedTo: null,
      createdAt: now(),
      updatedAt: now(),
      doneAt: null,
    });

    // Increment pending approvals
    batch.set(
      statsRef,
      {
        totalPendingApprovals: admin.firestore.FieldValue.increment(1),
        lastUpdated: now(),
      },
      { merge: true }
    );
  }

  await batch.commit();
});

export const onUserUpdated = onDocumentUpdated('users/{userId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const beforeData = snap.before.data();
  const afterData = snap.after.data();
  const userId = snap.after.id;

  const batch = db.batch();
  let hasChanges = false;

  // Handle KYC status change: from pending to something else (e.g., verified or rejected)
  if (beforeData.status === 'pending' && afterData.status !== 'pending') {
    const statsRef = db.collection('app_stats').doc('global');

    // Decrement pending approvals
    batch.set(
      statsRef,
      {
        totalPendingApprovals: admin.firestore.FieldValue.increment(-1),
        lastUpdated: now(),
      },
      { merge: true }
    );
    hasChanges = true;

    // Find the related admin task and mark as done
    const tasksSnapshot = await db
      .collection('admin_tasks')
      .where('refId', '==', userId)
      .where('type', '==', 'kyc_review')
      .where('status', '!=', 'done')
      .get();

    for (const doc of tasksSnapshot.docs) {
      batch.update(doc.ref, {
        status: 'done',
        doneAt: now(),
        updatedAt: now(),
      });
    }
  }

  // Handle other user updates here if needed in the future

  if (hasChanges) {
    await batch.commit();
  }
});
