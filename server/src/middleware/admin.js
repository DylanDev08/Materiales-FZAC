import { ApiError } from '../utils/ApiError.js';

export const admin = (req, _res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(new ApiError(403, 'Acceso exclusivo para administradores'));
  }
  next();
};
