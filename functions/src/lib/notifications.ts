import admin from 'firebase-admin';
import { db, now } from './firebase-admin';
import type { UserDoc } from '../types/auth';
import type {
  NotificationClass,
  NotificationDoc,
  NotificationType,
} from '../types/notification';

const INVALID_TOKEN_ERRORS = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  class?: NotificationClass;
  title: string;
  body: string;
  transactionId?: string | null;
  deeplink?: string | null;
  imageUrl?: string | null;
  idempotencyKey?: string | null;
  dryRun?: boolean;
}

interface BroadcastNotificationInput {
  userIds?: string[];
  type: NotificationType;
  class: NotificationClass;
  title: string;
  body: string;
  transactionId?: string | null;
  deeplink?: string | null;
  imageUrl?: string | null;
  idempotencyKey?: string | null;
  dryRun?: boolean;
}

export interface BroadcastNotificationResult {
  scope: 'all' | 'segment';
  totalTarget: number;
  totalValidToken: number;
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
  createdNotificationCount: number;
  dryRun: boolean;
}

const parseFirebaseErrorCode = (error: unknown) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }
  return null;
};

const normalizeImageUrl = (imageUrl?: string | null) => {
  const value = imageUrl?.trim();
  if (!value) {
    return null;
  }
  return value;
};

const buildNotificationData = (input: CreateNotificationInput) => {
  const imageUrl = normalizeImageUrl(input.imageUrl);

  const data: Omit<NotificationDoc, 'id'> = {
    userId: input.userId,
    type: input.type,
    class: input.class ?? 'transactional',
    title: input.title,
    body: input.body,
    transactionId: input.transactionId || null,
    deeplink: input.deeplink?.trim() || null,
    imageUrl,
    idempotencyKey: input.idempotencyKey?.trim() || null,
    isRead: false,
    isSent: false,
    scheduledAt: null,
    createdAt: now(),
    updatedAt: now(),
    sentAt: null,
    pushMessageId: null,
    providerStatus: 'skipped',
    failureReason: null,
    attempt: 1,
  };

  return data;
};

const buildPushDataMap = (
  notificationId: string,
  input: {
    type: NotificationType;
    class?: NotificationClass;
    transactionId?: string | null;
    deeplink?: string | null;
    imageUrl?: string | null;
    idempotencyKey?: string | null;
  },
) => {
  return {
    notificationId,
    type: input.type,
    class: input.class ?? 'transactional',
    transactionId: input.transactionId ?? '',
    deeplink: input.deeplink ?? '',
    imageUrl: input.imageUrl ?? '',
    idempotencyKey: input.idempotencyKey ?? '',
  };
};

const buildMessageForToken = (
  token: string,
  input: {
    title: string;
    body: string;
    type: NotificationType;
    class?: NotificationClass;
    transactionId?: string | null;
    deeplink?: string | null;
    imageUrl?: string | null;
    idempotencyKey?: string | null;
  },
  notificationId: string,
): admin.messaging.Message => {
  const imageUrl = normalizeImageUrl(input.imageUrl);

  return {
    token,
    notification: {
      title: input.title,
      body: input.body,
      ...(imageUrl ? { imageUrl } : {}),
    },
    data: buildPushDataMap(notificationId, {
      type: input.type,
      class: input.class,
      transactionId: input.transactionId,
      deeplink: input.deeplink,
      imageUrl,
      idempotencyKey: input.idempotencyKey,
    }),
    android: {
      priority: 'high',
      notification: {
        channelId: 'default',
        ...(imageUrl ? { imageUrl } : {}),
      },
    },
    apns: {
      headers: {
        'apns-priority': '10',
      },
      payload: {
        aps: {
          sound: 'default',
        },
      },
      fcmOptions: imageUrl ? { imageUrl } : undefined,
    },
  };
};

const getUserToken = async (userId: string) => {
  const userSnap = await db.collection('users').doc(userId).get();
  const user = userSnap.data() as UserDoc | undefined;
  return user?.fcmToken?.trim() || '';
};

const clearInvalidToken = async (userId: string) => {
  await db.collection('users').doc(userId).update({
    fcmToken: '',
    lastTokenErrorAt: now(),
    updatedAt: now(),
  });
};

const findDuplicateNotificationByIdempotencyKey = async (
  userId: string,
  idempotencyKey?: string | null,
) => {
  const normalized = idempotencyKey?.trim();
  if (!normalized) {
    return null;
  }

  const snapshot = await db
    .collection('notifications')
    .where('userId', '==', userId)
    .where('idempotencyKey', '==', normalized)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }
  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as NotificationDoc;
};

export async function createNotification(input: CreateNotificationInput) {
  const duplicate = await findDuplicateNotificationByIdempotencyKey(
    input.userId,
    input.idempotencyKey,
  );
  if (duplicate) {
    return duplicate;
  }

  const data = buildNotificationData(input);
  const docRef = db.collection('notifications').doc();
  await docRef.set(data);

  const fcmToken = await getUserToken(input.userId);

  if (!fcmToken) {
    await docRef.update({
      providerStatus: 'skipped',
      failureReason: 'FCM_TOKEN_EMPTY',
      updatedAt: now(),
    });
    return { id: docRef.id, ...data };
  }

  if (input.dryRun === true) {
    await docRef.update({
      providerStatus: 'skipped',
      failureReason: 'DRY_RUN',
      updatedAt: now(),
    });
    return { id: docRef.id, ...data };
  }

  const message = buildMessageForToken(
    fcmToken,
    {
      title: input.title,
      body: input.body,
      type: input.type,
      class: input.class,
      transactionId: input.transactionId,
      deeplink: input.deeplink,
      imageUrl: input.imageUrl,
      idempotencyKey: input.idempotencyKey,
    },
    docRef.id,
  );

  try {
    const pushMessageId = await admin.messaging().send(message);
    await docRef.update({
      isSent: true,
      providerStatus: 'success',
      failureReason: null,
      pushMessageId,
      sentAt: now(),
      updatedAt: now(),
    });
  } catch (error) {
    const errorCode = parseFirebaseErrorCode(error);
    const isInvalidToken = errorCode !== null && INVALID_TOKEN_ERRORS.has(errorCode);

    await docRef.update({
      providerStatus: 'failed',
      failureReason: errorCode ?? 'UNKNOWN_SEND_ERROR',
      updatedAt: now(),
    });

    if (isInvalidToken) {
      await clearInvalidToken(input.userId);
    }

    console.error('Failed to send FCM push notification:', error);
  }

  return { id: docRef.id, ...data };
}

