import multer from 'multer';
import { cloudinary } from '../config/cloudinary.js';
import { ApiError } from '../utils/ApiError.js';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new ApiError(400, 'Solo se permiten imágenes'));
    cb(null, true);
  }
});

export const uploadToCloudinary = (fileBuffer, folder = 'materiales-fzac/products') => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'image' }, (error, result) => {
    if (error) return reject(error);
    resolve(result.secure_url);
  });
  stream.end(fileBuffer);
});
