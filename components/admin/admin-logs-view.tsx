import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { AdminInteractiveTable } from "@/components/admin/admin-interactive-table";

type AdminLogRow = Record<string, string | number | null | undefined>;

function isImportantLog(row: AdminLogRow) {
  const value = `${row.Tipo ?? ""} ${row.Mensaje ?? ""}`.toLowerCase();
  return ["rechaz", "error", "conflicto", "stock", "pago", "revisar", "pendiente"].some((word) => value.includes(word));
}

export function AdminLogsView({ rows }: { rows: AdminLogRow[] }) {
  const importantRows = rows.filter(isImportantLog).slice(0, 6);

  return (
    <div className="admin-logs-view">
      <section className="admin-panel admin-logs-priority">
        <div>
          <span className="kicker">Revision rapida</span>
          <h2>Actividad destacada</h2>
          <p className="admin-help">Eventos de pagos, stock o situaciones que conviene revisar antes que el historial completo.</p>
        </div>
        <div className="admin-logs-priority__grid">
          {importantRows.length ? (
            importantRows.map((row, index) => (
              <article key={`${row.Tipo}-${row.Fecha}-${index}`}>
                <AlertTriangle size={18} />
                <strong>{row.Tipo ?? "Evento"}</strong>
                <span>{row.Mensaje ?? "-"}</span>
                <small>
                  {row.Referencia ?? "-"} - {row.Fecha ?? "-"}
                </small>
              </article>
            ))
          ) : (
            <article className="admin-logs-priority__ok">
              <CheckCircle2 size={18} />
              <strong>Sin avisos urgentes</strong>
              <span>El sistema no marco eventos criticos recientes.</span>
              <small>Revisa el historial si necesitas auditar una accion puntual.</small>
            </article>
          )}
        </div>
      </section>

      <AdminInteractiveTable title="Actividad" columns={["Tipo", "Mensaje", "Referencia", "Fecha"]} rows={rows} />
    </div>
  );
}
