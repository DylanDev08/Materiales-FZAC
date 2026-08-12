"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Download, FileDown, Mail, MessageCircle, Search, SlidersHorizontal, UserRound, X } from "lucide-react";
import { getWhatsAppHref } from "@/lib/utils/contact";

type CustomerRow = {
  Id?: string;
  Email?: string;
  Nombre?: string | null;
  AvatarUrl?: string | null;
  Telefono?: string | null;
  Rol?: string;
  AuthProvider?: string;
  Verificado?: string;
  Registro?: string;
  UltimoLogin?: string;
  EstadoCliente?: string;
  Compras?: number;
  PagosAprobados?: number;
  PagosPendientes?: number;
  PedidosPendientes?: number;
  PedidosCancelados?: number;
  TotalGastado?: string;
  TotalGastadoNumero?: number;
  TicketPromedio?: string;
  Pedidos?: number;
  Direccion?: string;
  Provincia?: string;
  MetodoEnvio?: string;
  Entrega?: string;
  UltimoPedido?: string;
  UltimoPago?: string;
  Chats?: number;
  Actividad?: string[];
};

export type CustomerReportIdentity = {
  commercialName: string;
  legalName: string | null;
  taxId: string | null;
  address: string;
  email: string;
  phone: string;
};

const pageSize = 8;

