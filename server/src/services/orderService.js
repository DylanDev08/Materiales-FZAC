import { prisma } from '../config/db.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { ApiError } from '../utils/ApiError.js';
import { serializeOrder } from '../utils/format.js';

const paidOrderStatuses = [
  'PAID',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED'
];

const normalizeMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const buildTicketNumber = (orderId, issuedAt = new Date()) => {
  const date = issuedAt.toISOString().slice(0, 10).replace(/-/g, '');
  return `FZAC-${date}-${orderId.slice(0, 8).toUpperCase()}`;
};

const createTicketIfMissing = async (tx, order, payment, stockSnapshots = new Map()) => {
  const existingTicket = await tx.purchaseTicket.findUnique({
    where: { orderId: order.id },
    include: { items: true }
  });

  if (existingTicket) return existingTicket;

  const issuedAt = new Date();

  const ticket = await tx.purchaseTicket.create({
    data: {
      number: buildTicketNumber(order.id, issuedAt),
      orderId: order.id,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      taxId: order.addressSnapshot?.taxId || order.addressSnapshot?.dni || order.addressSnapshot?.cuit || null,
      paymentProvider: payment.provider,
      paymentId: payment.providerPaymentIntentId || payment.providerSessionId || null,
      subtotal: order.subtotal,
      discount: 0,
      shippingCost: order.shippingCost,
      total: order.total,
      shippingMethod: order.shippingMethod,
      addressSnapshot: order.addressSnapshot || null,
      notes: order.notes || null,
      issuedAt,
      items: {
        create: order.items.map((item) => {
          const snapshot = stockSnapshots.get(item.id) || {};

          return {
            productId: item.productId,
            sku: item.sku,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            subtotal: normalizeMoney(Number(item.price) * Number(item.quantity)),
            stockBefore: snapshot.stockBefore ?? null,
            stockAfter: snapshot.stockAfter ?? null
          };
        })
      }
    },
    include: { items: true }
  });

  await tx.notification.create({
    data: {
      userId: null,
      orderId: order.id,
      type: 'PURCHASE_TICKET_ISSUED',
      title: 'Ticket de compra generado',
      message: `Se genero el ticket ${ticket.number} para ${order.customerName}.`,
      linkTo: '/admin?tab=tickets'
    }
  });

  return ticket;
};

const decrementStockAndMarkPaid = async (tx, order, paymentPayload = {}) => {
  if (paidOrderStatuses.includes(order.status) || order.payment?.status === 'PAID') {
    const payment = order.payment || await tx.payment.findUnique({ where: { orderId: order.id } });
    if (payment) await createTicketIfMissing(tx, order, payment);

    return tx.order.findUnique({
      where: { id: order.id },
      include: { items: true, payment: true, ticket: { include: { items: true } } }
    });
  }

  const stockSnapshots = new Map();

  for (const item of order.items) {
    if (!item.productId) continue;

    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { id: true, name: true, sku: true, stock: true, stockMinimum: true, active: true }
    });

    if (!product?.active || product.stock < item.quantity) {
      throw new ApiError(409, `Stock insuficiente para ${item.name}`);
    }

    const updated = await tx.product.updateMany({
      where: {
        id: item.productId,
        active: true,
        stock: { gte: item.quantity }
      },
      data: { stock: { decrement: item.quantity } }
    });

    if (updated.count === 0) {
      throw new ApiError(409, `Stock insuficiente para ${item.name}`);
    }

    const stockAfter = product.stock - item.quantity;
    stockSnapshots.set(item.id, { stockBefore: product.stock, stockAfter });

    await tx.inventoryMovement.create({
      data: {
        productId: item.productId,
        orderId: order.id,
        type: 'SALE',
        quantity: -item.quantity,
        stockBefore: product.stock,
        stockAfter,
        reason: `Venta aprobada ${order.id}`,
        metadata: {
          orderItemId: item.id,
          sku: item.sku,
          paymentProvider: paymentPayload.provider || order.payment?.provider || 'MERCADOPAGO'
        }
      }
    });

    if (stockAfter <= Number(product.stockMinimum ?? 5)) {
      await tx.notification.create({
        data: {
          userId: null,
          orderId: order.id,
          type: 'LOW_STOCK',
          title: 'Stock bajo',
          message: `${product.name} quedo con ${stockAfter} unidades disponibles.`,
          linkTo: '/admin?tab=products'
        }
      });
    }
  }

  const payment = await tx.payment.update({
    where: { orderId: order.id },
    data: {
      status: 'PAID',
      provider: paymentPayload.provider || 'MERCADOPAGO',
      amount: paymentPayload.amount ?? order.total,
      currency: paymentPayload.currency || 'ars',
      providerSessionId: paymentPayload.providerSessionId || order.payment?.providerSessionId || null,
      providerPaymentIntentId: paymentPayload.providerPaymentIntentId || null,
      raw: paymentPayload.raw || null
    }
  });

  const updatedOrder = await tx.order.update({
    where: { id: order.id },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      stripePaymentIntentId: paymentPayload.providerPaymentIntentId || null
    },
    include: { items: true, payment: true }
  });

  await createTicketIfMissing(tx, updatedOrder, payment, stockSnapshots);

  return tx.order.findUnique({
    where: { id: order.id },
    include: { items: true, payment: true, ticket: { include: { items: true } } }
  });
};

