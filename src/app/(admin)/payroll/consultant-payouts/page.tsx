"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { HandCoins } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { AttentionPanel } from "@/components/payroll/consultant-payouts/AttentionPanel";
import { PAYOUT_STATUS } from "@/components/payroll/consultant-payouts/labels";
import { NewPayoutRunDialog } from "@/components/payroll/consultant-payouts/NewPayoutRunDialog";
import { PayoutStatusBadge } from "@/components/payroll/consultant-payouts/PayoutStatusBadge";
import { useApiQuery } from "@/hooks/useApiQuery";
import type {
  PayoutAttention,
  PayoutRunSummary,
} from "@/lib/types/consultant-payouts";
import type { EntityOption } from "@/lib/types/payroll";
import { formatDay } from "@/lib/utils";

const columns = (
  company: (id: string | null) => string,
): ColumnDef<PayoutRunSummary>[] => [
  {
    id: "pay_date",
    header: "Pay date",
    accessorFn: (run) => run.pay_date,
    meta: { text: (run) => formatDay(run.pay_date, true) },
    cell: ({ row }) => (
      <Link
        href={`/payroll/consultant-payouts/${row.original.id}`}
        className="font-medium text-foreground hover:underline"
      >
        {formatDay(row.original.pay_date, true)}
      </Link>
    ),
  },
  {
    id: "company",
    header: "Company",
    accessorFn: (run) => company(run.legal_entity_id),
  },
  {
    id: "cut_off",
    header: "Cut-off",
    accessorFn: (run) => run.cut_off,
    meta: { text: (run) => formatDay(run.cut_off, true) },
    cell: ({ row }) => formatDay(row.original.cut_off, true),
  },
  {
    id: "consultants",
    header: "Consultants",
    accessorFn: (run) => run.totals.lines_included,
    meta: { className: "text-right tabular-nums" },
  },
  {
    id: "net",
    header: "Net total",
    accessorFn: (run) => run.totals.net_payable,
    meta: { className: "text-right", text: (run) => run.totals.net_payable },
    cell: ({ row }) => <Money value={row.original.totals.net_payable} />,
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (run) => PAYOUT_STATUS[run.status]?.label ?? run.status,
    cell: ({ row }) => <PayoutStatusBadge status={row.original.status} />,
  },
];

/** Consultant payouts: approved hours paid outside payroll, with GST and TDS. */
export default function ConsultantPayoutsPage() {
  const router = useRouter();
  const runs = useApiQuery<PayoutRunSummary[]>("/consultant-payouts");
  const attention = useApiQuery<PayoutAttention>(
    "/consultant-payouts/attention",
  );
  const entities = useApiQuery<EntityOption[]>("/org/legal-entities");

  const cols = useMemo(
    () =>
      columns((id) =>
        id
          ? (entities.data?.find((entity) => entity.id === id)?.name ?? "—")
          : "Every company",
      ),
    [entities.data],
  );

  return (
    <PageShell
      title="Consultant payouts"
      description="Pay consultants for their approved hours, with GST and TDS worked out. Nothing is locked without a second person's sign-off."
      actions={
        <NewPayoutRunDialog
          onCreated={(run) =>
            router.push(`/payroll/consultant-payouts/${run.id}`)
          }
        />
      }
    >
      {attention.data && (
        <AttentionPanel
          attention={attention.data}
          onChanged={() => {
            attention.reload();
            runs.reload();
          }}
        />
      )}
      <DataTable
        title="Payout runs"
        columns={cols}
        data={runs.data ?? []}
        noun="runs"
        exportName="consultant-payouts"
        isLoading={runs.isLoading && !runs.data}
        error={runs.error?.detail}
        onRetry={runs.reload}
        empty={{
          icon: HandCoins,
          title: "No payout runs yet",
          description:
            "Start a run with a cut-off date and a pay date. It takes every approved hours entry that ends by then and has not been paid.",
        }}
      />
    </PageShell>
  );
}
