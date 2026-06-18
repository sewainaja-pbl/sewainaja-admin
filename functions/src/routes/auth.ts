import { Router } from 'express';
import { auth, db, now } from '../lib/firebase-admin';
import { fail, ok } from '../lib/http';
import { ERROR_CODES } from '../errors';
import { IdentityToolkitError, signInWithPassword } from '../lib/identity-toolkit';
import { requireAuth } from '../middleware/require-auth';
import type { UserDoc } from '../types/auth';
import { asyncHandler } from '../lib/async-handler';
import { createNotification } from '../lib/notifications';

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

// POST /auth/register
// Hanya validasi duplikat email & phone — TIDAK membuat akun Firebase.
// Akun Firebase dibuat dari sisi Flutter setelah OTP berhasil diverifikasi.
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = validateRegisterBody(req.body ?? {});

    if (!input) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Data registrasi tidak valid. Pastikan semua kolom diisi.', 400);
    }

    // Validasi format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email)) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Format email tidak valid', 400);
    }

    // Validasi format nomor HP Indonesia (E.164: +62xxx)
    const phoneRegex = /^\+62\d{7,12}$/;
    if (!phoneRegex.test(input.phone)) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Format nomor HP tidak valid. Gunakan format +62xxx.', 400);
    }

    // Validasi password minimal 8 karakter
    if (input.password.length < 8) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Password minimal 8 karakter', 400);
    }

    // Cek duplikasi email di Firebase Auth
    const existingByEmail = await auth.getUserByEmail(input.email).catch(() => null);
    if (existingByEmail) {
      return fail(res, ERROR_CODES.EMAIL_TAKEN, 'Email sudah digunakan oleh akun lain', 409);
    }

    // Cek duplikasi nomor HP di Firestore
    const phoneQuery = await db
      .collection('users')
      .where('phone', '==', input.phone)
      .limit(1)
      .get();
    if (!phoneQuery.empty) {
      return fail(res, ERROR_CODES.PHONE_TAKEN, 'Nomor HP sudah terdaftar', 409);
    }

    // Validasi lolos — Flutter akan trigger Firebase Phone Auth setelah ini
    return ok(res, null, 'Nomor HP siap diverifikasi');
  }),
);