const chunk = <T>(arr: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const getTargetUsers = async (userIds?: string[]) => {
  if (Array.isArray(userIds) && userIds.length > 0) {
    const unique = Array.from(
      new Set(userIds.map((id) => id.trim()).filter(Boolean)),
    );
    const refs = unique.map((id) => db.collection('users').doc(id).get());
    const snapshots = await Promise.all(refs);
    return snapshots
      .filter((snap) => snap.exists)
      .map((snap) => ({
        ...(snap.data() as UserDoc),
        id: snap.id,
      }));
  }

  const snapshot = await db
    .collection('users')
    .where('fcmToken', '!=', '')
    .get();

  return snapshot.docs.map((doc) => ({
    ...(doc.data() as UserDoc),
    id: doc.id,
  }));
};

export async function broadcastNotification(
  input: BroadcastNotificationInput,
): Promise<BroadcastNotificationResult> {
  const users = await getTargetUsers(input.userIds);
  const tokenTargets = users
    .map((user) => ({
      userId: user.id,
      token: user.fcmToken?.trim() ?? '',
    }))
    .filter((item) => item.token.length > 0);

  const perUserNotifications = await Promise.all(
    tokenTargets.map((target) =>
      createNotification({
        userId: target.userId,
        type: input.type,
        class: input.class,
        title: input.title,
        body: input.body,
        transactionId: input.transactionId,
        deeplink: input.deeplink,
        imageUrl: input.imageUrl,
        idempotencyKey: input.idempotencyKey
          ? `${input.idempotencyKey}:${target.userId}`
          : null,
        dryRun: true,
      }),
    ),
  );
  const broadcastTargets = tokenTargets.map((target, index) => ({
    ...target,
    notificationId: perUserNotifications[index]?.id ?? '',
  }));

  if (input.dryRun === true) {
    return {
      scope: input.userIds?.length ? 'segment' : 'all',
      totalTarget: users.length,
      totalValidToken: tokenTargets.length,
      successCount: 0,
      failureCount: 0,
      invalidTokens: [],
      createdNotificationCount: perUserNotifications.length,
      dryRun: true,
    };
  }

  const multicastChunks = chunk(broadcastTargets, 500);
  let successCount = 0;
  let failureCount = 0;
  const invalidTokens: string[] = [];

  for (const tokenChunk of multicastChunks) {
    const message = {
      tokens: tokenChunk.map((item) => item.token),
      notification: {
        title: input.title,
        body: input.body,
        ...(normalizeImageUrl(input.imageUrl)
          ? { imageUrl: normalizeImageUrl(input.imageUrl)! }
          : {}),
      },
      data: buildPushDataMap('broadcast', {
        type: input.type,
        class: input.class,
        transactionId: input.transactionId,
        deeplink: input.deeplink,
        imageUrl: input.imageUrl,
        idempotencyKey: input.idempotencyKey,
      }),
      android: {
        priority: 'high' as const,
        notification: normalizeImageUrl(input.imageUrl)
          ? { imageUrl: normalizeImageUrl(input.imageUrl)! }
          : undefined,
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
        fcmOptions: normalizeImageUrl(input.imageUrl)
          ? { imageUrl: normalizeImageUrl(input.imageUrl)! }
          : undefined,
      },
    };

    const resp = await admin.messaging().sendEachForMulticast(message);
    successCount += resp.successCount;
    failureCount += resp.failureCount;

    const updateOps: Promise<unknown>[] = [];
    resp.responses.forEach((itemResp, index) => {
      const target = tokenChunk[index];
      if (!target || !target.notificationId) {
        return;
      }
      if (itemResp.success) {
        updateOps.push(
          db.collection('notifications').doc(target.notificationId).update({
            isSent: true,
            providerStatus: 'success',
            failureReason: null,
            pushMessageId: itemResp.messageId ?? null,
            sentAt: now(),
            updatedAt: now(),
          }),
        );
        return;
      }
      const code = itemResp.error?.code ?? '';
      updateOps.push(
        db.collection('notifications').doc(target.notificationId).update({
          providerStatus: 'failed',
          failureReason: code || 'UNKNOWN_SEND_ERROR',
          updatedAt: now(),
        }),
      );
      if (INVALID_TOKEN_ERRORS.has(code)) {
        invalidTokens.push(target.userId);
      }
    });
    if (updateOps.length > 0) {
      await Promise.all(updateOps);
    }
  }

  if (invalidTokens.length > 0) {
    await Promise.all(invalidTokens.map((userId) => clearInvalidToken(userId)));
  }

  return {
    scope: input.userIds?.length ? 'segment' : 'all',
    totalTarget: users.length,
    totalValidToken: tokenTargets.length,
    successCount,
    failureCount,
    invalidTokens: Array.from(new Set(invalidTokens)),
    createdNotificationCount: perUserNotifications.length,
    dryRun: false,
  };
}
