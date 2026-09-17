"use client";

import { ShieldCheck } from "lucide-react";
import React from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { Money } from "@/components/common/Money";
import { MONTHS } from "@/components/payroll/labels";
import { useEmployeeNames } from "@/components/payroll/useEmployeeNames";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { EsiCoverage } from "@/lib/types/payroll";
import { formatDay } from "@/lib/utils";

/**
 * ESI coverage as recorded when each contribution period opened. It is why an
 * employee who crossed the ceiling mid-period still contributes to its end.
 */
export function EsiCoveragePanel() {
  const { data, error, isLoading, reload } = useApiQuery<EsiCoverage[]>("/statutory/esi-coverage");
  const nameOf = useEmployeeNames();
  const rows = data ?? [];
  return (
    <DataPanel
      title="ESI coverage"
      description="Recorded by payroll when a contribution period opens."
      isLoading={isLoading && !data}
      error={error?.detail}
      onRetry={reload}
      isEmpty={rows.length === 0}
      empty={{
        icon: ShieldCheck,
        title: "No coverage periods recorded",
        description: "A period is recorded the first time a run computes its opening month with an ESI rule set in force.",
      }}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>At the start</TableHead>
              <TableHead className="text-right">Opening wage</TableHead>
              <TableHead>Crossed the ceiling</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{nameOf(row.employee_id)}</TableCell>
                <TableCell className="text-sm">
                  {row.period_label} ({MONTHS[row.period_start_month - 1]} –{" "}
                  {MONTHS[row.period_end_month - 1]})
                </TableCell>
                <TableCell>
                  <Badge variant={row.was_contributing_at_start ? "success" : "muted"}>
                    {row.was_contributing_at_start ? "Contributing" : "Not covered"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Money value={row.opening_wage} />
                </TableCell>
                <TableCell className="text-sm">
                  {row.ceiling_crossed_on ? formatDay(row.ceiling_crossed_on, true) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DataPanel>
  );
}
