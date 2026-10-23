"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeftRight, Check, Loader2, X } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { EmployeePicker, type PickedEmployee } from "@/components/people/EmployeePicker";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { ShiftSwap, ShiftSwapStatus, SwapShift } from "@/lib/types/attendance";
import { formatDay, toISODate } from "@/lib/utils";

import { errorDetail, shortTime } from "./shared";

const STATUS: Record<ShiftSwapStatus, { label: string; variant: "outline" | "warning" | "success" | "muted" | "secondary" }> = {
  awaiting_partner: { label: "Waiting for colleague", variant: "outline" },
  awaiting_approval: { label: "Waiting for approval", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  declined: { label: "Declined", variant: "muted" },
  rejected: { label: "Rejected", variant: "muted" },
  cancelled: { label: "Withdrawn", variant: "muted" },
};

function shiftText(shift: SwapShift): string {
  return shift.start_time && shift.end_time
    ? `${shift.name} (${shortTime(shift.start_time)}–${shortTime(shift.end_time)})`
    : shift.name;
}

const DAY_COLUMN: ColumnDef<ShiftSwap> = {
  accessorKey: "swap_date",
  header: "Day",
  meta: { cellClassName: "whitespace-nowrap", text: (swap) => formatDay(swap.swap_date, true) },
  cell: ({ row }) => formatDay(row.original.swap_date, true),
};

/**
 * Trading a shift with a colleague for one day. The colleague agrees, then
 * your manager or HR approves; until then your schedule does not change.
 */
export function MyShiftSwaps() {
  const { user } = useAuth();
  const { data, error, isLoading, reload } = useApiQuery<ShiftSwap[]>("/attendance/shift-swaps");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const rows = data ?? [];

  const act = async (swap: ShiftSwap, path: string, body: object | undefined, done: string) => {
    setBusy(swap.id);
    try {
      await post(`/attendance/shift-swaps/${swap.id}/${path}`, body);
      toast.success(done);
      reload();
    } catch (caught) {
      toast.error(errorDetail(caught, "That did not go through."));
    } finally {
      setBusy(null);
    }
  };

  const isMine = (swap: ShiftSwap) => swap.requester_employee_id === user?.employee_id;
  const who = (swap: ShiftSwap) =>
    isMine(swap) ? `You and ${swap.partner_name}` : `${swap.requester_name} and you`;
  const trade = (swap: ShiftSwap) =>
    isMine(swap)
      ? `You work ${shiftText(swap.partner_shift)}; they work ${shiftText(swap.requester_shift)}`
      : `You work ${shiftText(swap.requester_shift)}; they work ${shiftText(swap.partner_shift)}`;

  const columns: ColumnDef<ShiftSwap>[] = [
    DAY_COLUMN,
    {
      id: "swap",
      header: "Swap",
      accessorFn: who,
      meta: {
        text: (swap) =>
          [who(swap), trade(swap), `“${swap.reason}”`, swap.note ? `Note: ${swap.note}` : null]
            .filter(Boolean)
            .join(" · "),
      },
      cell: ({ row: { original: swap } }) => (
        <>
          <p className="text-sm">{who(swap)}</p>
          <p className="text-xs text-muted-foreground">{trade(swap)}</p>
          <p className="text-xs text-muted-foreground">“{swap.reason}”</p>
          {swap.note && <p className="text-xs text-muted-foreground">Note: {swap.note}</p>}
        </>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (swap) => STATUS[swap.status].label,
      cell: ({ row }) => (
        <Badge variant={STATUS[row.original.status].variant}>{STATUS[row.original.status].label}</Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row: { original: swap } }) => {
        const mine = isMine(swap);
        return (
          <div className="flex justify-end gap-2">
            {!mine && swap.status === "awaiting_partner" && (
              <>
                <Button size="sm" disabled={busy === swap.id} onClick={() => void act(swap, "respond", { accept: true }, "You agreed to the swap.")}>
                  <Check /> Agree
                </Button>
                <Button size="sm" variant="outline" disabled={busy === swap.id} onClick={() => void act(swap, "respond", { accept: false }, "You declined the swap.")}>
                  <X /> Decline
                </Button>
              </>
            )}
            {mine && (swap.status === "awaiting_partner" || swap.status === "awaiting_approval") && (
              <Button size="sm" variant="ghost" disabled={busy === swap.id} onClick={() => void act(swap, "cancel", undefined, "Swap withdrawn.")}>
                Withdraw
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        tier="tier1"
        title="Shift swaps"
        description="Trade your shift with a colleague for a day. They agree, then your manager approves."
        actions={
          <Button size="sm" variant="outline" className="h-9" onClick={() => setAsking(true)}>
            <ArrowLeftRight /> Ask for a swap
          </Button>
        }
        columns={columns}
        data={rows}
        noun="swaps"
        exportName="shift-swaps"
        searchPlaceholder="Search swaps"
        isLoading={isLoading && !data}
        error={error?.detail ?? null}
        onRetry={reload}
        empty={{ icon: ArrowLeftRight, title: "No swaps", description: "Swaps you ask for or are asked into appear here." }}
      />
      {asking && (
        <AskSwapDialog
          excludeId={user?.employee_id ?? null}
          onClose={() => setAsking(false)}
          onAsked={() => {
            setAsking(false);
            reload();
          }}
        />
      )}
    </>
  );
}

function AskSwapDialog({
  excludeId,
  onClose,
  onAsked,
}: {
  excludeId: string | null;
  onClose: () => void;
  onAsked: () => void;
}) {
  const tomorrow = toISODate(new Date(Date.now() + 86_400_000));
  const [partner, setPartner] = useState<PickedEmployee | null>(null);
  const [day, setDay] = useState(tomorrow);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    if (!partner) return;
    setBusy(true);
    try {
      await post("/attendance/shift-swaps", { partner_employee_id: partner.id, swap_date: day, reason: reason.trim() });
      toast.success(`Asked ${partner.label.split(" (")[0]}.`);
      onAsked();
    } catch (caught) {
      toast.error(errorDetail(caught, "The swap could not be asked."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ask for a shift swap</DialogTitle>
          <DialogDescription>
            You take their shift that day and they take yours. Both of you need a shift that day,
            and they must be different.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="swap-partner" label="Colleague">
            <EmployeePicker id="swap-partner" value={partner} onChange={setPartner} excludeId={excludeId} placeholder="Choose a colleague" />
          </FormField>
          <FormField htmlFor="swap-day" label="Day">
            <Input id="swap-day" type="date" min={tomorrow} value={day} onChange={(e) => setDay(e.target.value)} />
          </FormField>
          <FormField htmlFor="swap-reason" label="Why">
            <Textarea id="swap-reason" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !partner || !day || reason.trim().length < 3} onClick={() => void ask()}>
            {busy && <Loader2 className="animate-spin" />} Ask
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Agreed swaps waiting for a manager or HR. */
export function SwapQueue() {
  const { data, error, isLoading, reload } = useApiQuery<ShiftSwap[]>("/attendance/shift-swaps/pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const rows = data ?? [];

  const decide = async (swap: ShiftSwap, approve: boolean) => {
    setBusy(swap.id);
    try {
      await post(`/attendance/shift-swaps/${swap.id}/decide`, { approve, note: notes[swap.id]?.trim() || null });
      toast.success(approve ? "Swap approved; both schedules now show it." : "Swap rejected.");
      reload();
    } catch (caught) {
      toast.error(errorDetail(caught, "The decision could not be saved."));
    } finally {
      setBusy(null);
    }
  };

  const pair = (swap: ShiftSwap) => `${swap.requester_name} ⇄ ${swap.partner_name}`;
  const trade = (swap: ShiftSwap) =>
    `${swap.requester_name} to ${shiftText(swap.partner_shift)}; ${swap.partner_name} to ${shiftText(swap.requester_shift)}`;

  const columns: ColumnDef<ShiftSwap>[] = [
    DAY_COLUMN,
    {
      id: "who",
      header: "Who",
      accessorFn: pair,
      meta: { text: (swap) => `${pair(swap)} · ${trade(swap)} · “${swap.reason}”` },
      cell: ({ row: { original: swap } }) => (
        <>
          <p className="text-sm">{pair(swap)}</p>
          <p className="text-xs text-muted-foreground">{trade(swap)}</p>
          <p className="text-xs text-muted-foreground">“{swap.reason}”</p>
        </>
      ),
    },
    {
      id: "note",
      header: "Note",
      meta: { cellClassName: "min-w-48", text: false },
      cell: ({ row: { original: swap } }) => (
        <Input
          aria-label="Note"
          placeholder="Optional"
          value={notes[swap.id] ?? ""}
          onChange={(e) => setNotes((current) => ({ ...current, [swap.id]: e.target.value }))}
        />
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row: { original: swap } }) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" disabled={busy === swap.id} onClick={() => void decide(swap, true)}>
            Approve
          </Button>
          <Button size="sm" variant="outline" disabled={busy === swap.id} onClick={() => void decide(swap, false)}>
            Reject
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      tier="tier1"
      title="Shift swaps to decide"
      description="Both people have agreed. Approving changes their shifts for that day only."
      columns={columns}
      data={rows}
      noun="swaps"
      exportName="shift-swaps-to-decide"
      searchPlaceholder="Search swaps"
      isLoading={isLoading && !data}
      error={error?.detail ?? null}
      onRetry={reload}
      empty={{ icon: ArrowLeftRight, title: "Nothing waiting", description: "Agreed swaps from your team appear here." }}
    />
  );
}
