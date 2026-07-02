import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { db, now } from '../lib/firebase-admin';
import admin from 'firebase-admin';

export const onItemCreated = onDocumentCreated('items/{itemId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const data = snap.data();
  const status = data.status || 'inactive';

  if (status === 'available') {
    const statsRef = db.collection('app_stats').doc('global');
    await statsRef.set(
      {
        totalAvailableItems: admin.firestore.FieldValue.increment(1),
        lastUpdated: now(),
      },
      { merge: true }
    );
  }
});

export const onItemUpdated = onDocumentUpdated('items/{itemId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const beforeData = snap.before.data();
  const afterData = snap.after.data();

  const beforeStatus = beforeData.status || 'inactive';
  const afterStatus = afterData.status || 'inactive';

  if (beforeStatus === afterStatus) return;

  const statsRef = db.collection('app_stats').doc('global');
  const updates: Record<string, any> = {
    lastUpdated: now(),
  };

  let hasChanges = false;

  if (beforeStatus === 'available' && afterStatus !== 'available') {
    updates.totalAvailableItems = admin.firestore.FieldValue.increment(-1);
    hasChanges = true;
  } else if (beforeStatus !== 'available' && afterStatus === 'available') {
    updates.totalAvailableItems = admin.firestore.FieldValue.increment(1);
    hasChanges = true;
  }

  if (hasChanges) {
    await statsRef.set(updates, { merge: true });
  }
});
