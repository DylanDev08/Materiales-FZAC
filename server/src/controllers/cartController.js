import { prisma } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { serializeProduct } from '../utils/format.js';

const serializeCartItem = (item) => ({
  ...item,
  product: serializeProduct(item.product),
  lineTotal: Number(item.product.price) * item.quantity
});

export const cartController = {
  list: asyncHandler(async (req, res) => {
    const items = await prisma.cartItem.findMany({
      where: { userId: req.user.id },
      include: { product: { include: { category: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: items.map(serializeCartItem) });
  }),

  add: asyncHandler(async (req, res) => {
    const { productId, quantity = 1 } = req.body;
    const product = await prisma.product.findUnique({ where: { id: productId } });

    if (!product || !product.active) throw new ApiError(404, 'Producto no encontrado');
    if (product.stock < quantity) throw new ApiError(409, 'Stock insuficiente');

    const current = await prisma.cartItem.findUnique({ where: { userId_productId: { userId: req.user.id, productId } } });
    if (current && current.quantity + quantity > product.stock) throw new ApiError(409, 'Stock insuficiente');

    const item = await prisma.cartItem.upsert({
      where: { userId_productId: { userId: req.user.id, productId } },
      update: { quantity: { increment: quantity } },
      create: { userId: req.user.id, productId, quantity },
      include: { product: { include: { category: true } } }
    });

    res.status(201).json({ success: true, data: serializeCartItem(item) });
  }),

  update: asyncHandler(async (req, res) => {
    const quantity = Number(req.body.quantity);
    if (quantity < 1) throw new ApiError(400, 'Cantidad inválida');

    const existing = await prisma.cartItem.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { product: true } });
    if (!existing) throw new ApiError(404, 'Item de carrito no encontrado');
    if (existing.product.stock < quantity) throw new ApiError(409, 'Stock insuficiente');

    const item = await prisma.cartItem.update({
      where: { id: req.params.id },
      data: { quantity },
      include: { product: { include: { category: true } } }
    });

    res.json({ success: true, data: serializeCartItem(item) });
  }),

  remove: asyncHandler(async (req, res) => {
    const deleted = await prisma.cartItem.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    if (!deleted.count) throw new ApiError(404, 'Item de carrito no encontrado');
    res.json({ success: true, message: 'Producto eliminado del carrito' });
  }),

  clear: asyncHandler(async (req, res) => {
    await prisma.cartItem.deleteMany({ where: { userId: req.user.id } });
    res.json({ success: true, message: 'Carrito vaciado' });
  })
};
