import { Router } from 'express';
import { ok } from '../lib/http';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  return ok(res, { status: 'ok' }, 'Service aktif');
});
