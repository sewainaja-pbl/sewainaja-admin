import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { db, now } from '../lib/firebase-admin';
import admin from 'firebase-admin';

const isActive = (status: string) => ['pending', 'approved', 'ongoing', 'disputed', 'waiting_rating'].includes(status);
const isCompleted = (status: string) => status === 'completed';
const isCancelled = (status: string) => status === 'cancelled';
const isOngoing = (status: string) => status === 'ongoing';

export const onTransactionCreated = onDocumentCreated('transactions/{transactionId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const data = snap.data();
  const status = data.status || 'pending';

  const batch = db.batch();
  const statsRef = db.collection('app_stats').doc('global');

  const updates: Record<string, any> = {
    lastUpdated: now(),
  };

  if (isActive(status)) {
    updates.totalTransactionsActive = admin.firestore.FieldValue.increment(1);
  } else if (isCompleted(status)) {
    updates.totalTransactionsCompleted = admin.firestore.FieldValue.increment(1);
  } else if (isCancelled(status)) {
    updates.totalTransactionsCancelled = admin.firestore.FieldValue.increment(1);
  }

  if (isOngoing(status)) {
    updates.totalActiveRentals = admin.firestore.FieldValue.increment(1);
  }

  batch.set(statsRef, updates, { merge: true });
  await batch.commit();
});

export const onTransactionUpdated = onDocumentUpdated('transactions/{transactionId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const beforeData = snap.before.data();
  const afterData = snap.after.data();

  const beforeStatus = beforeData.status || 'pending';
  const afterStatus = afterData.status || 'pending';

  // If status didn't change, we don't need to update stats for status changes
  if (beforeStatus === afterStatus) return;

  const batch = db.batch();
  const statsRef = db.collection('app_stats').doc('global');

  const updates: Record<string, any> = {
    lastUpdated: now(),
  };

  // Adjust totalActiveRentals
  if (isOngoing(beforeStatus) && !isOngoing(afterStatus)) {
    updates.totalActiveRentals = admin.firestore.FieldValue.increment(-1);
  } else if (!isOngoing(beforeStatus) && isOngoing(afterStatus)) {
    updates.totalActiveRentals = admin.firestore.FieldValue.increment(1);
  }

  // Adjust transaction type counters
  const beforeActive = isActive(beforeStatus);
  const afterActive = isActive(afterStatus);
  if (beforeActive && !afterActive) {
    updates.totalTransactionsActive = admin.firestore.FieldValue.increment(-1);
  } else if (!beforeActive && afterActive) {
    updates.totalTransactionsActive = admin.firestore.FieldValue.increment(1);
  }

  const beforeCompleted = isCompleted(beforeStatus);
  const afterCompleted = isCompleted(afterStatus);
  if (beforeCompleted && !afterCompleted) {
    updates.totalTransactionsCompleted = admin.firestore.FieldValue.increment(-1);
  } else if (!beforeCompleted && afterCompleted) {
    updates.totalTransactionsCompleted = admin.firestore.FieldValue.increment(1);
  }

  const beforeCancelled = isCancelled(beforeStatus);
  const afterCancelled = isCancelled(afterStatus);
  if (beforeCancelled && !afterCancelled) {
    updates.totalTransactionsCancelled = admin.firestore.FieldValue.increment(-1);
  } else if (!beforeCancelled && afterCancelled) {
    updates.totalTransactionsCancelled = admin.firestore.FieldValue.increment(1);
  }

  batch.set(statsRef, updates, { merge: true });
  await batch.commit();
});
