import { Router } from 'express';
import { prisma } from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { adminRateLimit } from '../middleware/rateLimitMiddleware.js';
import { logAudit } from '../utils/auditLogger.js';
import { upload, uploadToCloudinary } from '../middleware/upload.js';
import { toSlug } from '../utils/slug.js';
import { serializeTicket } from '../utils/format.js';

export const adminRoutes = Router();

adminRoutes.use(protect);
adminRoutes.use(adminOnly);
adminRoutes.use(adminRateLimit);

const asyncRoute = (handler) => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

const toNumber = (value) => Number(value || 0);

const normalizeStatus = (status) => {
  return String(status || '').trim().toUpperCase();
};

const getProductName = (product) => {
  return product?.name || product?.title || 'Producto sin nombre';
};

const getItemProductId = (item) => {
  return item.productId || item.product?.id || null;
};

const pendingStatuses = ['PENDING', 'PENDING_PAYMENT'];

const paidStatuses = [
  'PAID',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED'
];

const cancelledStatuses = ['CANCELLED', 'CANCELED'];

const activeStockStatuses = [
  'PENDING',
  'PENDING_PAYMENT',
  'PAID',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED'
];

const allowedOrderTransitions = {
  PENDING: ['PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'CANCELLED'],
  PENDING_PAYMENT: ['PAID', 'CONFIRMED', 'CANCELLED'],

  PAID: ['CONFIRMED', 'PREPARING', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],

  PREPARING: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'CANCELLED'],

  READY_FOR_PICKUP: ['DELIVERED', 'COMPLETED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],

  DELIVERED: ['COMPLETED'],
  COMPLETED: [],

  CANCELLED: [],
  CANCELED: []
};

const statusMessages = {
  PENDING: 'Tu pedido está pendiente.',
  PENDING_PAYMENT: 'Tu pedido está esperando el pago.',
  PAID: 'Recibimos el pago de tu pedido.',
  CONFIRMED: 'Tu pedido fue confirmado.',
  PREPARING: 'Tu pedido está en preparación.',
  READY_FOR_PICKUP: 'Tu pedido está listo para retirar.',
  OUT_FOR_DELIVERY: 'Tu pedido está en camino.',
  DELIVERED: 'Tu pedido fue entregado.',
  COMPLETED: 'Tu pedido fue completado.',
  CANCELLED: 'Tu pedido fue cancelado.',
  CANCELED: 'Tu pedido fue cancelado.'
};

const canTransitionOrder = (currentStatus, nextStatus) => {
  const current = normalizeStatus(currentStatus);
  const next = normalizeStatus(nextStatus);

  if (current === next) {
    return true;
  }

  const allowedNextStatuses = allowedOrderTransitions[current] || [];

  return allowedNextStatuses.includes(next);
};

const shouldReturnStock = (currentStatus, nextStatus) => {
  const current = normalizeStatus(currentStatus);
  const next = normalizeStatus(nextStatus);

  return activeStockStatuses.includes(current) && cancelledStatuses.includes(next);
};

const serializeProduct = (product) => {
  if (!product) return null;

  return {
    id: product.id,
    name: getProductName(product),
    title: product.title || product.name || null,

    slug: product.slug,
    sku: product.sku,
    description: product.description,
    brand: product.brand,
    image: product.image,
    gallery: product.gallery || [],

    price: toNumber(product.price),
    comparePrice: product.comparePrice ? toNumber(product.comparePrice) : null,
    stock: Number(product.stock || 0),
    stockMinimum: Number(product.stockMinimum || 5),
    unit: product.unit || 'unidad',
    active: product.active !== false,
    featured: Boolean(product.featured),
    onSale: Boolean(product.onSale),
    specifications: product.specifications || {},

    categoryId: product.categoryId || null,
    subcategory: product.subcategory || null,

    category: product.category
      ? {
          id: product.category.id,
          name: product.category.name,
          slug: product.category.slug
        }
      : null,

    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
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

    user: order.user
      ? {
          id: order.user.id,
          name: order.user.name,
          email: order.user.email,
          phone: order.user.phone,
          role: order.user.role
        }
      : null,

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

        product: item.product ? serializeProduct(item.product) : null,

        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      };
    }),

    payment: order.payment || null
  };
};

