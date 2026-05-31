import { Router } from 'express';
import { db, now } from '../lib/firebase-admin';
import { fail, ok } from '../lib/http';
import { ERROR_CODES } from '../errors';
import { requireAuth } from '../middleware/require-auth';
import { requireAdmin } from '../middleware/require-admin';
import { asyncHandler } from '../lib/async-handler';
import {
  broadcastNotification,
  createNotification,
} from '../lib/notifications';
import type {
  NotificationClass,
  NotificationType,
} from '../types/notification';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

const TEST_PUSH_ENABLED = process.env.ALLOW_TEST_PUSH === 'true';
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const BROADCAST_MAX_TARGET = 5000;
const RATE_LIMIT_STATE = new Map<string, { count: number; resetAt: number }>();

const TESTABLE_TYPES: NotificationType[] = [
  'request',
  'approved',
  'reminder',
  'overdue',
  'payment',
  'dispute',
  'promo',
  'review',
];

const assertRateLimit = (key: string) => {
  const nowTs = Date.now();
  const state = RATE_LIMIT_STATE.get(key);

  if (!state || nowTs >= state.resetAt) {
    RATE_LIMIT_STATE.set(key, {
      count: 1,
      resetAt: nowTs + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (state.count >= RATE_LIMIT_MAX) {
    return false;
  }

  state.count += 1;
  RATE_LIMIT_STATE.set(key, state);
  return true;
};

const parseClass = (value: unknown): NotificationClass => {
  return value === 'marketing' ? 'marketing' : 'transactional';
};

const parseType = (value: unknown): NotificationType | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim() as NotificationType;
  if (!TESTABLE_TYPES.includes(normalized)) {
    return null;
  }
  return normalized;
};

const parseBodyBase = (body: Record<string, unknown>) => {
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  const type = parseType(body.type);
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const messageBody = typeof body.body === 'string' ? body.body.trim() : '';
  const notifClass = parseClass(body.class);
  const transactionId =
    typeof body.transactionId === 'string' ? body.transactionId.trim() : '';
  const deeplink = typeof body.deeplink === 'string' ? body.deeplink.trim() : '';
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
  const idempotencyKey =
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
  const dryRun = body.dryRun !== false;

  if (!type || !title || !messageBody) {
    return null;
  }
  if (title.length > 60 || messageBody.length > 140) {
    return null;
  }
  if (notifClass === 'marketing' && !body.class) {
    // explicit class is strongly encouraged; keep transactional default.
  }

  return {
    userId,
    type,
    class: notifClass,
    title,
    body: messageBody,
    transactionId: transactionId || null,
    deeplink: deeplink || null,
    imageUrl: imageUrl || null,
    idempotencyKey: idempotencyKey || null,
    dryRun,
  };
};

/**
 * GET /notifications
 * List notifikasi milik user
 */
notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const snapshot = await db.collection('notifications')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();

    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return ok(res, notifications, 'Daftar notifikasi berhasil diambil');
  }),
);

/**
 * PATCH /notifications/read-all
 * Tandai semua sudah dibaca
 * Note: Define this before /:id/read to prevent route collision
 */
notificationsRouter.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    
    const unreadSnapshot = await db.collection('notifications')
      .where('userId', '==', uid)
      .where('isRead', '==', false)
      .get();

    if (unreadSnapshot.empty) {
      return ok(res, null, 'Tidak ada notifikasi baru untuk ditandai');
    }

    const batch = db.batch();
    
    unreadSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { 
        isRead: true, 
        updatedAt: now() 
      });
    });

    await batch.commit();

    return ok(res, { markedCount: unreadSnapshot.size }, 'Semua notifikasi berhasil ditandai sudah dibaca');
  }),
);

/**
 * POST /notifications/test
 * Admin-only, test push to a single user.
 */
