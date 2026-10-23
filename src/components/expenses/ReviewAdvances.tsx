"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { HandCoins, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { DatePicker } from "@/components/common/DatePicker";
import { PersonCell } from "@/components/common/PersonCell";
import { InlineProblem, StatTile, errorDetail, todayISO } from "@/components/expenses/ReviewCommon";
import { AdvanceStatusBadge, formatMoney } from "@/components/expenses/shared";
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
import { Label } from "@/components/ui/label";
import { post } from "@/lib/api";
import type { Advance, AdvanceStatus, SettleInput, SettlementOutcome, SettlementResult } from "@/lib/types/expenses";
import { formatDay } from "@/lib/utils";

const OUTCOME_LABEL: Record<SettlementOutcome, string> = {
  square: "Square — the claims equal the advance",
  refund_due_to_employee: "Refund due to the employee",
  recovery_due_from_employee: "Recovery due from the employee",
};

/** The status badge's words, for sorting, the search and the CSV. */
const STATUS_TEXT: Record<AdvanceStatus, string> = {
  issued: "Outstanding",
  settled: "Settled",
  cancelled: "Cancelled",
};

/** "Issued 3 Oct 2026 · trip ended 7 Oct 2026". */
function issuedLine(advance: Advance): string {
  return `Issued ${formatDay(advance.issued_on, true)}${
    advance.trip_to_date ? ` · trip ended ${formatDay(advance.trip_to_date, true)}` : ""
  }`;
}

