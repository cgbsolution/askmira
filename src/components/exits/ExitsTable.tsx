"use client";

import { DoorOpen } from "lucide-react";
import React, { useState } from "react";

import {
  dayOrDash,
  EXIT_STATUS_LABELS,
  EXIT_TYPE_LABELS,
  ExitPersonCell,
  ExitStatusBadge,
  pluralCount,
  QueryPanel,
  SettlementStatusBadge,
  useExitRoles,
  useReloadOn,
} from "@/components/exits/common";
import { Badge } from "@/components/ui/badge";
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
import type { ExitRecord, ExitStatus } from "@/lib/types/payroll-ops";

/**
 * Exits the caller can see: everyone for HR, the reporting line for a manager.
 * Which rows come back is the server's decision.
 */
export function ExitsTable({
  version,
  onOpen,
}: {
  version: number;
  onOpen: (exitId: string) => void;
}) {
  const { isHr } = useExitRoles();
  const [status, setStatus] = useState<ExitStatus | "any">("any");
  const query = useApiQuery<ExitRecord[]>(
    status === "any" ? "/exits" : `/exits?exit_status=${encodeURIComponent(status)}`,
  );
  useReloadOn(version, query.reload);

  return (
    <QueryPanel
      query={query}
      isEmpty={(rows) => rows.length === 0}
      empty={{
        icon: DoorOpen,
        title: "No exits",
        description:
          status !== "any"
            ? `No exits you can see are ${EXIT_STATUS_LABELS[status].toLowerCase()}.`
            : isHr
              ? "Nobody in the organisation has an exit on record."
              : "Nobody in your reporting line has an exit on record.",
      }}
      toolbar={
        <>
          <Select value={status} onValueChange={(next) => setStatus(next as ExitStatus | "any")}>
            <SelectTrigger size="sm" className="w-48" aria-label="Exit status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any status</SelectItem>
              {(Object.keys(EXIT_STATUS_LABELS) as ExitStatus[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {EXIT_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">
            {query.isLoading ? "Loading…" : query.data ? pluralCount(query.data.length, "exit") : ""}
          </span>
        </>
      }
    >
      {(rows) => (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Resigned</TableHead>
              <TableHead>Last working day</TableHead>
              <TableHead>Notice</TableHead>
              <TableHead>Clearance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Settlement</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="cursor-pointer" onClick={() => onOpen(row.id)}>
                <TableCell>
                  <ExitPersonCell name={row.employee_name} code={row.employee_code} />
                </TableCell>
                <TableCell>{EXIT_TYPE_LABELS[row.exit_type] ?? row.exit_type}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {dayOrDash(row.resignation_date)}
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {row.approved_last_working_day ? (
                    dayOrDash(row.approved_last_working_day)
                  ) : row.requested_last_working_day ? (
                    <span className="text-muted-foreground">
                      {dayOrDash(row.requested_last_working_day)} (requested)
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="tabular-nums">
                  <span className="block">{pluralCount(row.notice_period_days, "day")}</span>
                  {row.notice_shortfall_days > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      Short by {pluralCount(row.notice_shortfall_days, "day")}
                      {row.notice_waived && " · waived"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">
                  <ClearanceProgress record={row} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ExitStatusBadge status={row.status} />
                    {row.awaiting_acceptance && <Badge variant="warning">To accept</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <SettlementStatusBadge status={row.settlement_status} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(row.id);
                    }}
                  >
                    View
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

/** Items on the checklist, and whether mandatory ones are still open. */
export function ClearanceProgress({
  record,
}: {
  record: Pick<ExitRecord, "clearance_total" | "clearance_pending_mandatory">;
}) {
  if (record.clearance_total === 0) {
    return <span className="text-muted-foreground">No checklist</span>;
  }
  return (
    <>
      <span className="block">{pluralCount(record.clearance_total, "item")}</span>
      {record.clearance_pending_mandatory > 0 ? (
        <Badge variant="warning" className="mt-0.5">
          {record.clearance_pending_mandatory} mandatory pending
        </Badge>
      ) : (
        <span className="block text-xs text-muted-foreground">Mandatory items done</span>
      )}
    </>
  );
}