notificationsRouter.post(
  '/test',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!TEST_PUSH_ENABLED) {
      return fail(
        res,
        ERROR_CODES.FORBIDDEN,
        'Endpoint test push dinonaktifkan. Set ALLOW_TEST_PUSH=true untuk mengaktifkan.',
        403,
      );
    }

    const limiterKey = `single:${req.user?.uid ?? 'unknown'}`;
    if (!assertRateLimit(limiterKey)) {
      return fail(
        res,
        ERROR_CODES.FORBIDDEN,
        'Rate limit test push tercapai. Coba lagi 1 menit lagi.',
        429,
      );
    }

    const parsed = parseBodyBase((req.body ?? {}) as Record<string, unknown>);
    if (!parsed || !parsed.userId) {
      return fail(
        res,
        ERROR_CODES.INVALID_INPUT,
        'Payload tidak valid. Pastikan userId/type/title/body terisi dan panjang title/body sesuai.',
        400,
      );
    }

    const result = await createNotification(parsed);
    return ok(
      res,
      {
        notificationId: result.id,
        dryRun: parsed.dryRun,
      },
      parsed.dryRun
        ? 'Dry run berhasil. Notification tersimpan tanpa push.'
        : 'Test push single user diproses.',
    );
  }),
);

/**
 * POST /notifications/test-broadcast
 * Admin-only, test broadcast push to all/segment users.
 */
notificationsRouter.post(
  '/test-broadcast',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!TEST_PUSH_ENABLED) {
      return fail(
        res,
        ERROR_CODES.FORBIDDEN,
        'Endpoint test broadcast dinonaktifkan. Set ALLOW_TEST_PUSH=true untuk mengaktifkan.',
        403,
      );
    }

    const limiterKey = `broadcast:${req.user?.uid ?? 'unknown'}`;
    if (!assertRateLimit(limiterKey)) {
      return fail(
        res,
        ERROR_CODES.FORBIDDEN,
        'Rate limit broadcast test tercapai. Coba lagi 1 menit lagi.',
        429,
      );
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const scope = body.scope === 'segment' ? 'segment' : 'all';
    const parsed = parseBodyBase(body);
    if (!parsed) {
      return fail(
        res,
        ERROR_CODES.INVALID_INPUT,
        'Payload broadcast tidak valid. Pastikan type/title/body sesuai aturan.',
        400,
      );
    }

    const userIds = Array.isArray(body.userIds)
      ? body.userIds
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    if (scope === 'segment' && userIds.length === 0) {
      return fail(
        res,
        ERROR_CODES.INVALID_INPUT,
        'scope=segment wajib menyertakan userIds.',
        400,
      );
    }

    if (userIds.length > BROADCAST_MAX_TARGET) {
      return fail(
        res,
        ERROR_CODES.INVALID_INPUT,
        `Maksimum userIds per broadcast adalah ${BROADCAST_MAX_TARGET}.`,
        400,
      );
    }

    const dryRun = parsed.dryRun !== false;
    if (!dryRun) {
      const confirmText =
        typeof body.confirmText === 'string' ? body.confirmText.trim() : '';
      if (confirmText !== 'SEND_BROADCAST_NOW') {
        return fail(
          res,
          ERROR_CODES.INVALID_INPUT,
          'Untuk dryRun=false, confirmText wajib bernilai SEND_BROADCAST_NOW.',
          400,
        );
      }
    }

    const result = await broadcastNotification({
      userIds: scope === 'segment' ? userIds : undefined,
      type: parsed.type,
      class: parsed.class,
      title: parsed.title,
      body: parsed.body,
      transactionId: parsed.transactionId,
      deeplink: parsed.deeplink,
      imageUrl: parsed.imageUrl,
      idempotencyKey: parsed.idempotencyKey,
      dryRun,
    });

    return ok(
      res,
      result,
      dryRun
        ? 'Dry run broadcast selesai tanpa pengiriman push.'
        : 'Broadcast push diproses.',
    );
  }),
);

/**
 * PATCH /notifications/:id/read
 * Tandai sudah dibaca
 */
notificationsRouter.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const notificationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const docRef = db.collection('notifications').doc(String(notificationId));
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Notifikasi tidak ditemukan', 404);
    }

    const data = snapshot.data();
    if (data?.userId !== uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Anda tidak berhak mengubah notifikasi ini', 403);
    }

    await docRef.update({ 
      isRead: true,
      updatedAt: now()
    });

    return ok(res, { id: notificationId, isRead: true }, 'Notifikasi ditandai sudah dibaca');
  }),
);
