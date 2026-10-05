"use client";

import { FileWarning, Loader2, ShieldCheck, Users } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import { DetailField } from "@/components/payroll-ops/disbursements/common";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

/** Lines grouped by employee, then by period. */
function GroupedLines({ rows, filtered }: { rows: ArrearLine[]; filtered: boolean }) {
  const groups = useMemo(() => {
    const byEmployee = new Map<string, { label: string; code: string; periods: Map<string, ArrearLine[]> }>();
    for (const line of rows) {
      let group = byEmployee.get(line.employee_id);
      if (!group) {
        group = {
          label: line.employee_name ?? "Employee",
          code: line.employee_code ?? "",
          periods: new Map(),
        };
        byEmployee.set(line.employee_id, group);
      }
      const list = group.periods.get(line.period) ?? [];
      list.push(line);
      group.periods.set(line.period, list);
    }
    return Array.from(byEmployee.entries()).map(([id, group]) => ({
      id,
      ...group,
      periods: Array.from(group.periods.entries()).sort(([a], [b]) => a.localeCompare(b)),
    }));
  }, [rows]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={filtered ? "No arrears for this employee in this batch" : "This batch has no lines"}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Component</TableHead>
          <TableHead className="hidden sm:table-cell">Type</TableHead>
          <TableHead className="text-right">Paid</TableHead>
          <TableHead className="text-right">Should have been</TableHead>
          <TableHead className="text-right">Difference</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <React.Fragment key={group.id}>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableCell colSpan={5} className="font-semibold text-foreground">
                {group.label}{" "}
                <span className="font-normal text-muted-foreground">{group.code}</span>
              </TableCell>
            </TableRow>
            {group.periods.map(([period, periodLines]) => (
              <React.Fragment key={`${group.id}-${period}`}>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-1.5 pl-6 text-xs font-medium text-muted-foreground">
                    {displayPeriod(period)}
                  </TableCell>
                </TableRow>
                {periodLines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="pl-6">
                      <span className="text-foreground">{line.component_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {line.component_code}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {humanize(line.component_type)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={line.paid_amount} className="text-muted-foreground" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={line.should_have_been_amount} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money
                        value={line.difference}
                        className={cn("font-medium", isNegative(line.difference) && "text-destructive")}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
