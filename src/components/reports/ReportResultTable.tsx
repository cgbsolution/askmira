"use client";

import { EyeOff, Info, ShieldAlert } from "lucide-react";

import { Money } from "@/components/common/Money";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReportResult } from "@/lib/types/reports";
import { formatDate, formatDateTime } from "@/lib/utils";

const SCOPE_LABEL: Record<string, string> = {
  tenant: "Everyone in the workspace",
  reporting_tree: "Your reporting line",
  self: "Your own record only",
};

function cell(value: unknown, dataType: string, aggregation: string | null): React.ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  if (dataType === "decimal" && !aggregation?.startsWith("count")) return <Money value={String(value)} currency={false} />;
  if (dataType === "date") return formatDate(String(value));
  if (dataType === "datetime") return formatDateTime(String(value));
  if (dataType === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString("en-IN");
  return String(value);
}

/**
 * A report result, with what shaped it said out loud: whose rows it covers,
 * any field the viewer was not allowed to see (dropped, not silently blanked),
 * and whether it holds restricted data.
 */
export function ReportResultTable({ result }: { result: ReportResult }) {
  const numeric = new Set(["integer", "decimal"]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{SCOPE_LABEL[result.row_scope] ?? result.row_scope}</Badge>
        {result.max_sensitivity !== "public" && (
          <Badge variant="warning">
            <ShieldAlert /> {result.max_sensitivity === "payroll_only" ? "Contains payroll data" : "Contains HR data"} — this run is audited
          </Badge>
        )}
        <span>
          {result.returned_rows.toLocaleString("en-IN")} of {result.total_rows.toLocaleString("en-IN")} rows
          {result.duration_ms !== null && ` · ${result.duration_ms} ms`}
        </span>
      </div>

      {result.denied_fields.length > 0 && (
        <Alert variant="warning">
          <EyeOff />
          <AlertTitle>Some fields were left out</AlertTitle>
          <AlertDescription>
            {result.denied_fields.join(", ")} — your role may not see them, so they are dropped rather than shown blank.
          </AlertDescription>
        </Alert>
      )}
      {result.notes.length > 0 && (
        <Alert>
          <Info />
          <AlertDescription>
            <ul className="list-disc pl-5">
              {result.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {result.columns.map((column) => (
                <TableHead key={column.label} className={numeric.has(column.data_type) || column.aggregation ? "text-right" : undefined}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={result.columns.length} className="py-8 text-center text-sm text-muted-foreground">
                  No rows match.
                </TableCell>
              </TableRow>
            ) : (
              result.rows.map((row, index) => (
                <TableRow key={index}>
                  {result.columns.map((column, position) => (
                    <TableCell
                      key={column.label}
                      className={numeric.has(column.data_type) || column.aggregation ? "text-right tabular-nums" : "text-sm"}
                    >
                      {cell(row[position], column.data_type, column.aggregation)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
