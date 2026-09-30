"use client";

import { CalendarClock, Loader2, Plus } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  return (
    <>
      <DataPanel
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
        actions={
          <div className="flex items-center gap-2">
            {canSeeOthers && hasEmployee && (
              <Select value={scope} onValueChange={(value) => setScope(value as "mine" | "all")}>
                <SelectTrigger size="sm" className="w-44" aria-label="Whose claims">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mine">My claims</SelectItem>
                  <SelectItem value="all">Everyone I can see</SelectItem>
                </SelectContent>
              </Select>
            )}
            {hasEmployee && (
              <Button size="sm" disabled={!configured} onClick={() => setClaiming(true)}>
                <Plus /> Claim comp-off
              </Button>
            )}
          </div>
        }
        isLoading={claims.isLoading}
        error={claims.error?.detail}
        onRetry={claims.reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: CalendarClock,
          title: "No comp-off claims",
          description:
            scope === "mine"
              ? "Claims you make for working a holiday or a weekly off show up here."
              : "Nobody you can see has claimed comp-off.",
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              {scope === "all" && <TableHead className="pl-5">Employee</TableHead>}
              <TableHead className={scope === "all" ? undefined : "pl-5"}>Day worked</TableHead>
              <TableHead className="text-right">Days</TableHead>
              <TableHead className="hidden md:table-cell">Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Decision</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((claim) => (
              <TableRow key={claim.id}>
                {scope === "all" && (
                  <TableCell className="pl-5 font-medium text-foreground">
                    {claim.employee_name}
                  </TableCell>
                )}
                <TableCell className={scope === "all" ? "whitespace-nowrap" : "pl-5 whitespace-nowrap"}>
                  {formatDay(claim.worked_date, true)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{pluralDays(claim.days)}</TableCell>
                <TableCell className="hidden max-w-xs truncate text-muted-foreground md:table-cell">
                  {claim.reason}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS[claim.status].variant}>{STATUS[claim.status].label}</Badge>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
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
                </TableCell>
                <TableCell className="text-right">
                  {claim.can_cancel && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === claim.id}
                      onClick={() => void withdraw(claim)}
                    >
                      {busyId === claim.id && <Loader2 className="animate-spin" />}
                      Withdraw
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

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
