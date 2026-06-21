import { asyncHandler } from '../utils/asyncHandler.js';
import { orderService } from '../services/orderService.js';
import { mercadoPagoService } from '../services/mercadoPagoService.js';

export const checkoutController = {
  createSession: asyncHandler(async (req, res) => {
    const order = await orderService.createPendingOrder({
      userId: req.user?.id,
      customer: req.body.customer,
      shippingMethod: req.body.shippingMethod || req.body.deliveryMethod,
      address: req.body.address,
      notes: req.body.notes,
      items: req.body.items
    });

    const preference = await mercadoPagoService.createPreference(order);
    await orderService.updatePendingPayment(order.id, {
      provider: 'MERCADOPAGO',
      status: 'PENDING',
      amount: order.total,
      currency: 'ars',
      providerSessionId: preference.id,
      raw: preference.raw
    });

    res.status(201).json({
      success: true,
      data: {
        orderId: order.id,
        provider: 'MERCADOPAGO',
        preferenceId: preference.id,
        url: preference.initPoint || preference.sandboxInitPoint,
        checkoutUrl: preference.initPoint || preference.sandboxInitPoint,
        initPoint: preference.initPoint,
        sandboxInitPoint: preference.sandboxInitPoint
      }
    });
  })
};
