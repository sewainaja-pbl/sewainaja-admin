import { Router } from 'express';
import { db } from '../lib/firebase-admin';
import { fail, ok } from '../lib/http';
import { ERROR_CODES } from '../errors';
import { requireAuth } from '../middleware/require-auth';
import { requireAdmin } from '../middleware/require-admin';
import { asyncHandler } from '../lib/async-handler';
import type { ItemCategoryDoc } from '../types/category';

export const categoriesRouter = Router();

/**
 * GET /categories
 * List semua kategori
 */
categoriesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const snapshot = await db.collection('item_categories').orderBy('id', 'asc').get();
    
    const categories = snapshot.docs.map((doc) => doc.data());
    return ok(res, categories, 'Daftar kategori berhasil diambil');
  }),
);

/**
 * POST /categories
 * Tambah kategori baru (Admin Only)
 */
categoriesRouter.post(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id, category, code, photoUrl, subcategories } = req.body;

    if (!id || !category || !code || !photoUrl || !Array.isArray(subcategories)) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Data kategori tidak lengkap atau tidak valid', 400);
    }

    const docId = String(id).trim();
    const docRef = db.collection('item_categories').doc(docId);
    
    const snapshot = await docRef.get();
    if (snapshot.exists) {
      return fail(res, ERROR_CODES.CONFLICT, 'Kategori dengan ID tersebut sudah ada', 409);
    }

    const categoryData: ItemCategoryDoc = {
      id: docId,
      category: String(category).trim(),
      code: String(code).trim(),
      photoUrl: String(photoUrl).trim(),
      subcategories: subcategories.map((s: unknown) => String(s).trim()),
    };

    await docRef.set(categoryData);

    return ok(res, categoryData, 'Kategori berhasil ditambahkan');
  }),
);

/**
 * PATCH /categories/:id
 * Update kategori (Admin Only)
 */
categoriesRouter.patch(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const categoryId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { category, code, photoUrl, subcategories } = req.body;

    const docRef = db.collection('item_categories').doc(String(categoryId));
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Kategori tidak ditemukan', 404);
    }

    const updates: Partial<ItemCategoryDoc> = {};

    if (category !== undefined) updates.category = String(category).trim();
    if (code !== undefined) updates.code = String(code).trim();
    if (photoUrl !== undefined) updates.photoUrl = String(photoUrl).trim();
    if (Array.isArray(subcategories)) {
      updates.subcategories = subcategories.map((s: unknown) => String(s).trim());
    }

    if (Object.keys(updates).length > 0) {
      await docRef.update(updates);
    }

    const updatedSnapshot = await docRef.get();
    return ok(res, updatedSnapshot.data(), 'Kategori berhasil diperbarui');
  }),
);

/**
 * DELETE /categories/:id
 * Hapus kategori (Admin Only)
 */
categoriesRouter.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const categoryId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const docRef = db.collection('item_categories').doc(String(categoryId));
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return fail(res, ERROR_CODES.NOT_FOUND, 'Kategori tidak ditemukan', 404);
    }

    await docRef.delete();
    return ok(res, { id: categoryId }, 'Kategori berhasil dihapus');
  }),
);
