import { Router } from 'express';
import { db } from '../lib/firebase-admin';
import { fail, ok } from '../lib/http';
import { ERROR_CODES } from '../errors';
import { requireAuth } from '../middleware/require-auth';
import { requireAdmin } from '../middleware/require-admin';
import { asyncHandler } from '../lib/async-handler';

export const adminUsersRouter = Router();

adminUsersRouter.use(requireAuth, requireAdmin);

adminUsersRouter.get(
  '/pending',
  asyncHandler(async (req, res) => {
    const parsedLimit = Number(req.query.limit ?? 20);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 100)
      : 20;

    const snapshot = await db
      .collection('users')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .get();

    return ok(
      res,
      snapshot.docs.map((doc) => doc.data()),
      'Daftar user pending',
    );
  }),
);

const resolveKycTask = async (userId: string) => {
  const tasksRef = db.collection('admin_tasks');
  const snapshot = await tasksRef
    .where('refId', '==', userId)
    .where('type', '==', 'kyc_review')
    .where('status', 'in', ['pending', 'in_progress'])
    .get();

  if (!snapshot.empty) {
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: 'done',
        updatedAt: new Date(),
        doneAt: new Date(),
      });
    });
    await batch.commit();
  }
};

const updateUserStatus = async (
  id: string,
  status: 'verified' | 'suspended' | 'rejected',
  rejectionReason?: string,
) => {
  const ref = db.collection('users').doc(id);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return null;
  }

  const updateData: Record<string, any> = { status, updatedAt: new Date() };
  if (rejectionReason !== undefined) {
    updateData.rejectionReason = rejectionReason;
  } else if (status === 'verified') {
    updateData.rejectionReason = '';
  }

  await ref.update(updateData);
  return { id, status, rejectionReason: updateData.rejectionReason };
};

adminUsersRouter.patch(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await updateUserStatus(id, 'verified');

    if (!result) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'User tidak ditemukan', 404);
    }

    await resolveKycTask(id);
    return ok(res, result, 'User berhasil diapprove');
  }),
);

adminUsersRouter.patch(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const rejectionReason = typeof req.body.rejectionReason === 'string' ? req.body.rejectionReason.trim() : '';
    const result = await updateUserStatus(id, 'rejected', rejectionReason);

    if (!result) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'User tidak ditemukan', 404);
    }

    await resolveKycTask(id);
    return ok(res, result, 'User berhasil direject');
  }),
);
