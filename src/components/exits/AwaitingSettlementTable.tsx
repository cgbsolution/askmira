"use client";

import { Calculator, CheckCheck } from "lucide-react";
import React, { useMemo } from "react";

import {
  dayOrDash,
  EXIT_TYPE_LABELS,
  ExitPersonCell,
  ExitStatusBadge,
  pluralCount,
  QueryPanel,
  useExitRoles,
  useReloadOn,
} from "@/components/exits/common";
import { ClearanceProgress } from "@/components/exits/ExitsTable";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { ExitRecord } from "@/lib/types/payroll-ops";

/** Exits with no settlement computed yet (cancelled exits left out). */
export function AwaitingSettlementTable({
  version,
  onCompute,
}: {
  version: number;
  onCompute: (record: ExitRecord) => void;
}) {
  const { ownEmployeeId } = useExitRoles();
  const query = useApiQuery<ExitRecord[]>("/exits");
  useReloadOn(version, query.reload);

  const awaiting = useMemo(
    () =>
      query.data
        ? query.data.filter((row) => row.settlement_id === null && row.status !== "cancelled")
        : null,
    [query.data],
  );

  return (
    <QueryPanel
      query={{ ...query, data: awaiting }}
      isEmpty={(rows) => rows.length === 0}
      empty={{
        icon: CheckCheck,
        title: "Nothing awaiting settlement",
        description: "Every exit on record either has a settlement computed or was cancelled.",
      }}
    >
      {(rows) => (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Last working day</TableHead>
              <TableHead>Notice</TableHead>
              <TableHead>Clearance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const isOwn = ownEmployeeId !== null && row.employee_id === ownEmployeeId;
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <ExitPersonCell name={row.employee_name} code={row.employee_code} />
                  </TableCell>
                  <TableCell>{EXIT_TYPE_LABELS[row.exit_type] ?? row.exit_type}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {dayOrDash(row.approved_last_working_day ?? row.requested_last_working_day)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.notice_shortfall_days > 0 ? (
                      <>
                        <span className="block">
                          Short by {pluralCount(row.notice_shortfall_days, "day")}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {row.notice_waived ? "Recovery waived" : "Recovery not waived"}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Served</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    <ClearanceProgress record={row} />
                  </TableCell>
                  <TableCell>
                    <ExitStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {isOwn ? (
                      <span className="text-xs text-muted-foreground">Your own exit</span>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => onCompute(row)}>
                        <Calculator /> Compute
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </QueryPanel>
  );
}
