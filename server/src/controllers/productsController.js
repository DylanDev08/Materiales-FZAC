import { asyncHandler } from '../utils/asyncHandler.js';
import { productService } from '../services/productService.js';

export const productsController = {
  list: asyncHandler(async (req, res) => {
    const data = await productService.list(req.query);
    res.json({ success: true, data });
  }),

  detail: asyncHandler(async (req, res) => {
    const data = await productService.detail(req.params.slug);
    res.json({ success: true, data });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await productService.create(req.body);
    res.status(201).json({ success: true, data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await productService.update(req.params.id, req.body);
    res.json({ success: true, data });
  }),

  remove: asyncHandler(async (req, res) => {
    await productService.remove(req.params.id);
    res.json({ success: true, message: 'Producto desactivado' });
  })
};