/** Advances whose trips are over, settled against the claims made for them. */
export function ReviewAdvances({
  advances,
  onChanged,
}: {
  advances: Advance[];
  onChanged: () => void;
}) {
  const [settling, setSettling] = useState<Advance | null>(null);

  const columns: ColumnDef<Advance>[] = [
    {
      accessorKey: "employee_name",
      header: "Employee",
      meta: { text: (advance) => [advance.employee_name ?? "—", advance.employee_code].filter(Boolean).join(" ") },
      cell: ({ row }) => (
        <PersonCell size="sm" name={row.original.employee_name ?? "—"} subtitle={row.original.employee_code} />
      ),
    },
    {
      accessorKey: "trip_purpose",
      header: "Trip",
      meta: {
        cellClassName: "max-w-64",
        text: (advance) => `${advance.trip_purpose ?? "—"} · ${issuedLine(advance)}`,
      },
      cell: ({ row }) => (
        <>
          <p className="truncate text-foreground">{row.original.trip_purpose ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{issuedLine(row.original)}</p>
        </>
      ),
    },
    {
      accessorKey: "amount",
      header: "Advance",
      sortingFn: "alphanumeric",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => formatMoney(row.original.amount),
    },
    {
      accessorKey: "claimed_against",
      header: "Claimed against",
      sortingFn: "alphanumeric",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => formatMoney(row.original.claimed_against),
    },
    {
      accessorKey: "outstanding",
      header: "Outstanding",
      sortingFn: "alphanumeric",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => formatMoney(row.original.outstanding),
    },
    {
      accessorKey: "age_days",
      header: "Age",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => `${row.original.age_days}d`,
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (advance) => STATUS_TEXT[advance.status],
      meta: {
        text: (advance) => [STATUS_TEXT[advance.status], advance.is_blocking && "Blocking"].filter(Boolean).join(", "),
      },
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          <AdvanceStatusBadge status={row.original.status} />
          {row.original.is_blocking && <Badge variant="destructive">Blocking</Badge>}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <Button size="sm" onClick={() => setSettling(row.original)}>
          Settle
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={advances}
        noun="advances"
        exportName="advances-to-settle"
        searchPlaceholder="Search employee or trip"
        empty={{
          icon: HandCoins,
          title: "No advances to settle",
          description:
            "An issued advance appears here once its trip is over and it can be settled against the claims.",
        }}
      />

      <SettleDialog
        advance={settling}
        onClose={(changed) => {
          setSettling(null);
          if (changed) onChanged();
        }}
      />
    </>
  );
}

function SettleDialog({
  advance,
  onClose,
}: {
  advance: Advance | null;
  onClose: (changed: boolean) => void;
}) {
  const [settledOn, setSettledOn] = useState(todayISO());
  const [result, setResult] = useState<SettlementResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  // Reset when a different advance is opened.
  if (advance && advance.id !== openedFor) {
    setOpenedFor(advance.id);
    setSettledOn(todayISO());
    setResult(null);
    setProblem(null);
  }

  const settle = async () => {
    if (!advance || !settledOn) return;
    setIsSaving(true);
    setProblem(null);
    try {
      const body: SettleInput = { settled_on: settledOn };
      const outcome = await post<SettlementResult>(`/expenses/advances/${advance.id}/settle`, body);
      setResult(outcome);
      toast.success("Advance settled");
    } catch (error) {
      setProblem(errorDetail(error, "Could not settle the advance."));
    } finally {
      setIsSaving(false);
    }
  };

  const close = () => {
    const changed = result !== null;
    setOpenedFor(null);
    onClose(changed);
  };

  return (
    <Dialog open={advance !== null} onOpenChange={(open) => !open && !isSaving && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{result ? "Settlement" : "Settle this advance"}</DialogTitle>
          <DialogDescription>
            {advance &&
              `${advance.employee_name ?? "The employee"} · ${advance.trip_purpose ?? "trip"} · advance ${formatMoney(advance.amount)}.`}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="grid gap-4">
            <p className="font-medium text-foreground">{OUTCOME_LABEL[result.outcome] ?? result.outcome}</p>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Advance" value={formatMoney(result.advance_amount)} />
              <StatTile
                label="Claims against the trip"
                value={formatMoney(result.claims_total)}
                hint={`${result.claim_count} ${result.claim_count === 1 ? "claim" : "claims"}`}
              />
              {result.outcome === "recovery_due_from_employee" && (
                <StatTile label="To recover" tone="warning" value={formatMoney(result.recovery_amount)} />
              )}
              {result.outcome === "refund_due_to_employee" && (
                <StatTile label="To refund" tone="success" value={formatMoney(result.refund_amount)} />
              )}
            </div>
            <p className="text-sm text-muted-foreground">{result.message}</p>
            {result.payroll_recovery?.required && (
              <div className="rounded-md border border-mustard-200 bg-mustard-50 px-3 py-2.5 text-sm text-mustard-900 dark:border-mustard-900/40 dark:bg-mustard-900/20 dark:text-mustard-100">
                <p className="font-medium">
                  Payroll recovery of <span className="tabular-nums">{formatMoney(result.payroll_recovery.amount)}</span>{" "}
                  goes into the next payroll run.
                </p>
                {result.payroll_recovery.reference && (
                  <p className="mt-1">Reference {result.payroll_recovery.reference}</p>
                )}
                <p className="mt-1">{result.payroll_recovery.note}</p>
              </div>
            )}
            {result.payroll_refund && (
              <div className="rounded-md border border-border px-3 py-2.5 text-sm text-foreground">
                <p className="font-medium">
                  <span className="tabular-nums">{formatMoney(result.payroll_refund.amount)}</span> is
                  paid to the employee in the next payroll run.
                </p>
                <p className="mt-1 text-muted-foreground">{result.payroll_refund.note}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="settle-on">Settled on</Label>
            <DatePicker
              id="settle-on"
              value={settledOn}
              onChange={setSettledOn}
              max={todayISO()}
            />
          </div>
        )}

        {problem && <InlineProblem>{problem}</InlineProblem>}

        <DialogFooter>
          {result ? (
            <Button onClick={close}>Done</Button>
          ) : (
            <>
              <Button variant="outline" disabled={isSaving} onClick={close}>
                Cancel
              </Button>
              <Button disabled={!settledOn || isSaving} onClick={() => void settle()}>
                {isSaving && <Loader2 className="animate-spin" />}
                Settle
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
