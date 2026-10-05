"use client";

import { History } from "lucide-react";
import React, { useState } from "react";

import { Money } from "@/components/common/Money";
import {
  QueryPanel,
  useEntityName,
  useReloadOn,
} from "@/components/payroll-ops/disbursements/common";
import {
  ARREAR_STATUS_LABEL,
  ArrearStatusBadge,
  displayPeriod,
  formatTimestamp,
} from "@/components/payroll-ops/arrears/labels";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { ArrearBatch, ArrearStatus, LegalEntity } from "@/lib/types/payroll-ops";

/** Arrear batches: computed, awaiting approval, approved, and paid in a payroll run. */
export function ArrearBatchesTab({
  entities,
  version,
  onOpen,
}: {
  entities: LegalEntity[];
  version: number;
  onOpen: (batchId: string) => void;
}) {
  const [status, setStatus] = useState<ArrearStatus | "any">("any");
  const query = useApiQuery<ArrearBatch[]>(
    status === "any" ? "/arrears/batches" : `/arrears/batches?batch_status=${status}`,
  );
  useReloadOn(version, query.reload);
  const entityName = useEntityName(entities);

  return (
    <QueryPanel
      query={query}
      isEmpty={(rows) => rows.length === 0}
      empty={{
        icon: History,
        title: status === "any" ? "No arrear batches yet" : "No batches with this status",
        description:
          "A batch is computed when an admin commits a salary revision that reaches back into closed payroll periods.",
      }}
      toolbar={
        <Select value={status} onValueChange={(value) => setStatus(value as ArrearStatus | "any")}>
          <SelectTrigger size="sm" className="w-56" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any status</SelectItem>
            {(Object.keys(ARREAR_STATUS_LABEL) as ArrearStatus[]).map((value) => (
              <SelectItem key={value} value={value}>
                {ARREAR_STATUS_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {(rows) => (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Periods</TableHead>
              <TableHead className="hidden md:table-cell">Entity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Employees</TableHead>
              <TableHead className="text-right">Net payable</TableHead>
              <TableHead className="hidden text-right lg:table-cell">
                Employer contributions
              </TableHead>
              <TableHead className="hidden lg:table-cell">Computed</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-foreground">
                  {row.from_period === row.to_period
                    ? displayPeriod(row.from_period)
                    : `${displayPeriod(row.from_period)} – ${displayPeriod(row.to_period)}`}
                  {row.affected_filings.length > 0 && (
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      Touches {row.affected_filings.length} filed{" "}
                      {row.affected_filings.length === 1 ? "return" : "returns"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {entityName(row.legal_entity_id)}
                </TableCell>
                <TableCell>
                  <ArrearStatusBadge status={row.status} />
                  {row.awaiting_additional_approval && (
                    <span className="block text-xs text-muted-foreground">
                      Needs a second approver
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.employee_count}</TableCell>
                <TableCell className="text-right">
                  <Money value={row.total_net_payable} className="font-medium" />
                </TableCell>
                <TableCell className="hidden text-right lg:table-cell">
                  <Money
                    value={row.total_employer_contribution_arrear}
                    className="text-muted-foreground"
                  />
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {formatTimestamp(row.computed_at)}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => onOpen(row.id)}>
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </QueryPanel>
  );
}
