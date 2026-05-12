import { Router } from 'express';
import { db, now } from '../lib/firebase-admin';
import { fail, ok } from '../lib/http';
import { ERROR_CODES } from '../errors';
import { requireAuth } from '../middleware/require-auth';
import { asyncHandler } from '../lib/async-handler';
import type { RatingDoc } from '../types/rating';

export const ratingsRouter = Router();

/**
 * Reusable function to recompute overall average ratings and store on user doc.
 */
const updateUserRatingCache = async (userId: string, ratedAs: 'owner' | 'renter') => {
  const snap = await db.collection('ratings')
    .where('toUserId', '==', userId)
    .where('ratedAs', '==', ratedAs)
    .get();

  if (snap.empty) return;

  let sum = 0;
  snap.docs.forEach(d => {
    sum += d.data().score || 0;
  });

  const avg = parseFloat((sum / snap.size).toFixed(2));
  const fieldName = ratedAs === 'owner' ? 'avgRatingAsOwner' : 'avgRatingAsRenter';

  await db.collection('users').doc(userId).update({
    [fieldName]: avg,
    updatedAt: now()
  });
};

/**
 * POST /ratings
 * Submit rating
 */
ratingsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const { transactionId, ratedAs, score, comment } = req.body;

    if (!transactionId || !['owner', 'renter'].includes(ratedAs) || typeof score !== 'number') {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Data rating tidak lengkap', 400);
    }

    const ratingScore = Math.max(1, Math.min(5, Math.round(score)));

    const transRef = db.collection('transactions').doc(String(transactionId));
    const transSnap = await transRef.get();

    if (!transSnap.exists) return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);

    const trans = transSnap.data();
    
    // Validate users participating
    if (trans?.ownerId !== uid && trans?.renterId !== uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Anda tidak terdaftar di transaksi ini', 403);
    }

    // Check already voted
    const existing = await db.collection('ratings')
      .where('transactionId', '==', transactionId)
      .where('fromUserId', '==', uid)
      .where('ratedAs', '==', ratedAs)
      .get();

    if (!existing.empty) {
      return fail(res, ERROR_CODES.CONFLICT, 'Anda sudah memberikan rating untuk transaksi ini', 409);
    }

    let toUserId = '';
    let fromUserName = '';
    let toUserName = '';

    if (ratedAs === 'owner') {
      // Meaning Renter rating the Owner
      if (uid !== trans?.renterId) return fail(res, ERROR_CODES.FORBIDDEN, 'Hanya penyewa yang bisa me-rating pemilik', 403);
      toUserId = trans?.ownerId;
      fromUserName = trans?.renterName;
      toUserName = trans?.ownerName;
    } else {
      // Owner rating the Renter
      if (uid !== trans?.ownerId) return fail(res, ERROR_CODES.FORBIDDEN, 'Hanya pemilik yang bisa me-rating penyewa', 403);
      toUserId = trans?.renterId;
      fromUserName = trans?.ownerName;
      toUserName = trans?.renterName;
    }

    // Fetch item names from snapshot or transaction_details
    const detailsSnap = await transRef.collection('transaction_details').get();
    const itemNames = detailsSnap.docs.map(d => d.data().itemNameSnapshot);

    const ratingData: Omit<RatingDoc, 'id'> = {
      transactionId: String(transactionId),
      fromUserId: uid,
      toUserId,
      ratedAs: ratedAs as 'owner' | 'renter',
      score: ratingScore,
      comment: String(comment || '').trim(),
      createdAt: now(),
      fromUserName,
      toUserName,
      itemNames
    };

    const docRef = await db.collection('ratings').add(ratingData);

    // Update Cache asynchronously (could move to background function eventually but good for now)
    await updateUserRatingCache(toUserId, ratedAs as 'owner' | 'renter');

    return ok(res, { id: docRef.id, ...ratingData }, 'Rating berhasil dikirim');
  }),
);

/**
 * GET /ratings/user/:userId
 * List rating yang diterima user
 */
ratingsRouter.get(
  '/user/:userId',
  asyncHandler(async (req, res) => {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const { as } = req.query; // filter opsional owner/renter

    let query = db.collection('ratings')
      .where('toUserId', '==', String(userId));

    if (as === 'owner' || as === 'renter') {
      query = query.where('ratedAs', '==', as);
    }

    const snap = await query.orderBy('createdAt', 'desc').get();
    const ratings = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    return ok(res, ratings, 'Daftar rating berhasil diambil');
  }),
);
