import { Router } from 'express';
import { prisma } from '../config/db.js';
import { protect } from '../middleware/authMiddleware.js';

export const notificationRoutes = Router();

notificationRoutes.use(protect);

const asyncRoute = (handler) => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

const serializeNotification = (notification) => {
  return {
    id: notification.id,
    userId: notification.userId,
    orderId: notification.orderId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    linkTo: notification.linkTo,
    read: notification.read,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt
  };
};

notificationRoutes.get(
  '/',
  asyncRoute(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          {
            userId: req.user.id
          },
          {
            userId: null
          }
        ]
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });

    res.json({
      success: true,
      data: {
        notifications: notifications.map(serializeNotification)
      }
    });
  })
);

notificationRoutes.get(
  '/unread-count',
  asyncRoute(async (req, res) => {
    const count = await prisma.notification.count({
      where: {
        userId: req.user.id,
        read: false
      }
    });

    res.json({
      success: true,
      data: {
        count
      }
    });
  })
);

notificationRoutes.patch(
  '/:id/read',
  asyncRoute(async (req, res) => {
    const notification = await prisma.notification.findFirst({
      where: {
        id: req.params.id,
        OR: [
          {
            userId: req.user.id
          },
          {
            userId: null
          }
        ]
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }

    const updatedNotification = await prisma.notification.update({
      where: {
        id: notification.id
      },
      data: {
        read: true
      }
    });

    res.json({
      success: true,
      data: {
        notification: serializeNotification(updatedNotification)
      }
    });
  })
);

notificationRoutes.patch(
  '/read-all',
  asyncRoute(async (req, res) => {
    await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        read: false
      },
      data: {
        read: true
      }
    });

    res.json({
      success: true,
      message: 'Notificaciones marcadas como leídas'
    });
  })
);

notificationRoutes.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    const notification = await prisma.notification.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      });
    }

    await prisma.notification.delete({
      where: {
        id: notification.id
      }
    });

    res.json({
      success: true,
      message: 'Notificación eliminada'
    });
  })
);

export default notificationRoutes;