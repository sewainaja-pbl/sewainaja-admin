import { db, now } from './firebase-admin';
import type { NotificationDoc } from '../types/notification';

interface CreateNotificationInput {
  userId: string;
  type: NotificationDoc['type'];
  title: string;
  body: string;
  transactionId?: string | null;
}

/**
 * Helper to create a new notification in the 'notifications' collection.
 */
export async function createNotification(input: CreateNotificationInput) {
  const data: Omit<NotificationDoc, 'id'> = {
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    transactionId: input.transactionId || null,
    isRead: false,
    isSent: false,
    scheduledAt: null,
    createdAt: now(),
  };

  const docRef = db.collection('notifications').doc();
  await docRef.set(data);
  return { id: docRef.id, ...data };
}
