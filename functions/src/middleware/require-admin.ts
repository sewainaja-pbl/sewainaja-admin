import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '../errors';
import { fail } from '../lib/http';

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.user?.claims.admin === true) {
    return next();
  }

  return fail(res, ERROR_CODES.FORBIDDEN, 'Akses admin ditolak', 403);
};
