"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Check, ClipboardCheck, Inbox, Loader2, Lock, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { PersonCell } from "@/components/common/PersonCell";
import { EmptyState } from "@/components/common/EmptyState";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { chainSummary } from "@/components/common/ApprovalChain";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { MANAGERS, roleAllows } from "@/lib/access";
import { type ApiError, patch } from "@/lib/api";
import type {
  AttendanceException,
  AttendanceExceptionKind,
  AttendanceExceptionReport,
  Regularisation,
  RegularisationQueueItem,
} from "@/lib/types/attendance";
import { formatDate, formatDateRange, formatDay } from "@/lib/utils";

import { KIND_LABELS } from "./AttendanceRequestDialog";
import { CoverageTab } from "./CoverageTab";
import {
  currentMonthBounds,
  errorDetail,
  EXCEPTION_LABELS,
  ExceptionKindBadge,
  formatClock,
  LoadError,
  STATUS_LABELS,
  StatusBadge,
} from "./shared";
import { SwapQueue } from "./ShiftSwaps";
import { TeamToday } from "./TeamToday";
import { DatePicker } from "@/components/common/DatePicker";

/**
 * Attendance review for managers and HR (their reporting line, or everyone for HR).
 */
const TABS = ["today", "regularisations", "swaps", "coverage", "exceptions"];