const getDashboardData = async () => {
  const [orders, products, customersCount] = await Promise.all([
    prisma.order.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        user: true,
        items: {
          include: {
            product: {
              include: {
                category: true
              }
            }
          }
        },
        payment: true
      }
    }),

    prisma.product.findMany({
      include: {
        category: true
      }
    }),

    prisma.user
      .count({
        where: {
          role: 'USER'
        }
      })
      .catch(() => 0)
  ]);

  const pendingOrders = orders.filter((order) => {
    return pendingStatuses.includes(normalizeStatus(order.status));
  });

  const paidOrders = orders.filter((order) => {
    return paidStatuses.includes(normalizeStatus(order.status));
  });

  const cancelledOrders = orders.filter((order) => {
    return cancelledStatuses.includes(normalizeStatus(order.status));
  });

  const totalSales = paidOrders.reduce((acc, order) => {
    return acc + toNumber(order.total);
  }, 0);

  const stockUnits = products.reduce((acc, product) => {
    return acc + Number(product.stock || 0);
  }, 0);

  const lowStockProducts = products
    .filter((product) => Number(product.stock || 0) <= 5)
    .slice(0, 10)
    .map(serializeProduct);

  return {
    orders: {
      total: orders.length,
      pending: pendingOrders.length,
      paid: paidOrders.length,
      cancelled: cancelledOrders.length
    },

    sales: {
      total: totalSales,
      averageTicket: paidOrders.length > 0 ? totalSales / paidOrders.length : 0
    },

    customers: {
      total: customersCount
    },

    products: {
      total: products.length,
      active: products.length,
      lowStock: lowStockProducts.length,
      stockUnits
    },

    latestOrders: orders.slice(0, 10).map(serializeOrder),
    lowStockProducts
  };
};

adminRoutes.get(
  '/health',
  asyncRoute(async (req, res) => {
    res.json({
      success: true,
      message: 'Admin routes funcionando'
    });
  })
);

adminRoutes.get(
  '/metrics',
  asyncRoute(async (req, res) => {
    const data = await getDashboardData();

    res.json({
      success: true,
      data
    });
  })
);

adminRoutes.get(
  '/dashboard',
  asyncRoute(async (req, res) => {
    const data = await getDashboardData();

    res.json({
      success: true,
      data
    });
  })
);

