/**
 * A small CSV reader for partner files: quoted fields, embedded commas and
 * doubled quotes, CRLF or LF. Enough for a merchandise partner's export — not a
 * spreadsheet engine, and it does not try to guess types. Every value comes
 * back as a trimmed string; the API validates each row itself.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0].map((cell) => cell.trim().toLowerCase().replace(/\s+/g, "_"));
  return nonEmpty.slice(1).map((cells) =>
    Object.fromEntries(header.map((key, at) => [key, (cells[at] ?? "").trim()])),
  );
}

/**
 * One CSV cell, always quoted. A value starting with = + - @ (or a tab or
 * carriage return) is prefixed with ' so a spreadsheet shows it rather than
 * running it as a formula: exported names and remarks are typed by people.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Saves rows as a CSV file. The byte-order mark makes Excel read it as UTF-8,
 * so ₹ and non-English names survive.
 */
export function downloadCsv(fileName: string, header: string[], rows: unknown[][]): void {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  const blob = new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
