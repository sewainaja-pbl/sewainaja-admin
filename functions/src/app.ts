import cors from 'cors';
import admin from 'firebase-admin';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from './errors';
import { fail } from './lib/http';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';
import { adminUsersRouter } from './routes/admin-users';
import { adminWithdrawalsRouter } from './routes/admin-withdrawals';
import { addressesRouter } from './routes/addresses';
import { categoriesRouter } from './routes/categories';
import { itemsRouter } from './routes/items';
import { gpsRouter } from './routes/gps';
import { notificationsRouter } from './routes/notifications';
import { adminDisputesRouter } from './routes/admin-disputes';
import { transactionsRouter } from './routes/transactions';
import { evidencesRouter } from './routes/evidences';
import { chatsRouter } from './routes/chats';
import { paymentsRouter } from './routes/payments';
import { ratingsRouter } from './routes/ratings';
import { disputesRouter } from './routes/disputes';
import { uploadsRouter } from './routes/uploads';

export const app = express();

// --- security hardening ---
app.disable('x-powered-by');
app.set('trust proxy', 1);

// rate limit: 100 req/15min per IP (global)
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));

// stricter rate limit on auth endpoints: 20 req/15min
app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false }));

// stricter rate limit on upload: 30 req/15min
app.use('/uploads', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false }));

app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));
// Catatan: static file serving dihapus — gambar sekarang di-serve langsung dari Cloudinary

app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/admin/users', adminUsersRouter);
app.use('/admin/disputes', adminDisputesRouter);
app.use('/admin/withdrawals', adminWithdrawalsRouter);
app.use('/addresses', addressesRouter);
app.use('/categories', categoriesRouter);
app.use('/items', itemsRouter);
app.use('/gps', gpsRouter);
app.use('/notifications', notificationsRouter);
app.use('/transactions', transactionsRouter);
app.use('/transactions/:transactionId/evidences', evidencesRouter);
app.use('/transactions/:transactionId/chats', chatsRouter);
app.use('/payments', paymentsRouter);
app.use('/ratings', ratingsRouter);
app.use('/disputes', disputesRouter);
app.use('/uploads', uploadsRouter);

app.use((_req, res) => {
  return fail(res, ERROR_CODES.NOT_FOUND, 'Route tidak ditemukan', 404);
});

app.use(
  (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    return fail(res, ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan server', 500);
  },
);
