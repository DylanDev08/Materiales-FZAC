import { Router } from 'express';

import { prisma } from '../config/db.js';
import { checkoutController } from '../controllers/checkoutController.js';
import { env } from '../config/env.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkoutRateLimit } from '../middleware/rateLimitMiddleware.js';
import { validateRequest } from '../utils/validateRequest.js';
import { serializeOrder } from '../utils/format.js';
import { orderService } from '../services/orderService.js';

export const checkoutRoutes = Router();

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const checkoutValidation = validateRequest([
  { field: 'shippingMethod', label: 'Metodo de entrega', type: 'string', oneOf: ['PICKUP', 'DELIVERY'] },
  { field: 'notes', label: 'Notas', type: 'string', maxLength: 500 }
]);

const validateCheckoutPayload = (req, res, next) => {
  const errors = [];
  const { customer, items, shippingMethod } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    errors.push('El carrito esta vacio');
  } else {
    for (const item of items) {
      if (!item.productId || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 1) {
        errors.push('Los productos del carrito no son validos');
        break;
      }
    }
  }

  if (!customer?.name || !customer?.email || !customer?.phone) {
    errors.push('Los datos del comprador son obligatorios');
  }

  if (customer?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customer.email))) {
    errors.push('El email no tiene un formato valido');
  }

  if (shippingMethod === 'DELIVERY') {
    const address = req.body.address || {};
    if (!address.street || !address.number || !address.city || !address.postalCode) {
      errors.push('La direccion de entrega esta incompleta');
    }
  }

  if (errors.length) {
    return res.status(400).json({ success: false, message: 'Datos invalidos', errors });
  }

  next();
};

checkoutRoutes.use(protect);

checkoutRoutes.post(
  '/create-session',
  checkoutRateLimit,
  checkoutValidation,
  validateCheckoutPayload,
  checkoutController.createSession
);

checkoutRoutes.post('/', checkoutRateLimit, checkoutValidation, validateCheckoutPayload, checkoutController.createSession);

checkoutRoutes.post(
  '/simulate/:orderId',
  checkoutRateLimit,
  validateRequest([
    { field: 'status', label: 'Estado simulado', required: true, type: 'string', oneOf: ['PAID', 'FAILED', 'PENDING'] }
  ]),
  asyncRoute(async (req, res) => {
    if (env.MERCADOPAGO_ACCESS_TOKEN) {
      return res.status(403).json({ success: false, message: 'La simulacion no esta disponible con pagos reales activos' });
    }

    const order = await prisma.order.findFirst({
      where: {
        id: req.params.orderId,
        ...(req.user.role === 'ADMIN' ? {} : { userId: req.user.id })
      },
      include: { items: true, payment: true, ticket: { include: { items: true } } }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    const status = String(req.body.status || '').toUpperCase();
    const updated = status === 'PAID'
      ? await orderService.confirmApprovedPayment({
          orderId: order.id,
          provider: 'MERCADOPAGO_MOCK',
          providerSessionId: order.payment?.providerSessionId || `mock_mp_${order.id}`,
          providerPaymentIntentId: `mock_paid_${order.id}`,
          amount: order.total,
          currency: 'ars',
          raw: { simulated: true, status: 'approved', source: 'checkout' }
        })
      : await orderService.markPaymentNotApproved(
          order.id,
          status === 'FAILED' ? 'FAILED' : 'PENDING',
          { simulated: true, status: status.toLowerCase(), source: 'checkout' }
        );

    res.json({ success: true, data: { order: serializeOrder(updated) } });
  })
);

checkoutRoutes.get(
  '/status/:orderId',
  asyncRoute(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.orderId,
        ...(req.user.role === 'ADMIN' ? {} : { userId: req.user.id })
      },
      include: { items: true, payment: true, ticket: { include: { items: true } } }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    res.json({ success: true, data: { order: serializeOrder(order) } });
  })
);

checkoutRoutes.get(
  '/success/:orderId',
  asyncRoute(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.orderId,
        ...(req.user.role === 'ADMIN' ? {} : { userId: req.user.id })
      },
      include: { items: true, payment: true, ticket: { include: { items: true } } }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    res.json({ success: true, data: { order: serializeOrder(order) } });
  })
);

export default checkoutRoutes;
