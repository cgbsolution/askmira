"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Info } from "lucide-react";
import React from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Advance, AdvanceStatus, TravelRequest } from "@/lib/types/expenses";
import { formatDay } from "@/lib/utils";

import { AdvanceStatusBadge, formatMoney } from "./shared";

/** The status badge's words, for sorting, the search and the CSV. */
const STATUS_TEXT: Record<AdvanceStatus, string> = {
  issued: "Outstanding",
  settled: "Settled",
  cancelled: "Cancelled",
};

/** Advances the person has been given, and how much of each is still to account for. */
export function TravelAdvancesTable({
  advances,
  trips,
  currency,
}: {
  advances: Advance[];
  trips: TravelRequest[];
  currency: string;
}) {
  const purposeOf = (advance: Advance) =>
    advance.trip_purpose ?? trips.find((item) => item.id === advance.travel_request_id)?.purpose ?? null;

  const columns: ColumnDef<Advance>[] = [
    {
      id: "trip",
      header: "Trip",
      // Sorts on the advance's own field: the table caches this value until `advances`
      // changes, so one looked up in `trips` would go stale when only the trips reload.
      accessorFn: (advance) => advance.trip_purpose ?? "",
      meta: {
        cellClassName: "max-w-xs whitespace-normal",
        text: (advance) =>
          [
            purposeOf(advance) ?? "—",
            advance.trip_to_date && `Trip ended ${formatDay(advance.trip_to_date, true)}`,
            advance.payroll_recovery_ref && "Recovered through payroll",
            advance.payroll_refund_ref && "Balance paid to you through payroll",
          ]
            .filter(Boolean)
            .join(" · "),
      },
      cell: ({ row }) => {
        const advance = row.original;
        return (
          <>
            <p className="font-medium text-foreground">{purposeOf(advance) ?? "—"}</p>
            {advance.trip_to_date && (
              <p className="text-xs text-muted-foreground">
                Trip ended {formatDay(advance.trip_to_date, true)}
              </p>
            )}
            {advance.payroll_recovery_ref && (
              <p className="text-xs text-muted-foreground">
                Recovered through payroll
              </p>
            )}
            {advance.payroll_refund_ref && (
              <p className="text-xs text-muted-foreground">
                Balance paid to you through payroll
              </p>
            )}
          </>
        );
      },
    },
    {
      accessorKey: "amount",
      header: "Amount",
      // Decimal strings: compared digit group by digit group, so 9.00 sorts before 10.00.
      sortingFn: "alphanumeric",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => formatMoney(row.original.amount, currency),
    },
    {
      accessorKey: "issued_on",
      header: "Issued on",
      meta: {
        cellClassName: "whitespace-nowrap tabular-nums",
        text: (advance) => formatDay(advance.issued_on, true),
      },
      cell: ({ row }) => formatDay(row.original.issued_on, true),
    },
    {
      accessorKey: "claimed_against",
      header: "Claimed against",
      sortingFn: "alphanumeric",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => formatMoney(row.original.claimed_against, currency),
    },
    {
      accessorKey: "outstanding",
      header: "Outstanding",
      sortingFn: "alphanumeric",
      meta: { className: "text-right", cellClassName: "font-medium tabular-nums" },
      cell: ({ row }) => formatMoney(row.original.outstanding, currency),
    },
    {
      accessorKey: "age_days",
      header: "Age (days)",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => row.original.age_days,
    },
    {
      accessorKey: "is_blocking",
      header: "Blocking",
      meta: { text: (advance) => (advance.is_blocking ? "Blocking" : "No") },
      cell: ({ row }) =>
        row.original.is_blocking ? (
          <Badge variant="destructive">Blocking</Badge>
        ) : (
          <span className="text-muted-foreground">No</span>
        ),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (advance) => STATUS_TEXT[advance.status],
      cell: ({ row }) => <AdvanceStatusBadge status={row.original.status} />,
    },
  ];

  return (
    <Card tier="tier1" className="gap-0 overflow-hidden py-0">
      <DataTable
        bordered={false}
        columns={columns}
        data={advances}
        noun="advances"
        exportName="my-travel-advances"
        searchPlaceholder="Search advances"
      />
      <CardContent className="border-t border-border px-4 py-3">
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          When an advance is settled, money owed back is recovered in your next payroll, within your
          net pay; money owed to you is paid in your next payroll. Each is marked here once a payroll
          run has taken or paid it.
        </p>
      </CardContent>
    </Card>
  );
}
