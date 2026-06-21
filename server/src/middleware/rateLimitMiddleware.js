import rateLimit from 'express-rate-limit';

const buildLimiter = ({ windowMs, limit, message }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      message
    }
  });

export const createRateLimit = ({
  windowMs = 60_000,
  maxRequests = 20,
  message = 'Demasiadas solicitudes. Intentá nuevamente en unos minutos.'
} = {}) => buildLimiter({ windowMs, limit: maxRequests, message });

export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 8,
  message: 'Demasiados intentos de acceso. Esperá unos minutos y volvé a intentar.'
});

export const registerRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  message: 'Demasiados registros desde esta conexión. Intentá más tarde.'
});

export const checkoutRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'Demasiadas solicitudes de checkout. Esperá un momento.'
});

export const adminRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: 'Demasiadas acciones administrativas. Esperá un momento.'
});
