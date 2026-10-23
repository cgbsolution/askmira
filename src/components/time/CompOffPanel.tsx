"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClock, Loader2, Plus } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { CompOffClaim, CompOffStatus, LeaveSettings } from "@/lib/types";
import { formatDay, pluralDays, toISODate } from "@/lib/utils";

const STATUS: Record<CompOffStatus, { label: string; variant: "warning" | "success" | "destructive" | "muted" }> = {
  pending: { label: "Pending", variant: "warning" },
  approved: { label: "Credited", variant: "success" },
  rejected: { label: "Declined", variant: "destructive" },
  cancelled: { label: "Withdrawn", variant: "muted" },
};

/** The Decision column as text, for the search and the CSV. */
function decisionText(claim: CompOffClaim): string {
  if (claim.status === "pending") return `Waiting on ${claim.approver_name}`;
  if (claim.status === "approved") {
    return `By ${claim.decided_by_name ?? "—"}${claim.expires_on ? ` · lapses ${formatDay(claim.expires_on, true)}` : ""}`;
  }
  if (claim.status === "rejected") {
    return `By ${claim.decided_by_name ?? "—"}${claim.decision_note ? ` “${claim.decision_note}”` : ""}`;
  }
  return "";
}

/**
 * Comp-off: claim a day off for working a holiday or a weekly off.
 *
 * The server checks the date really was a day off *for you* — your state's
 * holidays, your shift's weekly offs — and routes the claim to your line
 * manager (HR when there is none). Approval credits the comp-off leave type,
 * which lapses after the tenant's expiry window if unused.
 */
export function CompOffPanel({
  hasEmployee,
  canSeeOthers,
  isHr,
  version,
  onChanged,
}: {
  hasEmployee: boolean;
  canSeeOthers: boolean;
  isHr: boolean;
  version: number;
  onChanged: () => void;
}) {
  const [scope, setScope] = useState<"mine" | "all">(hasEmployee ? "mine" : "all");
  const [claiming, setClaiming] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const settings = useApiQuery<LeaveSettings>("/leave/settings");
  const claims = useApiQuery<CompOffClaim[]>(
    `/leave/comp-off?mine=${scope === "mine" ? "true" : "false"}`,
  );
  const { reload } = claims;
  useEffect(() => {
    if (version > 0) reload();
  }, [version, reload]);

  const configured = Boolean(settings.data?.comp_off_leave_type_id);
  const rows = claims.data ?? [];

  const withdraw = async (claim: CompOffClaim) => {
    setBusyId(claim.id);
    try {
      await post(`/leave/comp-off/${claim.id}/cancel`);
      toast.success("Claim withdrawn");
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not withdraw the claim.");
    } finally {
      setBusyId(null);
    }
  };

  const columns: ColumnDef<CompOffClaim>[] = [
    ...(scope === "all"
      ? [{ accessorKey: "employee_name", header: "Employee", meta: { cellClassName: "font-medium text-foreground" } }]
      : []),
    {
      accessorKey: "worked_date",
      header: "Day worked",
      meta: { cellClassName: "whitespace-nowrap", text: (claim) => formatDay(claim.worked_date, true) },
      cell: ({ row }) => formatDay(row.original.worked_date, true),
    },
    {
      id: "days",
      header: "Days",
      accessorFn: (claim) => Number(claim.days),
      meta: { className: "text-right", cellClassName: "tabular-nums", text: (claim) => pluralDays(claim.days) },
      cell: ({ row }) => pluralDays(row.original.days),
    },
    {
      accessorKey: "reason",
      header: "Reason",
      meta: { className: "hidden md:table-cell", cellClassName: "max-w-xs truncate text-muted-foreground" },
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: { text: (claim) => STATUS[claim.status].label },
      cell: ({ row }) => (
        <Badge variant={STATUS[row.original.status].variant}>{STATUS[row.original.status].label}</Badge>
      ),
    },
    {
      id: "decision",
      header: "Decision",
      accessorFn: decisionText,
      meta: { className: "hidden lg:table-cell", cellClassName: "text-sm text-muted-foreground" },
      cell: ({ row }) => {
        const claim = row.original;
        return (
          <>
            {claim.status === "pending" && `Waiting on ${claim.approver_name}`}
            {claim.status === "approved" &&
              `By ${claim.decided_by_name ?? "—"}${claim.expires_on ? ` · lapses ${formatDay(claim.expires_on, true)}` : ""}`}
            {claim.status === "rejected" && (
              <>
                By {claim.decided_by_name ?? "—"}
                {claim.decision_note && (
                  <span className="block truncate text-xs italic">“{claim.decision_note}”</span>
                )}
              </>
            )}
          </>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "w-24 text-right", text: false },
      cell: ({ row }) =>
        row.original.can_cancel && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busyId === row.original.id}
            onClick={() => void withdraw(row.original)}
          >
            {busyId === row.original.id && <Loader2 className="animate-spin" />}
            Withdraw
          </Button>
        ),
    },
  ];

  return (
    <>
      <DataTable
        title="Comp-off"
        description={
          settings.data
            ? configured
              ? `Worked a holiday or a weekly off? Claim it. Approved days go to ${settings.data.comp_off_leave_type_name} and lapse ${settings.data.comp_off_expiry_days} days after they are credited.`
              : isHr
                ? "Not set up yet: mark one leave type as comp-off in Setup, and people can start claiming."
                : "Not set up yet. HR marks a leave type as comp-off before claims can be made."
            : undefined
        }
        columns={columns}
        data={rows}
        noun="claims"
        exportName="comp-off-claims"
        searchPlaceholder="Search claims"
        filters={
          canSeeOthers &&
          hasEmployee && (
            <Select value={scope} onValueChange={(value) => setScope(value as "mine" | "all")}>
              <SelectTrigger className="h-9 w-44" aria-label="Whose claims">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">My claims</SelectItem>
                <SelectItem value="all">Everyone I can see</SelectItem>
              </SelectContent>
            </Select>
          )
        }
        actions={
          hasEmployee && (
            <Button size="sm" className="h-9" disabled={!configured} onClick={() => setClaiming(true)}>
              <Plus /> Claim comp-off
            </Button>
          )
        }
        isLoading={claims.isLoading}
        error={claims.error?.detail}
        onRetry={claims.reload}
        empty={{
          icon: CalendarClock,
          title: "No comp-off claims",
          description:
            scope === "mine"
              ? "Claims you make for working a holiday or a weekly off show up here."
              : "Nobody you can see has claimed comp-off.",
        }}
      />

      <ClaimDialog
        open={claiming}
        expiryDays={settings.data?.comp_off_expiry_days ?? 60}
        onClose={() => setClaiming(false)}
        onSaved={() => {
          setClaiming(false);
          onChanged();
        }}
      />
    </>
  );
}

