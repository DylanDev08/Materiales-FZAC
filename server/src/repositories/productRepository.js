import { prisma } from '../config/db.js';

const buildWhere = ({ search, category, brand, minPrice, maxPrice, min, max, stock, inStock, onSale, featured, active = true }) => {
  const where = { active: active === true || active === 'true' || active === undefined };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { brand: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } }
    ];
  }
  if (category) where.category = { slug: category };
  if (brand) where.brand = { in: Array.isArray(brand) ? brand : [brand] };
  const low = minPrice ?? min;
  const high = maxPrice ?? max;
  if (low || high) where.price = { gte: low ? Number(low) : undefined, lte: high ? Number(high) : undefined };
  if (stock === 'available' || inStock === 'true' || inStock === true) where.stock = { gt: 0 };
  if (onSale !== undefined && onSale !== '') where.onSale = onSale === true || onSale === 'true';
  if (featured !== undefined && featured !== '') where.featured = featured === true || featured === 'true';
  return where;
};

const buildOrder = (sort) => {
  switch (sort) {
    case 'price_asc':
      return { price: 'asc' };
    case 'price_desc':
      return { price: 'desc' };
    case 'newest':
    case 'recent':
      return { createdAt: 'desc' };
    default:
      return [{ featured: 'desc' }, { createdAt: 'desc' }];
  }
};

export const productRepository = {
  async list(params = {}) {
    const page = Number(params.page || 1);
    const limit = Math.min(Number(params.limit || 12), 48);
    const skip = (page - 1) * limit;
    const where = buildWhere(params);

    const [items, total, brands] = await Promise.all([
      prisma.product.findMany({ where, include: { category: true }, orderBy: buildOrder(params.sort), skip, take: limit }),
      prisma.product.count({ where }),
      prisma.product.findMany({ where: { active: true }, distinct: ['brand'], select: { brand: true }, orderBy: { brand: 'asc' } })
    ]);

    return { items, total, page, pages: Math.ceil(total / limit), brands: brands.map((b) => b.brand) };
  },
  findBySlug(slug) {
    return prisma.product.findFirst({ where: { slug, active: true }, include: { category: true, reviews: { where: { approved: true } } } });
  },
  related(product) {
    return prisma.product.findMany({
      where: { active: true, categoryId: product.categoryId, id: { not: product.id } },
      include: { category: true },
      take: 4,
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }]
    });
  },
  create(data) {
    return prisma.product.create({ data, include: { category: true } });
  },
  update(id, data) {
    return prisma.product.update({ where: { id }, data, include: { category: true } });
  },
  delete(id) {
    return prisma.product.update({ where: { id }, data: { active: false } });
  }
};