// POST /auth/complete-register
// Dipanggil setelah OTP berhasil diverifikasi dan akun Firebase sudah dibuat oleh Flutter.
// Membuat dokumen Firestore users/{uid}, set custom claims, dan insert admin_task KYC.
authRouter.post(
  '/complete-register',
  requireAuth,
  asyncHandler(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid) {
      return fail(res, ERROR_CODES.UNAUTHORIZED, 'Token tidak valid', 401);
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';

    if (!name || !email || !phone) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Data profil tidak lengkap', 400);
    }

    // Cek apakah dokumen user sudah ada (idempoten — aman dipanggil ulang)
    const existingDoc = await db.collection('users').doc(uid).get();
    if (existingDoc.exists) {
      return ok(res, { uid, status: existingDoc.data()?.status }, 'Profil sudah terbuat');
    }

    const timestamp = now();

    // Buat dokumen Firestore users/{uid} sesuai schema DATABASE.md
    const userDoc: UserDoc = {
      id: uid,
      name,
      email,
      phone,
      bio: '',
      isOwner: false,
      isRenter: true,
      isAdmin: false,
      status: 'pending',
      profilePhotoUrl: '',
      ktpPhotoUrl: '',
      selfiePhotoUrl: '',
      avgRatingAsRenter: 0,
      avgRatingAsOwner: 0,
      totalTransactions: 0,
      followersCount: 0,
      fcmToken: '',
      walletBalance: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      // Gunakan batch write: Firestore doc + admin_task harus atomik
      const batch = db.batch();

      // 1. Buat dokumen users/{uid}
      const userRef = db.collection('users').doc(uid);
      batch.set(userRef, userDoc);

      // 2. Insert admin_task untuk antrian review KYC
      const adminTaskRef = db.collection('admin_tasks').doc();
      batch.set(adminTaskRef, {
        id: adminTaskRef.id,
        type: 'kyc_review',
        title: `Review KTP untuk ${name}`,
        description: `User baru ${name} (${email}) telah mendaftar dan menunggu review KYC.`,
        refId: uid,
        refType: 'user',
        priority: 'normal',
        status: 'pending',
        assignedTo: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        doneAt: null,
      });

      await batch.commit();
    } catch {
      // Jika Firestore gagal, hapus akun Firebase agar tidak ada orphan user
      await auth.deleteUser(uid).catch(() => undefined);
      return fail(res, ERROR_CODES.INTERNAL_ERROR, 'Gagal menyimpan profil. Silakan coba lagi.', 500);
    }

    // Set custom claims: verified=false, role="user"
    // (verified=true hanya setelah admin approve KYC)
    try {
      await auth.setCustomUserClaims(uid, { verified: false, role: 'user' });
    } catch (err) {
      // Custom claims gagal tidak membatalkan registrasi — admin bisa set manual
      console.error('[complete-register] Gagal set custom claims:', err);
    }

    return res.status(201).json({
      success: true,
      data: { uid, status: 'pending' },
      message: 'Registrasi berhasil. Akun sedang dalam review.',
    });
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
            profilePhotoUrl: user.profilePhotoUrl ?? '',
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

authRouter.post(
  '/upload-kyc',
  requireAuth,
  asyncHandler(async (req, res) => {
    const selfiePhotoUrl = typeof req.body?.selfiePhotoUrl === 'string' ? req.body.selfiePhotoUrl.trim() : '';
    const ktpPhotoUrl = typeof req.body?.ktpPhotoUrl === 'string' ? req.body.ktpPhotoUrl.trim() : '';

    if (!selfiePhotoUrl || !ktpPhotoUrl) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Foto selfie dan KTP wajib diunggah', 400);
    }

    const uid = req.user?.uid;
    const ref = db.collection('users').doc(uid ?? '');
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Profil user tidak ditemukan', 404);
    }

    await ref.update({
      selfiePhotoUrl,
      ktpPhotoUrl,
      status: 'pending',
      rejectionReason: '',
      updatedAt: now(),
    });

    // Kirim notifikasi ke admin
    const userData = snapshot.data();
    const userName = userData?.name || 'User';
    
    await createNotification({
      userId: 'admin',
      type: 'request',
      title: 'Pengunggahan Berkas KYC',
      body: `User ${userName} telah mengunggah berkas KTP dan selfie untuk verifikasi akun.`,
    });

    // Buat admin_task baru agar muncul di antrian review admin dashboard
    const adminTaskRef = db.collection('admin_tasks').doc();
    await adminTaskRef.set({
      id: adminTaskRef.id,
      type: 'kyc_review',
      title: `Review KTP untuk ${userName}`,
      description: `User ${userName} (${userData?.email || ''}) telah mengunggah berkas KYC untuk verifikasi.`,
      refId: uid,
      refType: 'user',
      priority: 'normal',
      status: 'pending',
      assignedTo: null,
      createdAt: now(),
      updatedAt: now(),
      doneAt: null,
    });

    return ok(res, { selfiePhotoUrl, ktpPhotoUrl, status: 'pending' }, 'Berkas KYC berhasil diunggah');
  }),
);

authRouter.patch(
  '/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const uid = req.user?.uid;
    const ref = db.collection('users').doc(uid ?? '');
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Profil user tidak ditemukan', 404);
    }

    const updates: Record<string, unknown> = {
      updatedAt: now(),
    };

    if (typeof req.body.name === 'string') {
      const name = req.body.name.trim();
      if (!name) {
        return fail(res, ERROR_CODES.INVALID_INPUT, 'Nama tidak boleh kosong', 400);
      }
      updates.name = name;
    }

    if (typeof req.body.phone === 'string') {
      const phone = req.body.phone.trim();
      if (!phone) {
        return fail(res, ERROR_CODES.INVALID_INPUT, 'Nomor telepon tidak boleh kosong', 400);
      }
      updates.phone = phone;
    }

    if (typeof req.body.profilePhotoUrl === 'string') {
      updates.profilePhotoUrl = req.body.profilePhotoUrl.trim();
    }

    if (typeof req.body.bio === 'string') {
      updates.bio = req.body.bio.trim();
    }

    if (req.body.isOwner !== undefined) {
      updates.isOwner = toBoolean(req.body.isOwner);
    }

    if (req.body.isRenter !== undefined) {
      updates.isRenter = toBoolean(req.body.isRenter);
    }

    await ref.update(updates);

    const updatedSnapshot = await ref.get();
    return ok(res, updatedSnapshot.data(), 'Profil berhasil diperbarui');
  }),
);