export function AttendanceReview({ initialTab }: { initialTab?: string }) {
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const { user } = useAuth();
  // Somebody an approval rule names, with no team of their own: their queue only.
  const reviewsTeam = roleAllows(user, MANAGERS);
  const fallback = reviewsTeam ? "today" : "regularisations";

  if (!reviewsTeam) {
    return <RegularisationQueue onCount={setPendingCount} />;
  }

  return (
    <Tabs defaultValue={initialTab && TABS.includes(initialTab) ? initialTab : fallback}>
      <TabsList>
        <TabsTrigger value="today">Team today</TabsTrigger>
        <TabsTrigger value="regularisations">
          Requests
          {pendingCount !== null && pendingCount > 0 && (
            <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground tabular-nums">
              {pendingCount}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="swaps">Shift swaps</TabsTrigger>
        <TabsTrigger value="coverage">Coverage</TabsTrigger>
        <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
      </TabsList>
      <TabsContent value="today" className="mt-4">
        <TeamToday />
      </TabsContent>
      <TabsContent value="regularisations" className="mt-4">
        <RegularisationQueue onCount={setPendingCount} />
      </TabsContent>
      <TabsContent value="swaps" className="mt-4">
        <SwapQueue />
      </TabsContent>
      <TabsContent value="coverage" className="mt-4">
        <CoverageTab />
      </TabsContent>
      <TabsContent value="exceptions" className="mt-4">
        <ExceptionsReport />
      </TabsContent>
    </Tabs>
  );
}

// ── Regularisation queue ────────────────────────────────────────────────────

function RegularisationQueue({ onCount }: { onCount: (count: number) => void }) {
  const { data, error, isLoading, reload } = useApiQuery<RegularisationQueueItem[]>(
    "/attendance/regularisations/pending",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<RegularisationQueueItem | null>(null);
  const [note, setNote] = useState("");
  const [noteTouched, setNoteTouched] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  useEffect(() => {
    if (data) onCount(data.length);
  }, [data, onCount]);

  const rows = useMemo(
    () =>
      [...(data ?? [])].sort(
        (a, b) =>
          a.attendance_date.localeCompare(b.attendance_date) ||
          a.employee_name.localeCompare(b.employee_name),
      ),
    [data],
  );

  const decide = async (item: RegularisationQueueItem, approve: boolean, decisionNote: string | null) => {
    setBusyId(item.id);
    setRejectError(null);
    try {
      await patch<Regularisation>(`/attendance/regularisation/${item.id}`, {
        approve,
        note: decisionNote,
      });
      toast.success(
        `${approve ? "Approved" : "Rejected"} ${item.employee_name}'s ${KIND_LABELS[item.kind].toLowerCase()} for ${formatDay(item.attendance_date, true)}`,
      );
      setRejecting(null);
      reload();
    } catch (caught) {
      const detail = errorDetail(caught, "Could not record the decision.");
      if (approve) toast.error(detail);
      else setRejectError(detail);
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card tier="tier1">
        <LoadError error={error} onRetry={reload} />
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card tier="tier1">
        <EmptyState
          icon={Inbox}
          title="You're all caught up"
          description="Regularisations raised by people you can decide for appear here. Your own requests go to your approver, not to this queue."
        />
      </Card>
    );
  }

  const noteOk = note.trim().length > 0;

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const busy = busyId === row.id;
        return (
          <Card key={row.id} tier="tier1" className="gap-0 py-4">
            <CardContent className="flex flex-col gap-4 px-4 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <PersonCell name={row.employee_name} subtitle={row.employee_code} />
                    {chainSummary(row.approval_chain) && (
                      <p className="mt-1 text-xs text-muted-foreground">{chainSummary(row.approval_chain)}</p>
                    )}
                    <Badge variant="outline">{KIND_LABELS[row.kind]}</Badge>
                    {row.period_locked && (
                      <Badge variant="warning">
                        <Lock /> Period locked
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground">{formatDay(row.attendance_date, true)}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <StatusBadge status={row.current_status} />
                    <span className="text-muted-foreground">→</span>
                    <StatusBadge status={row.requested_status} />
                    {(row.requested_first_in || row.requested_last_out) && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        in {formatClock(row.requested_first_in)} · out{" "}
                        {formatClock(row.requested_last_out)}
                      </span>
                    )}
                  </div>
                  {row.current_note && (
                    <p className="text-xs text-muted-foreground">System note: {row.current_note}</p>
                  )}
                  <p className="text-sm text-muted-foreground">“{row.reason}”</p>
                  {row.period_locked && (
                    <p className="flex items-start gap-1.5 text-xs text-marigold-900 dark:text-marigold-100">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      This date is in a period locked for payroll. Approval will be refused until
                      HR unlocks it; rejecting is still possible.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Raised {formatDate(row.created_at)}</p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2 md:flex-col lg:flex-row">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setNote("");
                    setNoteTouched(false);
                    setRejectError(null);
                    setRejecting(row);
                  }}
                >
                  <X /> Reject
                </Button>
                <Button size="sm" disabled={busy} onClick={() => void decide(row, true, null)}>
                  {busy ? <Loader2 className="animate-spin" /> : <Check />}
                  Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog
        open={rejecting !== null}
        onOpenChange={(open) => !open && busyId === null && setRejecting(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject {rejecting?.employee_name}&apos;s regularisation</DialogTitle>
            <DialogDescription>
              {rejecting &&
                `${formatDay(rejecting.attendance_date, true)}. The day stays as recorded, and they will see your reason.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="reject-note">Reason</Label>
            <Textarea
              id="reject-note"
              rows={3}
              maxLength={1000}
              value={note}
              aria-invalid={noteTouched && !noteOk}
              onChange={(event) => setNote(event.target.value)}
              onBlur={() => setNoteTouched(true)}
              placeholder="e.g. The badge log shows no entry that day — please apply for leave instead."
            />
            {noteTouched && !noteOk && (
              <p className="text-xs text-destructive">A reason is required to reject.</p>
            )}
          </div>
          {rejectError && (
            <Alert variant="destructive">
              <AlertDescription>{rejectError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busyId !== null} onClick={() => setRejecting(null)}>
              Back
            </Button>
            <Button
              variant="destructive"
              disabled={busyId !== null}
              onClick={() => {
                setNoteTouched(true);
                if (rejecting && noteOk) void decide(rejecting, false, note.trim());
              }}
            >
              {busyId !== null && busyId === rejecting?.id && <Loader2 className="animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Exceptions ──────────────────────────────────────────────────────────────

const ALL_KINDS = "all";

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

const EXCEPTION_COLUMNS: ColumnDef<AttendanceException>[] = [
  {
    accessorKey: "employee_name",
    header: "Employee",
    meta: { text: (row) => `${row.employee_name} ${row.employee_code}` },
    // A person's name heads their run of rows, as the rows are shown.
    cell: ({ row, table }) => {
      const shown = table.getRowModel().rows;
      const previous = shown[shown.findIndex((other) => other.id === row.id) - 1];
      return previous?.original.employee_id === row.original.employee_id ? null : (
        <PersonCell size="sm" name={row.original.employee_name} subtitle={row.original.employee_code} />
      );
    },
  },
  {
    accessorKey: "attendance_date",
    header: "Date",
    meta: { cellClassName: "whitespace-nowrap", text: (row) => formatDay(row.attendance_date, true) },
    cell: ({ row }) => formatDay(row.original.attendance_date, true),
  },
  {
    accessorKey: "kind",
    header: "Kind",
    meta: { text: (row) => EXCEPTION_LABELS[row.kind] },
    cell: ({ row }) => <ExceptionKindBadge kind={row.original.kind} />,
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: { text: (row) => (row.status ? STATUS_LABELS[row.status] : "Not computed") },
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "detail",
    header: "Detail",
    meta: { cellClassName: "max-w-80 whitespace-normal text-muted-foreground" },
  },
  {
    id: "regularisation",
    header: "Regularisation",
    accessorFn: (row) => (row.has_pending_regularisation ? "Pending" : "None raised"),
    cell: ({ row }) =>
      row.original.has_pending_regularisation ? (
        <Badge variant="warning">Pending</Badge>
      ) : (
        <span className="text-xs text-muted-foreground">None raised</span>
      ),
  },
];

function ExceptionsReport() {
  const initial = currentMonthBounds();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [kind, setKind] = useState<AttendanceExceptionKind | typeof ALL_KINDS>(ALL_KINDS);

  const rangeOk = Boolean(from && to && from <= to);
  const { data, error, isLoading, reload } = useApiQuery<AttendanceExceptionReport>(
    rangeOk ? `/attendance/exceptions?from=${from}&to=${to}` : null,
  );

  const rows = useMemo(
    () =>
      (data?.exceptions ?? [])
        .filter((row) => kind === ALL_KINDS || row.kind === kind)
        .sort(
          (a, b) =>
            a.employee_name.localeCompare(b.employee_name) ||
            a.employee_code.localeCompare(b.employee_code) ||
            a.attendance_date.localeCompare(b.attendance_date),
        ),
    [data, kind],
  );
  // The report has exceptions, all of other kinds than the one chosen.
  const otherKindsOnly = rangeOk && rows.length === 0 && (data?.exceptions.length ?? 0) > 0;

  return (
    <DataTable
      title="Exceptions"
      description={
        data && rangeOk
          ? `${formatDateRange(data.period_start, data.period_end)} · ${data.employees_in_scope} ${data.employees_in_scope === 1 ? "employee" : "employees"} in scope · ${data.exceptions.length} ${data.exceptions.length === 1 ? "exception" : "exceptions"}`
          : "Days that need a look: absences, late arrivals, early exits, punches outside a geofence."
      }
      tier="tier1"
      columns={EXCEPTION_COLUMNS}
      // A new range never shows the previous range's rows while it loads.
      data={rangeOk && !isLoading ? rows : []}
      getRowId={(row) => `${row.employee_id}-${row.attendance_date}-${row.kind}`}
      noun="exceptions"
      exportName={`attendance-exceptions-${from}-${to}`}
      searchPlaceholder="Search employee or detail"
      isLoading={rangeOk && isLoading}
      loadingRows={5}
      {...loadErrorProps(rangeOk ? error : null, reload)}
      filtered={!rangeOk || otherKindsOnly}
      empty={
        rangeOk
          ? {
              icon: ClipboardCheck,
              title: "No exceptions in this range",
              description: `Nothing needs a look between ${formatDateRange(from, to)}${data ? ` across ${data.employees_in_scope} ${data.employees_in_scope === 1 ? "employee" : "employees"} in scope` : ""}.`,
            }
          : undefined
      }
      emptyMessage={
        otherKindsOnly
          ? "No exceptions in this range. None of this kind. Choose All kinds to see the rest."
          : undefined
      }
      filters={
        <>
          <div className="flex items-center gap-2">
            <Label htmlFor="exc-from">From</Label>
            <DatePicker
              id="exc-from"
              className="h-9 w-auto"
              value={from}
              onChange={setFrom}
              aria-invalid={!rangeOk}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="exc-to">To</Label>
            <DatePicker
              id="exc-to"
              className="h-9 w-auto"
              min={from}
              value={to}
              onChange={setTo}
              aria-invalid={!rangeOk}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="exc-kind">Kind</Label>
            <Select value={kind} onValueChange={(value) => setKind(value as typeof kind)}>
              <SelectTrigger id="exc-kind" className="h-9 w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_KINDS}>All kinds</SelectItem>
                {(Object.keys(EXCEPTION_LABELS) as AttendanceExceptionKind[]).map((option) => (
                  <SelectItem key={option} value={option}>
                    {EXCEPTION_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!rangeOk && (
            <p className="text-xs text-destructive">Choose a start date on or before the end date.</p>
          )}
        </>
      }
    />
  );
}
