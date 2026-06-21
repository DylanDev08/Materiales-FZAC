import { prisma } from '../config/db.js';

export const healthController = {
  api: async (req, res) => {
    res.json({
      success: true,
      message: 'Materiales FZAC API funcionando',
      timestamp: new Date().toISOString()
    });
  },

  database: async (req, res) => {
    await prisma.$queryRaw`SELECT 1`;

    const [users, categories, products, orders] = await Promise.all([
      prisma.user.count(),
      prisma.category.count(),
      prisma.product.count(),
      prisma.order.count()
    ]);

    res.json({
      success: true,
      message: 'Database connected',
      data: {
        users,
        categories,
        products,
        orders
      }
    });
  }
};