export const orderService = {
  async createPendingOrder({ userId, customer, shippingMethod = 'PICKUP', address, notes, items }) {
    if (!items?.length) throw new ApiError(400, 'El carrito esta vacio');

    const normalizedItems = items.map((item) => ({
      productId: item.productId,
      quantity: Math.max(Number(item.quantity || 1), 1)
    }));

    const productIds = normalizedItems.map((item) => item.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds }, active: true } });
    const productById = new Map(products.map((product) => [product.id, product]));

    const orderItems = normalizedItems.map((item) => {
      const product = productById.get(item.productId);
      if (!product) throw new ApiError(400, 'Producto invalido');
      if (product.stock < item.quantity) throw new ApiError(409, `Stock insuficiente para ${product.name}`);

      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        image: product.image
      };
    });

    const subtotal = orderItems.reduce((acc, item) => acc + Number(item.price) * item.quantity, 0);
    const shippingCost = shippingMethod === 'DELIVERY' ? 6500 : 0;
    const total = subtotal + shippingCost;
    const customerName = customer?.name || `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim();

    if (!customerName || !customer?.email || !customer?.phone) {
      throw new ApiError(400, 'Datos de cliente incompletos');
    }

    const order = await orderRepository.create({
      userId,
      customerName,
      customerEmail: String(customer.email).trim().toLowerCase(),
      customerPhone: String(customer.phone).trim(),
      shippingMethod,
      shippingCost,
      subtotal,
      total,
      addressSnapshot: shippingMethod === 'DELIVERY' ? address : null,
      notes,
      items: { create: orderItems },
      payment: { create: { amount: total, status: 'PENDING', currency: 'ars', provider: 'MERCADOPAGO' } }
    });

    return serializeOrder(order);
  },

  async confirmApprovedPayment({
    orderId,
    provider = 'MERCADOPAGO',
    providerSessionId = null,
    providerPaymentIntentId = null,
    amount,
    currency = 'ars',
    raw = null
  }) {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new ApiError(404, 'Orden no encontrada');

    const paidAmount = normalizeMoney(amount);
    const orderTotal = normalizeMoney(order.total);

    if (paidAmount !== orderTotal) {
      throw new ApiError(409, 'El monto del pago no coincide con el pedido');
    }

    const updated = await prisma.$transaction((tx) => decrementStockAndMarkPaid(tx, order, {
      provider,
      providerSessionId,
      providerPaymentIntentId,
      amount: paidAmount,
      currency: String(currency || 'ars').toLowerCase(),
      raw
    }));

    return serializeOrder(updated);
  },

  async updatePendingPayment(orderId, payload = {}) {
    const order = await orderRepository.findById(orderId);
    if (!order) throw new ApiError(404, 'Orden no encontrada');

    return prisma.payment.upsert({
      where: { orderId: order.id },
      update: {
        provider: payload.provider || 'MERCADOPAGO',
        status: payload.status || 'PENDING',
        amount: payload.amount ?? order.total,
        currency: payload.currency || 'ars',
        providerSessionId: payload.providerSessionId,
        providerPaymentIntentId: payload.providerPaymentIntentId,
        raw: payload.raw
      },
      create: {
        orderId: order.id,
        provider: payload.provider || 'MERCADOPAGO',
        status: payload.status || 'PENDING',
        amount: payload.amount ?? order.total,
        currency: payload.currency || 'ars',
        providerSessionId: payload.providerSessionId,
        providerPaymentIntentId: payload.providerPaymentIntentId,
        raw: payload.raw
      }
    });
  },

  async markPaymentNotApproved(orderId, status, raw = null) {
    const allowedStatuses = ['FAILED', 'EXPIRED', 'REFUNDED', 'PENDING'];
    const nextStatus = allowedStatuses.includes(status) ? status : 'PENDING';
    const order = await orderRepository.findById(orderId);
    if (!order) throw new ApiError(404, 'Orden no encontrada');

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus === 'EXPIRED' ? 'CANCELLED' : order.status,
        payment: {
          update: {
            status: nextStatus,
            raw
          }
        }
      },
      include: { items: true, payment: true, ticket: { include: { items: true } } }
    });

    return serializeOrder(updated);
  },

  async listForUser(userId) {
    const orders = await orderRepository.listByUser(userId);
    return orders.map(serializeOrder);
  },

  async listAll(params) {
    const orders = await orderRepository.listAll(params);
    return orders.map(serializeOrder);
  },

  async updateStatus(id, status) {
    const order = await orderRepository.update(id, { status });
    return serializeOrder(order);
  }
};
