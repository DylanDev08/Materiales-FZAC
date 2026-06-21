import { prisma } from '../config/db.js';

const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
};

export const logAudit = async ({
  req,
  action,
  entity,
  entityId = null,
  message,
  metadata = null
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id || null,
        actorEmail: req.user?.email || null,
        actorRole: req.user?.role || null,

        action,
        entity,
        entityId,

        message,
        metadata,

        ip: getClientIp(req),
        userAgent: req.headers['user-agent'] || null
      }
    });
  } catch (error) {
    console.error('Audit log failed:', error.message);
  }
};