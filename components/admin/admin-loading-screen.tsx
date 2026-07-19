import Image from "next/image";
import { ShieldCheck } from "lucide-react";

export function AdminLoadingScreen({
  title = "Cargando panel FZAC",
  description = "Estamos preparando metricas, pedidos, pagos y actividad del panel administrativo."
}: {
  title?: string;
  description?: string;
}) {
  return (
    <main className="admin-loading-screen" role="status" aria-live="polite">
      <section className="admin-loading-card">
        <div className="admin-loading-logo">
          <Image src="/logoFZAC.jpg" alt="FZAC" width={84} height={84} priority unoptimized />
        </div>
        <span className="kicker">Panel protegido</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="admin-loading-progress" aria-hidden="true">
          <span />
        </div>
        <div className="admin-loading-steps" aria-hidden="true">
          {["Validando administrador", "Cargando datos", "Armando vista"].map((step) => (
            <span key={step}>
              <ShieldCheck size={16} />
              {step}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
