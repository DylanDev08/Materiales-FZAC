export type AdminTableRow = Record<string, string | number | null | undefined>;

type AdminTableFilterOptions = {
  columns: string[];
  query: string;
  statusColumn?: string;
  status?: string;
  dateColumn?: string;
  dateFrom?: string;
  dateTo?: string;
  tabMatch?: (row: AdminTableRow) => boolean;
};

export function adminCellText(value: AdminTableRow[string]) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

export function parseAdminDate(value: string) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function filterAdminRows(rows: AdminTableRow[], options: AdminTableFilterOptions) {
  const normalizedQuery = options.query.trim().toLocaleLowerCase("es-AR");

  return rows.filter((row) => {
    const matchesQuery =
      !normalizedQuery ||
      options.columns.some((column) => adminCellText(row[column]).toLocaleLowerCase("es-AR").includes(normalizedQuery));
    const matchesStatus =
      !options.statusColumn || !options.status || options.status === "Todos" || adminCellText(row[options.statusColumn]) === options.status;
    const rowDate = options.dateColumn ? parseAdminDate(adminCellText(row[options.dateColumn])) : null;
    const matchesDateFrom = !options.dateFrom || !rowDate || rowDate >= options.dateFrom;
    const matchesDateTo = !options.dateTo || !rowDate || rowDate <= options.dateTo;

    return matchesQuery && matchesStatus && (!options.tabMatch || options.tabMatch(row)) && matchesDateFrom && matchesDateTo;
  });
}

export function paginateAdminRows<T>(rows: T[], page: number, pageSize: number) {
  const safePageSize = Math.max(1, Math.trunc(pageSize));
  const totalPages = Math.max(1, Math.ceil(rows.length / safePageSize));
  const currentPage = Math.min(Math.max(1, Math.trunc(page)), totalPages);
  const start = (currentPage - 1) * safePageSize;
  return {
    currentPage,
    totalPages,
    rows: rows.slice(start, start + safePageSize)
  };
}
