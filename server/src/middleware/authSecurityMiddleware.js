const suspiciousPattern = /(<script|javascript:|onerror=|onload=|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bunion\b|--|;|\/\*|\*\/)/i;

const getStringValues = (body = {}) => {
  return Object.entries(body)
    .filter(([key, value]) => !['password'].includes(key) && typeof value === 'string')
    .map(([, value]) => value);
};

export const authBotGuard = (req, res, next) => {
  const body = req.body || {};

  const honeypot =
    body.website ||
    body.company ||
    body.companyConfirmation ||
    body['company-confirmation'] ||
    body.url ||
    body.nickname;

  if (honeypot) {
    return res.status(400).json({
      success: false,
      message: 'No pudimos validar la solicitud.'
    });
  }

  const clientStartedAt = Number(body.clientStartedAt || 0);

  if (clientStartedAt && Date.now() - clientStartedAt < 700) {
    return res.status(400).json({
      success: false,
      message: 'Validacion de seguridad incompleta. Intenta nuevamente.'
    });
  }

  const values = getStringValues(body);
  const hasSuspiciousText = values.some((value) => suspiciousPattern.test(value));

  if (hasSuspiciousText) {
    return res.status(400).json({
      success: false,
      message: 'La solicitud contiene caracteres no permitidos.'
    });
  }

  next();
};
