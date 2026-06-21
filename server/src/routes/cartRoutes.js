import { Router } from 'express';
import { prisma } from '../config/db.js';
import { protect } from '../middleware/authMiddleware.js';

export const cartRoutes = Router();

const asyncRoute = (handler) => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

const toNumber = (value) => Number(value || 0);

const getAvailableStock = (product) => {
  const stockActual = Number(product.stockActual ?? product.stock ?? 0);
  const stockReserved = Number(product.stockReserved, 0);

  return Math.max(stockActual - stockReserved, 0);
};

const serializeProduct = (product) => {
  if (!product) return null;

  const stockActual = Number(product.stockActual ?? product.stock ?? 0);
  const stockReserved = Number(product.stockReserved ?? 0);
  const stock = getAvailableStock(product);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description,
    brand: product.brand,
    image: product.image,
    gallery: product.gallery || [],

    price: toNumber(product.price),
    comparePrice: product.comparePrice ? toNumber(product.comparePrice) : null,

    stock,
    stockActual,
    stockReserved,
    stockMinimum: Number(product.stockMinimum || 0),
    unit: product.unit || 'unidad',

    active: product.active,
    featured: product.featured,
    onSale: product.onSale,

    category: product.category?.name || null,
    categorySlug: product.category?.slug || null,
    categoryId: product.categoryId
  };
};

const serializeCartItem = (item) => {
  const product = serializeProduct(item.product);
  const quantity = Number(item.quantity || 0);
  const unitPrice = product?.price || 0;

  return {
    id: item.id,
    userId: item.userId,
    productId: item.productId,
    quantity,
    unitPrice,
    total: unitPrice * quantity,
    product,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
};

const buildCartResponse = (items) => {
  const serializedItems = items.map(serializeCartItem);

  const itemsCount = serializedItems.reduce((acc, item) => {
    return acc + item.quantity;
  }, 0);

  const subtotal = serializedItems.reduce((acc, item) => {
    return acc + item.total;
  }, 0);

  return {
    items: serializedItems,
    summary: {
      itemsCount,
      subtotal,
      discountTotal: 0,
      shippingCost: 0,
      total: subtotal
    }
  };
};

const getUserCartItems = async (userId) => {
  return prisma.cartItem.findMany({
    where: {
      userId
    },
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      product: {
        include: {
          category: true
        }
      }
    }
  });
};

cartRoutes.use(protect);

cartRoutes.get(
  '/',
  asyncRoute(async (req, res) => {
    const items = await getUserCartItems(req.user.id);

    res.json({
      success: true,
      data: buildCartResponse(items)
    });
  })
);

cartRoutes.get(
  '/summary',
  asyncRoute(async (req, res) => {
    const items = await getUserCartItems(req.user.id);
    const cart = buildCartResponse(items);

    res.json({
      success: true,
      data: cart.summary
    });
  })
);

cartRoutes.post(
  '/items',
  asyncRoute(async (req, res) => {
    const { productId, slug, quantity = 1 } = req.body;

    if (!productId && !slug) {
      return res.status(400).json({
        success: false,
        message: 'Producto requerido'
      });
    }

    const requestedQuantity = Math.max(Number(quantity || 1), 1);

    const product = await prisma.product.findFirst({
      where: productId
        ? {
            id: productId,
            active: true
          }
        : {
            slug,
            active: true
          }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no disponible'
      });
    }

    const availableStock = getAvailableStock(product);

    if (availableStock <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Producto sin stock disponible'
      });
    }

    const existingItem = await prisma.cartItem.findUnique({
      where: {
        userId_productId: {
          userId: req.user.id,
          productId: product.id
        }
      }
    });

    const nextQuantity = existingItem
      ? existingItem.quantity + requestedQuantity
      : requestedQuantity;

    if (nextQuantity > availableStock) {
      return res.status(400).json({
        success: false,
        message: `Stock disponible insuficiente. Disponible: ${availableStock}`
      });
    }

    if (existingItem) {
      await prisma.cartItem.update({
        where: {
          id: existingItem.id
        },
        data: {
          quantity: nextQuantity
        }
      });
    } else {
      await prisma.cartItem.create({
        data: {
          userId: req.user.id,
          productId: product.id,
          quantity: requestedQuantity
        }
      });
    }

    const items = await getUserCartItems(req.user.id);

    res.status(201).json({
      success: true,
      data: buildCartResponse(items)
    });
  })
);

