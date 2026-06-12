import { Router } from 'express';
import admin from 'firebase-admin';
import { db, now } from '../lib/firebase-admin';
import { fail, ok } from '../lib/http';
import { ERROR_CODES } from '../errors';
import { requireAuth } from '../middleware/require-auth';
import { asyncHandler } from '../lib/async-handler';
import crypto from 'crypto';
import { createNotification } from '../lib/notifications';
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

// Helper to check for overlapping active bookings (status: approved or ongoing) for a specific item
async function checkItemDateOverlap(
  itemId: string,
  startDate: Date,
  endDate: Date,
  ignoreTransactionId?: string
): Promise<{ hasOverlap: boolean; overlappingTxId?: string; itemName?: string }> {
  const detailsSnap = await db.collectionGroup('transaction_details')
    .where('itemId', '==', String(itemId))
    .get();

  for (const detailDoc of detailsSnap.docs) {
    const detail = detailDoc.data();
    const parentTxRef = detailDoc.ref.parent.parent;
    if (!parentTxRef) continue;

    const txId = parentTxRef.id;
    if (ignoreTransactionId && txId === ignoreTransactionId) continue;

    const txSnap = await parentTxRef.get();
    if (!txSnap.exists) continue;

    const tx = txSnap.data();
    if (tx && ['approved', 'ongoing', 'disputed'].includes(tx.status)) {
      const activeStart = (detail.startDate as admin.firestore.Timestamp).toDate();
      const activeEnd = (detail.endDate as admin.firestore.Timestamp).toDate();

      // Overlap condition: activeStart < endDate && activeEnd > startDate
      if (activeStart < endDate && activeEnd > startDate) {
        return {
          hasOverlap: true,
          overlappingTxId: txId,
          itemName: detail.itemNameSnapshot || 'Barang'
        };
      }
    }
  }

  return { hasOverlap: false };
}

/**
 * GET /transactions
 * List transaksi user (sebagai renter atau owner)
 */
transactionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const { role, status } = req.query; // filter opsional

    let transactions: any[] = [];

    if (role === 'owner') {
      let query = db.collection('transactions').where('ownerId', '==', uid);
      if (status && typeof status === 'string') {
        query = query.where('status', '==', status);
      }
      const snapshot = await query.get();
      transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else if (role === 'renter') {
      let query = db.collection('transactions').where('renterId', '==', uid);
      if (status && typeof status === 'string') {
        query = query.where('status', '==', status);
      }
      const snapshot = await query.get();
      transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      // Parallel queries to fetch both renter and owner transactions (avoids composite index requirement)
      let queryOwner = db.collection('transactions').where('ownerId', '==', uid);
      let queryRenter = db.collection('transactions').where('renterId', '==', uid);

      if (status && typeof status === 'string') {
        queryOwner = queryOwner.where('status', '==', status);
        queryRenter = queryRenter.where('status', '==', status);
      }

      const [snapOwner, snapRenter] = await Promise.all([
        queryOwner.get(),
        queryRenter.get()
      ]);

      const mapTxs = new Map<string, any>();
      snapOwner.docs.forEach(doc => mapTxs.set(doc.id, { id: doc.id, ...doc.data() }));
      snapRenter.docs.forEach(doc => mapTxs.set(doc.id, { id: doc.id, ...doc.data() }));

      transactions = Array.from(mapTxs.values());
    }

    // Sort in-memory by createdAt descending
    transactions.sort((a, b) => {
      const timeA = a.createdAt && typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt && typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });

    const ratingsSnap = await db.collection('ratings')
      .where('fromUserId', '==', uid)
      .get();
    const ratedTransactionIds = new Set(ratingsSnap.docs.map(d => d.data().transactionId));

    const result = transactions.map((t: any) => {
      const data = {
        ...t,
        hasUserRated: ratedTransactionIds.has(t.id),
      };
      if (!req.user!.claims.admin) {
        if (data.renterId === uid) {
          data.qrCheckinTokenHash = '';
        }
        if (data.ownerId === uid) {
          data.qrCheckoutTokenHash = '';
        }
      }
      return data;
    });

    return ok(res, result, 'Daftar transaksi berhasil diambil');
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

    // Check if the user has rated this transaction
    const ratingSnap = await db.collection('ratings')
      .where('transactionId', '==', id)
      .where('fromUserId', '==', uid)
      .limit(1)
      .get();
    const hasUserRated = !ratingSnap.empty;

    // Fetch subcollection: transaction_details
    const detailsSnap = await docRef.collection('transaction_details').get();
    const details = detailsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const responseData = { ...transData, id: snapshot.id, details, hasUserRated };
    if (!req.user!.claims.admin) {
      if (responseData.renterId === uid) {
        responseData.qrCheckinTokenHash = '';
      }
      if (responseData.ownerId === uid) {
        responseData.qrCheckoutTokenHash = '';
      }
    }

    return ok(res, responseData, 'Detail transaksi berhasil diambil');
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

      // Check if item is already booked for overlapping dates
      const overlapCheck = await checkItemDateOverlap(reqItem.itemId, sDate, eDate);
      if (overlapCheck.hasOverlap) {
        return fail(
          res,
          ERROR_CODES.CONFLICT,
          `Barang "${itemData?.name || 'tersebut'}" sudah disewa oleh pengguna lain pada rentang tanggal tersebut.`,
          409
        );
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

    // Trigger push notification to the owner
    createNotification({
      userId: ownerId,
      type: 'request',
      class: 'transactional',
      title: 'Permintaan Sewa Baru',
      body: `${renterName} telah mengajukan permintaan sewa untuk barang Anda.`,
      transactionId: transRef.id,
    }).catch(err => {
      console.error('[Notification Error] Failed to send new rental request push notification:', err);
    });

    const createdSnap = await transRef.get();

    return ok(res, { id: transRef.id, ...createdSnap.data() }, 'Request sewa berhasil diajukan');
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

    // Fetch transaction details of this transaction to check date overlap
    const detailsSnap = await docRef.collection('transaction_details').get();
    for (const detailDoc of detailsSnap.docs) {
      const detail = detailDoc.data();
      const sDate = (detail.startDate as admin.firestore.Timestamp).toDate();
      const eDate = (detail.endDate as admin.firestore.Timestamp).toDate();

      const overlapCheck = await checkItemDateOverlap(detail.itemId, sDate, eDate, id);
      if (overlapCheck.hasOverlap) {
        return fail(
          res,
          ERROR_CODES.CONFLICT,
          `Gagal menyetujui. Barang "${overlapCheck.itemName}" sudah disewa oleh pengguna lain pada rentang tanggal tersebut.`,
          409
        );
      }
    }

    await docRef.update({
      status: 'approved',
      updatedAt: now()
    });

    // Trigger push notification to the renter
    createNotification({
      userId: trans.renterId,
      type: 'approved',
      class: 'transactional',
      title: 'Permintaan Sewa Disetujui',
      body: `Permintaan sewa Anda telah disetujui oleh ${trans.ownerName}. Silakan selesaikan pembayaran.`,
      transactionId: id,
    }).catch(err => {
      console.error('[Notification Error] Failed to send rental approved push notification:', err);
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

    const batch = db.batch();

    batch.update(docRef, {
      status: 'cancelled',
      updatedAt: now()
    });

    // Query paid payments in escrow
    const paymentsSnap = await db.collection('payments')
      .where('transactionId', '==', String(id))
      .where('status', '==', 'paid')
      .get();

    let totalRefund = 0;
    for (const pDoc of paymentsSnap.docs) {
      const pData = pDoc.data();
      if (pData.escrowStatus === 'held') {
        batch.update(pDoc.ref, {
          escrowStatus: 'refunded',
          updatedAt: now()
        });
        if (pData.paymentMethod === 'midtrans') {
          totalRefund += pData.amount || 0;
        }
      }
    }

    if (totalRefund > 0) {
      const renterRef = db.collection('users').doc(trans.renterId);
      batch.update(renterRef, {
        walletBalance: admin.firestore.FieldValue.increment(totalRefund),
        updatedAt: now()
      });
    }

    await batch.commit();

    return ok(
      res, 
      { id, status: 'cancelled', refundAmount: totalRefund }, 
      totalRefund > 0 
        ? `Transaksi berhasil dibatalkan dan dana sebesar Rp. ${totalRefund} dikembalikan ke wallet Anda.` 
        : 'Transaksi berhasil dibatalkan.'
    );
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

    // Verify that payment has been received/confirmed
    const paymentsSnap = await db.collection('payments')
      .where('transactionId', '==', String(id))
      .where('status', '==', 'paid')
      .get();

    if (paymentsSnap.empty) {
      return fail(res, ERROR_CODES.CONFLICT, 'Pembayaran belum diselesaikan atau belum dikonfirmasi pemilik barang', 409);
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

    const batch = db.batch();

    batch.update(docRef, {
      status: 'waiting_rating',
      checkoutAt: now(),
      qrCheckoutUsedAt: now(),
      isOverdue: false, // disable overdue tracking
      updatedAt: now()
    });

    // Find payments associated with this transaction
    const paymentsSnap = await db.collection('payments')
      .where('transactionId', '==', String(id))
      .where('status', '==', 'paid')
      .get();

    let totalAmountReleased = 0;
    for (const pDoc of paymentsSnap.docs) {
      const pData = pDoc.data();
      if (pData.escrowStatus === 'held') {
        batch.update(pDoc.ref, {
          escrowStatus: 'released',
          updatedAt: now()
        });
        if (pData.paymentMethod === 'midtrans') {
          totalAmountReleased += pData.amount || 0;
        }
      }
    }

    if (totalAmountReleased > 0) {
      const ownerRef = db.collection('users').doc(trans.ownerId);
      batch.update(ownerRef, {
        walletBalance: admin.firestore.FieldValue.increment(totalAmountReleased),
        updatedAt: now()
      });
    }

    await batch.commit();

    // Fetch item name to include in notifications
    const detailsSnap = await docRef.collection('transaction_details').limit(1).get();
    const itemName = !detailsSnap.empty ? detailsSnap.docs[0].data().itemNameSnapshot : 'barang';

    // Send push notification to Renter to review Owner
    await createNotification({
      userId: trans.renterId,
      type: 'review',
      title: 'Beri Rating Pemilik',
      body: `Masa sewa ${itemName} telah selesai. Harap berikan rating untuk pemilik barang.`,
      transactionId: String(id),
    }).catch(err => console.error('Error sending renter checkout notification:', err));

    // Send push notification to Owner to review Renter
    await createNotification({
      userId: trans.ownerId,
      type: 'review',
      title: 'Beri Rating Penyewa',
      body: `Masa sewa ${itemName} telah selesai. Harap berikan rating untuk penyewa barang.`,
      transactionId: String(id),
    }).catch(err => console.error('Error sending owner checkout notification:', err));

    return ok(res, { id, status: 'waiting_rating' }, 'Check-out berhasil. Barang telah dikembalikan.');
  }),
);

/**
 * POST /transactions/:id/extend
 * Penyewa mengajukan perpanjangan sewa (Adendum)
 */
transactionsRouter.post(
  '/:id/extend',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { newEndDate, additionalCost, paymentMethod } = req.body;

    if (!newEndDate) return fail(res, ERROR_CODES.INVALID_INPUT, 'newEndDate wajib diisi', 400);
    if (!paymentMethod || !['midtrans', 'cash'].includes(paymentMethod)) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Metode pembayaran (midtrans/cash) wajib diisi untuk perpanjangan', 400);
    }

    const docRef = db.collection('transactions').doc(String(id));
    const snap = await docRef.get();

    if (!snap.exists) return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);
    
    const trans = snap.data() as TransactionDoc;
    if (trans.renterId !== uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Hanya penyewa yang bisa mengajukan perpanjangan sewa', 403);
    }

    if (trans.status !== 'ongoing') {
      return fail(res, ERROR_CODES.CONFLICT, 'Perpanjangan hanya bisa dilakukan pada saat status sewa aktif (ongoing)', 409);
    }

    // Check if there is already a pending extension
    if (trans.adendumRequest?.status === 'pending') {
      return fail(res, ERROR_CODES.CONFLICT, 'Anda sudah memiliki pengajuan perpanjangan yang belum direspons pemilik', 409);
    }

    const eDate = new Date(newEndDate);
    if (isNaN(eDate.getTime())) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Format tanggal tidak valid', 400);
    }

    // Check if the new range overlaps with any other active booking
    const detailsSnap = await docRef.collection('transaction_details').get();
    for (const d of detailsSnap.docs) {
      const detail = d.data();
      const originalEndDate = (detail.endDate as admin.firestore.Timestamp).toDate();
      const overlapCheck = await checkItemDateOverlap(detail.itemId, originalEndDate, eDate, id);
      if (overlapCheck.hasOverlap) {
        return fail(
          res,
          ERROR_CODES.CONFLICT,
          `Tidak dapat memperpanjang sewa. Barang "${overlapCheck.itemName || 'tersebut'}" sudah disewa oleh pengguna lain pada rentang tanggal perpanjangan.`,
          409
        );
      }
    }

    await docRef.update({
      adendumRequest: {
        newEndDate: admin.firestore.Timestamp.fromDate(eDate),
        additionalCost: Number(additionalCost) || 0,
        status: 'pending',
        paymentMethod: paymentMethod,
        paymentStatus: 'pending',
        createdAt: now(),
      },
      updatedAt: now()
    });

    // Trigger notification to owner
    createNotification({
      userId: trans.ownerId,
      type: 'request',
      class: 'transactional',
      title: 'Permintaan Perpanjangan Sewa',
      body: `${trans.renterName} mengajukan perpanjangan sewa. Silakan tinjau dan berikan persetujuan.`,
      transactionId: id,
    }).catch(err => {
      console.error('[Notification Error] Failed to send extension request push notification:', err);
    });

    return ok(res, { id, status: 'pending' }, 'Pengajuan perpanjangan berhasil dikirim');
  }),
);

