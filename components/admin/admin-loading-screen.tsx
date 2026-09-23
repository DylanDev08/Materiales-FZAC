import Image from "next/image";

export function AdminLoadingScreen({
  title = "Cargando panel FZAC",
  description = "Estamos preparando metricas, pedidos, pagos y actividad del panel administrativo."
}: {
  title?: string;
  description?: string;
}) {
  return (
    <main className="admin-loading-screen admin-loading-screen--layout" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{title}. {description}</span>
      <section className="admin-loading-shell" aria-hidden="true">
        <aside className="admin-loading-sidebar">
          <div className="admin-loading-brand">
            <div className="admin-loading-logo">
              <Image src="/logoFZAC.jpg" alt="" width={54} height={54} priority unoptimized />
            </div>
            <div><span className="admin-skeleton-line admin-skeleton-line--medium" /><span className="admin-skeleton-line admin-skeleton-line--short" /></div>
          </div>
          <div className="admin-loading-nav">
            {Array.from({ length: 8 }, (_, index) => <span className={index === 0 ? "is-active" : undefined} key={index} />)}
          </div>
        </aside>
        <div className="admin-loading-workspace">
          <header className="admin-loading-topbar">
            <div><span className="admin-skeleton-line admin-skeleton-line--title" /><span className="admin-skeleton-line admin-skeleton-line--medium" /></div>
            <span className="admin-loading-avatar" />
          </header>
          <div className="admin-loading-content">
            <div className="admin-loading-cards">
              {Array.from({ length: 3 }, (_, index) => <article key={index}><span /><span /><strong /></article>)}
            </div>
            <section className="admin-loading-panel">
              <header><span className="admin-skeleton-line admin-skeleton-line--title" /><span className="admin-skeleton-line admin-skeleton-line--short" /></header>
              <div className="admin-loading-table">
                {Array.from({ length: 5 }, (_, index) => <span key={index} />)}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
