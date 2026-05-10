import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, role } = body; // role: 'owner', 'renter', 'admin'

    if (!userId || !role) {
      return NextResponse.json(
        { success: false, error: { message: 'Parameter userId dan role wajib diisi' } },
        { status: 400 }
      );
    }

    // Set custom claims (verified = true, dan role yang diminta)
    await adminAuth.setCustomUserClaims(userId, { [role]: true, verified: true });
    
    // Update status di Firestore
    const updateData: any = {
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
  } catch (error: any) {
    console.error('[API Error] approve-user:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}
