"use client";

import { ClipboardList, UserX } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { type ApiError, post } from "@/lib/api";
import type {
  AttendanceDay,
  Regularisation,
  RegularisationKind,
} from "@/lib/types/attendance";
import { formatDate, formatDay, toISODate } from "@/lib/utils";

import { AttendanceCalendar } from "./AttendanceCalendar";
import { AttendanceRequestDialog, KIND_LABELS } from "./AttendanceRequestDialog";
import { PunchCard } from "./PunchCard";
import {
  errorDetail,
  formatClock,
  LoadError,
  RegularisationStatusBadge,
  StatusBadge,
  TableSkeleton,
} from "./shared";

interface RequestTarget {
  kind: RegularisationKind;
  date: string;
  day: AttendanceDay | null;
  isLocked: boolean;
  today: string;
}

/**
 * The signed-in person's own attendance: punch, see the month, fix a day,
 * ask for on-duty or work-from-home.
 *
 * Tier 1 throughout — every day here becomes payable days or loss of pay.
 */
export function MyAttendance() {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  const [target, setTarget] = useState<RequestTarget | null>(null);
  const refresh = useCallback(() => setVersion((current) => current + 1), []);
  const regularisations = useApiQuery<Regularisation[]>(
    user?.employee_id ? "/attendance/regularisations" : null,
  );
  const reloadRequests = regularisations.reload;
  const changed = useCallback(() => {
    refresh();
    reloadRequests();
  }, [refresh, reloadRequests]);

  if (!user?.employee_id) {
    return (
      <Card tier="tier1">
        <EmptyState
          icon={UserX}
          title="Your login isn't linked to an employee record"
          description="Attendance is recorded against an employee. Ask your HR admin to link this login to your employee profile, then punches and attendance days will appear here."
        />
      </Card>
    );
  }

  const today = toISODate(new Date());
  return (
    <div className="flex flex-col gap-6">
      <PunchCard onPunched={refresh} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            setTarget({ kind: "missed_punch", date: today, day: null, isLocked: false, today })
          }
        >
          Missed punch
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            setTarget({ kind: "on_duty", date: today, day: null, isLocked: false, today })
          }
        >
          On duty
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            setTarget({ kind: "work_from_home", date: today, day: null, isLocked: false, today })
          }
        >
          Work from home
        </Button>
      </div>
      <AttendanceCalendar
        version={version}
        regularisations={regularisations.data ?? []}
        onRequest={(kind, date, day, isLocked, serverToday) =>
          setTarget({ kind, date, day, isLocked, today: serverToday })
        }
      />
      <MyRegularisations
        rows={regularisations.data}
        error={regularisations.error}
        isLoading={regularisations.isLoading}
        reload={regularisations.reload}
        onChanged={changed}
      />
      <AttendanceRequestDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        initialKind={target?.kind ?? "missed_punch"}
        initialDate={target?.date ?? today}
        day={target?.day ?? null}
        today={target?.today ?? today}
        isLocked={target?.isLocked ?? false}
        onCreated={changed}
      />
    </div>
  );
}

// ── My requests ─────────────────────────────────────────────────────────────

function MyRegularisations({
  rows: data,
  error,
  isLoading,
  reload,
  onChanged,
}: {
  rows: Regularisation[] | null;
  error: ApiError | null;
  isLoading: boolean;
  reload: () => void;
  onChanged: () => void;
}) {
  const [cancelling, setCancelling] = useState<Regularisation | null>(null);

  const rows = useMemo(
    () =>
      [...(data ?? [])].sort(
        (a, b) =>
          (b.created_at ?? "").localeCompare(a.created_at ?? "") ||
          b.attendance_date.localeCompare(a.attendance_date),
      ),
    [data],
  );

  const cancel = async () => {
    if (!cancelling) return;
    try {
      await post<Regularisation>(`/attendance/regularisations/${cancelling.id}/cancel`);
      toast.success(`Withdrew the request for ${formatDay(cancelling.attendance_date, true)}`);
      onChanged();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not withdraw the request."));
      throw caught;
    }
  };

  return (
    <Card tier="tier1" className="pb-0">
      <CardHeader>
        <CardTitle>My requests</CardTitle>
        <CardDescription>
          Missed punches, corrections, on-duty and work-from-home — and what was decided.
        </CardDescription>
      </CardHeader>

      {isLoading && !data ? (
        <div className="pb-5">
          <TableSkeleton rows={3} />
        </div>
      ) : error ? (
        <LoadError error={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No requests yet"
          description="Pick a day on the calendar above to report a missed punch, correct a day, or ask for on-duty or work-from-home. Your requests and their decisions appear here."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Asks for</TableHead>
              <TableHead>Times</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Decision note</TableHead>
              <TableHead>Raised</TableHead>
              <TableHead className="pr-6 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="pl-6 whitespace-nowrap">
                  {formatDay(row.attendance_date, true)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{KIND_LABELS[row.kind]}</Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.requested_status} />
                </TableCell>
                <TableCell className="tabular-nums">
                  {row.requested_first_in || row.requested_last_out
                    ? `${formatClock(row.requested_first_in)} – ${formatClock(row.requested_last_out)}`
                    : "—"}
                </TableCell>
                <TableCell className="max-w-64 whitespace-normal">{row.reason}</TableCell>
                <TableCell>
                  <RegularisationStatusBadge status={row.status} />
                </TableCell>
                <TableCell className="max-w-64 whitespace-normal text-muted-foreground">
                  {row.decision_note ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(row.created_at)}
                </TableCell>
                <TableCell className="pr-6 text-right">
                  {row.status === "pending" && (
                    <Button variant="outline" size="sm" onClick={() => setCancelling(row)}>
                      Withdraw
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title="Withdraw this request?"
        description={
          cancelling
            ? `Your ${KIND_LABELS[cancelling.kind].toLowerCase()} request for ${formatDay(cancelling.attendance_date, true)} will be withdrawn. The day stays as it was recorded.`
            : undefined
        }
        confirmLabel="Withdraw request"
        cancelLabel="Keep it"
        destructive
        onConfirm={cancel}
      />
    </Card>
  );
}
