"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  CheckCircle2,
  FileUp,
  HandCoins,
  Loader2,
  RefreshCw,
  Repeat,
  Send,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import { DetailField } from "@/components/payroll-ops/disbursements/common";
import { Money } from "@/components/common/Money";
import { FormField } from "@/components/common/FormField";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
import {
  apiErrorMessage,
  DownloadButton,
  InlineProblem,
  QueryBoundary,
} from "@/components/payroll-ops/shared";
import {
  BatchStatusBadge,
  formatTimestamp,
  LINE_STATUS_LABEL,
  LineStatusBadge,
} from "@/components/payroll-ops/disbursements/labels";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type {
  BatchPrepareInput,
  DisbursementBatch,
  DisbursementException,
  DisbursementLine,
  HeldSalary,
  ReconcileOutcome,
} from "@/lib/types/payroll-ops";
import { formatDay, toISODate } from "@/lib/utils";
import { DatePicker } from "@/components/common/DatePicker";
import { FileInput } from "@/components/ui/file-input";

const ADMIN = ["admin"] as const;
const HR = ["admin", "sub_admin"] as const;

type FailedCredit = ReconcileOutcome["failed"][number];

const LINE_COLUMNS: ColumnDef<DisbursementLine>[] = [
  {
    id: "employee",
    header: "Employee",
    accessorFn: (line) => line.employee_name ?? "—",
    meta: { text: (line) => [line.employee_name, line.employee_code].filter(Boolean).join(" ") },
    cell: ({ row }) => (
      <>
        <span className="font-medium text-foreground">{row.original.employee_name ?? "—"}</span>
        <span className="block text-xs text-muted-foreground">{row.original.employee_code ?? ""}</span>
      </>
    ),
  },
  { accessorKey: "beneficiary_name", header: "Beneficiary" },
  { accessorKey: "ifsc", header: "IFSC", meta: { cellClassName: "tabular-nums" } },
  {
    accessorKey: "amount",
    header: "Amount",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.amount} />,
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: {
      text: (line) =>
        line.failure_reason
          ? `${LINE_STATUS_LABEL[line.status]} (${line.failure_reason})`
          : LINE_STATUS_LABEL[line.status],
    },
    cell: ({ row }) => (
      <>
        <LineStatusBadge status={row.original.status} />
        {row.original.failure_reason && (
          <span className="block max-w-56 truncate text-xs text-destructive">
            {row.original.failure_reason}
          </span>
        )}
      </>
    ),
  },
  {
    accessorKey: "bank_reference",
    header: "Bank reference",
    meta: { className: "hidden lg:table-cell", cellClassName: "text-muted-foreground" },
    cell: ({ row }) => row.original.bank_reference ?? "—",
  },
];

const HELD_COLUMNS: ColumnDef<HeldSalary>[] = [
  {
    accessorKey: "employee_name",
    header: "Employee",
    meta: { text: (item) => `${item.employee_name} ${item.employee_code}` },
    cell: ({ row }) => (
      <>
        <span className="text-foreground">{row.original.employee_name}</span>
        <span className="block text-xs text-muted-foreground">{row.original.employee_code}</span>
      </>
    ),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.amount} />,
  },
  { accessorKey: "reason", header: "Why it is held", meta: { cellClassName: "whitespace-normal" } },
  {
    id: "status",
    header: "Status",
    accessorFn: (item) => (item.paid_in_batch_id ? "Paid from a supplementary batch" : "Held"),
    meta: { cellClassName: "text-muted-foreground" },
  },
];

