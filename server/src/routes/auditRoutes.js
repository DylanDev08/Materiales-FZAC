import { Router } from 'express';
import { prisma } from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

export const auditRoutes = Router();

auditRoutes.use(protect);
auditRoutes.use(adminOnly);

const asyncRoute = (handler) => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

const serializeAudit = (audit) => {
  return {
    id: audit.id,

    actorId: audit.actorId,
    actorEmail: audit.actorEmail,
    actorRole: audit.actorRole,

    action: audit.action,
    entity: audit.entity,
    entityId: audit.entityId,

    message: audit.message,
    metadata: audit.metadata,

    ip: audit.ip,
    userAgent: audit.userAgent,

    createdAt: audit.createdAt
  };
};

auditRoutes.get(
  '/',
  asyncRoute(async (req, res) => {
    const {
      action,
      entity,
      actorEmail,
      entityId,
      page = 1,
      limit = 50
    } = req.query;

    const currentPage = Math.max(Number(page || 1), 1);
    const take = Math.min(Math.max(Number(limit || 50), 1), 100);
    const skip = (currentPage - 1) * take;

    const where = {};

    if (action) where.action = String(action);
    if (entity) where.entity = String(entity);
    if (entityId) where.entityId = String(entityId);

    if (actorEmail) {
      where.actorEmail = {
        contains: String(actorEmail),
        mode: 'insensitive'
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: {
          createdAt: 'desc'
        }
      }),

      prisma.auditLog.count({
        where
      })
    ]);

    res.json({
      success: true,
      data: {
        logs: logs.map(serializeAudit),
        pagination: {
          page: currentPage,
          limit: take,
          total,
          pages: Math.ceil(total / take)
        }
      }
    });
  })
);

auditRoutes.get(
  '/summary',
  asyncRoute(async (req, res) => {
    const [total, latest, byActionRaw, byEntityRaw] = await Promise.all([
      prisma.auditLog.count(),

      prisma.auditLog.findMany({
        take: 10,
        orderBy: {
          createdAt: 'desc'
        }
      }),

      prisma.auditLog.groupBy({
        by: ['action'],
        _count: {
          action: true
        }
      }),

      prisma.auditLog.groupBy({
        by: ['entity'],
        _count: {
          entity: true
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        total,
        latest: latest.map(serializeAudit),
        byAction: byActionRaw.map((item) => ({
          action: item.action,
          count: item._count.action
        })),
        byEntity: byEntityRaw.map((item) => ({
          entity: item.entity,
          count: item._count.entity
        }))
      }
    });
  })
);

auditRoutes.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const audit = await prisma.auditLog.findUnique({
      where: {
        id: req.params.id
      }
    });

    if (!audit) {
      return res.status(404).json({
        success: false,
        message: 'Registro de auditoría no encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        audit: serializeAudit(audit)
      }
    });
  })
);

export default auditRoutes;