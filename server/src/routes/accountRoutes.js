import { Router } from 'express';
import bcrypt from 'bcryptjs';

import { prisma } from '../config/db.js';
import { protect } from '../middleware/authMiddleware.js';
import { createRateLimit } from '../middleware/rateLimitMiddleware.js';
import { validateRequest } from '../utils/validateRequest.js';

export const accountRoutes = Router();

accountRoutes.use(protect);
accountRoutes.use(
  createRateLimit({
    windowMs: 60_000,
    maxRequests: 90,
    keyPrefix: 'account'
  })
);

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const toNumber = (value) => Number(value || 0);

const serializeProduct = (product) =>
  product
    ? {
        ...product,
        price: toNumber(product.price),
        comparePrice: product.comparePrice ? toNumber(product.comparePrice) : null,
        category: product.category?.name || product.category || null,
        categorySlug: product.category?.slug || product.categorySlug || null
      }
    : null;

const serializeOrder = (order) => ({
  ...order,
  subtotal: toNumber(order.subtotal),
  shippingCost: toNumber(order.shippingCost),
  total: toNumber(order.total),
  items: (order.items || []).map((item) => ({
    ...item,
    price: toNumber(item.price),
    total: toNumber(item.price) * Number(item.quantity || 0)
  })),
  payment: order.payment
    ? { ...order.payment, amount: toNumber(order.payment.amount) }
    : null
});

accountRoutes.get(
  '/summary',
  asyncRoute(async (req, res) => {
    const [orders, cartItems, favorites, conversations, preferences] = await Promise.all([
      prisma.order.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        include: { items: true, payment: true }
      }),
      prisma.cartItem.findMany({
        where: { userId: req.user.id },
        include: { product: { include: { category: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.favorite.findMany({
        where: { userId: req.user.id },
        include: { product: { include: { category: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.chatConversation.findMany({
        where: { userId: req.user.id },
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: 20
      }),
      prisma.userPreference.findUnique({ where: { userId: req.user.id } })
    ]);

    const paidStatuses = ['PAID', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'SHIPPED', 'DELIVERED', 'COMPLETED'];
    const pendingStatuses = ['PENDING', 'PENDING_PAYMENT'];
    const paidOrders = orders.filter((order) => paidStatuses.includes(order.status));
    const pendingOrders = orders.filter((order) => pendingStatuses.includes(order.status));

    const spent = paidOrders.reduce((total, order) => total + toNumber(order.total), 0);
    const cartSubtotal = cartItems.reduce(
      (total, item) => total + Number(item.quantity || 0) * toNumber(item.product?.price),
      0
    );

    res.json({
      success: true,
      data: {
        status: 'Cuenta activa',
        balance: 0,
        spent,
        preferences: preferences || {
          marketingEmails: false,
          orderUpdates: true,
          assistantHistory: true,
          theme: 'system',
          preferredShipping: null
        },
        orders: {
          total: orders.length,
          paid: paidOrders.length,
          pending: pendingOrders.length,
          latest: orders.slice(0, 8).map(serializeOrder)
        },
        cart: {
          itemsCount: cartItems.reduce((total, item) => total + Number(item.quantity || 0), 0),
          subtotal: cartSubtotal,
          items: cartItems.map((item) => ({
            ...item,
            product: serializeProduct(item.product),
            total: Number(item.quantity || 0) * toNumber(item.product?.price)
          }))
        },
        favorites: favorites.map((favorite) => ({
          id: favorite.id,
          createdAt: favorite.createdAt,
          product: serializeProduct(favorite.product)
        })),
        conversations: conversations.map((conversation) => ({
          id: conversation.id,
          channel: conversation.channel,
          status: conversation.status,
          subject: conversation.subject,
          updatedAt: conversation.updatedAt,
          lastMessage: conversation.messages[0] || null
        }))
      }
    });
  })
);

accountRoutes.patch(
  '/settings',
  validateRequest([
    { field: 'name', label: 'Nombre', type: 'string', minLength: 2, maxLength: 80 },
    { field: 'phone', label: 'Teléfono', type: 'string', maxLength: 40 },
    { field: 'theme', label: 'Tema', type: 'string', oneOf: ['system', 'light', 'dark'] }
  ]),
  asyncRoute(async (req, res) => {
    const {
      name,
      phone,
      avatarUrl,
      marketingEmails,
      orderUpdates,
      assistantHistory,
      theme,
      preferredShipping
    } = req.body;

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: req.user.id },
        data: {
          ...(name !== undefined ? { name: String(name).trim() } : {}),
          ...(phone !== undefined ? { phone: String(phone || '').trim() || null } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl: String(avatarUrl || '').trim() || null } : {})
        }
      });

      await tx.userPreference.upsert({
        where: { userId: req.user.id },
        update: {
          ...(marketingEmails !== undefined ? { marketingEmails: Boolean(marketingEmails) } : {}),
          ...(orderUpdates !== undefined ? { orderUpdates: Boolean(orderUpdates) } : {}),
          ...(assistantHistory !== undefined ? { assistantHistory: Boolean(assistantHistory) } : {}),
          ...(theme !== undefined ? { theme } : {}),
          ...(preferredShipping !== undefined
            ? { preferredShipping: preferredShipping || null }
            : {})
        },
        create: {
          userId: req.user.id,
          marketingEmails: Boolean(marketingEmails),
          orderUpdates: orderUpdates !== false,
          assistantHistory: assistantHistory !== false,
          theme: theme || 'system',
          preferredShipping: preferredShipping || null
        }
      });

      return user;
    });

    res.json({
      success: true,
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        avatarUrl: updatedUser.avatarUrl,
        role: updatedUser.role,
        authProvider: updatedUser.authProvider
      }
    });
  })
);

accountRoutes.post(
  '/security/password',
  validateRequest([
    { field: 'currentPassword', label: 'Contraseña actual', type: 'string', maxLength: 120 },
    { field: 'nextPassword', label: 'Nueva contraseña', required: true, type: 'string', minLength: 8, maxLength: 120 }
  ]),
  asyncRoute(async (req, res) => {
    const { currentPassword, nextPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (user.authProvider === 'LOCAL' && user.password) {
      const valid = await bcrypt.compare(String(currentPassword || ''), user.password);
      if (!valid) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña actual no es correcta'
        });
      }
    }

    const password = await bcrypt.hash(nextPassword, 12);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password, authProvider: 'LOCAL' }
    });

    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  })
);

accountRoutes.get(
  '/favorites',
  asyncRoute(async (req, res) => {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      include: { product: { include: { category: true } } },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: favorites.map((favorite) => ({
        id: favorite.id,
        createdAt: favorite.createdAt,
        product: serializeProduct(favorite.product)
      }))
    });
  })
);

accountRoutes.post(
  '/favorites/:productId',
  asyncRoute(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.params.productId, active: true }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    const favorite = await prisma.favorite.upsert({
      where: {
        userId_productId: {
          userId: req.user.id,
          productId: product.id
        }
      },
      update: {},
      create: {
        userId: req.user.id,
        productId: product.id
      }
    });

    res.status(201).json({ success: true, data: favorite });
  })
);

accountRoutes.delete(
  '/favorites/:productId',
  asyncRoute(async (req, res) => {
    await prisma.favorite.deleteMany({
      where: { userId: req.user.id, productId: req.params.productId }
    });

    res.json({ success: true, message: 'Producto eliminado de favoritos' });
  })
);

export default accountRoutes;
