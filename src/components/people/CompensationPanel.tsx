"use client";

import { IndianRupee, Lock } from "lucide-react";
import React from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { EmptyState } from "@/components/common/EmptyState";
import { Money } from "@/components/common/Money";
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
import type { SalaryHistoryRow } from "@/lib/types/people";
import { formatDay } from "@/lib/utils";

/** The effective-dated salary series. Tier 1: every figure is payroll's own, as a string. */
export function CompensationPanel({ employeeId }: { employeeId: string }) {
  const { data, error, isLoading, reload } = useApiQuery<SalaryHistoryRow[]>(
    `/employees/${employeeId}/salary/history`,
  );
  const rows = data ?? [];

  if (error?.status === 403) {
    return (
      <DataPanel title="Compensation">
        <EmptyState
          icon={Lock}
          title="Compensation is not available to you here"
          description={error.detail}
        />
      </DataPanel>
    );
  }

  return (
    <DataPanel
      title="Compensation history"
      description="Annual CTC by effective date, as payroll holds it."
      isLoading={isLoading}
      error={error?.detail}
      onRetry={reload}
      isEmpty={rows.length === 0}
      empty={{
        icon: IndianRupee,
        title: "No salary assigned",
        description: "A salary appears here once payroll assigns a structure and CTC.",
      }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Effective</TableHead>
            <TableHead className="text-right">Annual CTC</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <span className="flex items-center gap-2">
                  {formatDay(row.effective_from, true)}
                  {row.effective_to ? (
                    <span className="text-muted-foreground">– {formatDay(row.effective_to, true)}</span>
                  ) : (
                    <Badge variant="success">Current</Badge>
                  )}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <Money value={row.ctc_annual} />
              </TableCell>
              <TableCell className="text-muted-foreground">{row.revision_reason ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataPanel>
  );
}
