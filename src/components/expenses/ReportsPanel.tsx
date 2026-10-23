"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FolderOpen, ReceiptText, Send } from "lucide-react";
import React, { useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Claim, ClaimStatus, ExpenseReport, PolicyVerdictKind, TravelRequest } from "@/lib/types/expenses";
import { formatDateRange, formatDay } from "@/lib/utils";

import { ReportCreateDialog } from "./ReportCreateDialog";
import { ReportSubmitDialog } from "./ReportSubmitDialog";
import {
  ClaimStatusBadge,
  ReportStatusBadge,
  VerdictBadge,
  formatDateTime,
  formatMoney,
  humanizeKey,
} from "./shared";

/** The policy badge's words, for sorting, the search and the CSV. */
const VERDICT_TEXT: Record<PolicyVerdictKind, string> = {
  within_policy: "Within policy",
  no_rule: "No rule",
  flagged: "Flagged",
  needs_justification: "Needs justification",
  blocked: "Blocked",
  receipt_required: "Receipt required",
  pre_approval_required: "Pre-approval required",
};

/** The status badge's words, for sorting, the search and the CSV. */
const STATUS_TEXT: Record<ClaimStatus, string> = {
  draft: "Draft",
  pending_manager: "With manager",
  submitted: "With finance",
  approved: "Approved",
  rejected: "Rejected",
  reimbursed: "Reimbursed",
  cancelled: "Cancelled",
};

/** The person's expense reports with their lines. */
export function ReportsPanel({
  reports,
  trips,
  currency,
  onChanged,
  onSelectClaim,
}: {
  reports: ExpenseReport[];
  trips: TravelRequest[];
  currency: string;
  onChanged: () => void;
  onSelectClaim: (claim: Claim) => void;
}) {
  const [submitting, setSubmitting] = useState<ExpenseReport | null>(null);

  const columns: ColumnDef<Claim>[] = [
    {
      accessorKey: "incurred_on",
      header: "Date",
      meta: { cellClassName: "whitespace-nowrap tabular-nums", text: (line) => formatDay(line.incurred_on, true) },
      cell: ({ row }) => formatDay(row.original.incurred_on, true),
    },
    {
      id: "category",
      header: "Category",
      accessorFn: (line) => humanizeKey(line.category_key),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      sortingFn: "alphanumeric",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => formatMoney(row.original.amount, currency),
    },
    {
      id: "policy",
      header: "Policy",
      accessorFn: (line) => VERDICT_TEXT[line.policy_verdict],
      cell: ({ row }) => <VerdictBadge kind={row.original.policy_verdict} />,
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (line) => STATUS_TEXT[line.status],
      cell: ({ row }) => <ClaimStatusBadge status={row.original.status} />,
    },
  ];

  if (reports.length === 0) {
    return (
      <Card tier="tier1">
        <EmptyState
          icon={FolderOpen}
          title="No expense reports"
          description="A report groups claims, usually from one trip, so they are approved together. Create one, then pick it when you add a claim."
          action={<ReportCreateDialog trips={trips} onCreated={onChanged} />}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ReportCreateDialog trips={trips} onCreated={onChanged} />
      </div>

      {reports.map((report) => {
        const trip = report.travel_request_id
          ? trips.find((item) => item.id === report.travel_request_id)
          : undefined;
        return (
          <DataTable
            key={report.id}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {report.title}
                <ReportStatusBadge status={report.status} />
                {report.blocked_lines > 0 && (
                  <Badge variant="destructive">
                    {report.blocked_lines} blocked {report.blocked_lines === 1 ? "line" : "lines"}
                  </Badge>
                )}
              </span>
            }
            description={
              <span className="tabular-nums">
                {report.line_count} {report.line_count === 1 ? "claim" : "claims"} · Total{" "}
                <span className="font-semibold text-foreground">{formatMoney(report.total_amount, currency)}</span>
                {trip && ` · ${trip.purpose} (${formatDateRange(trip.from_date, trip.to_date)})`}
                {report.submitted_at && ` · Submitted ${formatDateTime(report.submitted_at)}`}
              </span>
            }
            actions={
              report.status === "draft" && (
                <Button size="sm" className="h-9" onClick={() => setSubmitting(report)}>
                  <Send /> Submit report
                </Button>
              )
            }
            columns={columns}
            data={report.lines}
            noun="claims"
            exportName={`expense-report-${report.title}`}
            searchPlaceholder="Search claims"
            onRowClick={onSelectClaim}
            empty={{
              icon: ReceiptText,
              title: "No claims in this report yet",
              description: "Pick this report when you add a claim.",
            }}
          />
        );
      })}

      <ReportSubmitDialog
        report={submitting}
        currency={currency}
        onOpenChange={(open) => !open && setSubmitting(null)}
        onSubmitted={onChanged}
      />
    </div>
  );
}
