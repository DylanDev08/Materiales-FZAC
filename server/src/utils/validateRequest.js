export const validateRequest = (schema) => {
  return (req, res, next) => {
    const errors = [];

    for (const rule of schema) {
      const value = req.body?.[rule.field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${rule.label || rule.field} es obligatorio`);
        continue;
      }

      if (value === undefined || value === null || value === '') {
        continue;
      }

      if (rule.type === 'string' && typeof value !== 'string') {
        errors.push(`${rule.label || rule.field} debe ser texto`);
      }

      if (rule.type === 'number' && !Number.isFinite(Number(value))) {
        errors.push(`${rule.label || rule.field} debe ser numérico`);
      }

      if (rule.minLength && String(value).length < rule.minLength) {
        errors.push(`${rule.label || rule.field} debe tener al menos ${rule.minLength} caracteres`);
      }

      if (rule.maxLength && String(value).length > rule.maxLength) {
        errors.push(`${rule.label || rule.field} no puede superar ${rule.maxLength} caracteres`);
      }

      if (rule.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(String(value))) {
          errors.push(`${rule.label || rule.field} no tiene un formato válido`);
        }
      }

      if (rule.oneOf && !rule.oneOf.includes(value)) {
        errors.push(`${rule.label || rule.field} tiene un valor inválido`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errors
      });
    }

    next();
  };
};