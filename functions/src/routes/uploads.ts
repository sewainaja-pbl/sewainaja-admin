import { Router, type Request } from 'express';
import multer from 'multer';
import { ERROR_CODES } from '../errors';
import { fail, ok } from '../lib/http';
import { requireAuth } from '../middleware/require-auth';
import { asyncHandler } from '../lib/async-handler';
import { uploadToCloudinary } from '../lib/cloudinary';

export const uploadsRouter = Router();

const MAX_FILE_BYTES = Number(process.env.UPLOAD_MAX_FILE_BYTES || 5 * 1024 * 1024); // 5 MB default
const ALLOWED_KINDS = new Set(['profile', 'item', 'evidence', 'chat', 'kyc', 'dispute', 'category']);

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

const safeKind = (value: unknown) => {
  const kind = String(value || 'misc').trim().toLowerCase();
  return ALLOWED_KINDS.has(kind) ? kind : 'misc';
};

const imageInfoFromBuffer = (buffer: Buffer, mime: string) => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: '.jpg', mime: 'image/jpeg' };
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: '.png', mime: 'image/png' };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: '.webp', mime: 'image/webp' };
  }
  if (mime.startsWith('image/')) {
    if (mime === 'image/png') return { ext: '.png', mime };
    if (mime === 'image/webp') return { ext: '.webp', mime };
    return { ext: '.jpg', mime: 'image/jpeg' };
  }
  return null;
};

/**
 * POST /uploads/image
 * Upload gambar ke Cloudinary. Multipart field: "file" (required), "kind" (optional).
 * Mengembalikan secure_url Cloudinary sebagai field "url".
 */
uploadsRouter.post(
  '/image',
  requireAuth,
  (req, res, next) => {
    memoryUpload.single('file')(req, res, (error: any) => {
      if (!error) return next();
      if (error?.code === 'LIMIT_FILE_SIZE') {
        return fail(res, ERROR_CODES.INVALID_INPUT, `Ukuran foto maksimal ${MAX_FILE_BYTES / (1024 * 1024)} MB`, 400);
      }
      if (error?.message === 'ONLY_IMAGES_ALLOWED') {
        return fail(res, ERROR_CODES.INVALID_INPUT, 'File harus berupa gambar', 400);
      }
      return fail(res, ERROR_CODES.INVALID_INPUT, 'Upload foto tidak valid', 400);
    });
  },
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'File foto wajib diisi dengan field multipart "file"', 400);
    }

    const imageInfo = imageInfoFromBuffer(file.buffer, file.mimetype);
    if (!imageInfo) {
      return fail(res, ERROR_CODES.INVALID_INPUT, 'File harus berupa gambar (JPG, PNG, atau WebP)', 400);
    }

    const kind = safeKind(req.body?.kind);
    const userId = req.user!.uid;

    // Upload ke Cloudinary dengan folder terstruktur: sewainaja/{kind}/{userId}
    const result = await uploadToCloudinary(file.buffer, {
      folder: `sewainaja/${kind}/${userId}`,
    });

    return ok(
      res,
      {
        url: result.secure_url,
        publicId: result.public_id,
        path: result.public_id,
        kind,
        size: file.size,
        limitBytes: MAX_FILE_BYTES,
      },
      'Foto berhasil diunggah ke Cloudinary',
    );
  }),
);
