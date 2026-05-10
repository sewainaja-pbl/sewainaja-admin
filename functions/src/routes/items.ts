import { Router } from 'express';
import admin from 'firebase-admin';
import { db, now } from '../lib/firebase-admin';
import { fail, ok } from '../lib/http';
import { ERROR_CODES } from '../errors';
import { requireAuth } from '../middleware/require-auth';
import { asyncHandler } from '../lib/async-handler';
import ngeohash from 'ngeohash';
import type { ItemDoc, ItemStatus, ItemCondition } from '../types/item';

export const itemsRouter = Router();

/**
 * Validasi status item
 */
const isValidStatus = (status: any): status is ItemStatus => {
  return ['available', 'inactive', 'archived'].includes(status);
};

/**
 * Validasi condition item
 */
const isValidCondition = (condition: any): condition is ItemCondition => {
  return ['new', 'like-new', 'fair', 'poor'].includes(condition);
};

/**
 * Haversine formula for distance (in km)
 */
const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calculate bounding box for a given center point and radius (in km)
 * Returns [minLat, minLon, maxLat, maxLon]
 */
const getBoundingBox = (lat: number, lon: number, radiusKm: number) => {
  const latRadian = radiusKm / 111.32;
  const lonRadian = radiusKm / (111.32 * Math.cos(lat * (Math.PI / 180)));
  return {
    minLat: lat - latRadian,
    maxLat: lat + latRadian,
    minLon: lon - lonRadian,
    maxLon: lon + lonRadian,
  };
};

/**
 * GET /items
 * List barang nearby (query: lat, lng, radius km, category)
 */
itemsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = parseFloat(req.query.radius as string) || 5; // Default 5 km
    const categoryId = req.query.category as string;

    if (isNaN(lat) || isNaN(lng)) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Parameter lat dan lng wajib diisi dengan format angka', 400);
    }

    const { minLat, minLon, maxLat, maxLon } = getBoundingBox(lat, lng, radius);
    
    // We use a precision that covers roughly our radius to minimize number of queries or just query by prefix
    // For simplicity, we can just fetch items within a geohash bounding box.
    // ngeohash.bboxes returns an array of geohashes that intersect the bounding box
    // A more practical approach in Firestore without 'in' array limit is to query by a shorter geohash prefix.
    const centerHash = ngeohash.encode(lat, lng, 4); // precision 4 is ~20km x 20km

    let query = db.collection('items')
      .where('status', '==', 'available');

    if (categoryId) {
      query = query.where('categoryId', '==', categoryId);
    }

    // Basic geohash prefix query - fetching items that share the same prefix (coarse filtering)
    // To properly support exact radius, we should use geofire-common, but for now we filter in-memory.
    // Alternatively we fetch all items with prefix and filter.
    // For this implementation, we will fetch items matching the prefix and do Haversine filter in memory.
    const snapshot = await query
      .where('address.geohash', '>=', centerHash)
      .where('address.geohash', '<=', centerHash + '~')
      .get();

    const items = snapshot.docs
      .map(doc => {
        const data = doc.data() as ItemDoc;
        const coords = data.address.coordinat as any; // admin.firestore.GeoPoint
        const distance = getDistanceFromLatLonInKm(lat, lng, coords.latitude, coords.longitude);
        return { ...data, id: doc.id, distance };
      })
      .filter(item => item.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    return ok(res, items, 'Daftar barang berhasil diambil');
  }),
);

/**
 * GET /items/mine
 * List barang milik user sendiri
 */
itemsRouter.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const snapshot = await db.collection('items')
      .where('ownerId', '==', uid)
      .where('status', '!=', 'archived')
      .orderBy('status')
      .orderBy('createdAt', 'desc')
      .get();

    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return ok(res, items, 'Daftar barang Anda berhasil diambil');
  }),
);

/**
 * GET /items/:id
 * Detail barang
 */
itemsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const snapshot = await db.collection('items').doc(String(id)).get();

    if (!snapshot.exists || snapshot.data()?.status === 'archived') {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Barang tidak ditemukan', 404);
    }

    return ok(res, { id: snapshot.id, ...snapshot.data() }, 'Detail barang berhasil diambil');
  }),
);

/**
 * POST /items
 * Buat listing barang baru
 */
itemsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const { 
      categoryId, name, description, pricePerHour, 
      estimatedValue, condition, addressId 
    } = req.body;

    if (!categoryId || !name || typeof pricePerHour !== 'number' || typeof estimatedValue !== 'number' || !isValidCondition(condition) || !addressId) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Data barang tidak lengkap atau tidak valid', 400);
    }

    // Fetch user details for denormalization
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Profil pemilik tidak ditemukan', 404);
    }
    const userData = userSnap.data() as any;

    // Fetch category details for denormalization
    const catSnap = await db.collection('item_categories').doc(String(categoryId)).get();
    if (!catSnap.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Kategori tidak ditemukan', 404);
    }
    const catData = catSnap.data() as any;

    // Fetch address details for embedding
    const addrSnap = await db.collection('users').doc(uid).collection('addresses').doc(String(addressId)).get();
    if (!addrSnap.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Alamat tidak ditemukan', 404);
    }
    const addrData = addrSnap.data() as any;

    const lat = addrData.coordinat.latitude;
    const lng = addrData.coordinat.longitude;
    const geohashStr = ngeohash.encode(lat, lng, 9);

    // Generate unique QR code token
    const qrCodeToken = `QR_${uid}_${Date.now()}`;

    const itemData: Omit<ItemDoc, 'id'> = {
      ownerId: uid,
      categoryId: String(categoryId),
      name: String(name).trim(),
      description: String(description || '').trim(),
      pricePerHour,
      estimatedValue,
      status: 'available',
      condition,
      photos: [],
      qrCodeToken,
      createdAt: now(),
      updatedAt: now(),
      address: {
        addressId: String(addressId),
        label: addrData.label,
        fullAddress: addrData.fullAddress,
        coordinat: addrData.coordinat,
        geohash: geohashStr,
      },
      ownerName: userData.name,
      ownerRating: userData.avgRatingAsOwner || 0,
      categoryName: catData.category,
      categoryPhotoUrl: catData.photoUrl,
    };

    const docRef = await db.collection('items').add(itemData);

    return ok(res, { id: docRef.id, ...itemData }, 'Barang berhasil ditambahkan');
  }),
);

