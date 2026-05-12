import { Router } from 'express';
import admin from 'firebase-admin';
import { db, now } from '../lib/firebase-admin';
import { fail, ok } from '../lib/http';
import { ERROR_CODES } from '../errors';
import { requireAuth } from '../middleware/require-auth';
import { asyncHandler } from '../lib/async-handler';
import crypto from 'crypto';
import type { TransactionDoc, TransactionDetailDoc, TransactionStatus } from '../types/transaction';

export const transactionsRouter = Router();

transactionsRouter.use(requireAuth);

// Helper to generate simple random token for QR
const generateToken = () => crypto.randomBytes(16).toString('hex');

// Helper to set expiration time (default 24 hours from now)
const getExpiryDate = (hours = 24) => {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
};

/**
 * GET /transactions
 * List transaksi user (sebagai renter atau owner)
 */
transactionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const { role, status } = req.query; // filter opsional

    let query: admin.firestore.Query = db.collection('transactions');

    // Use separate queries if not specified, or build combined condition
    if (role === 'owner') {
      query = query.where('ownerId', '==', uid);
    } else if (role === 'renter') {
      query = query.where('renterId', '==', uid);
    } else {
      // If no explicit role, we need to query BOTH.
      // Firestore v12+ Node.js supports Filter.or
      const { Filter } = admin.firestore;
      query = query.where(
        Filter.or(
          Filter.where('ownerId', '==', uid),
          Filter.where('renterId', '==', uid)
        )
      );
    }

    if (status && typeof status === 'string') {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();
    const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return ok(res, transactions, 'Daftar transaksi berhasil diambil');
  }),
);

/**
 * GET /transactions/:id
 * Detail transaksi lengkap dengan item detailnya
 */
transactionsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const docRef = db.collection('transactions').doc(String(id));
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);
    }

    const transData = snapshot.data() as TransactionDoc;
    if (transData.ownerId !== uid && transData.renterId !== uid && !req.user!.claims.admin) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Anda tidak memiliki akses ke transaksi ini', 403);
    }

    // Fetch subcollection: transaction_details
    const detailsSnap = await docRef.collection('transaction_details').get();
    const details = detailsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return ok(res, { ...transData, id: snapshot.id, details }, 'Detail transaksi berhasil diambil');
  }),
);

/**
 * POST /transactions
 * Buat request sewa baru
 * Input Body: { items: [{ itemId, startDate, endDate }] }
 */
transactionsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Request sewa minimal harus memilih 1 item', 400);
    }

    // 1. Load first item to check who is the owner. All items must belong to SAME owner.
    const firstItemId = items[0].itemId;
    const firstItemSnap = await db.collection('items').doc(String(firstItemId)).get();

    if (!firstItemSnap.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, `Item dengan ID ${firstItemId} tidak ditemukan`, 404);
    }

    const firstItemData = firstItemSnap.data();
    const ownerId = firstItemData?.ownerId;

    if (ownerId === uid) {
      return fail(res, ERROR_CODES.CONFLICT, 'Anda tidak bisa menyewa barang milik Anda sendiri', 409);
    }

    // Fetch owner name and renter name for denormalization
    const [renterSnap, ownerSnap] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('users').doc(ownerId).get()
    ]);

    if (!renterSnap.exists || !ownerSnap.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Data profil penyewa atau pemilik tidak ditemukan', 404);
    }

    const renterName = renterSnap.data()?.name;
    const ownerName = ownerSnap.data()?.name;

    // We prepare to create a transaction
    const batch = db.batch();
    const transRef = db.collection('transactions').doc();
    
    let totalPrice = 0;
    const transactionDetails: Array<Omit<TransactionDetailDoc, 'id'>> = [];

    for (const reqItem of items) {
      const itemSnap = await db.collection('items').doc(String(reqItem.itemId)).get();
      if (!itemSnap.exists) continue; // or throw error

      const itemData = itemSnap.data();
      
      if (itemData?.ownerId !== ownerId) {
        return fail(res, ERROR_CODES.CONFLICT, 'Semua barang harus berasal dari satu pemilik yang sama dalam satu transaksi', 409);
      }
      if (itemData?.status !== 'available') {
        return fail(res, ERROR_CODES.CONFLICT, `Barang ${itemData?.name} saat ini tidak tersedia`, 409);
      }

      const sDate = new Date(reqItem.startDate);
      const eDate = new Date(reqItem.endDate);
      
      // Basic sanity test for dates
      if (isNaN(sDate.getTime()) || isNaN(eDate.getTime()) || eDate <= sDate) {
        return fail(res, ERROR_CODES.INVALID_INPUT, 'Format tanggal sewa tidak valid', 400);
      }

      // Calculate hours
      const hours = Math.ceil((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60));
      const subtotal = hours * (itemData?.pricePerHour || 0);
      totalPrice += subtotal;

      transactionDetails.push({
        itemId: String(reqItem.itemId),
        startDate: admin.firestore.Timestamp.fromDate(sDate),
        endDate: admin.firestore.Timestamp.fromDate(eDate),
        priceAtBooking: itemData?.pricePerHour || 0,
        itemNameSnapshot: itemData?.name,
        itemPhotoUrlSnapshot: itemData?.photos?.[0] || '',
        subtotal
      });
    }

    if (transactionDetails.length === 0) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Tidak ada barang valid untuk diproses', 400);
    }

    // Generate initial tokens
    const qrCheckinToken = generateToken();
    const qrCheckoutToken = generateToken();

    const transData: Omit<TransactionDoc, 'id'> = {
      renterId: uid,
      ownerId: ownerId,
      totalPrice,
      totalItems: transactionDetails.length,
      status: 'pending',
      isOverdue: false,
      qrCheckinTokenHash: qrCheckinToken, // explicitly as plain token for this simplicity implementation
      qrCheckinExpiredAt: admin.firestore.Timestamp.fromDate(getExpiryDate()),
      qrCheckinUsedAt: null,
      qrCheckoutTokenHash: qrCheckoutToken,
      qrCheckoutExpiredAt: admin.firestore.Timestamp.fromDate(getExpiryDate()),
      qrCheckoutUsedAt: null,
      checkinAt: null,
      checkoutAt: null,
      createdAt: now(),
      updatedAt: now(),
      renterName,
      ownerName
    };

    batch.set(transRef, transData);

    // Save sub-details
    for (const detail of transactionDetails) {
      const dRef = transRef.collection('transaction_details').doc();
      batch.set(dRef, detail);
    }

    await batch.commit();

    return ok(res, { id: transRef.id, ...transData }, 'Request sewa berhasil diajukan');
  }),
);

/**
 * PATCH /transactions/:id/approve
 * Pemilik menyetujui permintaan sewa
 */
transactionsRouter.patch(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const docRef = db.collection('transactions').doc(String(id));
    const snap = await docRef.get();

    if (!snap.exists) return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);
    
    const trans = snap.data() as TransactionDoc;
    if (trans.ownerId !== uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Hanya pemilik barang yang dapat menyetujui request sewa', 403);
    }

    if (trans.status !== 'pending') {
      return fail(res, ERROR_CODES.CONFLICT, `Status transaksi saat ini adalah ${trans.status}, tidak bisa diapprove`, 409);
    }

    await docRef.update({
      status: 'approved',
      updatedAt: now()
    });

    return ok(res, { id, status: 'approved' }, 'Request sewa berhasil disetujui');
  }),
);

/**
 * PATCH /transactions/:id/cancel
 * Cancel transaksi
 */
transactionsRouter.patch(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const docRef = db.collection('transactions').doc(String(id));
    const snap = await docRef.get();

    if (!snap.exists) return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);
    
    const trans = snap.data() as TransactionDoc;
    if (trans.ownerId !== uid && trans.renterId !== uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Akses ditolak', 403);
    }

    // Cancellable only if status is pending or approved (before ongoing)
    if (!['pending', 'approved'].includes(trans.status)) {
      return fail(res, ERROR_CODES.CONFLICT, 'Transaksi yang sudah berjalan atau selesai tidak bisa dibatalkan', 409);
    }

    await docRef.update({
      status: 'cancelled',
      updatedAt: now()
    });

    return ok(res, { id, status: 'cancelled' }, 'Transaksi berhasil dibatalkan');
  }),
);

/**
 * POST /transactions/:id/checkin
 * Proses QR Checkin (Penyewa menscan QR Pemilik)
 * Request body: { token: string }
 */
