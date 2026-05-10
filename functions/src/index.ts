import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { onRequest } from 'firebase-functions/v2/https';
import { ERROR_CODES } from './errors';
import { fail } from './lib/http';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';
import { adminUsersRouter } from './routes/admin-users';
import { addressesRouter } from './routes/addresses';
import { categoriesRouter } from './routes/categories';
import { itemsRouter } from './routes/items';
import { gpsRouter } from './routes/gps';
import { notificationsRouter } from './routes/notifications';
import { adminDisputesRouter } from './routes/admin-disputes';

export const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/admin/users', adminUsersRouter);
app.use('/admin/disputes', adminDisputesRouter);
app.use('/addresses', addressesRouter);
app.use('/categories', categoriesRouter);
app.use('/items', itemsRouter);
app.use('/gps', gpsRouter);
app.use('/notifications', notificationsRouter);

app.use((_req, res) => {
  return fail(res, ERROR_CODES.NOT_FOUND, 'Route tidak ditemukan', 404);
});

app.use(
  (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    return fail(res, ERROR_CODES.INTERNAL_ERROR, 'Terjadi kesalahan server', 500);
  },
);

export const api = onRequest(app);
export default api;
