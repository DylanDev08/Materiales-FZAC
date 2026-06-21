export const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  createdAt: user.createdAt
});

export const serializeProduct = (product) => ({
  ...product,
  price: Number(product.price),
  comparePrice: product.comparePrice ? Number(product.comparePrice) : null
});

export const serializeTicket = (ticket) => ticket
  ? {
      ...ticket,
      subtotal: Number(ticket.subtotal),
      discount: Number(ticket.discount || 0),
      shippingCost: Number(ticket.shippingCost || 0),
      total: Number(ticket.total),
      items: ticket.items?.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.subtotal)
      })) || []
    }
  : null;

export const serializeOrder = (order) => ({
  ...order,
  subtotal: Number(order.subtotal),
  shippingCost: Number(order.shippingCost),
  total: Number(order.total),
  items: order.items?.map((item) => ({ ...item, price: Number(item.price) })) || [],
  payment: order.payment
    ? { ...order.payment, amount: Number(order.payment.amount) }
    : null,
  ticket: serializeTicket(order.ticket)
});
