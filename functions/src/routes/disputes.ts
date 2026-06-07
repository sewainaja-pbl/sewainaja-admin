import { Router } from 'express';
import { db, now } from '../lib/firebase-admin';
import { fail, ok } from '../lib/http';
import { ERROR_CODES } from '../errors';
import { requireAuth } from '../middleware/require-auth';
import { asyncHandler } from '../lib/async-handler';
import type { DisputeDoc } from '../types/dispute';
import { createNotification } from '../lib/notifications';

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
    const { transactionId, description, category, evidenceUrl } = req.body;

    if (!transactionId || !description || !category) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Data klaim sengketa tidak lengkap', 400);
    }

    if (!['handover_rejection', 'ongoing_damage', 'checkout_damage'].includes(category)) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Kategori sengketa tidak valid', 400);
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
      category: category as any,
      evidenceUrl: evidenceUrl || null,
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

    // Lock payments in escrow
    const paymentsSnap = await db.collection('payments')
      .where('transactionId', '==', String(transactionId))
      .where('status', '==', 'paid')
      .get();

    for (const pDoc of paymentsSnap.docs) {
      const pData = pDoc.data();
      if (pData.escrowStatus === 'held' || pData.escrowStatus === 'completed_held') {
        batch.update(pDoc.ref, {
          escrowStatus: 'disputed_locked',
          updatedAt: now()
        });
      }
    }

    await batch.commit();

    const createdSnap = await disputeRef.get();

    // Kirim notifikasi ke admin
    await createNotification({
      userId: 'admin',
      type: 'dispute',
      title: 'Sengketa Transaksi Baru',
      body: `User ${reporterName} mengajukan klaim sengketa (${category}) untuk transaksi ${transactionId}.`,
      transactionId: String(transactionId),
    });

    return ok(res, { id: disputeRef.id, ...createdSnap.data() }, 'Klaim sengketa berhasil diajukan, admin akan segera meninjau.');
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
