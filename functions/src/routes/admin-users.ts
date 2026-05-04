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

const updateUserStatus = async (
  id: string,
  status: 'verified' | 'suspended',
) => {
  const ref = db.collection('users').doc(id);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return null;
  }

  await ref.update({ status, updatedAt: new Date() });
  return { id, status };
};

adminUsersRouter.patch(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await updateUserStatus(id, 'verified');

    if (!result) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'User tidak ditemukan', 404);
    }

    return ok(res, result, 'User berhasil diapprove');
  }),
);

adminUsersRouter.patch(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await updateUserStatus(id, 'suspended');

    if (!result) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'User tidak ditemukan', 404);
    }

    return ok(res, result, 'User berhasil direject');
  }),
);
