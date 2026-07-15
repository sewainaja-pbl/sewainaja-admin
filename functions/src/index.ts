import admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { app } from './app';

export { app };
export const api = onRequest({ cors: true, invoker: 'public' }, app);

// Firestore trigger: kirim FCM push notification saat dokumen notifications baru dibuat oleh client.
export const onNotificationCreated = onDocumentCreated(
  'notifications/{notificationId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data() as Record<string, unknown>;

    // Jika isSent sudah true (dibuat oleh backend langsung), skip.
    if (data['isSent'] === true) return;
    // Jika source dari backend, skip karena backend akan/sudah mengirimkan push notifikasi.
    if (data['source'] === 'backend') return;
    // Jika scheduledAt ada (penjadwalan), skip — biarkan proses scheduler yang handle.
    if (data['scheduledAt'] != null) return;

    const { db, now } = await import('./lib/firebase-admin');

    const userId = data['userId'] as string | undefined;
    if (!userId) return;

    // Ambil FCM token pengguna
    const userSnap = await db.collection('users').doc(userId).get();
    const fcmToken = ((userSnap.data() as Record<string, unknown> | undefined)?.['fcmToken'] as string | undefined)?.trim() ?? '';

    if (!fcmToken) {
      await snap.ref.update({
        providerStatus: 'skipped',
        failureReason: 'FCM_TOKEN_EMPTY',
        updatedAt: now(),
      });
      return;
    }

    const title = (data['title'] as string | undefined) ?? 'Notifikasi baru';
    let body = (data['body'] as string | undefined) ?? 'Ada pembaruan baru.';
    let imageUrl = (data['imageUrl'] as string | undefined) ?? '';
    const notificationId = snap.id;

    // Parse JSON item card body if the sender used raw JSON as the body text
    if (body.startsWith('{') && body.includes('"name"')) {
      try {
        const parsed = JSON.parse(body);
        const itemName = parsed.name || 'Barang';
        body = `📦 ${itemName}`;
        if (!imageUrl && parsed.image) {
          imageUrl = parsed.image;
        }
      } catch (_) {
        // Not valid JSON, keep body as-is
      }
    }

    const message = {
      token: fcmToken,
      notification: { 
        title, 
        body,
        ...(imageUrl ? { imageUrl } : {}) 
      },
      data: {
        notificationId,
        type: (data['type'] as string | undefined) ?? '',
        class: (data['class'] as string | undefined) ?? 'transactional',
        transactionId: (data['transactionId'] as string | undefined) ?? '',
        deeplink: (data['deeplink'] as string | undefined) ?? '',
        imageUrl: imageUrl,
        chatPartnerId: (data['chatPartnerId'] as string | undefined) ?? '',
        chatPartnerName: (data['chatPartnerName'] as string | undefined) ?? '',
        idempotencyKey: (data['idempotencyKey'] as string | undefined) ?? '',
      },
      android: {
        priority: 'high' as const,
        notification: { channelId: 'default' },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: { aps: { sound: 'default' } },
      },
    };

    try {
      const pushMessageId = await admin.messaging().send(message);
      await snap.ref.update({
        isSent: true,
        providerStatus: 'success',
        failureReason: null,
        pushMessageId,
        sentAt: now(),
        updatedAt: now(),
      });
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code: unknown }).code)
          : 'UNKNOWN_SEND_ERROR';
      await snap.ref.update({
        providerStatus: 'failed',
        failureReason: code,
        updatedAt: now(),
      });
      // Hapus token yang tidak valid
      const INVALID = new Set([
        'messaging/invalid-registration-token',
        'messaging/registration-token-not-registered',
      ]);
      if (INVALID.has(code)) {
        await db.collection('users').doc(userId).update({
          fcmToken: '',
          lastTokenErrorAt: now(),
          updatedAt: now(),
        });
      }
      console.error('[onNotificationCreated] FCM send failed:', error);
    }
  },
);

export default api;
export { checkOverdueTransactions, generateDailyTrafficLog, resetMonthlyStats, checkExpiredTransactions } from './cron';
export * from './triggers/users';
export * from './triggers/transactions';
export * from './triggers/items';
export * from './triggers/disputes';
