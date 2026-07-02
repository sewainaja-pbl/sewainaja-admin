import { Router } from 'express';
import admin from 'firebase-admin';
import { db, now } from '../lib/firebase-admin';
import { fail, ok } from '../lib/http';
import { ERROR_CODES } from '../errors';
import { requireAuth } from '../middleware/require-auth';
import { requireAdmin } from '../middleware/require-admin';
import { asyncHandler } from '../lib/async-handler';
import { createNotification } from '../lib/notifications';

export const adminWithdrawalsRouter = Router();

// Require admin authentication for all withdrawal routes
adminWithdrawalsRouter.use(requireAuth, requireAdmin);

/**
 * GET /admin/withdrawals
 * List all withdrawal requests
 */
adminWithdrawalsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const snapshot = await db.collection('withdrawals')
      .orderBy('createdAt', 'desc')
      .get();

    const withdrawals = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return ok(res, withdrawals, 'Daftar penarikan berhasil diambil');
  }),
);

/**
 * PATCH /admin/withdrawals/:id/approve
 * Approve withdrawal request
 */
adminWithdrawalsRouter.patch(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const docRef = db.collection('withdrawals').doc(String(id));
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Permintaan penarikan tidak ditemukan', 404);
    }

    const withdrawal = snapshot.data();
    if (withdrawal?.status !== 'pending') {
      return fail(res, ERROR_CODES.CONFLICT, 'Permintaan penarikan sudah diproses', 409);
    }

    await docRef.update({
      status: 'approved',
      processedAt: now(),
      processedBy: uid,
      updatedAt: now()
    });

    // Send notification to user
    try {
      await createNotification({
        userId: withdrawal.userId,
        type: 'payment',
        class: 'transactional',
        title: 'Penarikan Saldo Disetujui',
        body: `Permintaan penarikan saldo sebesar Rp. ${Number(withdrawal.amount).toLocaleString('id-ID')} telah disetujui dan berhasil ditransfer ke rekening Anda.`,
      });
    } catch (err) {
      console.error('Failed to send notification for withdrawal approval:', err);
    }

    return ok(res, { id, status: 'approved' }, 'Permintaan penarikan berhasil disetujui');
  }),
);

/**
 * PATCH /admin/withdrawals/:id/reject
 * Reject withdrawal request (with refund to wallet balance)
 */
adminWithdrawalsRouter.patch(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const rejectionReason = typeof req.body.rejectionReason === 'string' ? req.body.rejectionReason.trim() : '';

    if (!rejectionReason) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Alasan penolakan wajib diisi', 400);
    }

    const docRef = db.collection('withdrawals').doc(String(id));
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Permintaan penarikan tidak ditemukan', 404);
    }

    const withdrawal = snapshot.data();
    if (withdrawal?.status !== 'pending') {
      return fail(res, ERROR_CODES.CONFLICT, 'Permintaan penarikan sudah diproses', 409);
    }

    // Process status update and refund user wallet balance in a single transaction
    const userRef = db.collection('users').doc(withdrawal.userId);

    await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new Error('Pengguna tidak ditemukan');
      }

      // Update withdrawal request
      transaction.update(docRef, {
        status: 'rejected',
        rejectionReason,
        processedAt: now(),
        processedBy: uid,
        updatedAt: now()
      });

      // Refund the amount back to user's walletBalance
      transaction.update(userRef, {
        walletBalance: admin.firestore.FieldValue.increment(Number(withdrawal.amount)),
        updatedAt: now()
      });
    });

    // Send notification to user
    try {
      await createNotification({
        userId: withdrawal.userId,
        type: 'rejected',
        class: 'transactional',
        title: 'Penarikan Saldo Ditolak',
        body: `Permintaan penarikan saldo sebesar Rp. ${Number(withdrawal.amount).toLocaleString('id-ID')} ditolak. Alasan: ${rejectionReason}`,
      });
    } catch (err) {
      console.error('Failed to send notification for withdrawal rejection:', err);
    }

    return ok(res, { id, status: 'rejected' }, 'Permintaan penarikan berhasil ditolak');
  }),
);
