import rateLimit from 'express-rate-limit';

const buildLimiter = ({ windowMs, limit, message, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
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
  message = 'Demasiadas solicitudes. Intenta nuevamente en unos minutos.',
  skipSuccessfulRequests = false
} = {}) => buildLimiter({ windowMs, limit: maxRequests, message, skipSuccessfulRequests });

export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 8,
  message: 'Demasiados intentos de acceso. Espera unos minutos y volve a intentar.'
});

export const loginRateLimit = createRateLimit({
  windowMs: 5 * 60 * 1000,
  maxRequests: 20,
  skipSuccessfulRequests: true,
  message: 'Demasiados intentos de ingreso. Espera un minuto y volve a intentar.'
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
