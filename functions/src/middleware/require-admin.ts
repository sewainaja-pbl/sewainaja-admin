import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '../errors';
import { fail } from '../lib/http';
import { db } from '../lib/firebase-admin';

export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.user?.claims.admin === true) {
    return next();
  }

  const uid = req.user?.uid;
  if (!uid) {
    return fail(res, ERROR_CODES.UNAUTHORIZED, 'Token tidak valid', 401);
  }

  const userSnapshot = await db.collection('users').doc(uid).get();
  if (userSnapshot.exists && userSnapshot.data()?.isAdmin === true) {
    return next();
  }

  return fail(res, ERROR_CODES.FORBIDDEN, 'Akses admin ditolak', 403);
};
