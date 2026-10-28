"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, Lock, LockOpen, RefreshCw, Users } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import { PersonCell } from "@/components/common/PersonCell";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { type ApiError, post } from "@/lib/api";
import { ADMIN } from "@/lib/access";
import type {
  AttendanceSummaryResponse,
  EmployeeAttendanceSummary,
  PeriodLock,
} from "@/lib/types/attendance";
import { formatDateRange, formatDays } from "@/lib/utils";

import {
  currentMonthBounds,
  daysInclusive,
  errorDetail,
  formatDateTime,
} from "./shared";
import { Field } from "./ShiftsTab";
import { DatePicker } from "@/components/common/DatePicker";

const MAX_RECOMPUTE_DAYS = 93;

/**
 * LoadError's words as DataTable's `error` and `onRetry`: a 403 reads as a
 * lack of access, with nothing to retry.
 */
function loadErrorProps(error: ApiError | null, onRetry: () => void) {
  if (error?.status === 403) {
    return {
      error: `You don't have access to this. ${error.detail} If you think you should, ask your admin to check your role.`,
      onRetry: undefined,
    };
  }
  return { error: error?.detail ?? null, onRetry };
}

/** A day count from the API ("21.50"): sorted by its value, shown and exported as the screen shows it. */
function daysColumn(
  key: "payable_days" | "lop_days",
  header: string,
  cellClassName: string,
): ColumnDef<EmployeeAttendanceSummary> {
  return {
    id: key,
    header,
    accessorFn: (row) => Number(row[key]),
    meta: { className: "text-right", cellClassName, text: (row) => formatDays(row[key]) },
    cell: ({ row }) => formatDays(row.original[key]),
  };
}

function countColumn(
  key: "present_days" | "half_days" | "absent_days" | "on_leave_days" | "late_count",
  header: string,
): ColumnDef<EmployeeAttendanceSummary> {
  return { accessorKey: key, header, meta: { className: "text-right", cellClassName: "tabular-nums" } };
}

const SUMMARY_COLUMNS: ColumnDef<EmployeeAttendanceSummary>[] = [
  {
    accessorKey: "employee_name",
    header: "Employee",
    meta: { text: (row) => `${row.employee_name} ${row.employee_code}` },
    cell: ({ row }) => (
      <PersonCell
        size="sm"
        name={row.original.employee_name}
        subtitle={`${row.original.employee_code} · ${row.original.days_computed} days computed`}
      />
    ),
  },
  daysColumn("payable_days", "Payable", "font-medium tabular-nums"),
  daysColumn("lop_days", "LOP", "tabular-nums"),
  countColumn("present_days", "Present"),
  countColumn("half_days", "Half"),
  countColumn("absent_days", "Absent"),
  countColumn("on_leave_days", "On leave"),
  countColumn("late_count", "Late"),
  {
    accessorKey: "needs_regularisation",
    header: "Needs regularisation",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
    cell: ({ row }) =>
      row.original.needs_regularisation > 0 ? (
        <Badge variant="warning">{row.original.needs_regularisation}</Badge>
      ) : (
        0
      ),
  },
];

