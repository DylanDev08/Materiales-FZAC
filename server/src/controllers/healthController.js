import { prisma } from '../config/db.js';
import { env } from '../config/env.js';

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
  },

  environment: async (req, res) => {
    res.json({
      success: true,
      data: {
        nodeEnv: env.NODE_ENV,
        database: Boolean(env.DATABASE_URL),
        directUrl: Boolean(env.DIRECT_URL),
        jwt: Boolean(env.JWT_ACCESS_SECRET && env.JWT_REFRESH_SECRET),
        clientUrl: Boolean(env.CLIENT_URL),
        apiUrl: Boolean(env.API_URL),
        mercadoPago: Boolean(env.MERCADOPAGO_ACCESS_TOKEN),
        mercadoPagoMock: !env.MERCADOPAGO_ACCESS_TOKEN,
        openai: Boolean(env.OPENAI_API_KEY && env.ASSISTANT_ENABLED),
        cloudinary: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
        smtp: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)
      }
    });
  }
};