/**
 * PATCH /items/:id
 * Update listing
 */
itemsRouter.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, description, pricePerHour, estimatedValue, condition, status } = req.body;

    const docRef = db.collection('items').doc(String(id));
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Barang tidak ditemukan', 404);
    }

    const itemData = snapshot.data() as ItemDoc;
    if (itemData.ownerId !== uid && !req.user!.claims.admin) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Anda tidak berhak mengubah barang ini', 403);
    }

    if (itemData.status === 'archived') {
      return fail(res, ERROR_CODES.CONFLICT, 'Barang yang sudah dihapus (archived) tidak dapat diubah', 409);
    }

    const updates: Partial<ItemDoc> = { updatedAt: now() };

    if (name !== undefined) updates.name = String(name).trim();
    if (description !== undefined) updates.description = String(description).trim();
    if (typeof pricePerHour === 'number') updates.pricePerHour = pricePerHour;
    if (typeof estimatedValue === 'number') updates.estimatedValue = estimatedValue;
    if (condition !== undefined && isValidCondition(condition)) updates.condition = condition;
    if (status !== undefined && isValidStatus(status)) updates.status = status;

    if (Object.keys(updates).length > 1) { // 1 is updatedAt
      await docRef.update(updates);
    }

    const updatedSnapshot = await docRef.get();
    return ok(res, { id, ...updatedSnapshot.data() }, 'Barang berhasil diperbarui');
  }),
);

/**
 * DELETE /items/:id
 * Soft-delete listing (status → archived)
 */
itemsRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const docRef = db.collection('items').doc(String(id));
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Barang tidak ditemukan', 404);
    }

    const itemData = snapshot.data() as ItemDoc;
    if (itemData.ownerId !== uid && !req.user!.claims.admin) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Anda tidak berhak menghapus barang ini', 403);
    }

    await docRef.update({ 
      status: 'archived',
      updatedAt: now() 
    });

    return ok(res, { id }, 'Barang berhasil dihapus');
  }),
);

/**
 * POST /items/:id/photos
 * Upload foto barang
 */
itemsRouter.post(
  '/:id/photos',
  requireAuth,
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { photoUrl } = req.body;

    if (!photoUrl || typeof photoUrl !== 'string') {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'URL foto tidak valid', 400);
    }

    const docRef = db.collection('items').doc(String(id));
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Barang tidak ditemukan', 404);
    }

    const itemData = snapshot.data() as ItemDoc;
    if (itemData.ownerId !== uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Anda tidak berhak menambahkan foto pada barang ini', 403);
    }

    const updatedPhotos = [...(itemData.photos || []), photoUrl.trim()];

    await docRef.update({ 
      photos: updatedPhotos,
      updatedAt: now()
    });

    return ok(res, { photos: updatedPhotos }, 'Foto berhasil ditambahkan');
  }),
);

/**
 * DELETE /items/:id/photos/:photoId
 * Hapus foto barang (photoId di sini adalah base64 encoded URL atau kita kirim url lewat body)
 * Agar konsisten dengan REST, photoId di path seringkali URL safe, tapi karena URL ribet di path, 
 * kita fallback ambil dari index atau query params saja.
 * Di sini kita asumsikan photoId adalah URL encoded, atau lebih baik URL foto yang dikirim di body bila DELETE mensupport body (tidak ideal), 
 * atau by index.
 * Kita akan pakai encoded URL.
 */
itemsRouter.delete(
  '/:id/photos/:encodedPhotoUrl',
  requireAuth,
  asyncHandler(async (req, res) => {
    const uid = req.user!.uid;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const encodedPhotoUrl = Array.isArray(req.params.encodedPhotoUrl) ? req.params.encodedPhotoUrl[0] : req.params.encodedPhotoUrl;
    
    if (!encodedPhotoUrl) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Parameter foto tidak valid', 400);
    }

    const photoUrl = decodeURIComponent(String(encodedPhotoUrl));

    const docRef = db.collection('items').doc(String(id));
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Barang tidak ditemukan', 404);
    }

    const itemData = snapshot.data() as ItemDoc;
    if (itemData.ownerId !== uid) {
      return fail(res, ERROR_CODES.FORBIDDEN, 'Anda tidak berhak menghapus foto pada barang ini', 403);
    }

    const updatedPhotos = (itemData.photos || []).filter(url => url !== photoUrl);

    await docRef.update({ 
      photos: updatedPhotos,
      updatedAt: now()
    });

    return ok(res, { photos: updatedPhotos }, 'Foto berhasil dihapus');
  }),
);
