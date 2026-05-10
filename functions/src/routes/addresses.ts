import { Router } from 'express';
import admin from 'firebase-admin';
import { db, now } from '../lib/firebase-admin';
import { fail, ok } from '../lib/http';
import { ERROR_CODES } from '../errors';
import { requireAuth } from '../middleware/require-auth';
import { asyncHandler } from '../lib/async-handler';
import type { AddressDoc } from '../types/address';

export const addressesRouter = Router();

// Apply requireAuth to all routes in this router
addressesRouter.use(requireAuth);

/**
 * Helper to ensure only one address is default for a user.
 * If setting newAddressId as default, update all other default addresses to false.
 */
const setAsDefaultTransaction = async (uid: string, targetAddressId: string) => {
  const addressesRef = db.collection('users').doc(uid).collection('addresses');
  const defaultsQuery = await addressesRef.where('isDefault', '==', true).get();

  const batch = db.batch();
  
  // Set others to false
  defaultsQuery.docs.forEach((doc) => {
    if (doc.id !== targetAddressId) {
      batch.update(doc.ref, { 
        isDefault: false,
        updatedAt: now() 
      });
    }
  });

  // Set target to true
  batch.update(addressesRef.doc(targetAddressId), { 
    isDefault: true,
    updatedAt: now() 
  });

  await batch.commit();
};

/**
 * GET /addresses
 * List alamat tersimpan milik user
 */
addressesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const snapshot = await db
      .collection('users')
      .doc(uid)
      .collection('addresses')
      .orderBy('isDefault', 'desc')
      .orderBy('createdAt', 'desc')
      .get();

    const addresses = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return ok(res, addresses, 'Daftar alamat berhasil diambil');
  }),
);

/**
 * POST /addresses
 * Tambah alamat baru
 */
addressesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const { label, fullAddress, latitude, longitude, isDefault } = req.body;

    if (!label || !fullAddress || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Data alamat tidak lengkap atau tidak valid', 400);
    }

    const addressesRef = db.collection('users').doc(uid).collection('addresses');
    
    // Check if user has any addresses. If this is the first, force isDefault = true.
    const countSnap = await addressesRef.limit(1).get();
    const isFirstAddress = countSnap.empty;
    const shouldBeDefault = isFirstAddress ? true : (isDefault === true);

    const newDocRef = addressesRef.doc();
    const geoPoint = new admin.firestore.GeoPoint(latitude, longitude);

    const addressData: Omit<AddressDoc, 'id'> = {
      label: String(label).trim(),
      fullAddress: String(fullAddress).trim(),
      coordinat: geoPoint,
      isDefault: shouldBeDefault,
      createdAt: now(),
      updatedAt: now(),
    };

    if (shouldBeDefault && !isFirstAddress) {
      // We need to clear existing defaults first. Let's do it sequentially for simplicity, or write batch.
      const batch = db.batch();
      const defaultsQuery = await addressesRef.where('isDefault', '==', true).get();
      
      defaultsQuery.docs.forEach((doc) => {
        batch.update(doc.ref, { isDefault: false, updatedAt: now() });
      });
      
      batch.set(newDocRef, addressData);
      await batch.commit();
    } else {
      await newDocRef.set(addressData);
    }

    return ok(res, { id: newDocRef.id, ...addressData }, 'Alamat berhasil ditambahkan');
  }),
);

/**
 * PATCH /addresses/:id
 * Update alamat
 */
addressesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const addressId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { label, fullAddress, latitude, longitude, isDefault } = req.body;

    const docRef = db.collection('users').doc(uid).collection('addresses').doc(addressId);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Alamat tidak ditemukan', 404);
    }

    const updates: Record<string, any> = {
      updatedAt: now(),
    };

    if (typeof label === 'string') updates.label = label.trim();
    if (typeof fullAddress === 'string') updates.fullAddress = fullAddress.trim();
    
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      updates.coordinat = new admin.firestore.GeoPoint(latitude, longitude);
    } else if ((latitude !== undefined && typeof latitude !== 'number') || (longitude !== undefined && typeof longitude !== 'number')) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Koordinat harus bernilai angka', 400);
    }

    // Handle isDefault update
    if (isDefault === true) {
      // Need atomicity to update current doc and other defaults
      const batch = db.batch();
      const addressesRef = db.collection('users').doc(uid).collection('addresses');
      const defaultsQuery = await addressesRef.where('isDefault', '==', true).get();
      
      defaultsQuery.docs.forEach((doc) => {
        if (doc.id !== addressId) {
          batch.update(doc.ref, { isDefault: false, updatedAt: now() });
        }
      });
      
      updates.isDefault = true;
      batch.update(docRef, updates);
      await batch.commit();
    } else if (isDefault === false) {
      // Cannot set false if it is currently the ONLY address or if user won't have default.
      // For simpler flow, we prevent setting false directly via PATCH /:id. 
      // User must set ANOTHER address to default.
      // But let's just allow it for raw data flexibility, OR check if it's currently default.
      const currentData = snapshot.data();
      if (currentData?.isDefault === true) {
        return fail(res, ERROR_CODES.CONFLICT, 'Anda harus memiliki minimal satu alamat utama. Silakan tentukan alamat utama lain terlebih dahulu.', 409);
      }
      updates.isDefault = false;
      await docRef.update(updates);
    } else {
      // Just standard field updates
      await docRef.update(updates);
    }

    const updatedSnapshot = await docRef.get();
    return ok(res, { id: addressId, ...updatedSnapshot.data() }, 'Alamat berhasil diperbarui');
  }),
);

/**
 * DELETE /addresses/:id
 * Hapus alamat
 */
addressesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const addressId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const docRef = db.collection('users').doc(uid).collection('addresses').doc(addressId);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Alamat tidak ditemukan', 404);
    }

    const addressData = snapshot.data();
    if (addressData?.isDefault === true) {
      return fail(res, ERROR_CODES.CONFLICT, 'Tidak dapat menghapus alamat utama. Silakan tentukan alamat utama lain terlebih dahulu.', 409);
    }

    await docRef.delete();
    return ok(res, { id: addressId }, 'Alamat berhasil dihapus');
  }),
);

/**
 * PATCH /addresses/:id/default
 * Set sebagai alamat default
 */
addressesRouter.patch(
  '/:id/default',
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const addressId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const docRef = db.collection('users').doc(uid).collection('addresses').doc(addressId);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Alamat tidak ditemukan', 404);
    }

    await setAsDefaultTransaction(uid, addressId);
    
    const updatedSnapshot = await docRef.get();
    return ok(res, { id: addressId, ...updatedSnapshot.data() }, 'Alamat utama berhasil diubah');
  }),
);
