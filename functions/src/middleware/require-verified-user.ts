import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '../errors';
import { db } from '../lib/firebase-admin';
import { fail } from '../lib/http';

export const requireVerifiedUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const uid = req.user?.uid;

  if (!uid) {
    return fail(res, ERROR_CODES.UNAUTHORIZED, 'Token tidak valid', 401);
  }

  const snapshot = await db.collection('users').doc(uid).get();

  if (!snapshot.exists || snapshot.data()?.status !== 'verified') {
    return fail(res, ERROR_CODES.FORBIDDEN, 'Akun belum terverifikasi', 403);
  }

  return next();
};
