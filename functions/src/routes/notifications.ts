import { Router } from 'express';
import { db, now } from '../lib/firebase-admin';
import { fail, ok } from '../lib/http';
import { ERROR_CODES } from '../errors';
import { requireAuth } from '../middleware/require-auth';
import { asyncHandler } from '../lib/async-handler';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

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
