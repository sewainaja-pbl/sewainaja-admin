import admin from 'firebase-admin';
import { db, now } from './firebase-admin';
import type { UserDoc } from '../types/auth';
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

  let isSent = false;

  try {
    const userSnap = await db.collection('users').doc(input.userId).get();
    const user = userSnap.data() as UserDoc | undefined;
    const fcmToken = user?.fcmToken?.trim();

    if (fcmToken) {
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: input.title,
          body: input.body,
        },
        data: {
          notificationId: docRef.id,
          type: input.type,
          transactionId: input.transactionId ?? '',
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
        },
      });

      isSent = true;
      await docRef.update({
        isSent: true,
      });
    }
  } catch (error) {
    console.error('Failed to send FCM push notification:', error);
  }

  return { id: docRef.id, ...data, isSent };
}
