import { prisma } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { orderService } from '../services/orderService.js';

export const adminController = {
  dashboard: asyncHandler(async (_req, res) => {
    const [orders, paidOrders, products, users] = await Promise.all([
      prisma.order.count(),
      prisma.order.findMany({
        where: { status: { in: ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'] } },
        select: { total: true }
      }),
      prisma.product.count({ where: { active: true } }),
      prisma.user.count()
    ]);

    const sales = paidOrders.reduce((acc, order) => acc + Number(order.total), 0);
    res.json({ success: true, data: { sales, revenue: sales, orders, products, users, customers: users } });
  }),

  orders: asyncHandler(async (req, res) => {
    const data = await orderService.listAll(req.query);
    res.json({ success: true, data });
  }),

  updateOrderStatus: asyncHandler(async (req, res) => {
    const data = await orderService.updateStatus(req.params.id, req.body.status);
    res.json({ success: true, data });
  })
};
