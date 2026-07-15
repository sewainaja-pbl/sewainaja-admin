import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router, type Request } from 'express';
import multer from 'multer';
import { ERROR_CODES } from '../errors';
import { fail, ok } from '../lib/http';
import { requireAuth } from '../middleware/require-auth';
import { asyncHandler } from '../lib/async-handler';

export const uploadsRouter = Router();

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || '/var/www/sewainaja-uploads';
const PUBLIC_UPLOAD_PATH = '/uploads';
const MAX_FILE_BYTES = Number(process.env.UPLOAD_MAX_FILE_BYTES || 1 * 1024 * 1024);
const MAX_TOTAL_BYTES = Number(process.env.UPLOAD_MAX_TOTAL_BYTES || 200 * 1024 * 1024);
const ALLOWED_KINDS = new Set(['profile', 'item', 'evidence', 'chat', 'kyc', 'dispute']);
const MAX_FILES_TO_DELETE_PER_REQUEST = 50;

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

type StoredFile = {
  fullPath: string;
  size: number;
  mtimeMs: number;
};

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

const publicBaseUrl = (req: Request) => {
  const configured = process.env.PUBLIC_API_BASE_URL?.replace(/\/+$/, '');
  if (configured) return configured;

  const proto = req.header('x-forwarded-proto') || req.protocol || 'https';
  const host = req.header('x-forwarded-host') || req.header('host') || 'sewainaja-api.ghufronainun.tech';
  return `${proto}://${host}`;
};

const collectFiles = async (dir: string): Promise<StoredFile[]> => {
  let entries: Array<import('node:fs').Dirent> = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const files: StoredFile[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
      continue;
    }
    if (!entry.isFile()) continue;
    const stat = await fs.stat(fullPath);
    files.push({ fullPath, size: stat.size, mtimeMs: stat.mtimeMs });
  }
  return files;
};

const enforceQuota = async () => {
  const files = await collectFiles(UPLOAD_ROOT);
  let total = files.reduce((sum, file) => sum + file.size, 0);
  if (total <= MAX_TOTAL_BYTES) return { deleted: 0, totalBytes: total };

  const oldest = files.sort((a, b) => a.mtimeMs - b.mtimeMs);
  let deleted = 0;
  for (const file of oldest) {
    if (total <= MAX_TOTAL_BYTES) break;
    if (deleted >= MAX_FILES_TO_DELETE_PER_REQUEST) break;
    await fs.unlink(file.fullPath).catch(() => undefined);
    total -= file.size;
    deleted += 1;
  }
  return { deleted, totalBytes: total };
};

uploadsRouter.post(
  '/image',
  requireAuth,
  (req, res, next) => {
    memoryUpload.single('file')(req, res, (error: any) => {
      if (!error) return next();
      if (error?.code === 'LIMIT_FILE_SIZE') {
        return fail(res, ERROR_CODES.INVALID_INPUT, 'Ukuran foto maksimal 1 MB', 400);
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
      return fail(res, ERROR_CODES.INVALID_INPUT, 'File harus berupa gambar', 400);
    }

    const kind = safeKind(req.body?.kind);
    const userId = req.user!.uid;
    const filename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${imageInfo.ext}`;
    const relativePath = path.join(kind, userId, filename);
    const fullPath = path.join(UPLOAD_ROOT, relativePath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.buffer, { flag: 'wx' });
    const quota = await enforceQuota();

    const urlPath = `${PUBLIC_UPLOAD_PATH}/${kind}/${userId}/${filename}`;
    return ok(
      res,
      {
        url: `${publicBaseUrl(req)}${urlPath}`,
        path: urlPath,
        kind,
        size: file.size,
        limitBytes: MAX_FILE_BYTES,
        quotaBytes: MAX_TOTAL_BYTES,
        quotaDeletedFiles: quota.deleted,
      },
      'Foto berhasil diunggah ke fallback VPS',
    );
  }),
);
