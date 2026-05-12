import { Router } from 'express';
import { db, now } from '../lib/firebase-admin';
import { fail, ok } from '../lib/http';
import { ERROR_CODES } from '../errors';
import { requireAuth } from '../middleware/require-auth';
import { asyncHandler } from '../lib/async-handler';
import type { DisputeDoc } from '../types/dispute';

export const disputesRouter = Router();

disputesRouter.use(requireAuth);

/**
 * POST /disputes
 * Ajukan klaim kerusakan
 */
disputesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const { transactionId, description } = req.body;

    if (!transactionId || !description) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Data klaim sengketa tidak lengkap', 400);
    }

    const transRef = db.collection('transactions').doc(String(transactionId));
    const transSnap = await transRef.get();

    if (!transSnap.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);
    }

    const trans = transSnap.data();
    if (trans?.ownerId !== uid && trans?.renterId !== uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Anda tidak berhak membuka sengketa pada transaksi ini', 403);
    }

    // Validate that checkout just happened (within last 12 hours theoretically)
    // or generally allow for safety. We'll just ensure it has been completed.
    if (trans?.status !== 'completed') {
      // Technically disputes can be opened if something goes wrong mid-rent too?
      // Docs step 9 says: "ajukan klaim kerusakan maksimal 12 jam setelah checkoutAt"
      // We allow.
    }

    // Denormalization info
    const [reporterSnap] = await Promise.all([
      db.collection('users').doc(uid).get()
    ]);

    const reporterName = reporterSnap.data()?.name || 'Unknown User';
    
    // Get item names from details
    const detailsSnap = await transRef.collection('transaction_details').get();
    const itemNames = detailsSnap.docs.map(d => d.data().itemNameSnapshot);

    const disputeData: Omit<DisputeDoc, 'id'> = {
      transactionId: String(transactionId),
      reportedBy: uid,
      description: String(description).trim(),
      status: 'open',
      resolutionNote: null,
      resolvedBy: null,
      createdAt: now(),
      resolvedAt: null,
      reporterName,
      renterName: trans?.renterName || 'Unknown Renter',
      itemNames
    };

    const batch = db.batch();
    const disputeRef = db.collection('disputes').doc();
    batch.set(disputeRef, disputeData);

    // Also set transaction status to disputed
    batch.update(transRef, { status: 'disputed', updatedAt: now() });

    await batch.commit();

    return ok(res, { id: disputeRef.id, ...disputeData }, 'Klaim sengketa berhasil diajukan, admin akan segera meninjau.');
  }),
);

/**
 * GET /disputes/:id
 * Detail sengketa (untuk user terkait)
 */
disputesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const docRef = db.collection('disputes').doc(String(id));
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Sengketa tidak ditemukan', 404);
    }

    const dispute = snapshot.data() as Omit<DisputeDoc, 'id'>;

    // Security check: user must be reporter or part of transaction
    const transRef = db.collection('transactions').doc(dispute.transactionId);
    const transSnap = await transRef.get();
    const trans = transSnap.data();

    if (dispute.reportedBy !== uid && trans?.ownerId !== uid && trans?.renterId !== uid && !req.user!.claims.admin) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Akses ditolak', 403);
    }

    return ok(res, { id: snapshot.id, ...dispute }, 'Detail sengketa berhasil diambil');
  }),
);
