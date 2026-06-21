import { Router } from 'express';
import { prisma } from '../config/db.js';
import { optionalAuth } from '../middleware/authMiddleware.js';
import { createRateLimit } from '../middleware/rateLimitMiddleware.js';

export const productRoutes = Router();

const asyncRoute = (handler) => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

const toNumber = (value) => Number(value || 0);

const serializeProduct = (product) => {
  if (!product) return null;

  const stock = Number(product.stock || 0);

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
    stockActual: stock,
    stockReserved: 0,
    stockMinimum: Number(product.stockMinimum ?? 5),
    unit: product.unit || 'unidad',
    subcategory: product.subcategory || 'General',
    specifications: product.specifications || {},

    active: product.active,
    featured: product.featured,
    onSale: product.onSale,

    metaTitle: product.name,
    metaDescription: product.description,

    category: product.category?.name || null,
    categorySlug: product.category?.slug || null,
    categoryId: product.categoryId,

    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
};

const buildOrderBy = (sort) => {
  switch (sort) {
    case 'price-asc':
    case 'price_asc':
      return { price: 'asc' };

    case 'price-desc':
    case 'price_desc':
      return { price: 'desc' };

    case 'name':
    case 'name-asc':
      return { name: 'asc' };

    case 'stock':
      return { stock: 'desc' };

    case 'oldest':
      return { createdAt: 'asc' };

    case 'newest':
    default:
      return { createdAt: 'desc' };
  }
};

productRoutes.get(
  '/',
  asyncRoute(async (req, res) => {
    const {
      q,
      search,
      category,
      categorySlug,
      brand,
      featured,
      onSale,
      active,
      minPrice,
      maxPrice,
      stock,
      sort = 'newest',
      page = 1,
      limit = 24
    } = req.query;

    const currentPage = Math.max(Number(page || 1), 1);
    const take = Math.min(Math.max(Number(limit || 24), 1), 100);
    const skip = (currentPage - 1) * take;

    const queryText = q || search;

    const where = {
      active: active === undefined ? true : active === 'true'
    };

    if (queryText) {
      where.OR = [
        { name: { contains: String(queryText), mode: 'insensitive' } },
        { description: { contains: String(queryText), mode: 'insensitive' } },
        { sku: { contains: String(queryText), mode: 'insensitive' } },
        { brand: { contains: String(queryText), mode: 'insensitive' } },
        {
          category: {
            name: { contains: String(queryText), mode: 'insensitive' }
          }
        }
      ];
    }

    const selectedCategory = categorySlug || category;

    if (selectedCategory && selectedCategory !== 'todas' && selectedCategory !== 'all') {
      where.category = {
        slug: String(selectedCategory)
      };
    }

    if (brand && brand !== 'todas' && brand !== 'all') {
      where.brand = {
        equals: String(brand),
        mode: 'insensitive'
      };
    }

    if (featured !== undefined && featured !== '') {
      where.featured = featured === 'true';
    }

    if (onSale !== undefined && onSale !== '') {
      where.onSale = onSale === 'true';
    }

    if (minPrice || maxPrice) {
      where.price = {};

      if (minPrice) {
        where.price.gte = Number(minPrice);
      }

      if (maxPrice) {
        where.price.lte = Number(maxPrice);
      }
    }

    if (stock === 'true' || stock === 'available') {
      where.stock = {
        gt: 0
      };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(sort),
        include: {
          category: true
        }
      }),

      prisma.product.count({
        where
      })
    ]);

    res.json({
      success: true,
      data: {
        products: products.map(serializeProduct),
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


productRoutes.get(
  '/brands',
  asyncRoute(async (req, res) => {
    const rows = await prisma.product.findMany({
      where: { active: true },
      distinct: ['brand'],
      select: { brand: true },
      orderBy: { brand: 'asc' }
    });

    res.json({
      success: true,
      data: rows.map((row) => row.brand).filter(Boolean)
    });
  })
);

productRoutes.get(
  '/suggestions',
  createRateLimit({ windowMs: 60_000, maxRequests: 60, keyPrefix: 'product-suggestions' }),
  optionalAuth,
  asyncRoute(async (req, res) => {
    const query = String(req.query.q || req.query.search || '').trim();

    if (query.length < 2) {
      return res.json({ success: true, data: { products: [], categories: [], brands: [] } });
    }

    const where = {
      active: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { sku: { contains: query, mode: 'insensitive' } },
        { brand: { contains: query, mode: 'insensitive' } },
        { subcategory: { contains: query, mode: 'insensitive' } },
        { category: { name: { contains: query, mode: 'insensitive' } } }
      ]
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: [{ featured: 'desc' }, { stock: 'desc' }],
        take: 8
      }),
      prisma.product.count({ where })
    ]);

    await prisma.searchEvent.create({
      data: {
        userId: req.user?.id || null,
        sessionId: String(req.query.sessionId || '').slice(0, 120) || null,
        query: query.slice(0, 160),
        resultsCount: total
      }
    }).catch(() => null);

    res.json({
      success: true,
      data: {
        products: products.map(serializeProduct),
        categories: [...new Set(products.map((product) => product.category?.name).filter(Boolean))],
        brands: [...new Set(products.map((product) => product.brand).filter(Boolean))]
      }
    });
  })
);

