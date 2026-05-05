import type { NextFunction, Request, Response } from 'express';
import { auth } from '../lib/firebase-admin';
import { fail } from '../lib/http';
import { ERROR_CODES } from '../errors';

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const header = req.header('authorization') ?? req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    return fail(res, ERROR_CODES.UNAUTHORIZED, 'Token tidak valid', 401);
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      claims: decoded,
    };
    return next();
  } catch {
    return fail(res, ERROR_CODES.UNAUTHORIZED, 'Token tidak valid', 401);
  }
};
