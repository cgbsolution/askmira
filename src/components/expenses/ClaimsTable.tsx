"use client";

import type { ColumnDef } from "@tanstack/react-table";
import React from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import type { Claim, ClaimStatus, PolicyVerdictKind } from "@/lib/types/expenses";
import { formatDay } from "@/lib/utils";

import {
  CLAIM_KIND_LABEL,
  ClaimStatusBadge,
  VerdictBadge,
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

/** Where a paid claim's money went, in a few words for a table cell. */
function paidLine(claim: Claim): string | null {
  if (claim.status !== "reimbursed") return null;
  if (claim.reimbursed_in_period) {
    return claim.reimbursed_run_status === "paid"
      ? `Paid in ${claim.reimbursed_in_period} payroll`
      : `In ${claim.reimbursed_in_period} payroll`;
  }
  return claim.advance_settlement_id ? "Settled against advance" : null;
}

/** The person's own claims. A row opens the full detail. */
export function ClaimsTable({
  claims,
  currency,
  onSelect,
}: {
  claims: Claim[];
  currency: string;
  onSelect: (claim: Claim) => void;
}) {
  const columns: ColumnDef<Claim>[] = [
    {
      accessorKey: "incurred_on",
      header: "Date",
      meta: { cellClassName: "whitespace-nowrap tabular-nums", text: (claim) => formatDay(claim.incurred_on, true) },
      cell: ({ row }) => formatDay(row.original.incurred_on, true),
    },
    {
      id: "category",
      header: "Category",
      accessorFn: (claim) => humanizeKey(claim.category_key),
      meta: { cellClassName: "font-medium" },
    },
    {
      id: "kind",
      header: "Type",
      accessorFn: (claim) => CLAIM_KIND_LABEL[claim.kind],
    },
    {
      accessorKey: "amount",
      header: "Amount",
      sortingFn: "alphanumeric",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => (
        <>
          <div>{formatMoney(row.original.amount, currency)}</div>
          {row.original.original_currency !== currency && (
            <div className="text-xs text-muted-foreground">
              {formatMoney(row.original.original_amount, row.original.original_currency)}
            </div>
          )}
        </>
      ),
    },
    {
      id: "policy",
      header: "Policy",
      accessorFn: (claim) => VERDICT_TEXT[claim.policy_verdict],
      cell: ({ row }) => <VerdictBadge kind={row.original.policy_verdict} />,
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (claim) => STATUS_TEXT[claim.status],
      meta: { text: (claim) => [STATUS_TEXT[claim.status], paidLine(claim)].filter(Boolean).join(" · ") },
      cell: ({ row }) => {
        const paid = paidLine(row.original);
        return (
          <>
            <ClaimStatusBadge status={row.original.status} />
            {paid && <p className="mt-1 text-xs text-muted-foreground">{paid}</p>}
          </>
        );
      },
    },
    {
      id: "flags",
      header: "Flags",
      accessorFn: (claim) =>
        [claim.flagged_for_approver && "Flagged", claim.exceeds_route_tolerance && "Route variance"]
          .filter(Boolean)
          .join(", "),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.flagged_for_approver && <Badge variant="warning">Flagged</Badge>}
          {row.original.exceeds_route_tolerance && <Badge variant="warning">Route variance</Badge>}
          {!row.original.flagged_for_approver && !row.original.exceeds_route_tolerance && (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={claims}
      noun="claims"
      exportName="expense-claims"
      searchPlaceholder="Search claims"
      onRowClick={onSelect}
    />
  );
}
