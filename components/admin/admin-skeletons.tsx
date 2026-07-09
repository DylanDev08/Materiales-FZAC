export function AdminMetricSkeleton({ count = 8 }: { count?: number }) {
  return (
    <section className="metrics-grid" aria-label="Cargando metricas">
      {Array.from({ length: count }).map((_, index) => (
        <article className="metric-card admin-skeleton-card" key={index}>
          <span className="admin-skeleton admin-skeleton--icon" />
          <span className="admin-skeleton admin-skeleton--label" />
          <strong className="admin-skeleton admin-skeleton--value" />
          <small className="admin-skeleton admin-skeleton--text" />
        </article>
      ))}
    </section>
  );
}

export function AdminTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <section className="admin-panel" aria-label="Cargando tabla">
      <div className="admin-skeleton-toolbar">
        <span className="admin-skeleton admin-skeleton--search" />
        <span className="admin-skeleton admin-skeleton--filter" />
      </div>
      <div className="admin-skeleton-table">
        {Array.from({ length: rows }).map((_, index) => (
          <div className="admin-skeleton-row" key={index}>
            <span className="admin-skeleton admin-skeleton--avatar" />
            <span className="admin-skeleton admin-skeleton--wide" />
            <span className="admin-skeleton admin-skeleton--medium" />
            <span className="admin-skeleton admin-skeleton--medium" />
            <span className="admin-skeleton admin-skeleton--pill" />
            <span className="admin-skeleton admin-skeleton--button" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function UserDetailSkeleton() {
  return (
    <aside className="admin-user-drawer admin-user-drawer--skeleton" aria-label="Cargando detalle">
      <span className="admin-skeleton admin-skeleton--avatar-lg" />
      <span className="admin-skeleton admin-skeleton--wide" />
      <span className="admin-skeleton admin-skeleton--medium" />
      <div className="admin-user-detail__cards">
        {Array.from({ length: 4 }).map((_, index) => (
          <span className="admin-skeleton admin-skeleton--detail-card" key={index} />
        ))}
      </div>
      <span className="admin-skeleton admin-skeleton--wide" />
      <span className="admin-skeleton admin-skeleton--wide" />
      <span className="admin-skeleton admin-skeleton--medium" />
    </aside>
  );
}

export function OrderCardSkeleton() {
  return <span className="admin-skeleton admin-skeleton--floating-card" aria-label="Cargando pedido" />;
}

export function PaymentCardSkeleton() {
  return <span className="admin-skeleton admin-skeleton--floating-card" aria-label="Cargando pago" />;
}

export function ProductFloatingCardSkeleton() {
  return <span className="admin-skeleton admin-skeleton--product-card" aria-label="Cargando producto" />;
}