authRouter.post(
  '/fcm-token',
  requireAuth,
  asyncHandler(async (req, res) => {
    const fcmToken = typeof req.body?.fcmToken === 'string' ? req.body.fcmToken.trim() : '';

    if (!fcmToken) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Token FCM tidak valid', 400);
    }

    const uid = req.user?.uid;
    const ref = db.collection('users').doc(uid ?? '');
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Profil user tidak ditemukan', 404);
    }

    await ref.update({
      fcmToken,
      updatedAt: now(),
    });

    return ok(res, { fcmToken }, 'Token FCM berhasil diperbarui');
  }),
);

authRouter.post(
  '/login-google',
  asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;
    const idToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

    if (!idToken) {
      return fail(res, ERROR_CODES.UNAUTHORIZED, 'Token tidak ditemukan', 401);
    }

    try {
      const decoded = await auth.verifyIdToken(idToken);
      const { uid, email, name, picture } = decoded;

      const userRef = db.collection('users').doc(uid);
      const userSnap = await userRef.get();

      if (userSnap.exists) {
        const user = userSnap.data()!;

        if (user.status === 'suspended') {
          return fail(res, ERROR_CODES.FORBIDDEN, 'Akun kamu telah disuspend', 403);
        }

        await userRef.update({
          lastLoginAt: now(),
          updatedAt: now(),
        });

        const updatedUserSnap = await userRef.get();
        const updatedUser = updatedUserSnap.data()!;

        return ok(
          res,
          {
            user: {
              id: updatedUser.id,
              name: updatedUser.name,
              email: updatedUser.email,
              phone: updatedUser.phone,
              profilePhotoUrl: updatedUser.profilePhotoUrl ?? '',
              status: updatedUser.status,
              isOwner: updatedUser.isOwner,
              isRenter: updatedUser.isRenter,
              isAdmin: updatedUser.isAdmin,
              lastLoginAt: updatedUser.lastLoginAt,
            },
          },
          'Login via Google berhasil',
        );
      }

      const timestamp = now();
      const newUser: UserDoc = {
        id: uid,
        name: name ?? '',
        email: email ?? '',
        phone: '',
        isOwner: true,
        isRenter: true,
        isAdmin: false,
        status: 'unverified',
        ktpPhotoUrl: '',
        selfiePhotoUrl: '',
        profilePhotoUrl: picture ?? '',
        avgRatingAsRenter: 0,
        avgRatingAsOwner: 0,
        totalTransactions: 0,
        fcmToken: '',
        createdAt: timestamp,
        updatedAt: timestamp,
        lastLoginAt: timestamp,
      };

      await userRef.set(newUser);

      return res.status(201).json({
        success: true,
        data: newUser,
        message: 'Registrasi via Google berhasil',
      });
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      const errorCode = firebaseError?.code;

      if (errorCode === 'auth/id-token-expired') {
        return fail(res, ERROR_CODES.UNAUTHORIZED, 'Token kadaluarsa, silakan login ulang', 401);
      }
      if (
        errorCode === 'auth/argument-error' ||
        errorCode === 'auth/invalid-id-token'
      ) {
        return fail(res, ERROR_CODES.UNAUTHORIZED, 'Token tidak valid', 401);
      }

      return fail(
        res,
        ERROR_CODES.INTERNAL_ERROR,
        firebaseError.message || 'Login via Google gagal',
        500
      );
    }
  }),
);