adminRoutes.get(
  '/orders',
  asyncRoute(async (req, res) => {
    const orders = await prisma.order.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        user: true,
        items: {
          include: {
            product: {
              include: {
                category: true
              }
            }
          }
        },
        payment: true
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

adminRoutes.get(
  '/orders/:id',
  asyncRoute(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: {
        id: req.params.id
      },
      include: {
        user: true,
        items: {
          include: {
            product: {
              include: {
                category: true
              }
            }
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

    res.json({
      success: true,
      data: {
        order: serializeOrder(order)
      }
    });
  })
);

adminRoutes.patch(
  '/orders/:id/status',
  asyncRoute(async (req, res) => {
    const nextStatus = normalizeStatus(req.body.status);

    if (!nextStatus) {
      return res.status(400).json({
        success: false,
        message: 'Estado requerido'
      });
    }

    const order = await prisma.order.findUnique({
      where: {
        id: req.params.id
      },
      include: {
        user: true,
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

    const currentStatus = normalizeStatus(order.status);

    if (!canTransitionOrder(currentStatus, nextStatus)) {
      return res.status(400).json({
        success: false,
        message: `No se puede cambiar el pedido de ${currentStatus} a ${nextStatus}`
      });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      if (shouldReturnStock(currentStatus, nextStatus)) {
        for (const item of order.items) {
          const productId = getItemProductId(item);

          if (!productId) continue;

          await tx.product.update({
            where: {
              id: productId
            },
            data: {
              stock: {
                increment: Number(item.quantity || 0)
              }
            }
          });
        }
      }

      const data = {
        status: nextStatus
      };

      if (paidStatuses.includes(nextStatus) && !order.paidAt) {
        data.paidAt = new Date();
      }

      const updated = await tx.order.update({
        where: {
          id: order.id
        },
        data,
        include: {
          user: true,
          items: {
            include: {
              product: {
                include: {
                  category: true
                }
              }
            }
          },
          payment: true
        }
      });

      if (order.userId) {
        await tx.notification.create({
          data: {
            userId: order.userId,
            orderId: order.id,
            type: 'ORDER_STATUS_UPDATED',
            title: 'Estado del pedido actualizado',
            message:
              statusMessages[nextStatus] ||
              `Tu pedido cambió de ${currentStatus} a ${nextStatus}.`,
            linkTo: `/pedidos/${order.id}`
          }
        });
      }

      await tx.notification.create({
        data: {
          userId: null,
          orderId: order.id,
          type: 'ADMIN_ORDER_STATUS_UPDATED',
          title: 'Pedido actualizado',
          message: `El pedido ${order.id} cambió de ${currentStatus} a ${nextStatus}.`,
          linkTo: `/admin/orders/${order.id}`
        }
      });

      return updated;
    });

    await logAudit({
      req,
      action: 'ORDER_STATUS_UPDATED',
      entity: 'Order',
      entityId: updatedOrder.id,
      message: `Pedido actualizado de ${currentStatus} a ${nextStatus}`,
      metadata: {
        from: currentStatus,
        to: nextStatus,
        returnedStock: shouldReturnStock(currentStatus, nextStatus),
        orderTotal: toNumber(updatedOrder.total)
      }
    });

    res.json({
      success: true,
      data: {
        order: serializeOrder(updatedOrder),
        message: `Pedido actualizado de ${currentStatus} a ${nextStatus}`
      }
    });
  })
);


adminRoutes.get(
  '/customers',
  asyncRoute(async (req, res) => {
    const customers = await prisma.user.findMany({
      where: {
        role: 'USER'
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            orders: true,
            cartItems: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        customers: customers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          role: customer.role,
          ordersCount: customer._count.orders,
          cartItemsCount: customer._count.cartItems,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt
        }))
      }
    });
  })
);

adminRoutes.get(
  '/products',
  asyncRoute(async (req, res) => {
    const products = await prisma.product.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        category: true
      }
    });

    res.json({
      success: true,
      data: {
        products: products.map(serializeProduct)
      }
    });
  })
);

adminRoutes.get(
  '/products/:id',
  asyncRoute(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: {
        id: req.params.id
      },
      include: {
        category: true
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        product: serializeProduct(product)
      }
    });
  })
);

adminRoutes.patch(
  '/products/:id/stock',
  asyncRoute(async (req, res) => {
    const { stock } = req.body;

    if (!Number.isFinite(Number(stock))) {
      return res.status(400).json({
        success: false,
        message: 'Stock inválido'
      });
    }

    const previousProduct = await prisma.product.findUnique({
      where: {
        id: req.params.id
      }
    });

    if (!previousProduct) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    const product = await prisma.product.update({
      where: {
        id: req.params.id
      },
      data: {
        stock: Number(stock)
      },
      include: {
        category: true
      }
    });

    if (Number(product.stock || 0) <= 5) {
      await prisma.notification.create({
        data: {
          userId: null,
          orderId: null,
          type: 'LOW_STOCK',
          title: 'Stock bajo',
          message: `${getProductName(product)} tiene stock bajo: ${product.stock} unidades.`,
          linkTo: `/admin/products/${product.id}`
        }
      });
    }

    await logAudit({
      req,
      action: 'PRODUCT_STOCK_UPDATED',
      entity: 'Product',
      entityId: product.id,
      message: `Stock actualizado para ${getProductName(product)}`,
      metadata: {
        productName: getProductName(product),
        previousStock: previousProduct.stock,
        newStock: product.stock
      }
    });

    res.json({
      success: true,
      data: {
        product: serializeProduct(product),
        message: 'Stock actualizado correctamente'
      }
    });
  })
);

