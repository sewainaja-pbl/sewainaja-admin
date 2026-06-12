import { Router } from 'express';
import admin from 'firebase-admin';
import { db, now } from '../lib/firebase-admin';
import { fail, ok } from '../lib/http';
import { ERROR_CODES } from '../errors';
import { requireAuth } from '../middleware/require-auth';
import { requireAdmin } from '../middleware/require-admin';
import { asyncHandler } from '../lib/async-handler';

export const adminDisputesRouter = Router();

// Semua rute sengketa untuk admin membutuhkan role admin
adminDisputesRouter.use(requireAuth, requireAdmin);

/**
 * GET /admin/disputes
 * List semua sengketa aktif
 */
adminDisputesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    // Sengketa yang aktif biasanya open atau under_review, 
    // tetapi kita ambil semua saja dan admin memfilter di FE atau limit
    const snapshot = await db.collection('disputes')
      .orderBy('createdAt', 'desc')
      .get();

    const disputes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return ok(res, disputes, 'Daftar sengketa berhasil diambil');
  }),
);

/**
 * PATCH /admin/disputes/:id/review
 * Set status → under_review
 */
adminDisputesRouter.patch(
  '/:id/review',
  asyncHandler(async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const docRef = db.collection('disputes').doc(String(id));
    
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Sengketa tidak ditemukan', 404);
    }

    if (snapshot.data()?.status === 'resolved' || snapshot.data()?.status === 'closed') {
      return fail(res, ERROR_CODES.CONFLICT, 'Sengketa sudah ditutup', 409);
    }

    await docRef.update({
      status: 'under_review',
      updatedAt: now()
    });

    const updated = await docRef.get();
    return ok(res, { id, ...updated.data() }, 'Status sengketa berhasil diubah menjadi under_review');
  }),
);

/**
 * PATCH /admin/disputes/:id/resolve
 * Resolve sengketa + catatan resolusi
 */
adminDisputesRouter.patch(
  '/:id/resolve',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { resolutionNote, decision } = req.body;

    if (!resolutionNote || typeof resolutionNote !== 'string') {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Catatan resolusi wajib diisi', 400);
    }

    if (decision && !['release_to_owner', 'refund_to_renter'].includes(decision)) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Keputusan resolusi tidak valid', 400);
    }

    const docRef = db.collection('disputes').doc(String(id));
    
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Sengketa tidak ditemukan', 404);
    }

    const dispute = snapshot.data();
    if (dispute?.status === 'resolved' || dispute?.status === 'closed') {
      return fail(res, ERROR_CODES.CONFLICT, 'Sengketa sudah diselesaikan', 409);
    }

    const transId = dispute?.transactionId;
    const transRef = db.collection('transactions').doc(transId);
    const transSnap = await transRef.get();
    const trans = transSnap.data();

    const batch = db.batch();

    batch.update(docRef, {
      status: 'resolved',
      resolutionNote: resolutionNote.trim(),
      resolvedBy: uid,
      resolvedAt: now(),
      updatedAt: now()
    });

    if (decision) {
      // Update transaction status to completed (if released) or cancelled (if refunded)
      batch.update(transRef, {
        status: decision === 'refund_to_renter' ? 'cancelled' : 'completed',
        updatedAt: now()
      });

      // Find disputed_locked payments for this transaction
      const paymentsSnap = await db.collection('payments')
        .where('transactionId', '==', transId)
        .where('status', '==', 'paid')
        .get();

      let totalAmount = 0;
      for (const pDoc of paymentsSnap.docs) {
        const pData = pDoc.data();
        // Only release/refund payments that are currently locked under dispute
        if (pData.escrowStatus === 'disputed_locked') {
          const newEscrowStatus = decision === 'refund_to_renter' ? 'refunded' : 'released';
          batch.update(pDoc.ref, {
            escrowStatus: newEscrowStatus,
            updatedAt: now()
          });
          if (pData.paymentMethod === 'midtrans') {
            totalAmount += pData.amount || 0;
          }
        }
      }

      if (totalAmount > 0 && trans) {
        if (decision === 'refund_to_renter') {
          const renterRef = db.collection('users').doc(trans.renterId);
          batch.update(renterRef, {
            walletBalance: admin.firestore.FieldValue.increment(totalAmount),
            updatedAt: now()
          });
        } else if (decision === 'release_to_owner') {
          const ownerRef = db.collection('users').doc(trans.ownerId);
          batch.update(ownerRef, {
            walletBalance: admin.firestore.FieldValue.increment(totalAmount),
            updatedAt: now()
          });
        }
      }
    }

    await batch.commit();

    const updated = await docRef.get();
    return ok(res, { id, ...updated.data() }, 'Sengketa berhasil diselesaikan');
  }),
);
