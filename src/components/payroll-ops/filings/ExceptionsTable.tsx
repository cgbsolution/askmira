"use client";

import { CheckCircle2 } from "lucide-react";
import React, { useMemo } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FilingException } from "@/lib/types/payroll-ops";

/**
 * Pre-generation validation findings, grouped by subject (the employee code,
 * or the state for a Professional Tax challan) so each person's problems can
 * be fixed together.
 */
export function ExceptionsTable({
  exceptions,
  emptyTitle = "No validation findings",
}: {
  exceptions: FilingException[];
  emptyTitle?: string;
}) {
  const groups = useMemo(() => {
    const bySubject = new Map<string, FilingException[]>();
    for (const exception of exceptions) {
      const key = exception.subject || "—";
      const list = bySubject.get(key) ?? [];
      list.push(exception);
      bySubject.set(key, list);
    }
    return Array.from(bySubject.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [exceptions]);

  if (exceptions.length === 0) {
    return <EmptyState icon={CheckCircle2} title={emptyTitle} />;
  }

  return (
    // table-ok: each subject's cell spans all its findings (rowSpan) so one person's problems read and get fixed together; DataTable has no row grouping
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Subject</TableHead>
          <TableHead>Field</TableHead>
          <TableHead>Problem</TableHead>
          <TableHead>Severity</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map(([subject, rows]) =>
          rows.map((row, index) => (
            <TableRow key={`${subject}-${row.code}-${row.field}-${index}`}>
              {index === 0 ? (
                <TableCell rowSpan={rows.length} className="align-top font-medium text-foreground">
                  {subject}
                  <span className="block text-xs font-normal text-muted-foreground tabular-nums">
                    {rows.length} {rows.length === 1 ? "finding" : "findings"}
                  </span>
                </TableCell>
              ) : null}
              <TableCell className="text-muted-foreground">{row.field}</TableCell>
              <TableCell className="whitespace-normal text-foreground">
                {row.message}
                <span className="block text-xs text-muted-foreground">{row.code}</span>
              </TableCell>
              <TableCell>
                <Badge variant={row.severity === "blocking" ? "destructive" : "warning"}>
                  {row.severity === "blocking" ? "Blocking" : "Warning"}
                </Badge>
              </TableCell>
            </TableRow>
          )),
        )}
      </TableBody>
    </Table>
  );
}