adminRoutes.patch(
  '/products/:id',
  asyncRoute(async (req, res) => {
    const {
      name,
      slug,
      sku,
      description,
      brand,
      image,
      gallery,
      price,
      stock,
      stockMinimum,
      unit,
      comparePrice,
      active,
      featured,
      onSale,
      specifications,
      categoryId,
      subcategory
    } = req.body;

    const data = {};

    if (name !== undefined) data.name = name;
    if (slug !== undefined) data.slug = slug;
    if (sku !== undefined) data.sku = sku;
    if (description !== undefined) data.description = description;
    if (brand !== undefined) data.brand = brand;
    if (image !== undefined) data.image = image;
    if (gallery !== undefined) data.gallery = gallery;
    if (subcategory !== undefined) data.subcategory = subcategory;
    if (categoryId !== undefined) data.categoryId = categoryId || null;
    if (unit !== undefined) data.unit = String(unit || 'unidad');
    if (active !== undefined) data.active = Boolean(active);
    if (featured !== undefined) data.featured = Boolean(featured);
    if (onSale !== undefined) data.onSale = Boolean(onSale);
    if (specifications !== undefined) data.specifications = specifications || {};
    if (comparePrice !== undefined) data.comparePrice = comparePrice === null || comparePrice === '' ? null : Number(comparePrice);
    if (stockMinimum !== undefined) data.stockMinimum = Number(stockMinimum || 0);

    if (price !== undefined) {
      if (!Number.isFinite(Number(price))) {
        return res.status(400).json({
          success: false,
          message: 'Precio inválido'
        });
      }

      data.price = Number(price);
    }

    if (stock !== undefined) {
      if (!Number.isFinite(Number(stock))) {
        return res.status(400).json({
          success: false,
          message: 'Stock inválido'
        });
      }

      data.stock = Number(stock);
    }

    const previousProduct = await prisma.product.findUnique({
      where: {
        id: req.params.id
      }
    });

    if (!previousProduct) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    const product = await prisma.product.update({
      where: {
        id: req.params.id
      },
      data,
      include: {
        category: true
      }
    });

    if (stock !== undefined && Number(product.stock || 0) <= 5) {
      await prisma.notification.create({
        data: {
          userId: null,
          orderId: null,
          type: 'LOW_STOCK',
          title: 'Stock bajo',
          message: `${getProductName(product)} tiene stock bajo: ${product.stock} unidades.`,
          linkTo: `/admin/products/${product.id}`
        }
      });
    }

    await logAudit({
      req,
      action: 'PRODUCT_UPDATED',
      entity: 'Product',
      entityId: product.id,
      message: `Producto actualizado: ${getProductName(product)}`,
      metadata: {
        productName: getProductName(product),
        changedFields: Object.keys(data),
        previous: {
          name: previousProduct.name,
          slug: previousProduct.slug,
          sku: previousProduct.sku,
          price: toNumber(previousProduct.price),
          stock: previousProduct.stock
        },
        current: {
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          price: toNumber(product.price),
          stock: product.stock
        }
      }
    });

    res.json({
      success: true,
      data: {
        product: serializeProduct(product),
        message: 'Producto actualizado correctamente'
      }
    });
  })
);


adminRoutes.get(
  '/stock',
  asyncRoute(async (req, res) => {
    const products = await prisma.product.findMany({
      include: { category: true },
      orderBy: [{ stock: 'asc' }, { name: 'asc' }]
    });

    res.json({
      success: true,
      data: {
        products: products.map((product) => ({
          ...serializeProduct(product),
          stockMinimum: product.stockMinimum ?? 5,
          unit: product.unit || 'unidad',
          lowStock: Number(product.stock || 0) <= Number(product.stockMinimum ?? 5)
        }))
      }
    });
  })
);

adminRoutes.get(
  '/pickups',
  asyncRoute(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { shippingMethod: 'PICKUP' },
      orderBy: { createdAt: 'desc' },
      include: { user: true, items: { include: { product: true } }, payment: true },
      take: 200
    });

    res.json({ success: true, data: { orders: orders.map(serializeOrder) } });
  })
);

adminRoutes.get(
  '/notifications',
  asyncRoute(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: null },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({ success: true, data: notifications });
  })
);

adminRoutes.get(
  '/tickets',
  asyncRoute(async (req, res) => {
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim().toUpperCase();

    const where = {};
    if (status && status !== 'ALL') where.status = status;
    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { orderId: { contains: search, mode: 'insensitive' } }
      ];
    }

    const tickets = await prisma.purchaseTicket.findMany({
      where,
      orderBy: { issuedAt: 'desc' },
      include: { items: true, order: { include: { payment: true } } },
      take: Math.min(Number(req.query.limit || 200), 500)
    });

    res.json({
      success: true,
      data: {
        tickets: tickets.map(serializeTicket)
      }
    });
  })
);