export function PeriodsTab() {
  const { hasRole } = useAuth();
  const canLock = hasRole(...ADMIN);
  const initial = currentMonthBounds();
  const [start, setStart] = useState(initial.from);
  const [end, setEnd] = useState(initial.to);
  const [confirmRecompute, setConfirmRecompute] = useState(false);
  const [recomputeError, setRecomputeError] = useState<string | null>(null);
  const [confirmLock, setConfirmLock] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState<PeriodLock | null>(null);

  const rangeOk = Boolean(start && end && start <= end);
  const span = rangeOk ? daysInclusive(start, end) : 0;
  const summary = useApiQuery<AttendanceSummaryResponse>(
    rangeOk ? `/attendance/summary?period_start=${start}&period_end=${end}` : null,
  );
  const locks = useApiQuery<PeriodLock[]>("/attendance/locks");

  const employees = useMemo(
    () =>
      [...(summary.data?.employees ?? [])].sort(
        (a, b) =>
          b.needs_regularisation - a.needs_regularisation ||
          a.employee_name.localeCompare(b.employee_name),
      ),
    [summary.data],
  );
  const lockRows = useMemo(
    () => [...(locks.data ?? [])].sort((a, b) => b.period_start.localeCompare(a.period_start)),
    [locks.data],
  );

  const isLocked = Boolean(summary.data?.is_locked);
  const pendingTotal = employees.reduce((sum, row) => sum + row.needs_regularisation, 0);

  const lockColumns: ColumnDef<PeriodLock>[] = [
    {
      id: "period",
      header: "Period",
      accessorFn: (row) => row.period_start,
      meta: {
        cellClassName: "whitespace-nowrap font-medium",
        text: (row) => formatDateRange(row.period_start, row.period_end),
      },
      cell: ({ row }) => formatDateRange(row.original.period_start, row.original.period_end),
    },
    {
      accessorKey: "locked_at",
      header: "Locked",
      meta: { cellClassName: "whitespace-nowrap tabular-nums", text: (row) => formatDateTime(row.locked_at) },
      cell: ({ row }) => formatDateTime(row.original.locked_at),
    },
    {
      id: "state",
      header: "State",
      accessorFn: (row) => (row.unlocked_at ? `Unlocked ${formatDateTime(row.unlocked_at)}` : "Locked"),
      cell: ({ row }) =>
        row.original.unlocked_at ? (
          <span className="text-sm text-muted-foreground">
            Unlocked <span className="tabular-nums">{formatDateTime(row.original.unlocked_at)}</span>
          </span>
        ) : (
          <Badge variant="outline">
            <Lock /> Locked
          </Badge>
        ),
    },
    {
      accessorKey: "unlock_reason",
      header: "Unlock reason",
      meta: { cellClassName: "max-w-64 whitespace-normal text-muted-foreground" },
      cell: ({ row }) => row.original.unlock_reason ?? "—",
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) =>
        canLock &&
        !row.original.unlocked_at && (
          <Button variant="outline" size="sm" onClick={() => setUnlocking(row.original)}>
            <LockOpen /> Unlock
          </Button>
        ),
    },
  ];

  const recompute = async () => {
    setRecomputeError(null);
    try {
      const result = await post<{ days_computed: number }>("/attendance/recompute", { start, end });
      toast.success(
        `${result.days_computed.toLocaleString("en-IN")} attendance ${result.days_computed === 1 ? "day" : "days"} recomputed`,
      );
      summary.reload();
    } catch (caught) {
      setRecomputeError(errorDetail(caught, "Could not recompute attendance."));
      throw caught;
    }
  };

  const lock = async () => {
    setLockError(null);
    try {
      await post<PeriodLock>("/attendance/lock", { period_start: start, period_end: end });
      toast.success(`${formatDateRange(start, end)} locked for payroll`);
      summary.reload();
      locks.reload();
    } catch (caught) {
      setLockError(errorDetail(caught, "Could not lock the period."));
      throw caught;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card tier="tier1" className="pb-0">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Period summary
            {summary.data &&
              (isLocked ? (
                <Badge variant="outline">
                  <Lock /> Locked for payroll
                </Badge>
              ) : (
                <Badge variant="muted">
                  <LockOpen /> Open
                </Badge>
              ))}
          </CardTitle>
          <CardDescription>
            Payable and LOP days per employee, as payroll will read them.
          </CardDescription>
          <CardAction className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!rangeOk || span > MAX_RECOMPUTE_DAYS || isLocked}
              title={isLocked ? "A locked period cannot be recomputed." : undefined}
              onClick={() => {
                setRecomputeError(null);
                setConfirmRecompute(true);
              }}
            >
              <RefreshCw /> Recompute
            </Button>
            {canLock && !isLocked && (
              <Button
                size="sm"
                disabled={!rangeOk || !summary.data}
                onClick={() => {
                  setLockError(null);
                  setConfirmLock(true);
                }}
              >
                <Lock /> Lock for payroll
              </Button>
            )}
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-end gap-3">
            <Field id="period-start" label="Period start">
              <DatePicker
                id="period-start"
                value={start}
                aria-invalid={!rangeOk}
                onChange={setStart}
              />
            </Field>
            <Field id="period-end" label="Period end">
              <DatePicker
                id="period-end"
                min={start}
                value={end}
                aria-invalid={!rangeOk}
                onChange={setEnd}
              />
            </Field>
          </div>
          {!rangeOk && (
            <p className="text-xs text-destructive">Choose a start date on or before the end date.</p>
          )}
          {rangeOk && span > MAX_RECOMPUTE_DAYS && (
            <p className="text-xs text-muted-foreground">
              Recompute covers at most {MAX_RECOMPUTE_DAYS} days at a time; this range is{" "}
              <span className="tabular-nums">{span}</span>.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            The nightly recompute runs from the scheduler, not from this screen. Use Recompute here
            only after correcting shifts, rosters, leave or punches for past days.
          </p>
        </CardContent>

        <div className="mt-5">
          {rangeOk && (
            <>
              {!summary.isLoading && !summary.error && pendingTotal > 0 && !isLocked && (
                <div className="px-5 pb-3">
                  <Alert variant="warning">
                    <AlertDescription>
                      <span className="tabular-nums">{pendingTotal}</span>{" "}
                      {pendingTotal === 1 ? "day still needs" : "days still need"} regularisation in
                      this period. Locking now freezes them as they are.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              <DataTable
                bordered={false}
                columns={SUMMARY_COLUMNS}
                // A new range never shows the previous range's rows while it loads.
                data={summary.isLoading ? [] : employees}
                getRowId={(row) => row.employee_id}
                noun="employees"
                exportName={`attendance-summary-${start}-${end}`}
                searchPlaceholder="Search employees"
                isLoading={summary.isLoading}
                loadingRows={5}
                {...loadErrorProps(summary.error, summary.reload)}
                empty={{
                  icon: Users,
                  title: "No attendance computed for this period",
                  description:
                    "No employee has computed days between these dates. Check assignments, or recompute the range.",
                }}
              />
            </>
          )}
        </div>
      </Card>

      <DataTable
        tier="tier1"
        title="Payroll locks"
        description="A locked period cannot be recomputed and its regularisations cannot be approved. Every unlock is audited with its reason."
        columns={lockColumns}
        data={locks.isLoading ? [] : lockRows}
        noun="locks"
        exportName="payroll-locks"
        searchPlaceholder="Search locks"
        isLoading={locks.isLoading}
        loadingRows={3}
        {...loadErrorProps(locks.error, locks.reload)}
        empty={{
          icon: Lock,
          title: "No periods have been locked",
          description: canLock
            ? "Lock a period once its attendance is final, before payroll runs."
            : "An admin locks a period once its attendance is final.",
        }}
      />

      <ConfirmDialog
        open={confirmRecompute}
        onOpenChange={setConfirmRecompute}
        title="Recompute attendance?"
        description={`Every attendance day between ${rangeOk ? formatDateRange(start, end) : ""} is recomputed from punches, shifts, rosters and leave. Approved regularisations are kept.`}
        confirmLabel="Recompute"
        onConfirm={recompute}
      >
        {recomputeError && (
          <Alert variant="destructive">
            <AlertDescription>{recomputeError}</AlertDescription>
          </Alert>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmLock}
        onOpenChange={setConfirmLock}
        title="Lock this period for payroll?"
        description={`${rangeOk ? formatDateRange(start, end) : ""} will be frozen: no recompute and no regularisation approvals until it is unlocked.`}
        confirmLabel="Lock period"
        onConfirm={lock}
      >
        {lockError && (
          <Alert variant="destructive">
            <AlertDescription>{lockError}</AlertDescription>
          </Alert>
        )}
      </ConfirmDialog>

      <UnlockDialog
        lock={unlocking}
        onClose={() => setUnlocking(null)}
        onSaved={() => {
          setUnlocking(null);
          locks.reload();
          summary.reload();
        }}
      />
    </div>
  );
}

function UnlockDialog({
  lock,
  onClose,
  onSaved,
}: {
  lock: PeriodLock | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const reasonOk = reason.trim().length >= 3;

  const close = () => {
    if (isSaving) return;
    setReason("");
    setSubmitted(false);
    setServerError(null);
    onClose();
  };

  const save = async () => {
    setSubmitted(true);
    if (!lock || !reasonOk) return;
    setIsSaving(true);
    setServerError(null);
    try {
      await post<PeriodLock>(`/attendance/lock/${lock.id}/unlock`, { reason: reason.trim() });
      toast.success(`${formatDateRange(lock.period_start, lock.period_end)} unlocked`);
      setReason("");
      setSubmitted(false);
      onSaved();
    } catch (caught) {
      setServerError(errorDetail(caught, "Could not unlock the period."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={lock !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unlock {lock ? formatDateRange(lock.period_start, lock.period_end) : ""}</DialogTitle>
          <DialogDescription>
            Attendance for this period can change again once unlocked. The reason is kept in the
            audit log.
          </DialogDescription>
        </DialogHeader>
        <Field
          id="unlock-reason"
          label="Reason"
          error={submitted && !reasonOk ? "Give a reason of at least 3 characters." : undefined}
        >
          <Textarea
            id="unlock-reason"
            rows={3}
            maxLength={1000}
            value={reason}
            aria-invalid={submitted && !reasonOk}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Late-approved leave for three employees must be reflected before the payroll rerun"
          />
        </Field>
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={close}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isSaving} onClick={() => void save()}>
            {isSaving && <Loader2 className="animate-spin" />}
            Unlock period
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
