import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { AdminInteractiveTable } from "@/components/admin/admin-interactive-table";

type AdminLogRow = Record<string, string | number | null | undefined>;

function isImportantLog(row: AdminLogRow) {
  const value = `${row.Tipo ?? ""} ${row.Mensaje ?? ""}`.toLowerCase();
  return ["rechaz", "error", "conflicto", "stock", "pago", "revisar", "pendiente"].some((word) => value.includes(word));
}

function logStatus(row: AdminLogRow) {
  const value = `${row.Tipo ?? ""} ${row.Mensaje ?? ""}`.toLowerCase();
  if (["rechaz", "error", "deneg", "fall"].some((word) => value.includes(word))) return "Denegado";
  if (["pendiente", "revisar", "stock", "esper"].some((word) => value.includes(word))) return "Pendiente";
  if (["aprob", "pagado", "confirm", "emitido"].some((word) => value.includes(word))) return "Aprobado";
  return "Informativo";
}

function logAction(row: AdminLogRow) {
  const value = `${row.Tipo ?? ""} ${row.Mensaje ?? ""}`.toLowerCase();
  if (value.includes("pago")) return "Revisar pagos";
  if (value.includes("pedido")) return "Revisar pedido";
  if (value.includes("stock")) return "Revisar stock";
  if (value.includes("chat")) return "Responder chat";
  return "Ver detalle";
}

export function AdminLogsView({ rows }: { rows: AdminLogRow[] }) {
  const importantRows = rows.filter(isImportantLog).slice(0, 6);
  const tableRows = rows.map((row) => ({
    Fecha: row.Fecha,
    Tipo: row.Tipo,
    Estado: logStatus(row),
    Descripcion: row.Mensaje,
    Referencia: row.Referencia,
    Accion: logAction(row),
    Mensaje: row.Mensaje
  }));

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

      <AdminInteractiveTable title="Actividad" columns={["Fecha", "Tipo", "Estado", "Descripcion", "Referencia", "Accion"]} rows={tableRows} />
    </div>
  );
}
