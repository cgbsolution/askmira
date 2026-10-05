"use client";

import { History, UserSearch } from "lucide-react";
import React, { useState } from "react";

import { FormField } from "@/components/common/FormField";
import { QueryPanel } from "@/components/payroll-ops/disbursements/common";
import { EmployeePicker } from "@/components/payroll-ops/disbursements/EmployeePicker";
import { formatTimestamp, REVISION_TYPE_LABEL } from "@/components/payroll-ops/arrears/labels";
import { Badge } from "@/components/ui/badge";
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
import type { EmployeeSummary } from "@/lib/types";
import type { SalaryRevision } from "@/lib/types/payroll-ops";
import { formatDay } from "@/lib/utils";

/** One employee's committed salary revisions. */
export function RevisionHistoryTab({ onOpenBatch }: { onOpenBatch: (batchId: string) => void }) {
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const query = useApiQuery<SalaryRevision[]>(
    employee ? `/arrears/revisions?employee_id=${encodeURIComponent(employee.id)}` : null,
  );

  return (
    <QueryPanel
      query={query}
      title="Revision history"
      description="Every committed revision for a person, and the batch it produced."
      loadingRows={3}
      toolbar={
        <FormField htmlFor="history-employee" label="Employee" className="w-full max-w-md">
          <EmployeePicker id="history-employee" value={employee} onChange={setEmployee} />
        </FormField>
      }
      idle={{
        icon: UserSearch,
        title: "Choose an employee",
        description: "Search by name or employee code to see their salary revisions.",
      }}
      isEmpty={(rows) => rows.length === 0}
      empty={{
        icon: History,
        title: "No revisions committed for this employee",
        description: "Revisions appear here once an admin commits one.",
      }}
    >
      {(rows) => (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Effective from</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead className="hidden md:table-cell">Reason</TableHead>
              <TableHead>Processed</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatDay(row.effective_from, true)}</TableCell>
                <TableCell>
                  <Badge variant="muted">{REVISION_TYPE_LABEL[row.revision_type]}</Badge>
                </TableCell>
                <TableCell className="hidden max-w-80 truncate text-muted-foreground md:table-cell">
                  {row.reason ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.processed_at ? formatTimestamp(row.processed_at) : "Not yet"}
                </TableCell>
                <TableCell className="text-right">
                  {row.arrear_batch_id && (
                    <Button
                      size="sm"
                      variant="link"
                      onClick={() => onOpenBatch(row.arrear_batch_id!)}
                    >
                      Open batch
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </QueryPanel>
  );
}
