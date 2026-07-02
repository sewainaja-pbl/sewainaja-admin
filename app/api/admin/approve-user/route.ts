import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!token) {
      return NextResponse.json(
        { success: false, error: { message: 'Token tidak valid' } },
        { status: 401 }
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    if (decodedToken.admin !== true) {
      return NextResponse.json(
        { success: false, error: { message: 'Akses admin ditolak' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { userId, role } = body; // role: 'owner', 'renter', 'admin'
    const allowedRoles = new Set(['owner', 'renter', 'admin']);

    if (!userId || !role) {
      return NextResponse.json(
        { success: false, error: { message: 'Parameter userId dan role wajib diisi' } },
        { status: 400 }
      );
    }

    if (!allowedRoles.has(role)) {
      return NextResponse.json(
        { success: false, error: { message: 'Role tidak valid' } },
        { status: 400 }
      );
    }

    // Merge with existing claims to avoid removing unrelated permissions.
    const userRecord = await adminAuth.getUser(userId);
    await adminAuth.setCustomUserClaims(userId, {
      ...(userRecord.customClaims ?? {}),
      [role]: true,
      verified: true,
    });
    
    // Update status di Firestore
    const updateData: Record<string, unknown> = {
      status: 'verified',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (role === 'owner') updateData.isOwner = true;
    if (role === 'renter') updateData.isRenter = true;
    if (role === 'admin') updateData.isAdmin = true;

    await adminDb.collection('users').doc(userId).update(updateData);

    return NextResponse.json({ 
      success: true, 
      message: `User ${userId} berhasil di-approve sebagai ${role}` 
    });
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    console.error('[API Error] approve-user:', error);

    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Token tidak valid' } },
        { status: 401 }
      );
    }

    if (error.code === 'auth/user-not-found') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User tidak ditemukan' } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
