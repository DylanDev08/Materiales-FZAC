"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Mail, MessageCircle, Search, SlidersHorizontal, UserRound, X } from "lucide-react";
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

export function AdminCustomersView({ rows }: { rows: CustomerRow[] }) {
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
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table admin-users-table">
            <thead>
              <tr>
                {["Usuario", "Contacto", "Registro", "Ultimo acceso", "Estado", "Pedidos", "Total", "Acciones"].map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.length ? (
                visibleRows.map((row) => (
                  <tr key={row.Id || row.Email} className={selected?.Id === row.Id ? "is-selected" : ""}>
                    <td data-label="Usuario">
                      <button className="admin-user-cell" type="button" onClick={() => setSelected(row)}>
                        <UserAvatar row={row} />
                        <span>
                          <strong>{row.Nombre || "Sin nombre"}</strong>
                          <small>{row.Rol || "Cliente"}</small>
                        </span>
                      </button>
                    </td>
                    <td data-label="Contacto">
                      <div className="admin-customer-stack">
                        <strong>{row.Email}</strong>
                        <span>{row.Telefono || "-"}</span>
                        <small className="status-pill">{row.AuthProvider}</small>
                      </div>
                    </td>
                    <td data-label="Registro">{row.Registro || "-"}</td>
                    <td data-label="Ultimo acceso">{row.UltimoLogin || "-"}</td>
                    <td data-label="Estado">
                      <span className={`status-pill ${row.EstadoCliente === "Cliente frecuente" ? "status-pill--warning" : "status-pill--success"}`}>
                        {row.EstadoCliente || "Sin compras"}
                      </span>
                    </td>
                    <td data-label="Pedidos">{row.Pedidos ?? 0}</td>
                    <td data-label="Total">{row.TotalGastado || "$0"}</td>
                    <td data-label="Acciones">
                      <button className="admin-icon-button" type="button" onClick={() => setSelected(row)} aria-label="Ver detalle">
                        <ChevronRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>No hay usuarios para esos filtros.</td>
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
          <small>ID: {row.Id ? `${row.Id.slice(0, 8)}...${row.Id.slice(-6)}` : "-"}</small>
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
            <dt>Ultimo pedido</dt>
            <dd>{row.UltimoPedido || "-"}</dd>
          </div>
          <div>
            <dt>Metodo preferido</dt>
            <dd>{row.MetodoEnvio || "-"}</dd>
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
