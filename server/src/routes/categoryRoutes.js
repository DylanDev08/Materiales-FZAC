import { Router } from 'express';
import { prisma } from '../config/db.js';

export const categoryRoutes = Router();

const asyncRoute = (handler) => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

categoryRoutes.get(
  '/',
  asyncRoute(async (req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: [
        {
          sortOrder: 'asc'
        },
        {
          name: 'asc'
        }
      ],
      include: {
        _count: {
          select: {
            products: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        active: category.active,
        sortOrder: category.sortOrder,
        productsCount: category._count.products,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt
      }))
    });
  })
);

categoryRoutes.get(
  '/:slug',
  asyncRoute(async (req, res) => {
    const category = await prisma.category.findUnique({
      where: {
        slug: req.params.slug
      },
      include: {
        _count: {
          select: {
            products: true
          }
        }
      }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    res.json({
      success: true,
      data: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        active: category.active,
        sortOrder: category.sortOrder,
        productsCount: category._count.products,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt
      }
    });
  })
);

export default categoryRoutes;