cartRoutes.patch(
  '/items/:id',
  asyncRoute(async (req, res) => {
    const { quantity } = req.body;
    const nextQuantity = Number(quantity);

    const item = await prisma.cartItem.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      },
      include: {
        product: true
      }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item no encontrado'
      });
    }

    if (!Number.isFinite(nextQuantity)) {
      return res.status(400).json({
        success: false,
        message: 'Cantidad inválida'
      });
    }

    if (nextQuantity <= 0) {
      await prisma.cartItem.delete({
        where: {
          id: item.id
        }
      });

      const items = await getUserCartItems(req.user.id);

      return res.json({
        success: true,
        data: buildCartResponse(items)
      });
    }

    const availableStock = getAvailableStock(item.product);

    if (nextQuantity > availableStock) {
      return res.status(400).json({
        success: false,
        message: `Stock disponible insuficiente. Disponible: ${availableStock}`
      });
    }

    await prisma.cartItem.update({
      where: {
        id: item.id
      },
      data: {
        quantity: nextQuantity
      }
    });

    const items = await getUserCartItems(req.user.id);

    res.json({
      success: true,
      data: buildCartResponse(items)
    });
  })
);

cartRoutes.patch(
  '/products/:productId',
  asyncRoute(async (req, res) => {
    const { quantity } = req.body;
    const nextQuantity = Number(quantity);

    const item = await prisma.cartItem.findUnique({
      where: {
        userId_productId: {
          userId: req.user.id,
          productId: req.params.productId
        }
      },
      include: {
        product: true
      }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item no encontrado'
      });
    }

    if (!Number.isFinite(nextQuantity)) {
      return res.status(400).json({
        success: false,
        message: 'Cantidad inválida'
      });
    }

    if (nextQuantity <= 0) {
      await prisma.cartItem.delete({
        where: {
          id: item.id
        }
      });

      const items = await getUserCartItems(req.user.id);

      return res.json({
        success: true,
        data: buildCartResponse(items)
      });
    }

    const availableStock = getAvailableStock(item.product);

    if (nextQuantity > availableStock) {
      return res.status(400).json({
        success: false,
        message: `Stock disponible insuficiente. Disponible: ${availableStock}`
      });
    }

    await prisma.cartItem.update({
      where: {
        id: item.id
      },
      data: {
        quantity: nextQuantity
      }
    });

    const items = await getUserCartItems(req.user.id);

    res.json({
      success: true,
      data: buildCartResponse(items)
    });
  })
);

cartRoutes.delete(
  '/items/:id',
  asyncRoute(async (req, res) => {
    const item = await prisma.cartItem.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item no encontrado'
      });
    }

    await prisma.cartItem.delete({
      where: {
        id: item.id
      }
    });

    const items = await getUserCartItems(req.user.id);

    res.json({
      success: true,
      data: buildCartResponse(items)
    });
  })
);

cartRoutes.delete(
  '/products/:productId',
  asyncRoute(async (req, res) => {
    const item = await prisma.cartItem.findUnique({
      where: {
        userId_productId: {
          userId: req.user.id,
          productId: req.params.productId
        }
      }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item no encontrado'
      });
    }

    await prisma.cartItem.delete({
      where: {
        id: item.id
      }
    });

    const items = await getUserCartItems(req.user.id);

    res.json({
      success: true,
      data: buildCartResponse(items)
    });
  })
);

cartRoutes.delete(
  '/',
  asyncRoute(async (req, res) => {
    await prisma.cartItem.deleteMany({
      where: {
        userId: req.user.id
      }
    });

    res.json({
      success: true,
      data: buildCartResponse([])
    });
  })
);

export default cartRoutes;