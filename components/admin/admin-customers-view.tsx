"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

type CustomerRow = Record<string, string | number | null | undefined>;

const columns = [
  "Cliente",
  "Rol",
  "Contacto",
  "Actividad",
  "Compras",
  "Direccion",
  "Chats"
];

export function AdminCustomersView({ rows }: { rows: CustomerRow[] }) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return rows.filter((row) => {
      const matchesRole = role === "all" || String(row.Rol) === role;
      const matchesSearch = !query || Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(query));
      return matchesRole && matchesSearch;
    });
  }, [rows, search, role]);

  return (
    <section className="admin-panel">
      <div className="admin-toolbar">
        <label className="admin-search">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar email, telefono, direccion, estado..." />
        </label>
        <select value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="all">Todos los roles</option>
          <option value="ADMIN">Admins</option>
          <option value="USER">Usuarios</option>
          <option value="OPERATOR">Operadores</option>
        </select>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length ? (
              filtered.map((row, index) => (
                <tr key={index}>
                  <td>
                    <div className="admin-customer-summary">
                      <strong>{row.Nombre || "Sin nombre"}</strong>
                      <span>{row.Email}</span>
                    </div>
                  </td>
                  <td>
                    <span className="status-pill">{row.Rol ?? "-"}</span>
                  </td>
                  <td>
                    <div className="admin-customer-stack">
                      <strong>{row.Telefono || "-"}</strong>
                      <span>{row.Provincia || "-"}</span>
                    </div>
                  </td>
                  <td>
                    <div className="admin-customer-stack">
                      <span>Registro: {row.Registro || "-"}</span>
                      <span>Ultimo login: {row.UltimoLogin || "-"}</span>
                      <span>Estado: {row.Entrega || "-"}</span>
                    </div>
                  </td>
                  <td>
                    <div className="admin-customer-stack">
                      <strong>{row.TotalGastado || "$0"}</strong>
                      <span>{row.Compras ?? 0} compras</span>
                      <span>{row.Pedidos ?? 0} pedidos</span>
                    </div>
                  </td>
                  <td>{row.Direccion ?? "-"}</td>
                  <td>{row.Chats ?? 0}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>No hay clientes para esos filtros.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
