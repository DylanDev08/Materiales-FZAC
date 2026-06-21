import { asyncHandler } from '../utils/asyncHandler.js';
import { categoryRepository } from '../repositories/categoryRepository.js';
import { toSlug } from '../utils/slug.js';

export const categoryController = {
  list: asyncHandler(async (_req, res) => {
    const categories = await categoryRepository.list();
    const data = categories.map((category) => ({ ...category, productsCount: category._count?.products || 0 }));
    res.json({ success: true, data });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await categoryRepository.create({
      ...req.body,
      slug: req.body.slug || toSlug(req.body.name)
    });
    res.status(201).json({ success: true, data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await categoryRepository.update(req.params.id, {
      ...req.body,
      slug: req.body.slug || (req.body.name ? toSlug(req.body.name) : undefined)
    });
    res.json({ success: true, data });
  }),

  remove: asyncHandler(async (req, res) => {
    await categoryRepository.delete(req.params.id);
    res.json({ success: true, message: 'Categoría eliminada' });
  })
};
