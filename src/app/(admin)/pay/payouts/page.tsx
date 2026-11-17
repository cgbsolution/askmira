"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { HandCoins } from "lucide-react";
import React from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import {
  hasAmount,
  SECTION_LABEL,
} from "@/components/payroll/consultant-payouts/labels";
import { PayoutStatusBadge } from "@/components/payroll/consultant-payouts/PayoutStatusBadge";
import { DownloadButton } from "@/components/payroll-ops/shared";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { MyPayout } from "@/lib/types/consultant-payouts";
import { formatDay } from "@/lib/utils";

const COLUMNS: ColumnDef<MyPayout>[] = [
  {
    id: "pay_date",
    header: "Pay date",
    accessorFn: (row) => row.pay_date,
    meta: { text: (row) => formatDay(row.pay_date, true) },
    cell: ({ row }) => formatDay(row.original.pay_date, true),
  },
  {
    accessorKey: "hours",
    header: "Hours",
    meta: { className: "text-right tabular-nums" },
  },
  {
    accessorKey: "gross",
    header: "Fees",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.gross} />,
  },
  {
    accessorKey: "gst_amount",
    header: "GST",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.gst_amount} />,
  },
  {
    id: "tds",
    header: "Tax deducted (TDS)",
    accessorFn: (row) => row.tds_amount,
    meta: { className: "text-right", text: (row) => row.tds_amount },
    cell: ({ row }) => (
      <>
        <Money value={row.original.tds_amount} />
        <p className="text-xs text-muted-foreground">
          {SECTION_LABEL[row.original.section] ?? row.original.section}
        </p>
        {hasAmount(row.original.tds_carried_out) && (
          <p className="text-xs text-muted-foreground">
            Carried to next payout:{" "}
            <Money value={row.original.tds_carried_out} />
          </p>
        )}
      </>
    ),
  },
  {
    accessorKey: "net_payable",
    header: "You receive",
    meta: { className: "text-right", cellClassName: "font-semibold" },
    cell: ({ row }) => <Money value={row.original.net_payable} />,
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (row) => row.status,
    meta: { text: (row) => (row.status === "paid" ? "Paid" : "Approved") },
    cell: ({ row }) => <PayoutStatusBadge status={row.original.status} />,
  },
  {
    id: "actions",
    header: "",
    enableHiding: false,
    meta: { className: "w-28 text-right", text: false },
    cell: ({ row }) => (
      <DownloadButton
        path={`/payroll/my-payouts/${row.original.line_id}/pdf`}
        fallbackName={`payout-statement-${row.original.pay_date}.pdf`}
        label="Statement"
        variant="ghost"
      />
    ),
  },
];

/** A consultant's own payouts, from approved and paid runs. */
export default function MyPayoutsPage() {
  const { user } = useAuth();
  const linked = Boolean(user?.employee_id);
  const payouts = useApiQuery<MyPayout[]>(
    linked ? "/payroll/my-payouts" : null,
  );

  return (
    <PageShell
      title="Payouts"
      description="What you were paid for your approved hours."
    >
      <DataTable
        title="Payouts"
        columns={COLUMNS}
        data={payouts.data ?? []}
        getRowId={(row) => row.line_id}
        noun="payouts"
        exportName="my-payouts"
        isLoading={payouts.isLoading && !payouts.data}
        error={payouts.error?.detail}
        onRetry={payouts.reload}
        empty={{
          icon: HandCoins,
          title: linked
            ? "No payouts yet"
            : "Your login is not linked to an employee record",
          description: linked
            ? "A payout appears here once HR approves the run that pays your hours."
            : "Ask your admin to link your login to your employee record.",
        }}
      />
    </PageShell>
  );
}
