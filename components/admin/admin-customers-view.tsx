"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

type CustomerRow = Record<string, string | number | null | undefined>;

const columns = [
  "Email",
  "Nombre",
  "Telefono",
  "Rol",
  "Registro",
  "UltimoLogin",
  "Compras",
  "TotalGastado",
  "Pedidos",
  "Direccion",
  "Distancia",
  "Entrega",
  "Chats"
];

export function AdminCustomersView({ rows }: { rows: CustomerRow[] }) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return rows.filter((row) => {
      const matchesRole = role === "all" || String(row.Rol) === role;
      const matchesSearch = !query || columns.some((column) => String(row[column] ?? "").toLowerCase().includes(query));
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
                  {columns.map((column) => (
                    <td key={column}>{row[column] ?? "-"}</td>
                  ))}
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
