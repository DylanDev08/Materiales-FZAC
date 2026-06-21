import { Router } from 'express';

import { prisma } from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { logAudit } from '../utils/auditLogger.js';
import { serializeOrder } from '../utils/format.js';
import { mercadoPagoService, mapMercadoPagoStatus } from '../services/mercadoPagoService.js';
import { orderService } from '../services/orderService.js';

export const paymentRoutes = Router();

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const toNumber = (value) => Number(value || 0);

const serializePayment = (payment) => payment
  ? {
      ...payment,
      amount: toNumber(payment.amount)
    }
  : null;

const assertOrderAccess = (order, user) => {
  if (!order) return false;
  if (user.role === 'ADMIN') return true;
  return order.userId === user.id;
};

const getStatusMessage = (status) => {
  const messages = {
    PENDING: 'El pago esta pendiente.',
    PAID: 'El pago fue aprobado correctamente.',
    FAILED: 'El pago fue rechazado o fallo.',
    EXPIRED: 'El pago expiro.',
    REFUNDED: 'El pago fue reembolsado.'
  };

  return messages[status] || 'El pago fue actualizado.';
};

paymentRoutes.post(
  '/mercadopago/create-preference',
  protect,
  asyncRoute(async (req, res) => {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId requerido' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payment: true, ticket: { include: { items: true } } }
    });

    if (!assertOrderAccess(order, req.user)) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    if (order.payment?.status === 'PAID' || order.status === 'PAID') {
      return res.status(400).json({ success: false, message: 'Este pedido ya esta pagado' });
    }

    const preference = await mercadoPagoService.createPreference(order);
    const payment = await orderService.updatePendingPayment(order.id, {
      provider: 'MERCADOPAGO',
      status: 'PENDING',
      amount: order.total,
      currency: 'ars',
      providerSessionId: preference.id,
      raw: preference.raw
    });

    res.status(201).json({
      success: true,
      data: {
        order: serializeOrder({ ...order, payment }),
        payment: serializePayment(payment),
        preferenceId: preference.id,
        initPoint: preference.initPoint,
        sandboxInitPoint: preference.sandboxInitPoint
      }
    });
  })
);

paymentRoutes.post(
  '/mercadopago/webhook',
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    const query = req.query || {};

    const topic = body.type || body.topic || query.type || query.topic || null;
    const paymentId = body?.data?.id || body?.id || query['data.id'] || query.id || null;

    if (!paymentId) {
      return res.status(200).json({ success: true, message: 'Webhook recibido sin paymentId' });
    }

    const normalizedTopic = String(topic || '').toLowerCase();
    if (normalizedTopic && !normalizedTopic.includes('payment')) {
      return res.status(200).json({ success: true, message: 'Webhook ignorado' });
    }

    const mercadoPagoPayment = await mercadoPagoService.getPayment(paymentId);
    const orderId = mercadoPagoService.resolveOrderId(mercadoPagoPayment);

    if (!orderId) {
      return res.status(200).json({ success: true, message: 'Pago sin referencia de pedido' });
    }

    const mappedStatus = mapMercadoPagoStatus(mercadoPagoPayment.status);
    const amount = toNumber(mercadoPagoPayment.transaction_amount);
    const currency = String(mercadoPagoPayment.currency_id || 'ARS').toLowerCase();

    let order;
    if (mappedStatus === 'PAID') {
      order = await orderService.confirmApprovedPayment({
        orderId,
        provider: 'MERCADOPAGO',
        providerSessionId: String(mercadoPagoPayment.preference_id || ''),
        providerPaymentIntentId: String(mercadoPagoPayment.id),
        amount,
        currency,
        raw: mercadoPagoPayment
      });
    } else {
      order = await orderService.markPaymentNotApproved(orderId, mappedStatus, mercadoPagoPayment);
    }

    const payment = order.payment;

    await logAudit({
      req,
      action: 'PAYMENT_WEBHOOK_UPDATED',
      entity: 'Payment',
      entityId: payment?.id || null,
      message: `Mercado Pago actualizo el pago del pedido ${orderId} a ${mappedStatus}`,
      metadata: {
        orderId,
        mercadoPagoPaymentId: mercadoPagoPayment.id,
        mercadoPagoStatus: mercadoPagoPayment.status,
        mappedStatus
      }
    });

    res.status(200).json({
      success: true,
      data: {
        order,
        payment: serializePayment(payment)
      }
    });
  })
);