productRoutes.get(
  '/recommendations',
  optionalAuth,
  asyncRoute(async (req, res) => {
    const { productId, slug, category } = req.query;

    let reference = null;
    if (productId || slug) {
      reference = await prisma.product.findFirst({
        where: productId ? { id: String(productId) } : { slug: String(slug) },
        include: { category: true }
      });
    }

    const categorySlug = category || reference?.category?.slug;
    const where = {
      active: true,
      stock: { gt: 0 },
      ...(categorySlug ? { category: { slug: String(categorySlug) } } : {}),
      ...(reference ? { id: { not: reference.id } } : {})
    };

    let products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: [{ featured: 'desc' }, { onSale: 'desc' }, { stock: 'desc' }],
      take: 8
    });

    if (products.length < 4) {
      const fallback = await prisma.product.findMany({
        where: {
          active: true,
          stock: { gt: 0 },
          ...(reference ? { id: { not: reference.id } } : {})
        },
        include: { category: true },
        orderBy: [{ featured: 'desc' }, { onSale: 'desc' }, { createdAt: 'desc' }],
        take: 8
      });
      products = [...products, ...fallback].filter(
        (product, index, array) => array.findIndex((item) => item.id === product.id) === index
      ).slice(0, 8);
    }

    res.json({ success: true, data: { products: products.map(serializeProduct) } });
  })
);

productRoutes.post(
  '/events',
  createRateLimit({ windowMs: 60_000, maxRequests: 100, keyPrefix: 'product-events' }),
  optionalAuth,
  asyncRoute(async (req, res) => {
    const { productId, type = 'VIEW', sessionId, metadata } = req.body;
    const allowed = ['VIEW', 'ADD_TO_CART', 'FAVORITE', 'CHECKOUT'];
    const normalizedType = String(type).toUpperCase();

    if (!productId || !allowed.includes(normalizedType)) {
      return res.status(400).json({ success: false, message: 'Evento de producto inválido' });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, active: true },
      select: { id: true }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    const event = await prisma.productEvent.create({
      data: {
        productId: product.id,
        userId: req.user?.id || null,
        sessionId: String(sessionId || '').slice(0, 120) || null,
        type: normalizedType,
        metadata: metadata || null
      }
    });

    res.status(201).json({ success: true, data: event });
  })
);

productRoutes.get(
  '/statistics/public',
  asyncRoute(async (req, res) => {
    const [activeProducts, onSaleProducts, totalStock, categories] = await Promise.all([
      prisma.product.count({ where: { active: true } }),
      prisma.product.count({ where: { active: true, onSale: true } }),
      prisma.product.aggregate({ where: { active: true }, _sum: { stock: true } }),
      prisma.category.count()
    ]);

    res.json({
      success: true,
      data: {
        activeProducts,
        onSaleProducts,
        stockUnits: totalStock._sum.stock || 0,
        categories
      }
    });
  })
);

productRoutes.get(
  '/featured/list',
  asyncRoute(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit || 4), 1), 12);

    const products = await prisma.product.findMany({
      where: {
        active: true,
        featured: true
      },
      take: limit,
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

productRoutes.get(
  '/:slug',
  asyncRoute(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: {
        slug: req.params.slug,
        active: true
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

    const related = await prisma.product.findMany({
      where: {
        active: true,
        id: {
          not: product.id
        },
        categoryId: product.categoryId
      },
      take: 4,
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
        product: serializeProduct(product),
        related: related.map(serializeProduct)
      }
    });
  })
);

export default productRoutes;