function ClaimDialog({
  open,
  expiryDays,
  onClose,
  onSaved,
}: {
  open: boolean;
  expiryDays: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = toISODate(new Date());
  const earliest = toISODate(new Date(Date.now() - expiryDays * 24 * 60 * 60 * 1000));
  const [worked, setWorked] = useState("");
  const [days, setDays] = useState<"1" | "0.5">("1");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setWorked("");
      setDays("1");
      setReason("");
    }
  }, [open]);

  const save = async () => {
    setIsSaving(true);
    try {
      const claim = await post<CompOffClaim>("/leave/comp-off", {
        worked_date: worked,
        days,
        reason: reason.trim(),
      });
      toast.success("Comp-off claimed", {
        description: `Sent to ${claim.approver_name}${claim.worked_day_label ? ` · ${claim.worked_day_label}` : ""}.`,
      });
      onSaved();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not submit the claim.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Claim comp-off</DialogTitle>
          <DialogDescription>
            For a holiday or weekly off you worked in the last {expiryDays} days.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <FormField htmlFor="comp-off-date" label="Day worked">
              <DatePicker
                id="comp-off-date"
                value={worked}
                min={earliest}
                max={today}
                onChange={setWorked}
              />
            </FormField>
            <FormField htmlFor="comp-off-days" label="Credit">
              <Select value={days} onValueChange={(value) => setDays(value as "1" | "0.5")}>
                <SelectTrigger id="comp-off-days" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">A full day</SelectItem>
                  <SelectItem value="0.5">Half a day</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField htmlFor="comp-off-reason" label="What you worked on">
            <Textarea
              id="comp-off-reason"
              rows={3}
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Production release over the weekend"
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!worked || reason.trim().length < 3 || isSaving}
            onClick={() => void save()}
          >
            {isSaving && <Loader2 className="animate-spin" />}
            Submit claim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