/**
 * PATCH /transactions/:id/extend/approve
 * Pemilik menyetujui perpanjangan sewa
 */
transactionsRouter.patch(
  '/:id/extend/approve',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const docRef = db.collection('transactions').doc(String(id));
    const snap = await docRef.get();

    if (!snap.exists) return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);
    
    const trans = snap.data() as TransactionDoc;
    if (trans.ownerId !== uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Hanya pemilik yang bisa menyetujui perpanjangan sewa', 403);
    }

    if (trans.adendumRequest?.status !== 'pending') {
      return fail(res, ERROR_CODES.CONFLICT, 'Tidak ada pengajuan perpanjangan yang aktif', 409);
    }

    const newEndDateTimestamp = trans.adendumRequest.newEndDate as admin.firestore.Timestamp;
    const addedCost = trans.adendumRequest.additionalCost || 0;
    const eDate = newEndDateTimestamp.toDate();

    // Verify overlap before approving to prevent race conditions
    const detailsSnap = await docRef.collection('transaction_details').get();
    for (const d of detailsSnap.docs) {
      const detail = d.data();
      const originalEndDate = (detail.endDate as admin.firestore.Timestamp).toDate();
      const overlapCheck = await checkItemDateOverlap(detail.itemId, originalEndDate, eDate, id);
      if (overlapCheck.hasOverlap) {
        return fail(
          res,
          ERROR_CODES.CONFLICT,
          `Gagal menyetujui. Barang "${overlapCheck.itemName || 'tersebut'}" sudah disewa oleh pengguna lain pada rentang tanggal perpanjangan.`,
          409
        );
      }
    }

    const batch = db.batch();

    // 1. Update transaction doc
    if (trans.adendumRequest.paymentMethod === 'cash') {
      batch.update(docRef, {
        'adendumRequest.status': 'approved',
        totalPrice: admin.firestore.FieldValue.increment(addedCost),
        updatedAt: now()
      });

      // 2. Update transaction_details end date
      const detailsSnap = await docRef.collection('transaction_details').get();
      for (const d of detailsSnap.docs) {
        batch.update(d.ref, {
          endDate: newEndDateTimestamp
        });
      }
    } else {
      // For Midtrans, only update status. EndDate and Cost will be updated in webhook upon payment success.
      batch.update(docRef, {
        'adendumRequest.status': 'approved',
        updatedAt: now()
      });
    }

    await batch.commit();

    // Notify Renter
    createNotification({
      userId: trans.renterId,
      type: 'approved',
      class: 'transactional',
      title: 'Perpanjangan Sewa Disetujui',
      body: `Permintaan perpanjangan sewa Anda telah disetujui oleh ${trans.ownerName}.`,
      transactionId: id,
    }).catch(err => {
      console.error('[Notification Error] Failed to send extension approval push notification:', err);
    });

    return ok(res, { id, status: 'approved' }, 'Perpanjangan sewa berhasil disetujui');
  }),
);

