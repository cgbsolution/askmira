"use client";

import { CircleDollarSign } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { CreateRunDialog } from "@/components/payroll/CreateRunDialog";
import { periodLabel, RUN_TYPE } from "@/components/payroll/labels";
import { RunStatusBadge } from "@/components/payroll/RunStatusBadge";
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
import type { Page } from "@/lib/types";
import type { PayrollRun, RunStatus } from "@/lib/types/payroll";

const PAGE_SIZE = 25;

const STATUS_FILTERS: { value: RunStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Awaiting approval" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
];

/** Payroll runs (FRD 5.2). Tier 1: every figure here is money. */
export default function PayrollRunsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<RunStatus | "all">("all");
  const [page, setPage] = useState(1);
  const query = `/payroll/runs?page=${page}&page_size=${PAGE_SIZE}${
    status === "all" ? "" : `&status=${status}`
  }`;
  const { data, error, isLoading, reload } = useApiQuery<Page<PayrollRun>>(query);
  const runs = data?.items ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <PageShell
      title="Payroll runs"
      description="Compute, review, approve and publish a month's pay. Nothing moves without a second person's sign-off."
      actions={<CreateRunDialog onCreated={(run) => router.push(`/payroll/runs/${run.id}`)} />}
    >
      <DataPanel
        title="Runs"
        toolbar={
          <Select
            value={status}
            onValueChange={(next) => {
              setStatus(next as RunStatus | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48" aria-label="Filter by status">
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
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        isEmpty={runs.length === 0}
        empty={{
          icon: CircleDollarSign,
          title: status === "all" ? "No payroll runs yet" : "No runs with this status",
          description:
            "Open a run for a month. It computes once salaries are assigned, the rule sets are approved and attendance for the month is locked.",
        }}
        footer={
          data && data.total > PAGE_SIZE ? (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {page} of {pages} · {data.total} runs
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Employees</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Net pay</TableHead>
                <TableHead>Needs attention</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <Link
                      href={`/payroll/runs/${run.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {periodLabel(run.period_year, run.period_month)}
                    </Link>
                    <p className="text-xs text-muted-foreground">{RUN_TYPE[run.run_type]}</p>
                  </TableCell>
                  <TableCell>{run.legal_entity_name ?? "—"}</TableCell>
                  <TableCell>
                    <RunStatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{run.employee_count}</TableCell>
                  <TableCell className="text-right">
                    <Money value={run.total_gross} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={run.total_net} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {run.unacknowledged_variances > 0 && (
                        <Badge variant="warning">{run.unacknowledged_variances} variance(s)</Badge>
                      )}
                      {run.review_flags.length > 0 && (
                        <Badge variant="destructive">{run.review_flags.length} to resolve</Badge>
                      )}
                      {run.status === "approved" && !run.published_at && (
                        <Badge variant="muted">Not published</Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DataPanel>
    </PageShell>
  );
}
