"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardList, UserX } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { KioskPinCard } from "./KioskPinCard";
import { MyShiftSwaps } from "./ShiftSwaps";
import {
  errorDetail,
  formatClock,
  RegularisationStatusBadge,
  STATUS_LABELS,
  StatusBadge,
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
  const { user, hasRole } = useAuth();
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
          description="Attendance is recorded against an employee. Ask your admin to link this login to your employee profile, then punches and attendance days will appear here."
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
      <MyShiftSwaps />
      <KioskPinCard />
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
        direct={hasRole("admin", "sub_admin")}
      />
    </div>
  );
}

// ── My requests ─────────────────────────────────────────────────────────────

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

/** "09:30 – 18:00" asked for, or null when the request names no times. */
function requestedTimes(row: Regularisation): string | null {
  return row.requested_first_in || row.requested_last_out
    ? `${formatClock(row.requested_first_in)} – ${formatClock(row.requested_last_out)}`
    : null;
}

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

  const columns: ColumnDef<Regularisation>[] = [
    {
      accessorKey: "attendance_date",
      header: "Date",
      meta: { cellClassName: "whitespace-nowrap", text: (row) => formatDay(row.attendance_date, true) },
      cell: ({ row }) => formatDay(row.original.attendance_date, true),
    },
    {
      accessorKey: "kind",
      header: "Type",
      meta: { text: (row) => KIND_LABELS[row.kind] },
      cell: ({ row }) => <Badge variant="outline">{KIND_LABELS[row.original.kind]}</Badge>,
    },
    {
      accessorKey: "requested_status",
      header: "Asks for",
      meta: { text: (row) => STATUS_LABELS[row.requested_status] },
      cell: ({ row }) => <StatusBadge status={row.original.requested_status} />,
    },
    {
      id: "times",
      header: "Times",
      accessorFn: (row) => requestedTimes(row),
      meta: { cellClassName: "tabular-nums" },
      cell: ({ row }) => requestedTimes(row.original) ?? "—",
    },
    {
      accessorKey: "reason",
      header: "Reason",
      meta: { cellClassName: "min-w-48 max-w-72 whitespace-normal" },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <RegularisationStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "decision_note",
      header: "Decision note",
      meta: { cellClassName: "max-w-64 whitespace-normal text-muted-foreground" },
      cell: ({ row }) => row.original.decision_note ?? "—",
    },
    {
      accessorKey: "created_at",
      header: "Raised",
      meta: {
        cellClassName: "whitespace-nowrap text-muted-foreground",
        text: (row) => (row.created_at ? formatDate(row.created_at) : null),
      },
      cell: ({ row }) => formatDate(row.original.created_at),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) =>
        row.original.status === "pending" && (
          <Button variant="outline" size="sm" onClick={() => setCancelling(row.original)}>
            Withdraw
          </Button>
        ),
    },
  ];

  return (
    <>
      <DataTable
        tier="tier1"
        title="My requests"
        description="Missed punches, corrections, on-duty and work-from-home — and what was decided."
        columns={columns}
        data={rows}
        noun="requests"
        exportName="my-attendance-requests"
        searchPlaceholder="Search requests"
        isLoading={isLoading && !data}
        loadingRows={3}
        {...loadErrorProps(error, reload)}
        empty={{
          icon: ClipboardList,
          title: "No requests yet",
          description:
            "Pick a day on the calendar above to report a missed punch, correct a day, or ask for on-duty or work-from-home. Your requests and their decisions appear here.",
        }}
      />

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
    </>
  );
}
