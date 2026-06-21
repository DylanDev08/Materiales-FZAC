export const currency = (value) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(number);
};

export const statusLabel = (status) => {
  const labels = {
    PENDING: 'Pendiente',
    PAID: 'Pagado',
    PREPARING: 'Preparando',
    SHIPPED: 'Enviado',
    DELIVERED: 'Entregado',
    CANCELLED: 'Cancelado'
  };
  return labels[status] || status;
};
