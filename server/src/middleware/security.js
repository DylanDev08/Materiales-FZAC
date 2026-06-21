import rateLimit from 'express-rate-limit';
import xss from 'xss';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes. Probá nuevamente en unos minutos.' }
});

const cleanValue = (value) => {
  if (typeof value === 'string') return xss(value.trim());
  if (Array.isArray(value)) return value.map(cleanValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, cleanValue(val)]));
  }
  return value;
};

export const sanitizeBody = (req, _res, next) => {
  if (req.body && !Buffer.isBuffer(req.body)) req.body = cleanValue(req.body);
  if (req.query) req.query = cleanValue(req.query);
  next();
};