/** One disbursement batch: its file, maker-checker, release, and reconciliation. */
export function BatchDetailDialog({
  batchId,
  notice,
  onClose,
  onChanged,
  onOpenBatch,
  onFixAccount,
  onPrepareAgain,
}: {
  batchId: string | null;
  notice: string | null;
  onClose: () => void;
  onChanged: () => void;
  onOpenBatch: (batchId: string) => void;
  onFixAccount: (subject: string) => void;
  onPrepareAgain: (input: Partial<BatchPrepareInput>) => void;
}) {
  const query = useApiQuery<DisbursementBatch>(
    batchId ? `/disbursement/batches/${batchId}` : null,
  );

  return (
    <Dialog open={batchId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Salary file</DialogTitle>
          <DialogDescription>
            The person who prepares a batch cannot approve it, and regenerating a file voids its
            approval.
          </DialogDescription>
        </DialogHeader>
        {notice && <InlineProblem>{notice}</InlineProblem>}
        <QueryBoundary query={query} skeletonRows={5}>
          {(batch) => (
            <BatchBody
              key={`${batch.id}-${batch.status}-${batch.file_hash ?? ""}`}
              batch={batch}
              onUpdated={(updated) => {
                if (updated.id === batch.id) {
                  query.setData(updated);
                } else {
                  onOpenBatch(updated.id);
                }
                onChanged();
              }}
              onClose={onClose}
              onFixAccount={onFixAccount}
              onPrepareAgain={onPrepareAgain}
            />
          )}
        </QueryBoundary>
      </DialogContent>
    </Dialog>
  );
}

function BatchBody({
  batch,
  onUpdated,
  onClose,
  onFixAccount,
  onPrepareAgain,
}: {
  batch: DisbursementBatch;
  onUpdated: (batch: DisbursementBatch) => void;
  onClose: () => void;
  onFixAccount: (subject: string) => void;
  onPrepareAgain: (input: Partial<BatchPrepareInput>) => void;
}) {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole(...ADMIN);
  const isHr = hasRole(...HR);
  const lines = useApiQuery<DisbursementLine[]>(
    batch.status === "failed" && batch.validation_exceptions.length > 0
      ? null
      : `/disbursement/batches/${batch.id}/lines`,
  );

  const [actionError, setActionError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState(false);

  const preparedByMe = Boolean(user && batch.prepared_by_user_id === user.id);
  const failedLines = (lines.data ?? []).filter((line) => line.status === "failed");

  const approve = async () => {
    if (!batch.file_hash) return;
    setActionError(null);
    setIsApproving(true);
    try {
      const updated = await post<DisbursementBatch>(`/disbursement/batches/${batch.id}/approve`, {
        file_hash: batch.file_hash,
      });
      toast.success("File approved");
      onUpdated(updated);
    } catch (caught) {
      setActionError(apiErrorMessage(caught, "The file could not be approved."));
    } finally {
      setIsApproving(false);
    }
  };

  const regenerate = async () => {
    setActionError(null);
    try {
      const updated = await post<DisbursementBatch>(`/disbursement/batches/${batch.id}/regenerate`);
      toast.success("File regenerated. It needs approving again.");
      onUpdated(updated);
    } catch (caught) {
      const message = apiErrorMessage(caught, "The file could not be regenerated.");
      setActionError(message);
      toast.error(message);
      throw caught;
    }
  };

  const release = async () => {
    setActionError(null);
    setIsReleasing(true);
    try {
      const updated = await post<DisbursementBatch>(`/disbursement/batches/${batch.id}/release`);
      toast.success("Marked as released to the bank");
      onUpdated(updated);
    } catch (caught) {
      const message = apiErrorMessage(caught, "The batch could not be released.");
      setActionError(message);
      toast.error(message);
      throw caught;
    } finally {
      setIsReleasing(false);
    }
  };

  const exceptionColumns: ColumnDef<DisbursementException>[] = [
    {
      accessorKey: "subject",
      header: "Subject",
      meta: { cellClassName: "font-medium text-foreground" },
    },
    { accessorKey: "field", header: "Field", meta: { cellClassName: "text-muted-foreground" } },
    {
      accessorKey: "message",
      header: "Problem",
      meta: { cellClassName: "whitespace-normal", text: (item) => `${item.message} ${item.code}` },
      cell: ({ row }) => (
        <>
          {row.original.message}
          <span className="block text-xs text-muted-foreground">{row.original.code}</span>
        </>
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "w-44 text-right", text: false },
      cell: ({ row }) => {
        const item = row.original;
        const isAccountProblem = /account|ifsc|bank|beneficiary/i.test(
          `${item.field} ${item.code}`,
        );
        return (
          isAccountProblem &&
          isHr && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onClose();
                onFixAccount(item.subject);
              }}
            >
              <Wrench /> Fix bank account
            </Button>
          )
        );
      },
    },
  ];

  return (
    <div className="grid gap-5">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <DetailField label="Status">
          <BatchStatusBadge status={batch.status} />
        </DetailField>
        <DetailField label="Total">
          <Money value={batch.total_amount} className="font-semibold" />
        </DetailField>
        <DetailField label="Employees">
          <span className="tabular-nums">{batch.employee_count}</span>
        </DetailField>
        <DetailField label="Value date">
          {batch.value_date ? formatDay(batch.value_date, true) : "—"}
        </DetailField>
        <DetailField label="Prepared">
          {batch.prepared_by_name ?? "—"}
          <span className="block text-xs text-muted-foreground">
            {formatTimestamp(batch.prepared_at)}
          </span>
        </DetailField>
        <DetailField label="Approved">
          {batch.approved_by_name ?? "Not yet"}
          {batch.approved_at && (
            <span className="block text-xs text-muted-foreground">
              {formatTimestamp(batch.approved_at)}
            </span>
          )}
        </DetailField>
        <DetailField label="Released">{formatTimestamp(batch.released_at)}</DetailField>
        <DetailField label="File">{batch.file_name ?? "No file"}</DetailField>
        <div className="sm:col-span-4">
          <dt className="text-xs text-muted-foreground">File hash (what an approval signs)</dt>
          <dd className="mt-0.5 break-all text-xs text-foreground tabular-nums">
            {batch.file_hash ?? "—"}
          </dd>
        </div>
        {batch.supplements_batch_id && (
          <div className="sm:col-span-4">
            <dt className="text-xs text-muted-foreground">Supplementary batch</dt>
            <dd className="mt-0.5 text-foreground">
              Pays particular credits from an earlier salary file: credits the bank returned, or salaries that were held.
            </dd>
          </div>
        )}
        {batch.notes && (
          <div className="sm:col-span-4">
            <dt className="text-xs text-muted-foreground">Notes</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-foreground">{batch.notes}</dd>
          </div>
        )}
      </dl>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="grid gap-3">
        {batch.status === "pending_approval" && isAdmin && (
          <div className="rounded-md border border-border p-4">
            {preparedByMe ? (
              <p className="text-sm text-muted-foreground">
                You prepared this file, so you cannot approve it. Another admin must check and
                approve it.
              </p>
            ) : !batch.file_hash ? (
              <p className="text-sm text-muted-foreground">
                This batch has no file to approve yet.
              </p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-foreground">
                  Approving signs off the file with hash{" "}
                  <span className="break-all text-xs tabular-nums">{batch.file_hash}</span>. If it
                  is regenerated, this approval is voided.
                </p>
                <Button onClick={() => void approve()} disabled={isApproving}>
                  {isApproving ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                  Approve file
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {isHr && (batch.status === "pending_approval" || batch.status === "approved") && (
            <Button size="sm" variant="outline" onClick={() => setConfirmRegenerate(true)}>
              <RefreshCw /> Regenerate file
            </Button>
          )}
          {isAdmin && batch.status === "approved" && (
            <>
              <DownloadButton
                path={`/disbursement/batches/${batch.id}/file`}
                fallbackName={batch.file_name ?? `salary-file-${batch.id}.txt`}
                label="Download bank file"
              />
              <Button
                size="sm"
                onClick={() => setConfirmRelease(true)}
                disabled={isReleasing}
              >
                <Send /> Mark released to bank
              </Button>
            </>
          )}
          {isAdmin && batch.status === "released" && (
            <DownloadButton
              path={`/disbursement/batches/${batch.id}/file`}
              fallbackName={batch.file_name ?? `salary-file-${batch.id}.txt`}
              label="Download bank file"
            />
          )}
        </div>
        {isAdmin && (batch.status === "approved" || batch.status === "released") && (
          <p className="text-xs text-muted-foreground">
            The bank file can be downloaded only after approval and within 24 hours of it. After
            that, regenerate and approve again.
          </p>
        )}
        {actionError && <InlineProblem>{actionError}</InlineProblem>}
      </div>

      {/* ── Blocked worklist ────────────────────────────────────────────── */}
      {batch.status === "failed" && batch.validation_exceptions.length > 0 && (
        <div className="grid gap-3">
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                Fix these before preparing again{" "}
                <span className="text-muted-foreground tabular-nums">
                  ({batch.validation_exceptions.length})
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                No file was built. Correct each problem at its source, then prepare the file again.
              </p>
            </div>
            {isHr && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onPrepareAgain({
                      payroll_run_id: batch.payroll_run_id,
                      bank_profile_id: batch.bank_profile_id,
                      value_date: batch.value_date ?? undefined,
                      hold: Array.from(
                        new Set(batch.validation_exceptions.map((item) => item.subject)),
                      ).map((code) => ({ employee_code: code, reason: "" })),
                    })
                  }
                >
                  <HandCoins /> Hold these, pay the rest
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    onPrepareAgain({
                      payroll_run_id: batch.payroll_run_id,
                      bank_profile_id: batch.bank_profile_id,
                      value_date: batch.value_date ?? undefined,
                    })
                  }
                >
                  <Repeat /> Prepare again
                </Button>
              </div>
            )}
          </div>
          <div className="overflow-hidden rounded-md border border-border">
            <DataTable
              bordered={false}
              columns={exceptionColumns}
              data={batch.validation_exceptions}
              getRowId={(item, index) => `${item.subject}-${item.code}-${index}`}
              noun="problems"
              exportName="salary-file-problems"
              searchPlaceholder="Search problems"
            />
          </div>
        </div>
      )}

      {/* ── Held salaries ───────────────────────────────────────────────── */}
      {(batch.held ?? []).length > 0 && (
        <>
          <Separator />
          <HeldSalaries batch={batch} canPay={isHr} onPaid={onUpdated} />
        </>
      )}

      {/* ── Reconciliation ──────────────────────────────────────────────── */}
      {isHr && (batch.status === "released" || batch.status === "acknowledged") && (
        <>
          <Separator />
          <ReconcilePanel
            batch={batch}
            lines={lines.data ?? []}
            onImported={() => {
              lines.reload();
            }}
            onBatchChanged={onUpdated}
            failedCount={failedLines.length}
          />
        </>
      )}

      {/* ── Lines ───────────────────────────────────────────────────────── */}
      {!(batch.status === "failed" && batch.validation_exceptions.length > 0) && (
        <>
          <Separator />
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Credits in this file</p>
            <div className="overflow-hidden rounded-md border border-border">
              <QueryBoundary query={lines} skeletonRows={4}>
                {(rows) => (
                  <DataTable
                    bordered={false}
                    columns={LINE_COLUMNS}
                    data={rows}
                    noun="credits"
                    exportName="salary-file-credits"
                    searchPlaceholder="Search employee or beneficiary"
                    empty={{
                      icon: CheckCircle2,
                      title: "No credit lines",
                      description: "This batch has no lines to pay.",
                    }}
                  />
                )}
              </QueryBoundary>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmRegenerate}
        onOpenChange={setConfirmRegenerate}
        title="Regenerate this file?"
        description="The file is rebuilt from the current bank accounts and payroll. Any approval is voided, and the new file needs approving again before it can be downloaded."
        confirmLabel="Regenerate"
        destructive
        onConfirm={regenerate}
      />
      <ConfirmDialog
        open={confirmRelease}
        onOpenChange={setConfirmRelease}
        title="Mark this file as released to the bank?"
        description="Do this once the file has been uploaded to the bank. The batch then waits for the bank's response file to reconcile credits."
        confirmLabel="Mark released"
        onConfirm={release}
      />
    </div>
  );
}

function HeldSalaries({
  batch,
  canPay,
  onPaid,
}: {
  batch: DisbursementBatch;
  canPay: boolean;
  onPaid: (batch: DisbursementBatch) => void;
}) {
  const [valueDate, setValueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const waiting = batch.held.filter((item) => !item.paid_in_batch_id);
  const sent = batch.status === "released" || batch.status === "acknowledged";

  const pay = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!valueDate) {
      setError("Choose the value date for the held salaries.");
      return;
    }
    setIsPaying(true);
    try {
      const created = await post<DisbursementBatch>(`/disbursement/batches/${batch.id}/pay-held`, {
        value_date: valueDate,
      });
      toast.success("A batch for the held salaries is waiting for approval");
      onPaid(created);
    } catch (caught) {
      setError(apiErrorMessage(caught, "The held salaries could not be prepared."));
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div>
        <p className="text-sm font-medium text-foreground">
          Held out of this file{" "}
          <span className="text-muted-foreground tabular-nums">({batch.held.length})</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Not in the file, so everyone else was paid on time. They are paid from a supplementary
          batch once their bank accounts are in.
        </p>
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        <DataTable
          bordered={false}
          columns={HELD_COLUMNS}
          data={batch.held}
          getRowId={(item) => item.payslip_id}
          noun="held salaries"
          exportName="held-salaries"
          searchPlaceholder="Search employees"
        />
      </div>
      {canPay && waiting.length > 0 && sent && (
        <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => void pay(event)} noValidate>
          <FormField htmlFor="held-value-date" label="Value date">
            <DatePicker
              id="held-value-date"
              required
              min={toISODate(new Date())}
              value={valueDate}
              onChange={setValueDate}
            />
          </FormField>
          <Button type="submit" size="sm" disabled={isPaying}>
            {isPaying ? <Loader2 className="animate-spin" /> : <HandCoins />}
            Pay held salaries
          </Button>
        </form>
      )}
      {canPay && waiting.length > 0 && !sent && (
        <p className="text-xs text-muted-foreground">
          This file has not gone to the bank yet. If their accounts are in now, regenerate the file
          without the hold instead, so they are paid with everyone else.
        </p>
      )}
      {error && <InlineProblem>{error}</InlineProblem>}
    </div>
  );
}

function ReconcilePanel({
  batch,
  lines,
  onImported,
  onBatchChanged,
  failedCount,
}: {
  batch: DisbursementBatch;
  lines: DisbursementLine[];
  onImported: () => void;
  onBatchChanged: (batch: DisbursementBatch) => void;
  failedCount: number;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [outcome, setOutcome] = useState<ReconcileOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [valueDate, setValueDate] = useState("");
  const [supplementError, setSupplementError] = useState<string | null>(null);
  const [isSupplementing, setIsSupplementing] = useState(false);

  const nameOf = useMemo(() => {
    const byEmployee = new Map(lines.map((line) => [line.employee_id, line]));
    return (employeeId: string) => {
      const line = byEmployee.get(employeeId);
      return line?.employee_name
        ? `${line.employee_name}${line.employee_code ? ` (${line.employee_code})` : ""}`
        : employeeId;
    };
  }, [lines]);

  const importFile = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose the bank's response file.");
      return;
    }
    if (!/\.csv$/i.test(file.name)) {
      setError("The response file must be a CSV.");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    setIsImporting(true);
    try {
      const result = await post<ReconcileOutcome>(
        `/disbursement/batches/${batch.id}/reconcile/import`,
        form,
      );
      setOutcome(result);
      setFile(null);
      setInputKey((current) => current + 1);
      toast.success(`${result.credited} ${result.credited === 1 ? "credit" : "credits"} confirmed`);
      onImported();
    } catch (caught) {
      setError(apiErrorMessage(caught, "The response file could not be imported."));
    } finally {
      setIsImporting(false);
    }
  };

  const supplement = async (event: React.FormEvent) => {
    event.preventDefault();
    setSupplementError(null);
    if (!valueDate) {
      setSupplementError("Choose the value date for the reissued credits.");
      return;
    }
    setIsSupplementing(true);
    try {
      const created = await post<DisbursementBatch>(
        `/disbursement/batches/${batch.id}/supplementary`,
        { value_date: valueDate },
      );
      toast.success("Supplementary batch prepared for the failed credits");
      onBatchChanged(created);
    } catch (caught) {
      setSupplementError(apiErrorMessage(caught, "The supplementary batch could not be prepared."));
    } finally {
      setIsSupplementing(false);
    }
  };

  const showSupplement = failedCount > 0 || (outcome?.failed.length ?? 0) > 0;

  const failedColumns: ColumnDef<FailedCredit>[] = [
    { id: "employee", header: "Employee", accessorFn: (item) => nameOf(item.employee_id) },
    {
      accessorKey: "amount",
      header: "Amount",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.amount} />,
    },
    { accessorKey: "reason", header: "Bank's reason", meta: { cellClassName: "whitespace-normal" } },
  ];

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-sm font-medium text-foreground">Reconcile with the bank&apos;s response</p>
        <p className="text-xs text-muted-foreground">
          Upload the bank&apos;s response as a CSV with the header{" "}
          <span className="tabular-nums">account_number,status,reason,reference</span>.
        </p>
      </div>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => void importFile(event)} noValidate>
        <FormField htmlFor="reconcile-file" label="Response file">
          <FileInput
            key={inputKey}
            id="reconcile-file"
            accept=".csv,text/csv"
            required
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="max-w-xs"
          />
        </FormField>
        <Button type="submit" size="sm" disabled={isImporting}>
          {isImporting ? <Loader2 className="animate-spin" /> : <FileUp />}
          Import
        </Button>
      </form>
      {error && <InlineProblem>{error}</InlineProblem>}

      {outcome && (
        <div className="grid gap-3 rounded-md border border-border p-4 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <p>
              Credited: <span className="font-semibold tabular-nums">{outcome.credited}</span>
            </p>
            <p>
              Failed: <span className="font-semibold tabular-nums">{outcome.failed.length}</span>
            </p>
            <p>
              Unmatched rows:{" "}
              <span className="font-semibold tabular-nums">{outcome.unmatched.length}</span>
            </p>
            <p>
              Unreadable rows:{" "}
              <span className="font-semibold tabular-nums">{outcome.parse_errors.length}</span>
            </p>
          </div>
          <p className="text-muted-foreground">
            {outcome.failed.length === 0
              ? "No failed credits, so nobody needed notifying."
              : outcome.notified > 0
                ? `${outcome.notified} ${outcome.notified === 1 ? "person in HR was" : "people in HR were"} notified about the failed credits.`
                : "Nobody in HR was notified about the failed credits. Tell the team directly."}
          </p>
          {outcome.failed.length > 0 && (
            <div className="overflow-hidden rounded-md border border-border">
              <DataTable
                bordered={false}
                columns={failedColumns}
                data={outcome.failed}
                getRowId={(item) => item.line_id}
                noun="failed credits"
                exportName="failed-credits"
                searchPlaceholder="Search employees"
              />
            </div>
          )}
          {(outcome.already_reissued ?? []).length > 0 && (
            <p className="text-muted-foreground">
              {(outcome.already_reissued ?? []).length} row(s) matched a credit already reissued
              in a supplementary batch, so they were left as they were and will not be paid again.
            </p>
          )}
          {outcome.unmatched.length > 0 && (
            <div>
              <p className="font-medium text-foreground">Rows that matched no line in this batch</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {outcome.unmatched.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {outcome.parse_errors.length > 0 && (
            <div>
              <p className="font-medium text-foreground">Rows that could not be read</p>
              <ul className="mt-1 list-disc pl-5 text-destructive">
                {outcome.parse_errors.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {showSupplement && (
        <form
          className="grid gap-3 rounded-md border border-border p-4"
          onSubmit={(event) => void supplement(event)}
          noValidate
        >
          <div>
            <p className="text-sm font-medium text-foreground">Reissue failed credits</p>
            <p className="text-xs text-muted-foreground">
              Prepares a supplementary batch containing only the failed credits. Fix those
              employees&apos; bank accounts first. The new batch needs its own approval.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <FormField htmlFor="supplement-value-date" label="Value date">
              <DatePicker
                id="supplement-value-date"
                required
                min={toISODate(new Date())}
                value={valueDate}
                onChange={setValueDate}
              />
            </FormField>
            <Button type="submit" size="sm" disabled={isSupplementing}>
              {isSupplementing ? <Loader2 className="animate-spin" /> : <Repeat />}
              Prepare supplementary batch
            </Button>
          </div>
          {supplementError && <InlineProblem>{supplementError}</InlineProblem>}
        </form>
      )}
    </div>
  );
}