function initials(row: CustomerRow) {
  return String(row.Nombre || row.Email || "FZ")
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function matchesFilter(row: CustomerRow, filter: string) {
  if (filter === "active") return row.EstadoCliente === "Activo" || row.EstadoCliente === "Cliente frecuente";
  if (filter === "inactive") return row.EstadoCliente === "Sin compras";
  if (filter === "paid") return Number(row.PagosAprobados ?? 0) > 0;
  if (filter === "unpaid") return Number(row.PagosAprobados ?? 0) === 0;
  if (filter === "gmail") return row.AuthProvider === "Gmail";
  if (filter === "frequent") return row.EstadoCliente === "Cliente frecuente";
  return true;
}

function sortRows(rows: CustomerRow[], sort: string) {
  return [...rows].sort((a, b) => {
    if (sort === "orders") return Number(b.Pedidos ?? 0) - Number(a.Pedidos ?? 0);
    if (sort === "spent") return Number(b.TotalGastadoNumero ?? 0) - Number(a.TotalGastadoNumero ?? 0);
    if (sort === "login") return String(b.UltimoLogin ?? "").localeCompare(String(a.UltimoLogin ?? ""));
    return String(b.Registro ?? "").localeCompare(String(a.Registro ?? ""));
  });
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function htmlEscape(value: string | number | null | undefined) {
  return String(value ?? "-")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function customerReportHtml(rows: CustomerRow[], identity: CustomerReportIdentity) {
  const generatedAt = new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeStyle: "short" }).format(new Date());
  const totalSpent = rows.reduce((sum, row) => sum + Number(row.TotalGastadoNumero ?? 0), 0);
  const totalOrders = rows.reduce((sum, row) => sum + Number(row.Pedidos ?? 0), 0);
  const logoUrl = `${window.location.origin}/logoFZAC.jpg`;
  const body = rows
    .map(
      (row) => `<tr>
        <td><strong>${htmlEscape(row.Nombre || "Sin nombre")}</strong><small>${htmlEscape(row.Email)}</small></td>
        <td>${htmlEscape(row.Telefono)}</td>
        <td>${htmlEscape(row.Registro)}</td>
        <td>${htmlEscape(row.UltimoLogin)}</td>
        <td>${htmlEscape(row.EstadoCliente || "Sin compras")}</td>
        <td class="numeric">${htmlEscape(row.Pedidos ?? 0)}</td>
        <td class="numeric">${htmlEscape(row.TotalGastado || "$0")}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
  <html lang="es-AR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Informe de clientes FZAC</title>
      <style>
        :root { color-scheme: light; --fzac: #f4c400; --ink: #111; --muted: #5f6368; --line: #dedede; }
        * { box-sizing: border-box; }
        body { margin: 0; background: #ececec; color: var(--ink); font-family: Arial, Helvetica, sans-serif; }
        .toolbar { position: sticky; top: 0; display: flex; justify-content: flex-end; gap: 10px; background: #0b0b0b; padding: 12px 20px; }
        button { min-height: 42px; border: 0; border-radius: 5px; background: var(--fzac); color: #050505; padding: 0 18px; font-weight: 800; cursor: pointer; }
        .sheet { width: min(1120px, calc(100% - 28px)); margin: 24px auto; background: #fff; box-shadow: 0 16px 50px rgba(0,0,0,.18); }
        header { display: grid; grid-template-columns: auto 1fr auto; gap: 18px; align-items: center; border-bottom: 6px solid var(--fzac); background: #0b0b0b; color: #fff; padding: 22px 26px; }
        header img { width: 66px; height: 66px; border: 2px solid var(--fzac); border-radius: 50%; object-fit: cover; }
        header h1 { margin: 0 0 5px; color: var(--fzac); font-size: 24px; }
        header p, header small { margin: 0; color: #d0d0d0; }
        header .date { max-width: 240px; text-align: right; }
        .identity { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; border-bottom: 1px solid var(--line); padding: 16px 26px; }
        .identity div, .summary div { min-width: 0; }
        .identity span, .summary span { display: block; color: var(--muted); font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .identity strong { display: block; margin-top: 4px; overflow-wrap: anywhere; font-size: 13px; }
        .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; background: var(--line); margin: 18px 26px; border: 1px solid var(--line); }
        .summary div { background: #fff; padding: 14px; }
        .summary strong { display: block; margin-top: 4px; font-size: 20px; }
        .table-wrap { padding: 0 26px 26px; overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #171717; color: #fff; padding: 10px 9px; text-align: left; }
        td { border-bottom: 1px solid var(--line); padding: 10px 9px; vertical-align: top; }
        td strong, td small { display: block; }
        td small { margin-top: 3px; color: var(--muted); }
        .numeric { text-align: right; white-space: nowrap; }
        footer { border-top: 1px solid var(--line); color: var(--muted); padding: 14px 26px 22px; font-size: 11px; }
        @page { size: A4 landscape; margin: 10mm; }
        @media print {
          body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .toolbar { display: none; }
          .sheet { width: 100%; margin: 0; box-shadow: none; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
        }
        @media (max-width: 720px) {
          header { grid-template-columns: auto 1fr; }
          header .date { grid-column: 1 / -1; max-width: none; text-align: left; }
          .identity, .summary { grid-template-columns: 1fr 1fr; }
        }
      </style>
    </head>
    <body>
      <div class="toolbar"><button type="button" onclick="window.print()">Imprimir o guardar PDF</button></div>
      <main class="sheet">
        <header>
          <img src="${htmlEscape(logoUrl)}" alt="FZAC" />
          <div><h1>Informe de clientes</h1><p>${htmlEscape(identity.commercialName)}</p></div>
          <small class="date">Generado el ${htmlEscape(generatedAt)}</small>
        </header>
        <section class="identity">
          <div><span>Razón social</span><strong>${htmlEscape(identity.legalName || "Pendiente de configuración")}</strong></div>
          <div><span>CUIT</span><strong>${htmlEscape(identity.taxId || "Pendiente de configuración")}</strong></div>
          <div><span>Dirección</span><strong>${htmlEscape(identity.address)}</strong></div>
          <div><span>Contacto</span><strong>${htmlEscape(identity.email)} · ${htmlEscape(identity.phone)}</strong></div>
        </section>
        <section class="summary">
          <div><span>Clientes incluidos</span><strong>${rows.length}</strong></div>
          <div><span>Pedidos registrados</span><strong>${totalOrders}</strong></div>
          <div><span>Total comprado</span><strong>${htmlEscape(new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(totalSpent))}</strong></div>
        </section>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Cliente</th><th>Teléfono</th><th>Registro</th><th>Último acceso</th><th>Estado</th><th class="numeric">Pedidos</th><th class="numeric">Total</th></tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
        <footer>Documento administrativo generado por FZAC. Contiene datos personales: conservar y compartir únicamente con personal autorizado.</footer>
      </main>
    </body>
  </html>`;
}

function UserAvatar({ row, large = false }: { row: CustomerRow; large?: boolean }) {
  const [failed, setFailed] = useState(false);

  return (
    <span className={`admin-user-avatar ${large ? "admin-user-avatar--large" : ""}`}>
      {row.AvatarUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.AvatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        initials(row)
      )}
    </span>
  );
}

export function AdminCustomersView({ rows, reportIdentity }: { rows: CustomerRow[]; reportIdentity: CustomerReportIdentity }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CustomerRow | null>(rows[0] ?? null);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    const result = rows.filter((row) => {
      const matchesSearch =
        !query ||
        [row.Nombre, row.Email, row.Telefono, row.Direccion]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      return matchesSearch && matchesFilter(row, filter);
    });
    return sortRows(result, sort);
  }, [rows, search, filter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function clearFilters() {
    setSearch("");
    setFilter("all");
    setSort("recent");
    setPage(1);
  }

  function exportCsv() {
    const columns = ["Cliente", "Email", "Telefono", "Metodo login", "Registro", "Ultimo acceso", "Estado", "Pedidos", "Total gastado"];
    const csvRows = filtered.map((row) =>
      [
        row.Nombre || "Sin nombre",
        row.Email || "-",
        row.Telefono || "-",
        row.AuthProvider || "-",
        row.Registro || "-",
        row.UltimoLogin || "-",
        row.EstadoCliente || "Sin compras",
        String(row.Pedidos ?? 0),
        row.TotalGastado || "$0"
      ]
        .map(csvEscape)
        .join(",")
    );
    const blob = new Blob([`\uFEFF${[columns.map(csvEscape).join(","), ...csvRows].join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "clientes-fzac.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function openCustomerReport() {
    const blob = new Blob([customerReportHtml(filtered, reportIdentity)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <div className="admin-users-layout">
      <section className="admin-panel">
        <div className="admin-users-head">
          <div>
            <h2>Usuarios</h2>
            <p className="admin-help">Gestiona y observa la actividad de tus usuarios.</p>
          </div>
          <span>{filtered.length} usuarios</span>
        </div>

        <div className="admin-toolbar admin-toolbar--users">
          <label className="admin-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar usuario, email o telefono..."
            />
          </label>
          <label className="admin-select-label">
            <SlidersHorizontal size={16} />
            <select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Sin compras</option>
              <option value="paid">Con pagos</option>
              <option value="unpaid">Sin pagos</option>
              <option value="gmail">Gmail</option>
              <option value="frequent">Clientes frecuentes</option>
            </select>
          </label>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="recent">Mas recientes</option>
            <option value="orders">Mas compras</option>
            <option value="spent">Mas gasto</option>
            <option value="login">Ultimo acceso</option>
          </select>
          <div className="admin-table-actions">
            <button className="btn btn--ghost" type="button" onClick={clearFilters} disabled={!search && filter === "all" && sort === "recent"}>
              <X size={16} /> Limpiar
            </button>
            <button className="btn btn--ghost" type="button" onClick={exportCsv} disabled={!filtered.length}>
              <Download size={16} /> Exportar CSV
            </button>
            <button className="btn" type="button" onClick={openCustomerReport} disabled={!filtered.length}>
              <FileDown size={16} /> Informe FZAC
            </button>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table admin-users-table">
            <thead>
              <tr>
                {["Cliente", "Email", "Telefono", "Metodo login", "Ultimo acceso", "Pedidos", "Total gastado", "Estado", "Accion"].map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.length ? (
                visibleRows.map((row) => (
                  <tr key={row.Id || row.Email} className={selected?.Id === row.Id ? "is-selected" : ""}>
                    <td data-label="Cliente">
                      <button className="admin-user-cell" type="button" onClick={() => setSelected(row)}>
                        <UserAvatar row={row} />
                        <span>
                          <strong>{row.Nombre || "Sin nombre"}</strong>
                          <small>{row.Rol || "Cliente"}</small>
                        </span>
                      </button>
                    </td>
                    <td data-label="Email">
                      <div className="admin-customer-stack">
                        <strong>{row.Email}</strong>
                      </div>
                    </td>
                    <td data-label="Telefono">{row.Telefono || "-"}</td>
                    <td data-label="Metodo login">
                      <small className="status-pill">{row.AuthProvider}</small>
                    </td>
                    <td data-label="Ultimo acceso">{row.UltimoLogin || "-"}</td>
                    <td data-label="Pedidos">{row.Pedidos ?? 0}</td>
                    <td data-label="Total gastado">{row.TotalGastado || "$0"}</td>
                    <td data-label="Estado">
                      <span className={`status-pill ${row.EstadoCliente === "Cliente frecuente" ? "status-pill--warning" : "status-pill--success"}`}>
                        {row.EstadoCliente || "Sin compras"}
                      </span>
                    </td>
                    <td data-label="Accion">
                      <button className="admin-icon-button" type="button" onClick={() => setSelected(row)} aria-label="Ver detalle">
                        <ChevronRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9}>No hay usuarios para esos filtros.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="admin-pagination">
          <span>
            Mostrando {visibleRows.length ? (currentPage - 1) * pageSize + 1 : 0} a {Math.min(currentPage * pageSize, filtered.length)} de{" "}
            {filtered.length}
          </span>
          <div>
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Anterior
            </button>
            <strong>{currentPage}</strong>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              Siguiente
            </button>
          </div>
        </footer>
      </section>

      {selected ? <UserDetailDrawer row={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function UserDetailDrawer({ row, onClose }: { row: CustomerRow; onClose: () => void }) {
  const phone = String(row.Telefono || "").replace(/\D/g, "");
  const whatsappHref = phone
    ? `https://wa.me/${phone.startsWith("54") ? phone : `54${phone}`}`
    : getWhatsAppHref(`Hola FZAC, quiero contactar a ${row.Nombre || row.Email}.`);

  return (
    <aside className="admin-user-drawer" aria-label="Detalle del usuario">
      <header>
        <h2>Detalle del usuario</h2>
        <button className="admin-icon-button" type="button" onClick={onClose} aria-label="Cerrar detalle">
          <X size={18} />
        </button>
      </header>

      <div className="admin-user-detail__profile">
        <UserAvatar large row={row} />
        <div>
          <strong>{row.Nombre || "Cuenta FZAC"}</strong>
          <span>{row.Email}</span>
          <div>
            <span className="status-pill">{row.AuthProvider}</span>
            {row.Verificado === "Verificado" ? <span className="status-pill status-pill--success">Verificado</span> : null}
            <span className="status-pill status-pill--warning">{row.EstadoCliente}</span>
          </div>
        </div>
      </div>

      <div className="admin-user-detail__cards">
        <article>
          <UserRound size={18} />
          <span>Pedidos</span>
          <strong>{row.Pedidos ?? 0}</strong>
        </article>
        <article>
          <Mail size={18} />
          <span>Pagos realizados</span>
          <strong>{row.PagosAprobados ?? 0}</strong>
        </article>
        <article>
          <MessageCircle size={18} />
          <span>Total gastado</span>
          <strong>{row.TotalGastado || "$0"}</strong>
        </article>
        <article>
          <UserRound size={18} />
          <span>Compra promedio</span>
          <strong>{row.TicketPromedio || "$0"}</strong>
        </article>
      </div>

      <section className="admin-user-detail__info">
        <h3>Informacion adicional</h3>
        <dl>
          <div>
            <dt>Telefono</dt>
            <dd>{row.Telefono || "-"}</dd>
          </div>
          <div>
            <dt>Direccion</dt>
            <dd>{row.Direccion || "-"}</dd>
          </div>
          <div>
            <dt>Registro</dt>
            <dd>{row.Registro || "-"}</dd>
          </div>
          <div>
            <dt>Ultimo login</dt>
            <dd>{row.UltimoLogin || "-"}</dd>
          </div>
          <div>
            <dt>Ultimo pedido</dt>
            <dd>{row.UltimoPedido || "-"}</dd>
          </div>
          <div>
            <dt>Ultimo pago</dt>
            <dd>{row.UltimoPago || "-"}</dd>
          </div>
          <div>
            <dt>Metodo preferido</dt>
            <dd>{row.MetodoEnvio || "-"}</dd>
          </div>
          <div>
            <dt>Preferencias</dt>
            <dd>{row.Entrega || row.MetodoEnvio || "-"}</dd>
          </div>
          <div>
            <dt>Pagos pendientes</dt>
            <dd>{row.PagosPendientes ?? 0}</dd>
          </div>
          <div>
            <dt>Pedidos cancelados</dt>
            <dd>{row.PedidosCancelados ?? 0}</dd>
          </div>
        </dl>
      </section>

      <section className="admin-user-detail__activity">
        <h3>Actividad reciente</h3>
        {(row.Actividad ?? []).length ? (
          row.Actividad?.map((item, index) => (
            <p key={`${item}-${index}`}>
              <span />
              {item}
            </p>
          ))
        ) : (
          <p>Sin actividad reciente.</p>
        )}
      </section>

      <footer>
        <a className="btn" href={whatsappHref} target="_blank" rel="noreferrer">
          <MessageCircle size={17} /> Contactar
        </a>
        <button className="btn btn--ghost" type="button" onClick={onClose}>
          Cerrar
        </button>
      </footer>
    </aside>
  );
}
