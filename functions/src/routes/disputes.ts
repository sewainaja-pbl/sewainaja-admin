import { Router } from 'express';
import admin from 'firebase-admin';
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
    const { transactionId, description, category, evidenceUrl, evidenceUrls } = req.body;

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

    if (!['approved', 'ongoing'].includes(trans?.status)) {
      return fail(res, ERROR_CODES.CONFLICT, 'Sengketa hanya dapat diajukan pada transaksi aktif yang telah disetujui atau sedang berjalan', 409);
    }

    // Denormalization info
    const [reporterSnap] = await Promise.all([
      db.collection('users').doc(uid).get()
    ]);

    const reporterName = reporterSnap.data()?.name || 'Unknown User';
    
    // Get item names from details
    const detailsSnap = await transRef.collection('transaction_details').get();
    const itemNames = detailsSnap.docs.map(d => d.data().itemNameSnapshot);

    // Support both legacy evidenceUrl and new evidenceUrls array
    const urls: string[] = Array.isArray(evidenceUrls) 
      ? evidenceUrls 
      : (evidenceUrl ? [String(evidenceUrl)] : []);

    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 72); // SLA 3x24 hours

    const disputeData: Omit<DisputeDoc, 'id'> = {
      transactionId: String(transactionId),
      reportedBy: uid,
      description: String(description).trim(),
      category: category as any,
      evidenceUrl: urls.length > 0 ? urls[0] : null,
      evidenceUrls: urls,
      status: 'open',
      resolutionNote: null,
      resolvedBy: null,
      createdAt: now(),
      resolvedAt: null,
      deadlineAt: admin.firestore.Timestamp.fromDate(deadline),
      isOverdue: false,

      // Respondent / Terlapor fields initialized to empty
      respondentId: null,
      respondentName: null,
      respondentDescription: null,
      respondentEvidenceUrls: [],
      respondentRespondedAt: null,

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
      // Only lock payments that are currently held in escrow (not already released or refunded)
      if (pData.escrowStatus === 'held') {
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
 * GET /disputes/transaction/:transactionId
 * Ambil detail sengketa aktif berdasarkan transactionId beserta foto bukti check-in/out transaksi
 */
disputesRouter.get(
  '/transaction/:transactionId',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const { transactionId } = req.params;

    const disputesSnap = await db.collection('disputes')
      .where('transactionId', '==', String(transactionId))
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (disputesSnap.empty) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Sengketa untuk transaksi ini tidak ditemukan', 404);
    }

    const doc = disputesSnap.docs[0];
    const dispute = doc.data() as Omit<DisputeDoc, 'id'>;

    // Security check: user must be reporter or renter or owner or admin
    const transRef = db.collection('transactions').doc(dispute.transactionId);
    const transSnap = await transRef.get();
    const trans = transSnap.data();

    if (dispute.reportedBy !== uid && trans?.ownerId !== uid && trans?.renterId !== uid && !req.user!.claims.admin) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Akses ditolak', 403);
    }

    // Ambil bukti foto serah-terima check-in/out dari subcollection evidences
    const evidencesSnap = await transRef.collection('evidences').orderBy('uploadedAt', 'desc').get();
    const transactionEvidences = evidencesSnap.docs.map(eDoc => ({
      id: eDoc.id,
      ...eDoc.data()
    }));

    return ok(res, {
      id: doc.id,
      ...dispute,
      transactionEvidences
    }, 'Detail sengketa berhasil diambil');
  }),
);

/**
 * POST /disputes/:id/respond
 * Submit sanggahan dari pihak terlapor
 */
disputesRouter.post(
  '/:id/respond',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const id = req.params.id;
    const { description, evidenceUrls } = req.body;

    if (!description || typeof description !== 'string') {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Kronologi sanggahan wajib diisi', 400);
    }

    const disputeRef = db.collection('disputes').doc(String(id));
    const disputeSnap = await disputeRef.get();

    if (!disputeSnap.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Sengketa tidak ditemukan', 404);
    }

    const dispute = disputeSnap.data() as DisputeDoc;

    if (dispute.status === 'resolved' || dispute.status === 'closed') {
      return fail(res, ERROR_CODES.CONFLICT, 'Sengketa sudah selesai atau ditutup', 409);
    }

    if (dispute.respondentId) {
      return fail(res, ERROR_CODES.CONFLICT, 'Anda sudah memberikan sanggahan sebelumnya', 409);
    }

    // Security check: must be the renter or owner of the transaction
    const transRef = db.collection('transactions').doc(dispute.transactionId);
    const transSnap = await transRef.get();
    const trans = transSnap.data();

    const isRenter = trans?.renterId === uid;
    const isOwner = trans?.ownerId === uid;

    if (!isRenter && !isOwner) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Akses ditolak', 403);
    }

    if (dispute.reportedBy === uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Pelapor tidak dapat mengirimkan sanggahan', 403);
    }

    const respondentName = isRenter ? trans?.renterName : trans?.ownerName;
    const reqRespondentEvidenceUrls = Array.isArray(evidenceUrls) ? evidenceUrls : [];

    await disputeRef.update({
      respondentId: uid,
      respondentName,
      respondentDescription: description.trim(),
      respondentEvidenceUrls: reqRespondentEvidenceUrls,
      respondentRespondedAt: now(),
      status: 'under_review', // Otomatis naik status ke under_review setelah disanggah
      updatedAt: now()
    });

    // Kirim notifikasi ke pelapor
    await createNotification({
      userId: dispute.reportedBy,
      type: 'dispute',
      title: 'Sanggahan Sengketa Diterima',
      body: `Pihak terlapor (${respondentName}) telah mengirimkan sanggahan untuk transaksi ${dispute.transactionId}.`,
      transactionId: dispute.transactionId,
    });

    // Kirim notifikasi ke admin
    await createNotification({
      userId: 'admin',
      type: 'dispute',
      title: 'Sanggahan Sengketa Baru',
      body: `Terlapor ${respondentName} telah mengirimkan sanggahan untuk sengketa ${id} (Transaksi ${dispute.transactionId}).`,
      transactionId: dispute.transactionId,
    });

    const updatedSnap = await disputeRef.get();
    return ok(res, { id: disputeRef.id, ...updatedSnap.data() }, 'Sanggahan berhasil dikirim, admin akan segera meninjau.');
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
