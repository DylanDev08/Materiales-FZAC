export type DashboardMetric = {
  label: string;
  value: string;
  helper: string;
};

export type AdminAttentionTask = {
  key: "pending-orders" | "pending-payments" | "rejected-payments" | "out-of-stock" | "low-stock" | "overdue-suppliers" | "pending-chats" | "system";
  label: string;
  value: number;
  route: string;
  helper: string;
};

export function numericDashboardMetric(metrics: DashboardMetric[], label: string) {
  const raw = metrics.find((metric) => metric.label === label)?.value ?? "0";
  const parsed = Number(String(raw).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildAdminAttentionTasks(metrics: DashboardMetric[], paymentsReady: boolean): AdminAttentionTask[] {
  return [
    {
      key: "pending-orders",
      label: "Pedidos pendientes",
      value: numericDashboardMetric(metrics, "Pedidos pendientes"),
      route: "/pedidos",
      helper: "Revisar compras nuevas y coordinar entrega o retiro."
    },
    {
      key: "pending-payments",
      label: "Pagos pendientes",
      value: numericDashboardMetric(metrics, "Pagos pendientes"),
      route: "/pagos",
      helper: "Controlar cobros que todavía esperan confirmación."
    },
    {
      key: "rejected-payments",
      label: "Pagos rechazados",
      value: numericDashboardMetric(metrics, "Pagos rechazados"),
      route: "/pagos",
      helper: "Revisar rechazos y orientar al cliente sin duplicar cobros."
    },
    {
      key: "out-of-stock",
      label: "Productos agotados",
      value: numericDashboardMetric(metrics, "Productos sin stock"),
      route: "/inventario",
      helper: "Priorizar reposición o confirmar disponibilidad antes de vender."
    },
    {
      key: "low-stock",
      label: "Stock bajo",
      value: numericDashboardMetric(metrics, "Productos bajo stock"),
      route: "/inventario",
      helper: "Revisar cobertura y preparar la próxima reposición."
    },
    {
      key: "overdue-suppliers",
      label: "Cuentas vencidas",
      value: numericDashboardMetric(metrics, "Cuentas vencidas"),
      route: "/cuentas-proveedores",
      helper: "Revisar facturas vencidas y registrar pagos pendientes."
    },
    {
      key: "pending-chats",
      label: "Chats pendientes",
      value: numericDashboardMetric(metrics, "Chats pendientes"),
      route: "/chats",
      helper: "Responder consultas que el asistente no pudo resolver."
    },
    {
      key: "system",
      label: "Estado del sistema",
      value: paymentsReady ? 0 : 1,
      route: "/sistema",
      helper: "Revisar los pendientes operativos antes de cobrar en producción."
    }
  ];
}