transactionsRouter.post(
  '/:id/checkin',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { token } = req.body;

    if (!token) return fail(res, ERROR_CODES.INVALID_INPUT, 'Token QR Code wajib disertakan', 400);

    const docRef = db.collection('transactions').doc(String(id));
    const snap = await docRef.get();

    if (!snap.exists) return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);
    
    const trans = snap.data() as TransactionDoc;
    if (trans.renterId !== uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Hanya penyewa yang berwenang melakukan proses Check-in', 403);
    }

    if (trans.status !== 'approved') {
      return fail(res, ERROR_CODES.CONFLICT, 'Transaksi belum disetujui atau sudah berjalan', 409);
    }

    // Validate token match
    if (trans.qrCheckinTokenHash !== token) {
      return fail(res, ERROR_CODES.UNAUTHORIZED, 'Token QR Code tidak cocok atau tidak valid', 401);
    }

    // Validate expiration
    const expiry = (trans.qrCheckinExpiredAt as admin.firestore.Timestamp).toDate();
    if (new Date() > expiry) {
      return fail(res, ERROR_CODES.CONFLICT, 'Token QR Code sudah kadaluwarsa. Minta pemilik untuk me-regenerate QR.', 409);
    }

    await docRef.update({
      status: 'ongoing',
      checkinAt: now(),
      qrCheckinUsedAt: now(),
      updatedAt: now()
    });

    return ok(res, { id, status: 'ongoing' }, 'Check-in berhasil. Barang sudah dalam masa sewa.');
  }),
);

/**
 * POST /transactions/:id/checkout
 * Proses QR Checkout (Pemilik menscan QR Penyewa)
 * Request body: { token: string }
 */
transactionsRouter.post(
  '/:id/checkout',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { token } = req.body;

    if (!token) return fail(res, ERROR_CODES.INVALID_INPUT, 'Token QR Code wajib disertakan', 400);

    const docRef = db.collection('transactions').doc(String(id));
    const snap = await docRef.get();

    if (!snap.exists) return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);
    
    const trans = snap.data() as TransactionDoc;
    if (trans.ownerId !== uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Hanya pemilik yang berwenang melakukan proses Check-out', 403);
    }

    if (trans.status !== 'ongoing') {
      return fail(res, ERROR_CODES.CONFLICT, 'Transaksi belum berstatus masa sewa aktif', 409);
    }

    // Validate token match
    if (trans.qrCheckoutTokenHash !== token) {
      return fail(res, ERROR_CODES.UNAUTHORIZED, 'Token QR Code tidak cocok atau tidak valid', 401);
    }

    // Validate expiration
    const expiry = (trans.qrCheckoutExpiredAt as admin.firestore.Timestamp).toDate();
    if (new Date() > expiry) {
      return fail(res, ERROR_CODES.CONFLICT, 'Token QR Code sudah kadaluwarsa. Minta penyewa me-regenerate QR.', 409);
    }

    await docRef.update({
      status: 'completed',
      checkoutAt: now(),
      qrCheckoutUsedAt: now(),
      isOverdue: false, // disable overdue tracking
      updatedAt: now()
    });

    return ok(res, { id, status: 'completed' }, 'Check-out berhasil. Barang telah dikembalikan.');
  }),
);

/**
 * POST /transactions/:id/regenerate-qr
 * Me-regenerate token QR yang expire
 */
transactionsRouter.post(
  '/:id/regenerate-qr',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const docRef = db.collection('transactions').doc(String(id));
    const snap = await docRef.get();

    if (!snap.exists) return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);
    
    const trans = snap.data() as TransactionDoc;

    const newToken = generateToken();
    const newExpiry = admin.firestore.Timestamp.fromDate(getExpiryDate());

    const updates: Partial<TransactionDoc> = { updatedAt: now() };

    // Determine which QR needs to be regenerated based on user role and status
    if (trans.status === 'approved' && trans.ownerId === uid) {
      // Owner regenerates checkin QR
      updates.qrCheckinTokenHash = newToken;
      updates.qrCheckinExpiredAt = newExpiry;
    } else if (trans.status === 'ongoing' && trans.renterId === uid) {
      // Renter regenerates checkout QR
      updates.qrCheckoutTokenHash = newToken;
      updates.qrCheckoutExpiredAt = newExpiry;
    } else {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Anda tidak berhak meregenerate QR pada status ini', 403);
    }

    await docRef.update(updates);

    return ok(res, { id, newToken, expiresAt: newExpiry }, 'QR Token berhasil diperbarui');
  }),
);
