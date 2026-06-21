import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';

export const validate = (req, _res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  next(new ApiError(422, 'Datos inválidos', result.array()));
};
