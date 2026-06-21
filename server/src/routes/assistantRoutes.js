import { Router } from 'express';

import { prisma } from '../config/db.js';
import { assistantService } from '../services/assistantService.js';
import { optionalAuth, protect, adminOnly } from '../middleware/authMiddleware.js';
import { createRateLimit } from '../middleware/rateLimitMiddleware.js';
import { validateRequest } from '../utils/validateRequest.js';

export const assistantRoutes = Router();

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const assistantRateLimit = createRateLimit({
  windowMs: 10 * 60 * 1000,
  maxRequests: 20,
  keyPrefix: 'assistant',
  message: 'Llegaste al limite de mensajes del asistente. Espera un momento y volve a intentar.'
});

const chatValidation = validateRequest([
  { field: 'message', label: 'Mensaje', required: true, type: 'string', minLength: 2, maxLength: 1200 },
  { field: 'visitorId', label: 'Identificador de visitante', type: 'string', maxLength: 120 },
  { field: 'conversationId', label: 'Conversacion', type: 'string', maxLength: 80 }
]);

assistantRoutes.post(
  '/chat',
  assistantRateLimit,
  optionalAuth,
  chatValidation,
  asyncRoute(async (req, res) => {
    const data = await assistantService.chat({
      message: String(req.body.message).trim(),
      conversationId: req.body.conversationId || null,
      visitorId: req.body.visitorId || null,
      user: req.user || null
    });

    res.status(201).json({ success: true, data });
  })
);

assistantRoutes.get(
  '/conversations',
  protect,
  asyncRoute(async (req, res) => {
    const conversations = await prisma.chatConversation.findMany({
      where: { userId: req.user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({ success: true, data: conversations });
  })
);

assistantRoutes.get(
  '/conversations/:id',
  protect,
  asyncRoute(async (req, res) => {
    const conversation = await prisma.chatConversation.findFirst({
      where: {
        id: req.params.id,
        ...(req.user.role === 'ADMIN' ? {} : { userId: req.user.id })
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        assignedAdmin: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversacion no encontrada' });
    }

    res.json({ success: true, data: conversation });
  })
);

assistantRoutes.post(
  '/conversations/:id/request-admin',
  protect,
  asyncRoute(async (req, res) => {
    const conversation = await prisma.chatConversation.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversacion no encontrada' });
    }

    const updated = await prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { channel: 'SUPPORT', status: 'WAITING_ADMIN', lastMessageAt: new Date() }
    });

    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'SYSTEM',
        content: 'La conversacion fue derivada a atencion FZAC.'
      }
    });

    res.json({ success: true, data: updated });
  })
);

assistantRoutes.post(
  '/conversations/:id/message',
  protect,
  assistantRateLimit,
  validateRequest([
    { field: 'message', label: 'Mensaje', required: true, type: 'string', minLength: 1, maxLength: 2000 }
  ]),
  asyncRoute(async (req, res) => {
    const conversation = await prisma.chatConversation.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversacion no encontrada' });
    }

    const message = await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: req.user.id,
        role: 'USER',
        content: String(req.body.message).trim()
      }
    });

    await prisma.chatConversation.update({
      where: { id: conversation.id },
      data: {
        channel: conversation.channel === 'SUPPORT' ? 'SUPPORT' : 'AI',
        status: conversation.channel === 'SUPPORT' ? 'WAITING_ADMIN' : conversation.status,
        lastMessageAt: new Date()
      }
    });

    res.status(201).json({ success: true, data: message });
  })
);

assistantRoutes.get(
  '/admin/conversations',
  protect,
  adminOnly,
  asyncRoute(async (req, res) => {
    const conversations = await prisma.chatConversation.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        assignedAdmin: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' }, take: 120 }
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 200
    });

    res.json({ success: true, data: conversations });
  })
);

assistantRoutes.post(
  '/admin/conversations/:id/reply',
  protect,
  adminOnly,
  validateRequest([
    { field: 'message', label: 'Mensaje', required: true, type: 'string', minLength: 1, maxLength: 2000 }
  ]),
  asyncRoute(async (req, res) => {
    const conversation = await prisma.chatConversation.findUnique({ where: { id: req.params.id } });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversacion no encontrada' });
    }

    const message = await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: req.user.id,
        role: 'ADMIN',
        content: String(req.body.message).trim()
      }
    });

    await prisma.chatConversation.update({
      where: { id: conversation.id },
      data: {
        assignedAdminId: req.user.id,
        channel: 'SUPPORT',
        status: 'OPEN',
        lastMessageAt: new Date()
      }
    });

    res.status(201).json({ success: true, data: message });
  })
);

assistantRoutes.patch(
  '/admin/conversations/:id/status',
  protect,
  adminOnly,
  validateRequest([
    { field: 'status', label: 'Estado', required: true, type: 'string', oneOf: ['OPEN', 'WAITING_ADMIN', 'RESOLVED', 'CLOSED'] }
  ]),
  asyncRoute(async (req, res) => {
    const conversation = await prisma.chatConversation.update({
      where: { id: req.params.id },
      data: { status: req.body.status, assignedAdminId: req.user.id }
    });

    res.json({ success: true, data: conversation });
  })
);

export default assistantRoutes;