paymentRoutes.post(
  '/manual',
  protect,
  asyncRoute(async (req, res) => {
    const { orderId, provider = 'MANUAL', notes = null, reference = null } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId requerido' });
    }

    const allowedProviders = ['MANUAL', 'BANK_TRANSFER', 'NARANJA_X', 'QR', 'CASH_ON_PICKUP', 'EXTERNAL_LINK'];
    const normalizedProvider = String(provider || 'MANUAL').trim().toUpperCase();

    if (!allowedProviders.includes(normalizedProvider)) {
      return res.status(400).json({ success: false, message: 'Proveedor de pago invalido' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true }
    });

    if (!assertOrderAccess(order, req.user)) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    if (order.payment?.status === 'PAID' || order.status === 'PAID') {
      return res.status(400).json({ success: false, message: 'Este pedido ya esta pagado' });
    }

    const payment = await orderService.updatePendingPayment(order.id, {
      provider: normalizedProvider,
      status: 'PENDING',
      amount: order.total,
      currency: 'ars',
      raw: {
        notes,
        reference,
        requestedBy: req.user.email,
        requestedAt: new Date().toISOString()
      }
    });

    await prisma.notification.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        type: 'MANUAL_PAYMENT_SELECTED',
        title: 'Metodo de pago seleccionado',
        message: `Seleccionaste ${normalizedProvider}. El pago queda pendiente de validacion.`,
        linkTo: `/pedidos/${order.id}`
      }
    });

    res.status(201).json({
      success: true,
      data: {
        payment: serializePayment(payment),
        message: 'Metodo de pago registrado. Queda pendiente de validacion.'
      }
    });
  })
);

paymentRoutes.get(
  '/:orderId/status',
  protect,
  asyncRoute(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: { items: true, payment: true, ticket: { include: { items: true } } }
    });

    if (!assertOrderAccess(order, req.user)) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    res.json({
      success: true,
      data: {
        order: serializeOrder(order),
        payment: serializePayment(order.payment)
      }
    });
  })
);

paymentRoutes.patch(
  '/admin/:paymentId/status',
  protect,
  adminOnly,
  asyncRoute(async (req, res) => {
    const nextStatus = String(req.body.status || '').trim().toUpperCase();
    const allowedStatuses = ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED'];

    if (!allowedStatuses.includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Estado de pago invalido' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: req.params.paymentId },
      include: { order: true }
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Pago no encontrado' });
    }

    const order = nextStatus === 'PAID'
      ? await orderService.confirmApprovedPayment({
          orderId: payment.orderId,
          provider: payment.provider,
          providerSessionId: payment.providerSessionId,
          providerPaymentIntentId: payment.providerPaymentIntentId || `manual_${payment.id}`,
          amount: payment.amount,
          currency: payment.currency,
          raw: {
            ...(payment.raw && typeof payment.raw === 'object' ? payment.raw : {}),
            approvedBy: req.user.email,
            approvedAt: new Date().toISOString()
          }
        })
      : await orderService.markPaymentNotApproved(payment.orderId, nextStatus, payment.raw);

    await prisma.notification.create({
      data: {
        userId: payment.order.userId,
        orderId: payment.orderId,
        type: 'PAYMENT_STATUS_UPDATED',
        title: 'Pago actualizado',
        message: getStatusMessage(nextStatus),
        linkTo: `/pedidos/${payment.orderId}`
      }
    });

    await logAudit({
      req,
      action: 'PAYMENT_STATUS_UPDATED',
      entity: 'Payment',
      entityId: payment.id,
      message: `Pago actualizado manualmente a ${nextStatus}`,
      metadata: {
        from: payment.status,
        to: nextStatus,
        orderId: payment.orderId,
        provider: payment.provider
      }
    });

    res.json({
      success: true,
      data: {
        payment: serializePayment(order.payment),
        order,
        message: 'Estado de pago actualizado correctamente'
      }
    });
  })
);

export default paymentRoutes;