adminRoutes.get(
  '/tickets/:id',
  asyncRoute(async (req, res) => {
    const ticket = await prisma.purchaseTicket.findUnique({
      where: { id: req.params.id },
      include: { items: true, order: { include: { items: true, payment: true } } }
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket no encontrado' });
    }

    res.json({ success: true, data: { ticket: serializeTicket(ticket) } });
  })
);

adminRoutes.patch(
  '/tickets/:id/status',
  asyncRoute(async (req, res) => {
    const status = String(req.body.status || '').trim().toUpperCase();
    const allowedStatuses = ['ISSUED', 'PRINTED', 'CANCELLED'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Estado de ticket invalido' });
    }

    const ticket = await prisma.purchaseTicket.update({
      where: { id: req.params.id },
      data: { status },
      include: { items: true }
    });

    await logAudit({
      req,
      action: 'TICKET_STATUS_UPDATED',
      entity: 'PurchaseTicket',
      entityId: ticket.id,
      message: `Ticket ${ticket.number} actualizado a ${status}`
    });

    res.json({ success: true, data: { ticket: serializeTicket(ticket) } });
  })
);

adminRoutes.get(
  '/payments',
  asyncRoute(async (req, res) => {
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      include: { order: true },
      take: Math.min(Number(req.query.limit || 200), 500)
    });

    res.json({
      success: true,
      data: {
        payments: payments.map((payment) => ({
          ...payment,
          amount: toNumber(payment.amount),
          order: payment.order ? serializeOrder(payment.order) : null
        }))
      }
    });
  })
);

adminRoutes.get(
  '/analytics',
  asyncRoute(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days || 30), 7), 365);
    const from = new Date();
    from.setDate(from.getDate() - days + 1);
    from.setHours(0, 0, 0, 0);

    const [orders, productEvents, searchEvents] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: from } },
        include: { items: true, payment: true },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.productEvent.findMany({
        where: { createdAt: { gte: from } },
        include: { product: { select: { id: true, name: true, sku: true } } }
      }),
      prisma.searchEvent.findMany({
        where: { createdAt: { gte: from } },
        orderBy: { createdAt: 'desc' },
        take: 1000
      })
    ]);

    const paidStatusesSet = new Set(['PAID', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'SHIPPED', 'DELIVERED', 'COMPLETED']);
    const dailyMap = new Map();

    for (let index = 0; index < days; index += 1) {
      const date = new Date(from);
      date.setDate(from.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      dailyMap.set(key, { date: key, orders: 0, sales: 0 });
    }

    for (const order of orders) {
      const key = new Date(order.createdAt).toISOString().slice(0, 10);
      const row = dailyMap.get(key) || { date: key, orders: 0, sales: 0 };
      row.orders += 1;
      if (paidStatusesSet.has(order.status)) row.sales += toNumber(order.total);
      dailyMap.set(key, row);
    }

    const productStats = new Map();
    for (const event of productEvents) {
      const current = productStats.get(event.productId) || {
        productId: event.productId,
        name: event.product?.name || 'Producto',
        sku: event.product?.sku || '',
        views: 0,
        addToCart: 0,
        favorites: 0,
        checkout: 0
      };
      if (event.type === 'VIEW') current.views += 1;
      if (event.type === 'ADD_TO_CART') current.addToCart += 1;
      if (event.type === 'FAVORITE') current.favorites += 1;
      if (event.type === 'CHECKOUT') current.checkout += 1;
      productStats.set(event.productId, current);
    }

    const searchMap = new Map();
    for (const event of searchEvents) {
      const key = event.query.toLowerCase();
      const current = searchMap.get(key) || { query: event.query, count: 0, zeroResults: 0 };
      current.count += 1;
      if (event.resultsCount === 0) current.zeroResults += 1;
      searchMap.set(key, current);
    }

    res.json({
      success: true,
      data: {
        periodDays: days,
        daily: [...dailyMap.values()],
        products: [...productStats.values()].sort((a, b) => b.views + b.addToCart * 2 - (a.views + a.addToCart * 2)).slice(0, 12),
        searches: [...searchMap.values()].sort((a, b) => b.count - a.count).slice(0, 15)
      }
    });
  })
);

