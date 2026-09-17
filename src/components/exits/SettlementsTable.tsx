"use client";

import { ReceiptText } from "lucide-react";
import React, { useState } from "react";

import { Money } from "@/components/common/Money";
import {
  dayOrDash,
  EXIT_TYPE_LABELS,
  ExitPersonCell,
  pluralCount,
  QueryPanel,
  SETTLEMENT_STATUS_LABELS,
  SettlementStatusBadge,
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
import type { Settlement, SettlementStatus } from "@/lib/types/payroll-ops";

/** Computed settlements, filterable by status. */
export function SettlementsTable({
  version,
  onOpen,
}: {
  version: number;
  onOpen: (exitId: string) => void;
}) {
  const [status, setStatus] = useState<SettlementStatus | "any">("any");
  const query = useApiQuery<Settlement[]>(
    status === "any"
      ? "/exits/settlements"
      : `/exits/settlements?status=${encodeURIComponent(status)}`,
  );
  useReloadOn(version, query.reload);

  return (
    <QueryPanel
      query={query}
      isEmpty={(rows) => rows.length === 0}
      empty={{
        icon: ReceiptText,
        title: "No settlements",
        description:
          status === "any"
            ? "No full & final settlement has been computed yet."
            : `No settlement is ${SETTLEMENT_STATUS_LABELS[status].toLowerCase()}.`,
      }}
      toolbar={
        <>
          <Select
            value={status}
            onValueChange={(next) => setStatus(next as SettlementStatus | "any")}
          >
            <SelectTrigger size="sm" className="w-52" aria-label="Settlement status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any status</SelectItem>
              {(Object.keys(SETTLEMENT_STATUS_LABELS) as SettlementStatus[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {SETTLEMENT_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">
            {query.isLoading
              ? "Loading…"
              : query.data
                ? pluralCount(query.data.length, "settlement")
                : ""}
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
              <TableHead>Last working day</TableHead>
              <TableHead className="text-right">Earnings</TableHead>
              <TableHead className="text-right">Recoveries</TableHead>
              <TableHead className="text-right">Tax</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => onOpen(row.exit_record_id)}
              >
                <TableCell>
                  <ExitPersonCell name={row.employee_name} code={row.employee_code} />
                </TableCell>
                <TableCell>
                  {row.exit_type ? (EXIT_TYPE_LABELS[row.exit_type] ?? row.exit_type) : "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {dayOrDash(row.last_working_day)}
                </TableCell>
                <TableCell className="text-right">
                  <Money value={row.total_earnings} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={row.total_recoveries} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={row.total_tax} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={row.net_amount} className="font-medium" />
                  {row.is_demand && (
                    <Badge variant="destructive" className="ml-2">
                      Demand
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <SettlementStatusBadge status={row.status} />
                  {row.status === "on_hold" && row.hold_reason && (
                    <span className="mt-0.5 block max-w-48 truncate text-xs text-muted-foreground">
                      {row.hold_reason}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(row.exit_record_id);
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
