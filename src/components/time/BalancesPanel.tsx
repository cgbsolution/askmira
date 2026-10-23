"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { History, Loader2, SlidersHorizontal } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { EmployeePicker, employeeDisplayName } from "@/components/common/EmployeePicker";
import { FormField } from "@/components/common/FormField";
import { BalanceCards } from "@/components/time/BalanceCards";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import type {
  BalanceAdjustment,
  BalanceHistory,
  BalanceHistoryEntry,
  EmployeeSummary,
  LeaveBalance,
  LeaveType,
  ManualAdjustmentKind,
} from "@/lib/types";
import { formatDay, formatDays } from "@/lib/utils";

const KIND_LABEL: Record<ManualAdjustmentKind, string> = {
  opening: "Set the opening balance",
  credit: "Credit days",
  debit: "Debit days",
};

/** "+1.5" for a credit, "-1" for a debit: as the history shows it. */
function signedDays(entry: BalanceHistoryEntry): string {
  return `${entry.days.startsWith("-") ? "" : "+"}${formatDays(entry.days)}`;
}

// Day counts arrive as decimal strings ("1.50"): they sort by value and export as shown.
const HISTORY_COLUMNS: ColumnDef<BalanceHistoryEntry>[] = [
  {
    accessorKey: "on",
    header: "Date",
    meta: { cellClassName: "whitespace-nowrap tabular-nums", text: (entry) => formatDay(entry.on, true) },
    cell: ({ row }) => formatDay(row.original.on, true),
  },
  { accessorKey: "label", header: "Movement", meta: { cellClassName: "text-foreground" } },
  {
    accessorKey: "note",
    header: "Detail",
    meta: { className: "hidden md:table-cell", cellClassName: "max-w-xs truncate text-muted-foreground" },
    cell: ({ row }) => row.original.note ?? "—",
  },
  {
    id: "days",
    header: "Days",
    accessorFn: (entry) => Number(entry.days),
    meta: { className: "text-right font-mono", text: signedDays },
    cell: ({ row }) => (
      <span className={row.original.days.startsWith("-") ? "text-destructive" : "text-foreground"}>
        {signedDays(row.original)}
      </span>
    ),
  },
  {
    id: "running_balance",
    header: "Balance",
    accessorFn: (entry) => Number(entry.running_balance),
    meta: {
      className: "text-right font-mono",
      cellClassName: "text-foreground",
      text: (entry) => formatDays(entry.running_balance),
    },
    cell: ({ row }) => formatDays(row.original.running_balance),
  },
];

/**
 * Balances in depth: any year, the history behind each figure, and — for HR —
 * anybody's balance and the manual adjustments a migration or a correction needs.
 *
 * The history's last running total is the card's `available`, from the same
 * API; if the two ever differ, that is a bug to report, not a rounding.
 *
 * With `fixed`, one person's balances and no picker: their profile, or a row
 * opened from the team table. The API decides whether the caller may look.
 */
