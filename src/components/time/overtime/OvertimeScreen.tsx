"use client";

import { CalendarClock, Check, Loader2, RefreshCw, X } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { PersonCell } from "@/components/common/PersonCell";
import { apiMessage } from "@/components/payroll/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { HR, MANAGERS } from "@/lib/access";
import { post } from "@/lib/api";
import type { OvertimeEntry, OvertimeStatus, OvertimeSyncResult } from "@/lib/types/payroll-inputs";
import { formatDate } from "@/lib/utils";

import { OvertimePolicyPanel } from "./OvertimePolicyPanel";

export const OT_STATUS: Record<
  OvertimeStatus,
  { label: string; variant: "warning" | "accent" | "success" | "destructive" }
> = {
  pending: { label: "Awaiting approval", variant: "warning" },
  approved: { label: "Approved", variant: "accent" },
  paid: { label: "Paid", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export function minutesLabel(minutes: number | null): string {
  if (minutes === null) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function monthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Overtime: your own, your team's to decide, and the policy that prices it. */
export function OvertimeScreen() {
  const { hasRole } = useAuth();
  const reviews = hasRole(...MANAGERS);
  const isHr = hasRole(...HR);
  return (
    <Tabs defaultValue={reviews ? "review" : "mine"}>
      <TabsList>
        {reviews && <TabsTrigger value="review">Review</TabsTrigger>}
        <TabsTrigger value="mine">My overtime</TabsTrigger>
        {isHr && <TabsTrigger value="policy">Policy</TabsTrigger>}
      </TabsList>
      {reviews && (
        <TabsContent value="review" className="mt-4">
          <ReviewPanel isHr={isHr} />
        </TabsContent>
      )}
      <TabsContent value="mine" className="mt-4">
        <MinePanel />
      </TabsContent>
      {isHr && (
        <TabsContent value="policy" className="mt-4">
          <OvertimePolicyPanel />
        </TabsContent>
      )}
    </Tabs>
  );
}

function EntriesTable({
  rows,
  showEmployee,
  selected,
  onToggle,
}: {
  rows: OvertimeEntry[];
  showEmployee: boolean;
  selected?: Set<string>;
  onToggle?: (id: string, checked: boolean) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {onToggle && <TableHead className="w-10" />}
          {showEmployee && <TableHead>Employee</TableHead>}
          <TableHead>Day</TableHead>
          <TableHead className="text-right">Recorded</TableHead>
          <TableHead className="text-right">Counted</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            {onToggle && (
              <TableCell>
                {row.caller_may_decide && (
                  <Checkbox
                    aria-label={`Select overtime on ${row.attendance_date}`}
                    checked={selected?.has(row.id) ?? false}
                    onCheckedChange={(checked) => onToggle(row.id, checked === true)}
                  />
                )}
              </TableCell>
            )}
            {showEmployee && (
              <TableCell>
                <PersonCell
                  name={row.employee_name ?? "Unknown"}
                  subtitle={row.employee_code}
                  size="sm"
                />
              </TableCell>
            )}
            <TableCell className="whitespace-nowrap">
              {row.kind === "weekly" ? `Week ending ${formatDate(row.attendance_date)}` : formatDate(row.attendance_date)}
              {row.kind === "weekly" && (
                <span className="block text-xs text-muted-foreground">Past the weekly limit</span>
              )}
              {row.is_rest_day && (
                <span className="block text-xs text-muted-foreground">Rest day</span>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {minutesLabel(row.recorded_minutes)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {minutesLabel(row.approved_minutes ?? row.eligible_minutes)}
            </TableCell>
            <TableCell className="text-right">
              {row.amount ? <Money value={row.amount} /> : "—"}
              {row.basis && (
                <span className="block max-w-72 text-xs text-muted-foreground">{row.basis}</span>
              )}
            </TableCell>
            <TableCell>
              <Badge variant={OT_STATUS[row.status].variant}>{OT_STATUS[row.status].label}</Badge>
              {row.decision_note && (
                <span className="block max-w-56 text-xs text-muted-foreground italic">
                  “{row.decision_note}”
                </span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ReviewPanel({ isHr }: { isHr: boolean }) {
  const [status, setStatus] = useState<OvertimeStatus | "any">("pending");
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(today());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const params = new URLSearchParams({ start, end });
  if (status !== "any") params.set("status", status);
  const query = useApiQuery<OvertimeEntry[]>(`/attendance/overtime?${params}`);
  const rows = useMemo(() => query.data ?? [], [query.data]);
  const decidable = rows.filter((row) => row.caller_may_decide);

  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const decide = async (approve: boolean) => {
    if (!selected.size) return;
    if (!approve && note.trim().length < 3) {
      toast.error("Say why this overtime is rejected.");
      return;
    }
    setBusy(approve ? "approve" : "reject");
    try {
      await post("/attendance/overtime/decide", {
        entry_ids: [...selected],
        approve,
        note: note.trim() || null,
      });
      toast.success(`${selected.size} entr${selected.size === 1 ? "y" : "ies"} ${approve ? "approved" : "rejected"}.`);
      setSelected(new Set());
      setNote("");
      query.reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "That did not work."));
    } finally {
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy("sync");
    try {
      const result = await post<OvertimeSyncResult>("/attendance/overtime/sync", { start, end });
      toast.success(
        `Synced: ${result.created} new, ${result.updated} updated, ${result.removed} removed` +
          (result.auto_approved ? `, ${result.auto_approved} approved by policy` : "") +
          ".",
      );
      if (result.without_policy.length) {
        toast.warning(
          `${result.without_policy.length} day(s) have overtime but no policy covers them — set one under Policy.`,
        );
      }
      query.reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not sync overtime."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <DataPanel
      title="Overtime to review"
      description="Minutes beyond the shift from attendance, counted by the location's policy. Approving prices them from the salary in force on the day; the next payroll run pays them."
      actions={
        isHr && (
          <Button variant="outline" disabled={busy !== null} onClick={() => void sync()}>
            {busy === "sync" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Sync from attendance
          </Button>
        )
      }
      toolbar={
        <>
          <Select value={status} onValueChange={(v) => setStatus(v as OvertimeStatus | "any")}>
            <SelectTrigger size="sm" className="w-44" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any status</SelectItem>
              {(Object.keys(OT_STATUS) as OvertimeStatus[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {OT_STATUS[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            aria-label="From"
            className="h-8 w-40"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
          <Input
            type="date"
            aria-label="To"
            className="h-8 w-40"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
          {decidable.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setSelected(
                  selected.size === decidable.length
                    ? new Set()
                    : new Set(decidable.map((row) => row.id)),
                )
              }
            >
              {selected.size === decidable.length ? "Clear selection" : "Select all"}
            </Button>
          )}
        </>
      }
      footer={
        selected.size > 0 && (
          <div className="flex flex-wrap items-end gap-3">
            <FormField htmlFor="ot-note" label="Note" className="min-w-64 flex-1">
              <Textarea
                id="ot-note"
                rows={1}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Required to reject"
              />
            </FormField>
            <Button variant="outline" disabled={busy !== null} onClick={() => void decide(false)}>
              {busy === "reject" ? <Loader2 className="animate-spin" /> : <X />}
              Reject {selected.size}
            </Button>
            <Button disabled={busy !== null} onClick={() => void decide(true)}>
              {busy === "approve" ? <Loader2 className="animate-spin" /> : <Check />}
              Approve {selected.size}
            </Button>
          </div>
        )
      }
      isLoading={query.isLoading}
      error={query.error?.detail}
      onRetry={query.reload}
      isEmpty={rows.length === 0}
      empty={{
        icon: CalendarClock,
        title: "No overtime in this range",
        description: isHr
          ? "Sync from attendance to bring in the days with overtime."
          : "Overtime your team works appears here once HR syncs attendance.",
      }}
    >
      <EntriesTable rows={rows} showEmployee selected={selected} onToggle={toggle} />
    </DataPanel>
  );
}

function MinePanel() {
  const query = useApiQuery<OvertimeEntry[]>("/attendance/overtime/mine");
  const rows = query.data ?? [];
  return (
    <DataPanel
      title="My overtime"
      description="Overtime from your attendance, as your manager or HR decided it, and the run that paid it."
      isLoading={query.isLoading}
      error={query.error?.detail}
      onRetry={query.reload}
      isEmpty={rows.length === 0}
      empty={{ icon: CalendarClock, title: "No overtime recorded" }}
    >
      <EntriesTable rows={rows} showEmployee={false} />
    </DataPanel>
  );
}
