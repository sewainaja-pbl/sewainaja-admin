import { Router } from 'express';
import { auth, db, now } from '../lib/firebase-admin';
import { fail, ok } from '../lib/http';
import { ERROR_CODES } from '../errors';
import { IdentityToolkitError, signInWithPassword } from '../lib/identity-toolkit';
import { requireAuth } from '../middleware/require-auth';
import type { UserDoc } from '../types/auth';
import { asyncHandler } from '../lib/async-handler';

export const authRouter = Router();

const toBoolean = (value: unknown) => value === true;

const validateRegisterBody = (body: Record<string, unknown>) => {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

  if (!name || !email || !password || !phone) {
    return null;
  }

  return {
    name,
    email,
    password,
    phone,
    isOwner: toBoolean(body.isOwner),
    isRenter: toBoolean(body.isRenter),
  };
};

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = validateRegisterBody(req.body ?? {});

    if (!input) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Data registrasi tidak valid', 400);
    }

    const existing = await auth.getUserByEmail(input.email).catch(() => null);
    if (existing) {
      return fail(res, ERROR_CODES.CONFLICT, 'Email sudah terdaftar', 409);
    }

    const userRecord = await auth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.name,
      phoneNumber: input.phone,
    });

    const userDoc: UserDoc = {
      id: userRecord.uid,
      name: input.name,
      email: input.email,
      phone: input.phone,
      isOwner: input.isOwner,
      isRenter: input.isRenter,
      isAdmin: false,
      status: 'pending',
      ktpPhotoUrl: '',
      selfiePhotoUrl: '',
      avgRatingAsRenter: 0,
      avgRatingAsOwner: 0,
      totalTransactions: 0,
      fcmToken: '',
      createdAt: now(),
      updatedAt: now(),
    };

    try {
      await db.collection('users').doc(userRecord.uid).set(userDoc);
    } catch {
      await auth.deleteUser(userRecord.uid).catch(() => undefined);
      return fail(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal menyimpan profil user', 500);
    }

    return ok(
      res,
      {
        uid: userRecord.uid,
        status: userDoc.status,
        isOwner: userDoc.isOwner,
        isRenter: userDoc.isRenter,
      },
      'Registrasi berhasil',
    );
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Email atau password tidak valid', 400);
    }

    try {
      const result = await signInWithPassword(email, password);
      const userSnapshot = await db.collection('users').doc(result.localId).get();
      const user = userSnapshot.data();

      if (!user) {
        return fail(res, ERROR_CODES.NOT_FOUND, 'Profil user tidak ditemukan', 404);
      }

      if (user.status === 'suspended') {
        return fail(res, ERROR_CODES.FORBIDDEN, 'Akun diblokir', 403);
      }

      return ok(
        res,
        {
          tokens: {
            idToken: result.idToken,
            refreshToken: result.refreshToken,
            expiresIn: result.expiresIn,
          },
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            status: user.status,
            isOwner: user.isOwner,
            isRenter: user.isRenter,
            isAdmin: user.isAdmin,
          },
        },
        'Login berhasil',
      );
    } catch (error) {
      if (error instanceof IdentityToolkitError) {
        if (
          error.code === 'INVALID_PASSWORD' ||
          error.code === 'EMAIL_NOT_FOUND' ||
          error.code === 'USER_DISABLED'
        ) {
          return fail(res, ERROR_CODES.UNAUTHORIZED, 'Email atau password salah', 401);
        }

        return fail(res, ERROR_CODES.INTERNAL_ERROR, error.message, 500);
      }

      return fail(res, ERROR_CODES.INTERNAL_ERROR, 'Login gagal', 500);
    }
  }),
);

authRouter.get(
  '/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const uid = req.user?.uid;
    const snapshot = await db.collection('users').doc(uid ?? '').get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Profil user tidak ditemukan', 404);
    }

    return ok(res, snapshot.data(), 'Profil ditemukan');
  }),
);
