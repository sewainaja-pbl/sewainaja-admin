import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { db, now } from '../lib/firebase-admin';
import { fail, ok } from '../lib/http';
import { ERROR_CODES } from '../errors';
import { requireAuth } from '../middleware/require-auth';
import { asyncHandler } from '../lib/async-handler';
import { snap, coreApi } from '../lib/midtrans';
import { createNotification } from '../lib/notifications';
import crypto from 'crypto';
import type { PaymentDoc } from '../types/payment';

export const paymentsRouter = Router();

/**
 * POST /payments/initiate
 * Buat transaksi Midtrans, dapat Snap Token
 */
paymentsRouter.post(
  '/initiate',
  requireAuth,
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const { transactionId } = req.body;

    if (!transactionId) return fail(res, ERROR_CODES.INVALID_INPUT, 'Transaction ID wajib disertakan', 400);

    const transRef = db.collection('transactions').doc(String(transactionId));
    const snapTrans = await transRef.get();

    if (!snapTrans.exists) return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);

    const transaction = snapTrans.data();
    if (transaction?.renterId !== uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Hanya penyewa yang bisa memulai pembayaran', 403);
    }

    const orderId = `ORDER-${transactionId}-${Date.now()}`;
    const amount = transaction?.totalPrice || 0;

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      customer_details: {
        first_name: transaction?.renterName || 'User',
      }
    };

    try {
      // Generate snap response
      const midtransResp = await snap.createTransaction(parameter);

      // Save initial payment record in Firestore
      const paymentData: Omit<PaymentDoc, 'id'> = {
        transactionId: String(transactionId),
        amount: amount,
        status: 'pending',
        paymentMethod: 'midtrans',
        midtransOrderId: orderId,
        midtransPaymentType: null,
        paymentProofUrl: null,
        paidAt: null,
        createdAt: now()
      };

      await db.collection('payments').doc(orderId).set(paymentData);

      return ok(res, { ...midtransResp, orderId }, 'Snap token berhasil diciptakan');
    } catch (error: any) {
      console.error('Midtrans Init Error:', error);
      return fail(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal berkomunikasi dengan payment gateway: ' + (error.message || ''), 500);
    }
  }),
);

/**
 * POST /payments/initiate-cash
 * Renter menyatakan ingin membayar menggunakan Cash/COD
 */
paymentsRouter.post(
  '/initiate-cash',
  requireAuth,
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const { transactionId } = req.body;

    if (!transactionId) return fail(res, ERROR_CODES.INVALID_INPUT, 'Transaction ID wajib disertakan', 400);

    const transRef = db.collection('transactions').doc(String(transactionId));
    const snapTrans = await transRef.get();

    if (!snapTrans.exists) return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);

    const transaction = snapTrans.data();
    if (transaction?.renterId !== uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Hanya penyewa yang bisa memilih metode pembayaran COD', 403);
    }

    const orderId = `COD-${transactionId}-${Date.now()}`;
    const amount = transaction?.totalPrice || 0;

    const paymentData = {
      transactionId: String(transactionId),
      amount: amount,
      status: 'pending',
      paymentMethod: 'cash',
      midtransOrderId: null,
      midtransPaymentType: null,
      paymentProofUrl: null,
      paidAt: null,
      createdAt: now()
    };

    await db.collection('payments').doc(orderId).set(paymentData);

    // Kirim notifikasi ke pemilik bahwa renter memilih pembayaran COD
    createNotification({
      userId: transaction.ownerId,
      type: 'payment',
      class: 'transactional',
      title: 'Metode COD Dipilih',
      body: `${transaction.renterName} memilih metode pembayaran Tunai (COD). Harap konfirmasi ketika uang telah diterima.`,
      transactionId: String(transactionId),
    }).catch(err => {
      console.error('[Notification Error] Owner COD initiation notification failed:', err);
    });

    return ok(res, { id: orderId, ...paymentData }, 'Metode COD berhasil dipilih');
  }),
);

/**
 * POST /payments/initiate-adendum
 * Buat transaksi Midtrans untuk biaya perpanjangan sewa
 */
