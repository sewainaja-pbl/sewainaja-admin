import { Router } from 'express';
import { db, now } from '../lib/firebase-admin';
import { fail, ok } from '../lib/http';
import { ERROR_CODES } from '../errors';
import { requireAuth } from '../middleware/require-auth';
import { asyncHandler } from '../lib/async-handler';
import type { EvidenceDoc } from '../types/evidence';

// Merge params true helps read transactionId from parent route if registered as nested
export const evidencesRouter = Router({ mergeParams: true });

evidencesRouter.use(requireAuth);

/**
 * GET /transactions/:transactionId/evidences
 * List bukti kondisi per transaksi
 */
evidencesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const transactionId = Array.isArray(req.params.transactionId) ? req.params.transactionId[0] : req.params.transactionId;

    const transRef = db.collection('transactions').doc(String(transactionId));
    const snap = await transRef.get();

    if (!snap.exists) return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);

    const trans = snap.data();
    if (trans?.ownerId !== uid && trans?.renterId !== uid && !req.user!.claims.admin) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Akses ditolak', 403);
    }

    const snapshot = await transRef.collection('evidences')
      .orderBy('uploadedAt', 'asc')
      .get();

    const evidences = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return ok(res, evidences, 'Daftar bukti kondisi berhasil diambil');
  }),
);

/**
 * POST /transactions/:transactionId/evidences
 * Upload bukti kondisi (before/after)
 */
evidencesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const transactionId = Array.isArray(req.params.transactionId) ? req.params.transactionId[0] : req.params.transactionId;
    const { type, mediaUrl, mediaType } = req.body;

    if (!type || !mediaUrl || !mediaType) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Informasi media tidak lengkap', 400);
    }

    if (!['before', 'after'].includes(type)) {
      return fail(res, ERROR_CODES.INVALID_INPUT, "Tipe harus 'before' atau 'after'", 400);
    }

    const transRef = db.collection('transactions').doc(String(transactionId));
    const snap = await transRef.get();

    if (!snap.exists) return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);

    const trans = snap.data();
    // Generally only renter uploads evidences? Or both?
    // Docs says: "Penyewa wajib upload foto kondisi barang sebelum sewa (before evidence)"
    // and "Penyewa wajib upload foto kondisi barang setelah sewa (after evidence) sebelum checkout"
    // So we restrict upload to Renter for simplicity, or allow both parties to add observations.
    // Let's allow both, tagged with uploaderId.
    if (trans?.ownerId !== uid && trans?.renterId !== uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Hanya pihak terlibat yang dapat mengunggah bukti', 403);
    }

    const evidenceData: Omit<EvidenceDoc, 'id'> = {
      uploaderId: uid,
      type: type as 'before' | 'after',
      mediaUrl: String(mediaUrl),
      mediaType: mediaType === 'video' ? 'video' : 'photo',
      uploadedAt: now()
    };

    const docRef = await transRef.collection('evidences').add(evidenceData);

    return ok(res, { id: docRef.id, ...evidenceData }, 'Bukti berhasil diunggah');
  }),
);
