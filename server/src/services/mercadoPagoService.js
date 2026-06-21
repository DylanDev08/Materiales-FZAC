import { MercadoPagoConfig, Payment as MercadoPagoPayment, Preference } from 'mercadopago';

import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const clientUrl = () => env.CLIENT_URL.replace(/\/$/, '');
const apiUrl = () => env.API_URL.replace(/\/$/, '');

const toNumber = (value) => Number(value || 0);

const getClient = () => {
  if (!env.MERCADOPAGO_ACCESS_TOKEN) {
    if (env.NODE_ENV === 'production') {
      throw new ApiError(500, 'Mercado Pago no esta configurado');
    }

    return null;
  }

  return new MercadoPagoConfig({ accessToken: env.MERCADOPAGO_ACCESS_TOKEN });
};

export const mapMercadoPagoStatus = (status) => {
  const normalizedStatus = String(status || '').toLowerCase();

  if (normalizedStatus === 'approved') return 'PAID';
  if (normalizedStatus === 'refunded') return 'REFUNDED';
  if (normalizedStatus === 'expired') return 'EXPIRED';

  if (
    normalizedStatus === 'rejected' ||
    normalizedStatus === 'cancelled' ||
    normalizedStatus === 'charged_back'
  ) {
    return 'FAILED';
  }

  return 'PENDING';
};

export const mercadoPagoService = {
  async createPreference(order) {
    const client = getClient();

    if (!client) {
      return {
        id: `mock_mp_${order.id}`,
        initPoint: `${clientUrl()}/pago-pendiente?order_id=${order.id}&mock=true`,
        sandboxInitPoint: `${clientUrl()}/pago-pendiente?order_id=${order.id}&mock=true`,
        mock: true,
        mockUrls: {
          approved: `${clientUrl()}/pago-aprobado?order_id=${order.id}&mock=true`,
          rejected: `${clientUrl()}/pago-rechazado?order_id=${order.id}&mock=true`,
          pending: `${clientUrl()}/pago-pendiente?order_id=${order.id}&mock=true`
        },
        raw: { mode: 'mock', provider: 'MERCADOPAGO', simulated: true }
      };
    }

    const preferenceClient = new Preference(client);

    const items = order.items.map((item) => ({
      id: item.sku || item.id,
      title: item.name,
      quantity: Number(item.quantity || 1),
      unit_price: toNumber(item.price),
      currency_id: 'ARS'
    }));

    if (toNumber(order.shippingCost) > 0) {
      items.push({
        id: `shipping-${order.id}`,
        title: 'Envio coordinado Materiales FZAC',
        quantity: 1,
        unit_price: toNumber(order.shippingCost),
        currency_id: 'ARS'
      });
    }

    const preference = await preferenceClient.create({
      body: {
        items,
        external_reference: order.id,
        notification_url: `${apiUrl()}/api/payments/mercadopago/webhook`,
        back_urls: {
          success: `${clientUrl()}/pago-aprobado?order_id=${order.id}`,
          failure: `${clientUrl()}/pago-rechazado?order_id=${order.id}`,
          pending: `${clientUrl()}/pago-pendiente?order_id=${order.id}`
        },
        auto_return: 'approved',
        metadata: {
          orderId: order.id,
          userId: order.userId
        },
        payer: {
          name: order.customerName,
          email: order.customerEmail,
          phone: { number: order.customerPhone || '' }
        }
      }
    });

    return {
      id: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
      raw: preference
    };
  },

  async getPayment(paymentId) {
    const client = getClient();
    if (!client) throw new ApiError(503, 'Mercado Pago no esta disponible en este entorno');

    const paymentClient = new MercadoPagoPayment(client);
    return paymentClient.get({ id: paymentId });
  },

  resolveOrderId(payment) {
    return (
      payment?.external_reference ||
      payment?.metadata?.order_id ||
      payment?.metadata?.orderId ||
      null
    );
  }
};
