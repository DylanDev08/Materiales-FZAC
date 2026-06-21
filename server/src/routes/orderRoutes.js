import { Router } from 'express';
import { prisma } from '../config/db.js';
import { protect } from '../middleware/authMiddleware.js';

export const orderRoutes = Router();

orderRoutes.use(protect);

const asyncRoute = (handler) => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

const toNumber = (value) => Number(value || 0);

const getItemProductId = (item) => {
  return item.productId || item.product?.id || null;
};

const serializeOrder = (order) => {
  return {
    id: order.id,
    orderNumber: order.id,

    userId: order.userId,
    status: order.status,

    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,

    shippingMethod: order.shippingMethod,
    shippingCost: toNumber(order.shippingCost),

    subtotal: toNumber(order.subtotal),
    total: toNumber(order.total),

    addressSnapshot: order.addressSnapshot || null,
    notes: order.notes || null,

    stripeCheckoutSessionId: order.stripeCheckoutSessionId || null,
    stripePaymentIntentId: order.stripePaymentIntentId || null,
    paidAt: order.paidAt || null,

    createdAt: order.createdAt,
    updatedAt: order.updatedAt,

    items: (order.items || []).map((item) => {
      const price = toNumber(item.price);
      const quantity = Number(item.quantity || 0);

      return {
        id: item.id,
        orderId: item.orderId,

        productId: getItemProductId(item),

        name: item.name || item.product?.name || item.product?.title || 'Producto',
        productName: item.name || item.product?.name || item.product?.title || 'Producto',

        sku: item.sku || item.product?.sku || 'SIN-SKU',
        image: item.image || item.product?.image || '',

        price,
        unitPrice: price,

        quantity,
        total: price * quantity,

        product: item.product
          ? {
              id: item.product.id,
              name: item.product.name || item.product.title || null,
              slug: item.product.slug || null,
              sku: item.product.sku || null,
              image: item.product.image || null,
              price: toNumber(item.product.price),
              stock: Number(item.product.stock || 0)
            }
          : null,

        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      };
    }),

    payment: order.payment ? { ...order.payment, amount: toNumber(order.payment.amount) } : null,
    ticket: order.ticket
      ? {
          ...order.ticket,
          subtotal: toNumber(order.ticket.subtotal),
          discount: toNumber(order.ticket.discount),
          shippingCost: toNumber(order.ticket.shippingCost),
          total: toNumber(order.ticket.total),
          items: (order.ticket.items || []).map((item) => ({
            ...item,
            unitPrice: toNumber(item.unitPrice),
            subtotal: toNumber(item.subtotal)
          }))
        }
      : null
  };
};

orderRoutes.get(
  '/',
  asyncRoute(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: {
        userId: req.user.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        payment: true,
        ticket: { include: { items: true } }
      }
    });

    res.json({
      success: true,
      data: {
        orders: orders.map(serializeOrder)
      }
    });
  })
);

orderRoutes.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        payment: true,
        ticket: { include: { items: true } }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        order: serializeOrder(order)
      }
    });
  })
);

orderRoutes.patch(
  '/:id/cancel',
  asyncRoute(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        payment: true
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado'
      });
    }

    const cancellableStatuses = [
      'PENDING_PAYMENT',
      'PENDING'
    ];

    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Este pedido ya no se puede cancelar desde la cuenta'
      });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.order.update({
        where: {
          id: order.id
        },
        data: {
          status: 'CANCELLED'
        },
        include: {
          items: {
            include: {
              product: true
            }
          },
          payment: true,
          ticket: { include: { items: true } }
        }
      });

      return cancelled;
    });

    res.json({
      success: true,
      data: {
        order: serializeOrder(updatedOrder),
        message: 'Pedido cancelado correctamente'
      }
    });
  })
);

export default orderRoutes;
