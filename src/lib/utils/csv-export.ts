/**
 * Escape a single CSV cell. Defends against OWASP CSV Injection by prefixing
 * values starting with =, +, -, @, tab, or CR with a single quote so spreadsheet
 * apps treat them as text rather than formulas.
 */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of objects to a CSV blob and trigger download.
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  fileName: string
): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);

  const csvRows = [
    headers.map(escapeCell).join(","),
    ...data.map((row) =>
      headers.map((header) => escapeCell(row[header])).join(",")
    ),
  ];

  const csvContent = csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${fileName}.csv`);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Convert objects to CSV string (without downloading).
 */
export function toCSVString<T extends Record<string, unknown>>(
  data: T[]
): string {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0]);

  const csvRows = [
    headers.map(escapeCell).join(","),
    ...data.map((row) =>
      headers.map((header) => escapeCell(row[header])).join(",")
    ),
  ];

  return csvRows.join("\n");
}

/**
 * Export selected columns to CSV with custom header names and trigger download.
 * Alias with different signature used by some page agents.
 */
export function exportToCsv<T extends Record<string, unknown>>(
  data: T[],
  columns: string[],
  headerMap: Record<string, string>,
  fileName: string
): void {
  if (data.length === 0) return;

  const headers = columns.map((col) => headerMap[col] ?? col);

  const csvRows = [
    headers.map(escapeCell).join(","),
    ...data.map((row) =>
      columns.map((col) => escapeCell(row[col])).join(",")
    ),
  ];

  const csvContent = csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName.endsWith(".csv") ? fileName : `${fileName}.csv`);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 100);
}
