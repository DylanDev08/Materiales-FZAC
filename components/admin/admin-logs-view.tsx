import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";

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

      <section className="admin-panel">
        <div className="admin-table-heading">
          <div>
            <span className="kicker">Historial</span>
            <h2>Registro completo</h2>
          </div>
          <Activity size={22} />
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                {["Tipo", "Mensaje", "Referencia", "Fecha"].map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row, index) => (
                  <tr key={`${row.Tipo}-${row.Fecha}-${index}`}>
                    <td data-label="Tipo">{row.Tipo ?? "-"}</td>
                    <td data-label="Mensaje">{row.Mensaje ?? "-"}</td>
                    <td data-label="Referencia">{row.Referencia ?? "-"}</td>
                    <td data-label="Fecha">{row.Fecha ?? "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>No hay logs para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
