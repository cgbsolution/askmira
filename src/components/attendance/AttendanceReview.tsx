"use client";

import { AlertTriangle, Check, ClipboardCheck, Inbox, Loader2, Lock, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PersonCell } from "@/components/common/PersonCell";
import { EmptyState } from "@/components/common/EmptyState";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { patch } from "@/lib/api";
import type {
  AttendanceExceptionKind,
  AttendanceExceptionReport,
  Regularisation,
  RegularisationQueueItem,
} from "@/lib/types/attendance";
import { formatDate, formatDateRange, formatDay } from "@/lib/utils";

import { KIND_LABELS } from "./AttendanceRequestDialog";
import {
  currentMonthBounds,
  errorDetail,
  EXCEPTION_LABELS,
  ExceptionKindBadge,
  formatClock,
  LoadError,
  StatusBadge,
  TableSkeleton,
} from "./shared";
import { TeamToday } from "./TeamToday";

/**
 * Attendance review for managers and HR (their reporting line, or everyone for HR).
 */
const TABS = ["today", "regularisations", "exceptions"];

export function AttendanceReview({ initialTab }: { initialTab?: string }) {
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  return (
    <Tabs defaultValue={initialTab && TABS.includes(initialTab) ? initialTab : "today"}>
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
        <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
      </TabsList>
      <TabsContent value="today" className="mt-4">
        <TeamToday />
      </TabsContent>
      <TabsContent value="regularisations" className="mt-4">
        <RegularisationQueue onCount={setPendingCount} />
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
                    <p className="flex items-start gap-1.5 text-xs text-mustard-900 dark:text-mustard-100">
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

  return (
    <Card tier="tier1" className="pb-0">
      <CardHeader>
        <CardTitle>Exceptions</CardTitle>
        <CardDescription>
          {data && rangeOk
            ? `${formatDateRange(data.period_start, data.period_end)} · ${data.employees_in_scope} ${data.employees_in_scope === 1 ? "employee" : "employees"} in scope · ${data.exceptions.length} ${data.exceptions.length === 1 ? "exception" : "exceptions"}`
            : "Days that need a look: absences, late arrivals, early exits, punches outside a geofence."}
        </CardDescription>
        <CardAction>
          <ClipboardCheck className="size-5 text-muted-foreground" />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="exc-from">From</Label>
          <Input
            id="exc-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            aria-invalid={!rangeOk}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="exc-to">To</Label>
          <Input
            id="exc-to"
            type="date"
            min={from}
            value={to}
            onChange={(event) => setTo(event.target.value)}
            aria-invalid={!rangeOk}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="exc-kind">Kind</Label>
          <Select value={kind} onValueChange={(value) => setKind(value as typeof kind)}>
            <SelectTrigger id="exc-kind" className="w-52">
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
          <p className="pb-2 text-xs text-destructive">Choose a start date on or before the end date.</p>
        )}
      </CardContent>

      <div className="mt-5">
        {!rangeOk ? null : isLoading ? (
          <div className="pb-5">
            <TableSkeleton rows={5} />
          </div>
        ) : error ? (
          <LoadError error={error} onRetry={reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="No exceptions in this range"
            description={
              data && data.exceptions.length > 0
                ? "None of this kind. Choose All kinds to see the rest."
                : `Nothing needs a look between ${formatDateRange(from, to)}${data ? ` across ${data.employees_in_scope} ${data.employees_in_scope === 1 ? "employee" : "employees"} in scope` : ""}.`
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead className="pr-5">Regularisation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                const previous = rows[index - 1];
                const sameEmployee = previous?.employee_id === row.employee_id;
                return (
                  <TableRow key={`${row.employee_id}-${row.attendance_date}-${row.kind}`}>
                    <TableCell className="pl-5">
                      {!sameEmployee && (
                        <PersonCell size="sm" name={row.employee_name} subtitle={row.employee_code} />
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDay(row.attendance_date, true)}</TableCell>
                    <TableCell>
                      <ExceptionKindBadge kind={row.kind} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="max-w-80 whitespace-normal text-muted-foreground">
                      {row.detail}
                    </TableCell>
                    <TableCell className="pr-5">
                      {row.has_pending_regularisation ? (
                        <Badge variant="warning">Pending</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">None raised</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </Card>
  );
}