/**
 * PATCH /transactions/:id/extend/reject
 * Pemilik menolak perpanjangan sewa
 */
transactionsRouter.patch(
  '/:id/extend/reject',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const docRef = db.collection('transactions').doc(String(id));
    const snap = await docRef.get();

    if (!snap.exists) return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);
    
    const trans = snap.data() as TransactionDoc;
    if (trans.ownerId !== uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Hanya pemilik yang berwenang menolak perpanjangan', 403);
    }

    if (trans.adendumRequest?.status !== 'pending') {
      return fail(res, ERROR_CODES.CONFLICT, 'Tidak ada pengajuan perpanjangan yang aktif', 409);
    }

    await docRef.update({
      'adendumRequest.status': 'rejected',
      updatedAt: now()
    });

    // Notify Renter
    createNotification({
      userId: trans.renterId,
      type: 'rejected',
      class: 'transactional',
      title: 'Perpanjangan Sewa Ditolak',
      body: `${trans.ownerName} menolak perpanjangan sewa Anda. Silakan kembalikan barang sesuai jadwal semula.`,
      transactionId: id,
    }).catch(err => {
      console.error('[Notification Error] Failed to send extension rejection push notification:', err);
    });

    return ok(res, { id, status: 'rejected' }, 'Perpanjangan sewa berhasil ditolak');
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
