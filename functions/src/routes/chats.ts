import { Router } from 'express';
import { db, now } from '../lib/firebase-admin';
import { fail, ok } from '../lib/http';
import { ERROR_CODES } from '../errors';
import { requireAuth } from '../middleware/require-auth';
import { asyncHandler } from '../lib/async-handler';
import type { ChatMessageDoc } from '../types/chat';

export const chatsRouter = Router({ mergeParams: true });

chatsRouter.use(requireAuth);

/**
 * GET /transactions/:transactionId/chats
 * List pesan
 */
chatsRouter.get(
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

    const snapshot = await transRef.collection('chats')
      .where('deletedAt', '==', null)
      .orderBy('sentAt', 'asc')
      .get();

    const chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return ok(res, chats, 'Pesan berhasil diambil');
  }),
);

/**
 * POST /transactions/:transactionId/chats
 * Kirim pesan
 */
chatsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const transactionId = Array.isArray(req.params.transactionId) ? req.params.transactionId[0] : req.params.transactionId;
    const { message, messageType } = req.body;

    if (!message) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Isi pesan tidak boleh kosong', 400);
    }

    const transRef = db.collection('transactions').doc(String(transactionId));
    const snap = await transRef.get();

    if (!snap.exists) return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);

    const trans = snap.data();
    if (trans?.ownerId !== uid && trans?.renterId !== uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Anda bukan partisipan dalam transaksi ini', 403);
    }

    const chatData: Omit<ChatMessageDoc, 'id'> = {
      senderId: uid,
      message: String(message),
      messageType: messageType === 'image' ? 'image' : 'text',
      isRead: false,
      sentAt: now(),
      deletedAt: null
    };

    const docRef = await transRef.collection('chats').add(chatData);

    return ok(res, { id: docRef.id, ...chatData }, 'Pesan terkirim');
  }),
);
