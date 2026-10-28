"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CircleDollarSign, Download, ExternalLink, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { CreateRunDialog } from "@/components/payroll/CreateRunDialog";
import { DeleteRunDialog } from "@/components/payroll/DeleteRunDialog";
import { PayslipProtectionSwitch } from "@/components/payroll/PayslipProtection";
import {
  isRunDeletable,
  isRunLocked,
  periodLabel,
  RUN_STATUS,
  RUN_TYPE,
} from "@/components/payroll/labels";
import { downloadRegister } from "@/components/payroll/RegisterDownloadMenu";
import { RunStatusBadge } from "@/components/payroll/RunStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Page } from "@/lib/types";
import type { PayrollRun, RunStatus } from "@/lib/types/payroll";

const PAGE_SIZE = 25;

const STATUS_FILTERS: { value: RunStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  ...(["draft", "pending_review", "approved", "paid", "failed", "cancelled"] as const).map((value) => ({
    value,
    label: RUN_STATUS[value].label,
  })),
];

/** Open, download the month's data, or delete a run that is not locked. */
function RunRowMenu({ run, onDelete }: { run: PayrollRun; onDelete: (run: PayrollRun) => void }) {
  const period = periodLabel(run.period_year, run.period_month);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for the ${period} run`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem asChild>
          <Link href={`/payroll/runs/${run.id}`}>
            <ExternalLink /> Open run
          </Link>
        </DropdownMenuItem>
        {run.employee_count > 0 && (
          <>
            <DropdownMenuItem onSelect={() => void downloadRegister(run.id, "xlsx")}>
              <Download /> Salary register (Excel)
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void downloadRegister(run.id, "csv")}>
              <Download /> Register summary (CSV)
            </DropdownMenuItem>
          </>
        )}
        {isRunDeletable(run.status) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(run)}>
              <Trash2 /> Delete run
            </DropdownMenuItem>
          </>
        )}
        {isRunLocked(run.status) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Locked: it cannot be deleted. A correction is an arrears or off-cycle run.
            </DropdownMenuLabel>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const runColumns = (onDelete: (run: PayrollRun) => void): ColumnDef<PayrollRun>[] => [
  {
    id: "period",
    header: "Period",
    accessorFn: (run) => run.period_year * 100 + run.period_month,
    meta: { text: (run) => `${periodLabel(run.period_year, run.period_month)} ${RUN_TYPE[run.run_type]}` },
    cell: ({ row }) => (
      <>
        <Link href={`/payroll/runs/${row.original.id}`} className="font-medium text-foreground hover:underline">
          {periodLabel(row.original.period_year, row.original.period_month)}
        </Link>
        <p className="text-xs text-muted-foreground">{RUN_TYPE[row.original.run_type]}</p>
      </>
    ),
  },
  {
    accessorKey: "legal_entity_name",
    header: "Entity",
    cell: ({ row }) => row.original.legal_entity_name ?? "—",
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: { text: (run) => RUN_STATUS[run.status]?.label ?? run.status },
    cell: ({ row }) => <RunStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "employee_count",
    header: "Employees",
    meta: { className: "text-right tabular-nums" },
  },
  {
    accessorKey: "total_gross",
    header: "Gross",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.total_gross} />,
  },
  {
    accessorKey: "total_net",
    header: "Net pay",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.total_net} />,
  },
  {
    id: "attention",
    header: "Needs attention",
    meta: {
      text: (run) =>
        [
          run.unacknowledged_variances > 0 ? `${run.unacknowledged_variances} variance(s)` : null,
          run.review_flags.length > 0 ? `${run.review_flags.length} to resolve` : null,
          run.status === "approved" && !run.published_at ? "Not published" : null,
        ]
          .filter(Boolean)
          .join(", "),
    },
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.unacknowledged_variances > 0 && (
          <Badge variant="warning">{row.original.unacknowledged_variances} variance(s)</Badge>
        )}
        {row.original.review_flags.length > 0 && (
          <Badge variant="destructive">{row.original.review_flags.length} to resolve</Badge>
        )}
        {row.original.status === "approved" && !row.original.published_at && (
          <Badge variant="muted">Not published</Badge>
        )}
      </div>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    enableHiding: false,
    enableSorting: false,
    meta: { className: "w-16 text-right", text: false },
    cell: ({ row }) => (
      <div className="flex justify-end">
        <RunRowMenu run={row.original} onDelete={onDelete} />
      </div>
    ),
  },
];

/** Payroll runs (FRD 5.2). Tier 1: every figure here is money. */
export default function PayrollRunsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<RunStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [deleting, setDeleting] = useState<PayrollRun | null>(null);
  const columns = useMemo(() => runColumns(setDeleting), []);
  const query = `/payroll/runs?page=${page}&page_size=${pageSize}${
    status === "all" ? "" : `&status=${status}`
  }`;
  const { data, error, isLoading, reload } = useApiQuery<Page<PayrollRun>>(query);

  return (
    <PageShell
      title="Payroll runs"
      description="Compute, check, approve & lock, then publish a month's pay. Nothing is locked without a second person's sign-off."
      actions={<CreateRunDialog onCreated={(run) => router.push(`/payroll/runs/${run.id}`)} />}
    >
      <PayslipProtectionSwitch />
      <DeleteRunDialog
        run={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={() => {
          setDeleting(null);
          reload();
        }}
      />
      <DataTable
        title="Runs"
        columns={columns}
        data={data?.items ?? []}
        noun="runs"
        exportName="payroll-runs"
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        filtered={status !== "all"}
        empty={{
          icon: CircleDollarSign,
          title: "No payroll runs yet",
          description:
            "Open a run for a month. It computes once salaries are assigned, the rule sets are approved and attendance for the month is locked. Until you approve and lock it, a run can be recomputed or deleted.",
        }}
        emptyMessage="No runs with this status."
        filters={
          <Select
            value={status}
            onValueChange={(next) => {
              setStatus(next as RunStatus | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-48" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        server={{
          page,
          pageSize,
          total: data?.total ?? 0,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
        }}
      />
    </PageShell>
  );
}