adminRoutes.post(
  '/products',
  asyncRoute(async (req, res) => {
    const {
      name,
      slug,
      sku,
      categoryId,
      categorySlug,
      subcategory = 'General',
      brand = 'FZAC',
      stock = 0,
      stockMinimum = 5,
      unit = 'unidad',
      price,
      comparePrice,
      image,
      gallery = [],
      description = '',
      specifications = {},
      featured = false,
      onSale = false,
      active = true
    } = req.body;

    if (!name || !sku || !Number.isFinite(Number(price))) {
      return res.status(400).json({ success: false, message: 'Nombre, SKU y precio son obligatorios' });
    }

    let resolvedCategoryId = categoryId;
    if (!resolvedCategoryId && categorySlug) {
      const category = await prisma.category.findUnique({ where: { slug: categorySlug } });
      resolvedCategoryId = category?.id;
    }

    if (!resolvedCategoryId) {
      return res.status(400).json({ success: false, message: 'Categoría inválida' });
    }

    const product = await prisma.product.create({
      data: {
        name: String(name).trim(),
        slug: slug || toSlug(name),
        sku: String(sku).trim().toUpperCase(),
        categoryId: resolvedCategoryId,
        subcategory: String(subcategory || 'General').trim(),
        brand: String(brand || 'FZAC').trim(),
        stock: Number(stock || 0),
        stockMinimum: Number(stockMinimum || 5),
        unit: String(unit || 'unidad'),
        price: Number(price),
        comparePrice: comparePrice ? Number(comparePrice) : null,
        image: image || (Array.isArray(gallery) ? gallery[0] : '') || '',
        gallery: Array.isArray(gallery) ? gallery.filter(Boolean) : [],
        description: String(description || '').trim(),
        specifications: specifications || {},
        featured: Boolean(featured),
        onSale: Boolean(onSale),
        active: Boolean(active)
      },
      include: { category: true }
    });

    await logAudit({
      req,
      action: 'PRODUCT_CREATED',
      entity: 'Product',
      entityId: product.id,
      message: `Producto creado: ${product.name}`,
      metadata: { sku: product.sku, price: toNumber(product.price), stock: product.stock }
    });

    res.status(201).json({ success: true, data: { product: serializeProduct(product) } });
  })
);

adminRoutes.delete(
  '/products/:id',
  asyncRoute(async (req, res) => {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ success: false, message: 'Producto no encontrado' });

    const updated = await prisma.product.update({
      where: { id: product.id },
      data: { active: false }
    });

    await logAudit({
      req,
      action: 'PRODUCT_DEACTIVATED',
      entity: 'Product',
      entityId: product.id,
      message: `Producto desactivado: ${product.name}`
    });

    res.json({ success: true, data: { product: updated }, message: 'Producto desactivado' });
  })
);

adminRoutes.get(
  '/categories',
  asyncRoute(async (req, res) => {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });

    res.json({
      success: true,
      data: categories.map((category) => ({
        ...category,
        productsCount: category._count.products
      }))
    });
  })
);

adminRoutes.post(
  '/categories',
  asyncRoute(async (req, res) => {
    const { name, slug, description = '', image = '', active = true, sortOrder = 0, parentId = null } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Nombre requerido' });

    const category = await prisma.category.create({
      data: {
        name: String(name).trim(),
        slug: slug || toSlug(name),
        description: String(description || '').trim(),
        image: String(image || ''),
        active: Boolean(active),
        sortOrder: Number(sortOrder || 0),
        parentId: parentId || null
      }
    });

    res.status(201).json({ success: true, data: category });
  })
);

adminRoutes.patch(
  '/categories/:id',
  asyncRoute(async (req, res) => {
    const data = { ...req.body };
    if (data.name && !data.slug) data.slug = toSlug(data.name);
    if (data.sortOrder !== undefined) data.sortOrder = Number(data.sortOrder || 0);
    if (data.active !== undefined) data.active = Boolean(data.active);

    const category = await prisma.category.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: category });
  })
);

adminRoutes.delete(
  '/categories/:id',
  asyncRoute(async (req, res) => {
    const productsCount = await prisma.product.count({ where: { categoryId: req.params.id } });
    if (productsCount > 0) {
      return res.status(409).json({ success: false, message: 'No podés eliminar una categoría con productos' });
    }

    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Categoría eliminada' });
  })
);

adminRoutes.post(
  '/uploads/image',
  upload.single('image'),
  asyncRoute(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Imagen requerida' });
    const url = await uploadToCloudinary(req.file.buffer);
    res.status(201).json({ success: true, data: { url } });
  })
);

export default adminRoutes;
