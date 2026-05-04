import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { onRequest } from 'firebase-functions/v2/https';
import { ERROR_CODES } from './errors';
import { fail } from './lib/http';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';
import { adminUsersRouter } from './routes/admin-users';

export const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/admin/users', adminUsersRouter);

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