paymentsRouter.post(
  '/initiate-adendum',
  requireAuth,
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const { transactionId } = req.body;

    if (!transactionId) return fail(res, ERROR_CODES.INVALID_INPUT, 'Transaction ID wajib disertakan', 400);

    const transRef = db.collection('transactions').doc(String(transactionId));
    const snapTrans = await transRef.get();

    if (!snapTrans.exists) return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);

    const transaction = snapTrans.data();
    if (transaction?.renterId !== uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Hanya penyewa yang bisa memulai pembayaran adendum', 403);
    }

    if (!transaction?.adendumRequest || transaction.adendumRequest.status !== 'approved') {
      return fail(res, ERROR_CODES.CONFLICT, 'Perpanjangan sewa belum disetujui atau tidak ada', 409);
    }

    if (transaction.adendumRequest.paymentMethod !== 'midtrans') {
      return fail(res, ERROR_CODES.CONFLICT, 'Metode pembayaran untuk perpanjangan ini bukan Midtrans', 409);
    }

    if (transaction.adendumRequest.paymentStatus === 'paid') {
      return fail(res, ERROR_CODES.CONFLICT, 'Perpanjangan sewa ini sudah dibayar', 409);
    }

    const orderId = `ADENDUM-${transactionId}-${Date.now()}`;
    const amount = transaction.adendumRequest.additionalCost || 0;

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      customer_details: {
        first_name: transaction?.renterName || 'User',
      }
    };

    try {
      // Generate snap response
      const midtransResp = await snap.createTransaction(parameter);

      // Save initial payment record in Firestore
      const paymentData: Omit<PaymentDoc, 'id'> = {
        transactionId: String(transactionId),
        amount: amount,
        status: 'pending',
        paymentMethod: 'midtrans',
        midtransOrderId: orderId,
        midtransPaymentType: null,
        paymentProofUrl: null,
        paidAt: null,
        createdAt: now()
      };

      await db.collection('payments').doc(orderId).set(paymentData);

      return ok(res, { ...midtransResp, orderId }, 'Snap token adendum berhasil diciptakan');
    } catch (error: any) {
      console.error('Midtrans Init Adendum Error:', error);
      return fail(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal berkomunikasi dengan payment gateway: ' + (error.message || ''), 500);
    }
  }),
);

/**
 * POST /payments/webhook
 * Webhook dari Midtrans
 * TIPE PUBLIK (TANPA AUTH MIDDLEWARE)
 */
