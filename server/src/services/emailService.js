import { transporter } from '../config/mail.js';
import { env } from '../config/env.js';

export const emailService = {
  async sendOrderPaid(order) {
    if (!env.SMTP_USER || !env.SMTP_PASS) return null;

    const items = order.items.map((item) => `
      <li>${item.quantity} x ${item.name} - $${Number(item.price).toLocaleString('es-AR')}</li>
    `).join('');

    return transporter.sendMail({
      from: env.SMTP_FROM,
      to: order.customerEmail,
      subject: `Pedido confirmado #${order.id.slice(0, 8).toUpperCase()} - Materiales FZAC`,
      html: `
        <h1>Pago aprobado</h1>
        <p>Hola ${order.customerName}, confirmamos tu compra en Materiales FZAC.</p>
        <ul>${items}</ul>
        <p><strong>Total:</strong> $${Number(order.total).toLocaleString('es-AR')}</p>
        <p>Nos comunicaremos para coordinar ${order.shippingMethod === 'DELIVERY' ? 'el envío' : 'el retiro'}.</p>
      `
    });
  }
};
