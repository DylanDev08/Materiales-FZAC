import { asyncHandler } from '../utils/asyncHandler.js';
import { orderService } from '../services/orderService.js';
import { orderRepository } from '../repositories/orderRepository.js';
import { ApiError } from '../utils/ApiError.js';
import { serializeOrder } from '../utils/format.js';

export const orderController = {
  mine: asyncHandler(async (req, res) => {
    const data = await orderService.listForUser(req.user.id);
    res.json({ success: true, data });
  }),

  detail: asyncHandler(async (req, res) => {
    const order = await orderRepository.findById(req.params.id);
    if (!order) throw new ApiError(404, 'Pedido no encontrado');

    if (req.user.role !== 'ADMIN' && order.userId !== req.user.id) {
      throw new ApiError(403, 'No autorizado');
    }

    res.json({ success: true, data: serializeOrder(order) });
  })
};
