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
  message = 'Demasiadas solicitudes. Intenta nuevamente en unos minutos.'
} = {}) => buildLimiter({ windowMs, limit: maxRequests, message });

export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 8,
  message: 'Demasiados intentos de acceso. Espera unos minutos y volve a intentar.'
});

export const loginRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: 'Demasiados intentos de ingreso. Espera unos minutos y volve a intentar.'
});

export const registerRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  message: 'Demasiados registros desde esta conexion. Intenta mas tarde.'
});

export const checkoutRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'Demasiadas solicitudes de checkout. Espera un momento.'
});

export const adminRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: 'Demasiadas acciones administrativas. Espera un momento.'
});