paymentsRouter.post(
  '/webhook',
  asyncHandler(async (req: Request, res: Response) => {
    const notificationJson = req.body;

    try {
      // Let library verify correctness
      const statusResp = await coreApi.transaction.notification(notificationJson);
      
      const orderId = statusResp.order_id;
      const transactionStatus = statusResp.transaction_status;
      const fraudStatus = statusResp.fraud_status;
      const paymentType = statusResp.payment_type;

      console.log(`Webhook received for order: ${orderId}. Status: ${transactionStatus}, Fraud: ${fraudStatus}`);

      const paymentRef = db.collection('payments').doc(orderId);
      const paymentSnap = await paymentRef.get();

      if (!paymentSnap.exists) {
        return res.status(404).json({ status: 'Not Found' });
      }

      const payment = paymentSnap.data() as PaymentDoc;

      let finalStatus: 'paid' | 'failed' | 'pending' | 'refunded' = 'pending';
      let isSuccess = false;

      if (transactionStatus === 'capture') {
        if (fraudStatus === 'accept') {
          finalStatus = 'paid';
          isSuccess = true;
        }
      } else if (transactionStatus === 'settlement') {
        finalStatus = 'paid';
        isSuccess = true;
      } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
        finalStatus = 'failed';
      } else if (transactionStatus === 'pending') {
        finalStatus = 'pending';
      } else if (transactionStatus === 'refund') {
        finalStatus = 'refunded';
      }

      // Update Payment doc
      await paymentRef.update({
        status: finalStatus,
        midtransPaymentType: paymentType,
        paidAt: isSuccess ? now() : null,
        escrowStatus: isSuccess ? 'held' : null,
      });

      // Send push notification if payment succeeded
      if (isSuccess) {
        const transSnap = await db.collection('transactions').doc(payment.transactionId).get();
        if (transSnap.exists) {
          const trans = transSnap.data();
          if (trans) {
            const isAdendum = orderId.startsWith('ADENDUM-');
            if (isAdendum && trans.adendumRequest && trans.adendumRequest.status === 'approved') {
              const newEndDate = trans.adendumRequest.newEndDate;
              const additionalCost = trans.adendumRequest.additionalCost || 0;

              // 1. Update Transaction
              await db.collection('transactions').doc(payment.transactionId).update({
                'adendumRequest.paymentStatus': 'paid',
                'totalPrice': admin.firestore.FieldValue.increment(additionalCost)
              });

              // 2. Update Transaction Detail (assume 1 item for now)
              const detailSnap = await db.collection('transactions').doc(payment.transactionId).collection('transaction_details').get();
              if (!detailSnap.empty) {
                const detailDoc = detailSnap.docs[0];
                await detailDoc.ref.update({
                  'endDate': newEndDate,
                  'subtotal': admin.firestore.FieldValue.increment(additionalCost)
                });
              }
            }

            // Notify renter
            createNotification({
              userId: trans.renterId,
              type: 'payment',
              class: 'transactional',
              title: isAdendum ? 'Pembayaran Perpanjangan Sukses' : 'Pembayaran Sukses',
              body: isAdendum 
                ? `Pembayaran perpanjangan sewa Anda telah berhasil diverifikasi.`
                : `Pembayaran Anda untuk transaksi sewa barang ${trans.ownerName} telah berhasil diverifikasi.`,
              transactionId: payment.transactionId,
            }).catch(err => console.error('[Notification Error] Renter payment success notification failed:', err));

            // Notify owner
            createNotification({
              userId: trans.ownerId,
              type: 'payment',
              class: 'transactional',
              title: isAdendum ? 'Pembayaran Perpanjangan Diterima' : 'Pembayaran Diterima',
              body: isAdendum
                ? `Pembayaran perpanjangan sewa oleh ${trans.renterName} telah diterima.`
                : `Pembayaran sewa oleh ${trans.renterName} telah diterima. Silakan lakukan serah terima barang.`,
              transactionId: payment.transactionId,
            }).catch(err => console.error('[Notification Error] Owner payment success notification failed:', err));
          }
        }
      }

      // OPTIONAL: If PAID, update logic could update Transaction Status to "paid" too or just leave it.
      // Normally transaction flow is separate, but user can check payment.

      return res.status(200).json({ status: 'ok' });
    } catch (error: any) {
      console.error('Midtrans Webhook Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }),
);

/**
 * POST /payments/confirm-manual
 * Konfirmasi pembayaran cash/manual oleh pemilik
 */
paymentsRouter.post(
  '/confirm-manual',
  requireAuth,
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const { transactionId, method, amount } = req.body;

    if (!transactionId || !['cash', 'manual_transfer'].includes(method)) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Informasi pembayaran tidak valid', 400);
    }

    const transRef = db.collection('transactions').doc(String(transactionId));
    const snap = await transRef.get();

    if (!snap.exists) return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);

    const transaction = snap.data();
    if (transaction?.ownerId !== uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Hanya pemilik barang yang bisa mengonfirmasi pembayaran manual', 403);
    }

    const paymentData: Omit<PaymentDoc, 'id'> = {
      transactionId: String(transactionId),
      amount: amount || transaction?.totalPrice || 0,
      status: 'paid',
      paymentMethod: method,
      midtransOrderId: null,
      midtransPaymentType: null,
      paymentProofUrl: null, // optional if provided in body
      paidAt: now(),
      createdAt: now(),
      escrowStatus: 'held'
    };

    const docRef = await db.collection('payments').add(paymentData);

    // If this is an Adendum COD payment
    if (transaction?.adendumRequest && transaction.adendumRequest.status === 'approved' && transaction.adendumRequest.paymentMethod === 'cash' && transaction.adendumRequest.paymentStatus === 'pending') {
      // Update Transaction to mark Adendum payment as paid.
      // (endDate and totalPrice were already incremented upon approval in transactions.ts)
      await transRef.update({
        'adendumRequest.paymentStatus': 'paid'
      });
    }

    // Trigger push notification to the renter
    createNotification({
      userId: transaction?.renterId,
      type: 'payment',
      class: 'transactional',
      title: 'Pembayaran Dikonfirmasi',
      body: `Pembayaran manual Anda telah dikonfirmasi oleh pemilik (${transaction?.ownerName}). Silakan lakukan serah terima barang.`,
      transactionId: String(transactionId),
    }).catch(err => {
      console.error('[Notification Error] Renter manual payment success notification failed:', err);
    });

    return ok(res, { id: docRef.id, ...paymentData }, 'Pembayaran manual berhasil dikonfirmasi');
  }),
);

/**
 * GET /payments/:transactionId
 * Get status pembayaran per transaksi
 */
paymentsRouter.get(
  '/:transactionId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const transactionId = Array.isArray(req.params.transactionId) ? req.params.transactionId[0] : req.params.transactionId;

    // Since one transaction can have multiple payment attempts (e.g. failures)
    // we list all payments tied to this transaction ordered by newest
    const snap = await db.collection('payments')
      .where('transactionId', '==', String(transactionId))
      .get();

    const payments = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    payments.sort((a, b) => {
      const timeA = a.createdAt && typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt && typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });

    return ok(res, payments, 'Status pembayaran berhasil diambil');
  }),
);