export function BalancesPanel({
  isHr,
  ownEmployeeId,
  version,
  onChanged,
  fixed = null,
}: {
  isHr: boolean;
  ownEmployeeId: string | null;
  version: number;
  onChanged: () => void;
  fixed?: { id: string; name: string } | null;
}) {
  const thisYear = new Date().getFullYear();
  const [picked, setPerson] = useState<EmployeeSummary | null>(null);
  const [year, setYear] = useState(thisYear);
  const [historyTypeId, setHistoryTypeId] = useState<string>("");
  const [adjusting, setAdjusting] = useState(false);

  const person = fixed ?? (picked ? { id: picked.id, name: employeeDisplayName(picked) } : null);
  const employeeId = person?.id ?? ownEmployeeId;
  const viewingSelf = !person || person.id === ownEmployeeId;
  const params = new URLSearchParams({ year: String(year) });
  if (person) params.set("employee_id", person.id);

  const balances = useApiQuery<LeaveBalance[]>(
    employeeId ? `/leave/balances?${params}` : null,
  );
  const rows = useMemo(() => balances.data ?? [], [balances.data]);

  useEffect(() => {
    if (rows.length && !rows.some((row) => row.leave_type_id === historyTypeId)) {
      setHistoryTypeId(rows[0].leave_type_id);
    }
  }, [rows, historyTypeId]);

  const historyParams = new URLSearchParams({ year: String(year), leave_type_id: historyTypeId });
  if (person) historyParams.set("employee_id", person.id);
  const history = useApiQuery<BalanceHistory>(
    employeeId && historyTypeId ? `/leave/balances/history?${historyParams}` : null,
  );

  // Something changed elsewhere on the page (a request approved, a claim credited).
  const { reload: reloadBalances } = balances;
  const { reload: reloadHistory } = history;
  useEffect(() => {
    if (version === 0) return;
    reloadBalances();
    reloadHistory();
  }, [version, reloadBalances, reloadHistory]);

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card tier="tier1" className="gap-0 py-0">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          {isHr && !fixed && (
            <div className="grid min-w-72 flex-1 gap-1.5">
              <FormField htmlFor="balance-person" label="Employee" hint={picked ? undefined : "Showing your own balances. Search to see someone else's."}>
                <EmployeePicker
                  id="balance-person"
                  value={picked}
                  onChange={setPerson}
                  excludeId={null}
                />
              </FormField>
            </div>
          )}
          <FormField htmlFor="balance-year" label="Leave year">
            <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
              <SelectTrigger id="balance-year" size="sm" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[thisYear - 1, thisYear, thisYear + 1].map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {isHr && employeeId && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={viewingSelf && Boolean(ownEmployeeId)}
              title={viewingSelf ? "Nobody adjusts their own balance." : undefined}
              onClick={() => setAdjusting(true)}
            >
              <SlidersHorizontal /> Adjust balance
            </Button>
          )}
        </CardContent>
      </Card>

      {!employeeId ? (
        <Card tier="tier1">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Search for an employee to see their balances.
          </CardContent>
        </Card>
      ) : (
        <BalanceCards
          balances={rows}
          isLoading={balances.isLoading}
          emptyTitle={`No balances for ${year}`}
          emptyDescription="A balance appears once a policy covers this person or HR posts one."
        />
      )}

      {employeeId && rows.length > 0 && (
        <DataTable
          title={
            <span className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" /> Balance history
            </span>
          }
          description="Every credit and debit behind the figure, in date order."
          columns={HISTORY_COLUMNS}
          data={history.data?.entries ?? []}
          getRowId={(entry, index) => `${entry.on}-${entry.kind}-${index}`}
          noun="entries"
          exportName={`balance-history-${year}`}
          searchPlaceholder="Search movements"
          filters={
            <Select value={historyTypeId} onValueChange={setHistoryTypeId}>
              <SelectTrigger className="h-9 w-48" aria-label="Leave type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rows.map((row) => (
                  <SelectItem key={row.leave_type_id} value={row.leave_type_id}>
                    {row.leave_type_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
          isLoading={history.isLoading}
          error={history.error?.detail}
          onRetry={history.reload}
          empty={{
            icon: History,
            title: "Nothing recorded yet",
            description: `No accruals, leave or adjustments on this balance in ${year}.`,
          }}
        />
      )}

      {isHr && employeeId && (
        <AdjustDialog
          open={adjusting}
          employeeId={employeeId}
          employeeName={person ? person.name : "you"}
          year={year}
          onClose={() => setAdjusting(false)}
          onSaved={() => {
            setAdjusting(false);
            balances.reload();
            history.reload();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function AdjustDialog({
  open,
  employeeId,
  employeeName,
  year,
  onClose,
  onSaved,
}: {
  open: boolean;
  employeeId: string;
  employeeName: string;
  year: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const types = useApiQuery<LeaveType[]>(open ? "/leave/types" : null);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [kind, setKind] = useState<ManualAdjustmentKind>("credit");
  const [days, setDays] = useState("");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLeaveTypeId("");
      setKind("credit");
      setDays("");
      setReason("");
    }
  }, [open]);

  const validDays = /^\d{1,3}(\.\d{1,2})?$/.test(days) && (kind === "opening" || Number(days) > 0);
  const valid = leaveTypeId && validDays && reason.trim().length >= 3;

  const save = async () => {
    setIsSaving(true);
    try {
      await post<BalanceAdjustment>("/leave/balances/adjustments", {
        employee_id: employeeId,
        leave_type_id: leaveTypeId,
        year,
        kind,
        // Sent as a string; the API parses it as Decimal.
        days,
        reason: reason.trim(),
      });
      toast.success(`${KIND_LABEL[kind]}: done for ${employeeName}`);
      onSaved();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not adjust the balance.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust {employeeName}&apos;s balance</DialogTitle>
          <DialogDescription>
            For the {year} leave year. Recorded in the balance history with your reason, and
            audited.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="adjust-type" label="Leave type">
            <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
              <SelectTrigger id="adjust-type" className="w-full">
                <SelectValue placeholder="Choose a leave type" />
              </SelectTrigger>
              <SelectContent>
                {(types.data ?? []).map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <FormField htmlFor="adjust-kind" label="Adjustment">
              <Select value={kind} onValueChange={(value) => setKind(value as ManualAdjustmentKind)}>
                <SelectTrigger id="adjust-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="adjust-days" label={kind === "opening" ? "Opening" : "Days"}>
              <Input
                id="adjust-days"
                inputMode="decimal"
                className="font-mono"
                value={days}
                placeholder={kind === "opening" ? "12" : "1.5"}
                onChange={(event) => setDays(event.target.value)}
              />
            </FormField>
          </div>
          <FormField
            htmlFor="adjust-reason"
            label="Reason"
            hint="The employee sees this in their balance history."
          >
            <Textarea
              id="adjust-reason"
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Balance carried over from the previous HR system"
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || isSaving} onClick={() => void save()}>
            {isSaving && <Loader2 className="animate-spin" />}
            Save adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
