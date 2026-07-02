import { AdminShell } from "@/components/admin/admin-shell";

const swatches = [
  { label: "Negro principal", color: "#0B0B0B" },
  { label: "Panel oscuro", color: "#1F1F1F" },
  { label: "Amarillo FZAC", color: "#F4C400" },
  { label: "Verde stock", color: "#16834A" },
  { label: "Rojo error", color: "#C83232" },
  { label: "Gris texto", color: "#B8B8B8" }
];

export function AdminAppearance() {
  return (
    <AdminShell title="Apariencia">
      <section className="admin-panel">
        <h2>Identidad visual</h2>
        <p style={{ color: "var(--color-muted)" }}>
          Estos tokens respetan la identidad FZAC. El admin no permite CSS arbitrario ni JavaScript inyectado.
        </p>
        <div className="appearance-grid">
          {swatches.map((swatch) => (
            <article className="appearance-swatch" style={{ background: swatch.color }} key={swatch.label}>
              <strong>{swatch.label}</strong>
              <span>{swatch.color}</span>
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
