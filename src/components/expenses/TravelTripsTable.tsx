"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Ban } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { post } from "@/lib/api";
import type { TravelApproval, TravelRequest, TravelRequestStatus } from "@/lib/types/expenses";
import { formatDateRange } from "@/lib/utils";

import { CITY_TIER_LABEL, TravelStatusBadge, errorDetail, formatDateTime, formatMoney } from "./shared";

/** The status badge's words, for sorting, the search and the CSV. */
const STATUS_TEXT: Record<TravelRequestStatus, string> = {
  draft: "Draft",
  pending_manager: "Awaiting manager",
  submitted: "Awaiting finance",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  completed: "Completed",
};

/** "Mumbai (Tier A), Pune"; empty for a trip with no stops. */
function destinationsText(trip: TravelRequest): string {
  return trip.destinations
    .map((stop) => (stop.city_tier ? `${stop.city} (${CITY_TIER_LABEL[stop.city_tier]})` : stop.city))
    .join(", ");
}

/** "Approved by manager", "Rejected by finance", or just the decision for an old record. */
function decisionLabel(step: TravelApproval): string {
  return `${step.decision === "approved" ? "Approved" : "Rejected"}${
    step.stage === "manager" ? " by manager" : step.stage === "finance" ? " by finance" : ""
  }`;
}

/** The person's trips, with the advance asked for and given, and who decided. */
export function TravelTripsTable({
  trips,
  currency,
  onChanged,
}: {
  trips: TravelRequest[];
  currency: string;
  onChanged: () => void;
}) {
  const [cancelling, setCancelling] = useState<TravelRequest | null>(null);

  const cancel = async () => {
    if (!cancelling) return;
    try {
      await post<TravelRequest>(`/expenses/travel-requests/${cancelling.id}/cancel`);
      toast.success("Travel request cancelled");
      onChanged();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not cancel the travel request."));
      throw caught;
    }
  };

  const columns: ColumnDef<TravelRequest>[] = [
    {
      accessorKey: "purpose",
      header: "Trip",
      meta: {
        cellClassName: "max-w-xs whitespace-normal",
        text: (trip) => [trip.purpose, destinationsText(trip)].filter(Boolean).join(" · "),
      },
      cell: ({ row }) => (
        <>
          <p className="font-medium text-foreground">{row.original.purpose}</p>
          <p className="text-xs text-muted-foreground">{destinationsText(row.original) || "—"}</p>
        </>
      ),
    },
    {
      accessorKey: "from_date",
      header: "Dates",
      meta: {
        cellClassName: "whitespace-nowrap tabular-nums",
        text: (trip) => formatDateRange(trip.from_date, trip.to_date),
      },
      cell: ({ row }) => formatDateRange(row.original.from_date, row.original.to_date),
    },
    {
      accessorKey: "estimated_cost",
      header: "Estimated",
      // Decimal strings: compared digit group by digit group, so 9.00 sorts before 10.00.
      sortingFn: "alphanumeric",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => formatMoney(row.original.estimated_cost, currency),
    },
    {
      accessorKey: "advance_requested",
      header: "Advance requested / issued",
      sortingFn: "alphanumeric",
      meta: {
        className: "text-right",
        cellClassName: "tabular-nums",
        text: (trip) =>
          `${formatMoney(trip.advance_requested, currency)} / ${formatMoney(trip.advance_issued, currency)}`,
      },
      cell: ({ row }) => (
        <>
          {formatMoney(row.original.advance_requested, currency)} /{" "}
          {formatMoney(row.original.advance_issued, currency)}
        </>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (trip) => STATUS_TEXT[trip.status],
      cell: ({ row }) => <TravelStatusBadge status={row.original.status} />,
    },
    {
      id: "decisions",
      header: "Decisions",
      meta: {
        cellClassName: "max-w-xs whitespace-normal",
        text: (trip) =>
          trip.approvals
            .map((step) => [decisionLabel(step), formatDateTime(step.at), step.note].filter(Boolean).join(" · "))
            .join("; "),
      },
      cell: ({ row }) =>
        row.original.approvals.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <ul className="space-y-1.5">
            {row.original.approvals.map((step, index) => (
              <li key={`${step.user_id}-${step.at}-${index}`} className="text-xs">
                <Badge variant={step.decision === "approved" ? "success" : "destructive"}>
                  {decisionLabel(step)}
                </Badge>{" "}
                <span className="text-muted-foreground tabular-nums">{formatDateTime(step.at)}</span>
                {step.note && <p className="mt-0.5 text-foreground">{step.note}</p>}
              </li>
            ))}
          </ul>
        ),
    },
    {
      id: "actions",
      header: "Action",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) =>
        (row.original.status === "submitted" || row.original.status === "pending_manager") && (
          <Button size="sm" variant="outline" onClick={() => setCancelling(row.original)}>
            <Ban /> Cancel
          </Button>
        ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={trips}
        noun="trips"
        exportName="my-travel-requests"
        searchPlaceholder="Search trips"
      />

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title="Cancel this travel request?"
        description={
          cancelling
            ? `${cancelling.purpose}, ${formatDateRange(cancelling.from_date, cancelling.to_date)}. Nobody will review it any further.`
            : undefined
        }
        confirmLabel="Cancel request"
        cancelLabel="Keep it"
        destructive
        onConfirm={cancel}
      />
    </>
  );
}
