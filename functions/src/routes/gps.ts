import { Router } from 'express';
import admin from 'firebase-admin';
import { db, now } from '../lib/firebase-admin';
import { fail, ok } from '../lib/http';
import { ERROR_CODES } from '../errors';
import { requireAuth } from '../middleware/require-auth';
import { asyncHandler } from '../lib/async-handler';
import type { GpsLogDoc } from '../types/gps';

export const gpsRouter = Router();

gpsRouter.use(requireAuth);

/**
 * POST /gps/log
 * Log lokasi GPS (dipanggil Flutter saat overdue)
 */
gpsRouter.post(
  '/log',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const { transactionId, lat, lng, intervalMinutes } = req.body;

    if (!transactionId || typeof lat !== 'number' || typeof lng !== 'number') {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Data lokasi tidak lengkap atau tidak valid', 400);
    }

    const docRef = db.collection('transactions').doc(String(transactionId));
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);
    }

    const transaction = snapshot.data();
    
    // Validasi apakah user yang melog adalah penyewa
    if (transaction?.renterId !== uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Anda bukan penyewa dalam transaksi ini', 403);
    }

    // Walaupun idealnya hanya log saat overdue, kita terima log sesuai permintaan client
    // jika transaksi belum selesai/cancel
    if (['completed', 'cancelled'].includes(transaction?.status)) {
      return fail(res, ERROR_CODES.CONFLICT, 'Transaksi sudah selesai atau dibatalkan', 409);
    }

    const gpsLogsRef = docRef.collection('gps_logs');
    const newLogRef = gpsLogsRef.doc();

    const geoPoint = new admin.firestore.GeoPoint(lat, lng);

    const logData: Omit<GpsLogDoc, 'id'> = {
      userId: uid,
      coordinat: geoPoint,
      intervalMinutes: typeof intervalMinutes === 'number' ? intervalMinutes : 5,
      recordedAt: now(),
    };

    await newLogRef.set(logData);

    return ok(res, { id: newLogRef.id, ...logData }, 'Log GPS berhasil disimpan');
  }),
);

/**
 * GET /gps/latest/:transactionId
 * Ambil lokasi terakhir penyewa
 */
gpsRouter.get(
  '/latest/:transactionId',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const transactionId = Array.isArray(req.params.transactionId) 
      ? req.params.transactionId[0] 
      : req.params.transactionId;

    const docRef = db.collection('transactions').doc(String(transactionId));
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Transaksi tidak ditemukan', 404);
    }

    const transaction = snapshot.data();

    // Pemilik atau penyewa, atau admin boleh melihat
    if (transaction?.ownerId !== uid && transaction?.renterId !== uid && !req.user!.claims.admin) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Anda tidak memiliki akses ke data ini', 403);
    }

    const logsSnapshot = await docRef.collection('gps_logs')
      .orderBy('recordedAt', 'desc')
      .limit(1)
      .get();

    if (logsSnapshot.empty) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Belum ada log GPS untuk transaksi ini', 404);
    }

    const latestLog = logsSnapshot.docs[0];

    return ok(res, { id: latestLog.id, ...latestLog.data() }, 'Lokasi terakhir berhasil diambil');
  }),
);
