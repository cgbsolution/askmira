"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Ban, FileWarning, Loader2, ShieldCheck, Users } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import { DetailField } from "@/components/payroll-ops/disbursements/common";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { FormField } from "@/components/common/FormField";
import { EmptyState } from "@/components/common/EmptyState";
import {
  apiErrorMessage,
  InlineProblem,
  isNegative,
  QueryBoundary,
} from "@/components/payroll-ops/shared";
import { EmployeePicker } from "@/components/payroll-ops/disbursements/EmployeePicker";
import {
  ArrearStatusBadge,
  displayPeriod,
  formatTimestamp,
  humanize,
} from "@/components/payroll-ops/arrears/labels";
import { ReliefPanel, ReliefResult } from "@/components/payroll-ops/arrears/ReliefPanel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import type { ArrearBatch, ArrearLine, SectionRelief } from "@/lib/types/payroll-ops";
import { cn } from "@/lib/utils";

/** One arrear batch: totals, filings statement, approval, lines, and Section 89(1) relief. */
export function ArrearBatchDialog({
  batchId,
  onClose,
  onChanged,
}: {
  batchId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const batches = useApiQuery<ArrearBatch[]>(batchId ? "/arrears/batches" : null);
  const batch = batches.data?.find((row) => row.id === batchId) ?? null;
  const batchQuery = {
    data: batches.data ? batch : null,
    error: batches.error,
    isLoading: batches.isLoading,
    reload: batches.reload,
  };

  return (
    <Dialog open={batchId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Arrear batch</DialogTitle>
          <DialogDescription>
            Closed payroll runs are never rewritten. These are the differences, paid in a future
            payroll run once approved.
          </DialogDescription>
        </DialogHeader>
        <QueryBoundary query={batchQuery} skeletonRows={5}>
          {(row) =>
            row === null ? (
              <EmptyState icon={FileWarning} title="This batch could not be found" />
            ) : (
              <BatchBody
                batch={row}
                onApproved={() => {
                  batches.reload();
                  onChanged();
                }}
              />
            )
          }
        </QueryBoundary>
      </DialogContent>
    </Dialog>
  );
}

function BatchBody({ batch, onApproved }: { batch: ArrearBatch; onApproved: () => void }) {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const isPayroll = hasRole("admin", "sub_admin");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  const lines = useApiQuery<ArrearLine[]>(
    `/arrears/batches/${batch.id}/lines${
      employee ? `?employee_id=${encodeURIComponent(employee.id)}` : ""
    }`,
  );
  const reliefs = useApiQuery<SectionRelief[]>(
    `/arrears/reliefs?batch_id=${encodeURIComponent(batch.id)}${
      employee ? `&employee_id=${encodeURIComponent(employee.id)}` : ""
    }`,
  );

  const computedByMe = Boolean(user && batch.computed_by_user_id === user.id);
  const firstApprovalMine = Boolean(user && batch.approved_by_user_id === user.id);
  const containsMine = Boolean(
    user?.employee_id &&
      !employee &&
      (lines.data ?? []).some((line) => line.employee_id === user.employee_id),
  );
  const needsAck = batch.affected_filings.length > 0;
  const canApproveNow =
    batch.status === "pending_approval" || batch.awaiting_additional_approval;

  const approve = async () => {
    setApproveError(null);
    if (needsAck && !acknowledged) {
      setApproveError("Acknowledge the affected filings before approving.");
      return;
    }
    setIsApproving(true);
    try {
      const updated = await post<ArrearBatch>(`/arrears/batches/${batch.id}/approve`, {
        acknowledge_filings: acknowledged,
      });
      toast.success(
        updated.awaiting_additional_approval
          ? "First approval recorded. A second, different approver is needed."
          : "Arrear batch approved. It will be paid in the next payroll run.",
      );
      setAcknowledged(false);
      onApproved();
    } catch (caught) {
      setApproveError(apiErrorMessage(caught, "The batch could not be approved."));
    } finally {
      setIsApproving(false);
    }
  };

  // A batch worked out wrongly is discarded before a run pays it, rather than
  // approved and corrected later.
  const canCancel =
    isPayroll &&
    (batch.status === "pending_approval" || batch.status === "approved") &&
    !batch.paid_in_run_id;

  const cancel = async () => {
    if (cancelReason.trim().length < 3) {
      toast.error("Say why these arrears are being cancelled.");
      throw new Error("reason required");
    }
    try {
      await post<ArrearBatch>(`/arrears/batches/${batch.id}/cancel`, {
        reason: cancelReason.trim(),
      });
      toast.success("Arrear batch cancelled. Nothing on it will be paid.");
      setCancelReason("");
      onApproved();
    } catch (caught) {
      toast.error(apiErrorMessage(caught, "The batch could not be cancelled."));
      throw caught;
    }
  };

  let approvalBlock: React.ReactNode = null;
  if (isAdmin && canApproveNow) {
    if (computedByMe) {
      approvalBlock = (
        <p className="text-sm text-muted-foreground">
          You computed this batch, so you cannot approve it. Another admin must.
        </p>
      );
    } else if (batch.awaiting_additional_approval && firstApprovalMine) {
      approvalBlock = (
        <p className="text-sm text-muted-foreground">
          You gave the first approval. This batch is above the additional-approval threshold, so a
          second, different approver must sign it off.
        </p>
      );
    } else if (containsMine) {
      approvalBlock = (
        <p className="text-sm text-muted-foreground">
          This batch contains your own arrears, so you cannot approve it. Another admin must.
        </p>
      );
    } else {
      approvalBlock = (
        <div className="grid gap-3">
          {batch.awaiting_additional_approval && (
            <p className="text-sm text-foreground">
              The first approval is recorded. Yours would be the second, additional approval.
            </p>
          )}
          {needsAck && (
            <div className="flex items-start gap-2">
              <Checkbox
                id="ack-filings"
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
              />
              <Label htmlFor="ack-filings" className="font-normal leading-snug">
                I understand that the returns listed above were already filed for these periods and
                may need revising once the arrears are paid.
              </Label>
            </div>
          )}
          {approveError && <InlineProblem>{approveError}</InlineProblem>}
          <div>
            <Button
              onClick={() => void approve()}
              disabled={isApproving || (needsAck && !acknowledged)}
            >
              {isApproving ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              {batch.awaiting_additional_approval ? "Give second approval" : "Approve batch"}
            </Button>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="grid gap-5">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <DetailField label="Status">
          <ArrearStatusBadge status={batch.status} />
          {batch.awaiting_additional_approval && (
            <span className="mt-1 block text-xs text-muted-foreground">
              Awaiting additional approval
            </span>
          )}
        </DetailField>
        <DetailField label="Periods">
          {displayPeriod(batch.from_period)} – {displayPeriod(batch.to_period)}
        </DetailField>
        <DetailField label="Employees">
          <span className="tabular-nums">{batch.employee_count}</span>
        </DetailField>
        <DetailField label="Net payable">
          <Money value={batch.total_net_payable} className="font-semibold" />
        </DetailField>
        <DetailField label="Earnings arrear">
          <Money value={batch.total_earnings_arrear} />
        </DetailField>
        <DetailField label="Employee deductions">
          <Money value={batch.total_employee_deduction_arrear} />
        </DetailField>
        <DetailField label="Employer contributions (not netted)">
          <Money value={batch.total_employer_contribution_arrear} />
        </DetailField>
        <DetailField label="Computed">
          {formatTimestamp(batch.computed_at)}
          {computedByMe && <span className="block text-xs text-muted-foreground">by you</span>}
        </DetailField>
        <DetailField label="Approved">
          {formatTimestamp(batch.approved_at)}
          {firstApprovalMine && <span className="block text-xs text-muted-foreground">by you</span>}
        </DetailField>
        {batch.requires_additional_approval && (
          <DetailField label="Additional approval">
            {batch.additional_approved_at
              ? formatTimestamp(batch.additional_approved_at)
              : "Required, not yet given"}
          </DetailField>
        )}
        <DetailField label="Paid">
          {batch.paid_in_run_id ? "In a payroll run" : "Not yet — paid in a future payroll run"}
        </DetailField>
      </dl>

      {needsAck && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 px-3 py-2.5 text-sm">
          <FileWarning className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">Affected filings</p>
            <p className="text-muted-foreground">
              These returns were already filed for periods this batch changes:
            </p>
            <ul className="mt-1 list-disc pl-4 text-foreground">
              {batch.affected_filings.map((filing) => (
                <li key={filing}>{filing}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {approvalBlock && <div className="rounded-md border border-border p-4">{approvalBlock}</div>}

      {canCancel && (
        <div>
          <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
            <Ban /> Cancel batch
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={(open) => {
          setCancelOpen(open);
          if (!open) setCancelReason("");
        }}
        title="Cancel this arrear batch?"
        description="Nothing on it is paid. Use this when the batch was worked out on the wrong salary record; raise the revision again once it is right."
        confirmLabel="Cancel batch"
        cancelLabel="Keep batch"
        destructive
        onConfirm={cancel}
      >
        <FormField htmlFor="arrear-cancel-reason" label="Reason">
          <Textarea
            id="arrear-cancel-reason"
            value={cancelReason}
            maxLength={500}
            onChange={(event) => setCancelReason(event.target.value)}
          />
        </FormField>
      </ConfirmDialog>

      <FormField htmlFor="arrear-lines-employee" label="Employee" className="w-full max-w-md">
        <EmployeePicker id="arrear-lines-employee" value={employee} onChange={setEmployee} />
        <p className="text-xs text-muted-foreground">
          Narrows the lines, and is needed to compute Section 89(1) relief.
        </p>
      </FormField>

      <Tabs defaultValue="lines">
        <TabsList>
          <TabsTrigger value="lines">Lines</TabsTrigger>
          <TabsTrigger value="relief">Section 89(1) relief</TabsTrigger>
        </TabsList>
        <TabsContent value="lines">
          <div className="overflow-hidden rounded-md border border-border">
            <QueryBoundary query={lines} skeletonRows={5}>
              {(rows) => <GroupedLines rows={rows} filtered={Boolean(employee)} />}
            </QueryBoundary>
          </div>
        </TabsContent>
        <TabsContent value="relief" className="grid gap-4">
          <div className="overflow-hidden rounded-md border border-border">
            <QueryBoundary query={reliefs} skeletonRows={2}>
              {(rows) =>
                rows.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No relief computed yet"
                    description={
                      employee
                        ? "Compute it below."
                        : "Choose an employee above to compute their relief."
                    }
                  />
                ) : (
                  <div className="grid gap-3 p-3">
                    {rows.map((relief) => (
                      <div key={relief.id} className="grid gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {relief.employee_name ?? "Employee"}{" "}
                          <span className="font-normal text-muted-foreground">
                            {relief.employee_code ?? ""} · {relief.financial_year}
                          </span>
                        </p>
                        <ReliefResult relief={relief} onIssued={reliefs.reload} />
                      </div>
                    ))}
                  </div>
                )
              }
            </QueryBoundary>
          </div>
          {employee && (
            <ReliefPanel
              key={employee.id}
              batchId={batch.id}
              employee={employee}
              onComputed={reliefs.reload}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

const LINE_COLUMNS: ColumnDef<ArrearLine>[] = [
  {
    id: "employee",
    header: "Employee",
    accessorFn: (line) => line.employee_name ?? "Employee",
    meta: { text: (line) => `${line.employee_name ?? "Employee"} ${line.employee_code ?? ""}` },
    cell: ({ row }) => (
      <>
        <span className="font-medium text-foreground">{row.original.employee_name ?? "Employee"}</span>
        <span className="block text-xs text-muted-foreground">{row.original.employee_code ?? ""}</span>
      </>
    ),
  },
  {
    accessorKey: "period",
    header: "Period",
    meta: { className: "whitespace-nowrap", text: (line) => displayPeriod(line.period) },
    cell: ({ row }) => displayPeriod(row.original.period),
  },
  {
    accessorKey: "component_name",
    header: "Component",
    meta: { text: (line) => `${line.component_name} ${line.component_code}` },
    cell: ({ row }) => (
      <>
        <span className="text-foreground">{row.original.component_name}</span>
        <span className="block text-xs text-muted-foreground">{row.original.component_code}</span>
      </>
    ),
  },
  {
    accessorKey: "component_type",
    header: "Type",
    meta: {
      className: "hidden sm:table-cell",
      cellClassName: "text-muted-foreground",
      text: (line) => humanize(line.component_type),
    },
    cell: ({ row }) => humanize(row.original.component_type),
  },
  {
    accessorKey: "paid_amount",
    header: "Paid",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.paid_amount} className="text-muted-foreground" />,
  },
  {
    accessorKey: "should_have_been_amount",
    header: "Should have been",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.should_have_been_amount} />,
  },
  {
    accessorKey: "difference",
    header: "Difference",
    meta: { className: "text-right" },
    cell: ({ row }) => (
      <Money
        value={row.original.difference}
        className={cn("font-medium", isNegative(row.original.difference) && "text-destructive")}
      />
    ),
  },
];

/** Lines by employee, then by period: each row names its employee and period. */
function GroupedLines({ rows, filtered }: { rows: ArrearLine[]; filtered: boolean }) {
  // Employees in the order they first appear, each one's periods oldest first.
  const ordered = useMemo(() => {
    const byEmployee = new Map<string, Map<string, ArrearLine[]>>();
    for (const line of rows) {
      let periods = byEmployee.get(line.employee_id);
      if (!periods) {
        periods = new Map();
        byEmployee.set(line.employee_id, periods);
      }
      const list = periods.get(line.period) ?? [];
      list.push(line);
      periods.set(line.period, list);
    }
    return Array.from(byEmployee.values()).flatMap((periods) =>
      Array.from(periods.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([, periodLines]) => periodLines),
    );
  }, [rows]);

  return (
    <DataTable
      bordered={false}
      columns={LINE_COLUMNS}
      data={ordered}
      noun="lines"
      exportName="arrear-lines"
      searchPlaceholder="Search employee or component"
      filtered={filtered}
      empty={{ icon: Users, title: "This batch has no lines" }}
      emptyMessage="No arrears for this employee in this batch."
    />
  );
}
