export const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
    requestId: req.requestId
  });
};

export const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || error.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  const isOperational = Boolean(error.isOperational || statusCode < 500);
  const publicMessage = isOperational
    ? error.message
    : 'No se pudo procesar la solicitud.';

  if (!isProduction) {
    console.error('Request error:', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      message: error.message,
      stack: error.stack
    });
  }

  res.status(statusCode).json({
    success: false,
    message: publicMessage || 'No se pudo procesar la solicitud.',
    requestId: req.requestId,
    details: !isProduction && isOperational ? error.details || null : undefined
  });
};
