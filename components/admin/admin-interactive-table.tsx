"use client";

import { useMemo, useState } from "react";
import { Download, Search, X } from "lucide-react";

type AdminTableRow = Record<string, string | number | null | undefined>;

function cellText(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function AdminInteractiveTable({
  columns,
  rows,
  title
}: {
  columns: string[];
  rows: AdminTableRow[];
  title: string;
}) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const statusColumn = columns.find((column) => ["Estado", "Estado del pago", "Activa"].includes(column));
  const filters = useMemo(() => {
    if (!statusColumn) return ["Todos"];
    const values = Array.from(new Set(rows.map((row) => cellText(row[statusColumn])).filter((value) => value !== "-")));
    return ["Todos", ...values.slice(0, 8)];
  }, [rows, statusColumn]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const matchesQuery =
          !normalizedQuery ||
          columns.some((column) => cellText(row[column]).toLowerCase().includes(normalizedQuery));
        const matchesFilter = activeFilter === "Todos" || !statusColumn || cellText(row[statusColumn]) === activeFilter;
        return matchesQuery && matchesFilter;
      }),
    [activeFilter, columns, normalizedQuery, rows, statusColumn]
  );

  function clearFilters() {
    setQuery("");
    setActiveFilter("Todos");
  }

  function exportCsv() {
    const csv = [
      columns.map(csvEscape).join(","),
      ...filteredRows.map((row) => columns.map((column) => csvEscape(cellText(row[column]))).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase().replaceAll(" ", "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="admin-panel">
      <div className="admin-table-controls">
        <label className="admin-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar cliente, email, telefono, pedido o referencia..."
          />
        </label>
        <div className="admin-table-actions">
          <button className="btn btn--ghost" type="button" onClick={clearFilters} disabled={!query && activeFilter === "Todos"}>
            <X size={16} /> Limpiar
          </button>
          <button className="btn btn--ghost" type="button" onClick={exportCsv} disabled={!filteredRows.length}>
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      {filters.length > 1 ? (
        <div className="admin-filter-chips" aria-label="Filtros de estado">
          {filters.map((filter) => (
            <button key={filter} type="button" aria-pressed={activeFilter === filter} onClick={() => setActiveFilter(filter)}>
              {filter}
            </button>
          ))}
        </div>
      ) : null}

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
            {filteredRows.length ? (
              filteredRows.map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td data-label={column} key={column}>
                      {cellText(row[column])}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>No hay registros para mostrar con estos filtros.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
