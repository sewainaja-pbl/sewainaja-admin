import { v2 as cloudinary } from 'cloudinary';

// Konfigurasi Cloudinary — baca dari environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export type CloudinaryUploadResult = {
  secure_url: string;
  public_id: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};

/**
 * Upload buffer gambar ke Cloudinary.
 * @param buffer - Data gambar dalam bentuk Buffer
 * @param options.folder - Folder tujuan di Cloudinary (contoh: 'sewainaja/item/uid123')
 * @param options.publicId - Public ID opsional; jika tidak diisi, Cloudinary auto-generate
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  options: {
    folder: string;
    publicId?: string;
    resourceType?: 'image' | 'video' | 'raw' | 'auto';
  },
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const uploadOptions: Record<string, unknown> = {
      folder: options.folder,
      resource_type: options.resourceType ?? 'image',
      // f_auto dan q_auto diterapkan di URL transform, bukan saat upload
    };

    if (options.publicId) {
      uploadOptions.public_id = options.publicId;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          return reject(new Error(`Cloudinary upload error: ${error.message}`));
        }
        if (!result) {
          return reject(new Error('Cloudinary upload returned empty result'));
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      },
    );

    uploadStream.end(buffer);
  });
}

/**
 * Hapus file dari Cloudinary berdasarkan public_id.
 * Tidak melempar error jika file tidak ditemukan.
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch {
    // Tidak blokir proses jika delete gagal
    console.warn(`[Cloudinary] Gagal menghapus file: ${publicId}`);
  }
}
