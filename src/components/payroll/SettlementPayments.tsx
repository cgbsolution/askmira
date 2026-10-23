"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Banknote, CheckCircle2, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { PersonCell } from "@/components/common/PersonCell";
import { apiMessage } from "@/components/payroll/labels";
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
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { Settlement, SettlementPaymentInput } from "@/lib/types/payroll-ops";
import { formatDate, formatDay, toISODate } from "@/lib/utils";

const EMPLOYEE_COLUMN: ColumnDef<Settlement> = {
  id: "employee",
  header: "Employee",
  accessorFn: (row) => row.employee_name ?? "Unnamed employee",
  meta: { text: (row) => `${row.employee_name ?? "Unnamed employee"} ${row.employee_code ?? ""}` },
  cell: ({ row }) => (
    <PersonCell name={row.original.employee_name ?? "Unnamed employee"} subtitle={row.original.employee_code} />
  ),
};

const PAID_COLUMNS: ColumnDef<Settlement>[] = [
  EMPLOYEE_COLUMN,
  {
    accessorKey: "net_amount",
    header: "Amount",
    meta: { className: "text-right", cellClassName: "font-medium" },
    cell: ({ row }) => <Money value={row.original.net_amount} />,
  },
  {
    id: "paid_on",
    header: "Paid on",
    accessorFn: (row) => row.paid_on ?? row.paid_at,
    meta: {
      cellClassName: "whitespace-nowrap tabular-nums",
      text: (row) => (row.paid_on ? formatDay(row.paid_on, true) : formatDate(row.paid_at)),
    },
    cell: ({ row }) =>
      row.original.paid_on ? formatDay(row.original.paid_on, true) : formatDate(row.original.paid_at),
  },
  {
    accessorKey: "payment_reference",
    header: "Bank reference",
    meta: { cellClassName: "font-mono text-sm", text: (row) => row.payment_reference ?? "Not recorded" },
    cell: ({ row }) => row.original.payment_reference ?? <Badge variant="muted">Not recorded</Badge>,
  },
  {
    accessorKey: "paid_by_name",
    header: "Recorded by",
    meta: { cellClassName: "text-sm text-muted-foreground" },
    cell: ({ row }) => row.original.paid_by_name ?? "—",
  },
];

/**
 * Paying an approved full & final settlement.
 *
 * Approval says the company owes the money; this records that it was paid —
 * the day and the bank's reference — so the leaver asking "where is my money"
 * and the auditor reconciling the bank statement get the same answer. Tenant
 * and admins record payments, as they approve settlements; nobody records
 * their own.
 */
export function SettlementPayments() {
  const { user, hasRole } = useAuth();
  const canPay = hasRole("admin");
  const approved = useApiQuery<Settlement[]>("/exits/settlements?status=approved");
  const paid = useApiQuery<Settlement[]>("/exits/settlements?status=paid");
  const [paying, setPaying] = useState<Settlement | null>(null);

  const reload = () => {
    approved.reload();
    paid.reload();
  };

  const waiting = approved.data ?? [];
  const done = paid.data ?? [];

  const waitingColumns: ColumnDef<Settlement>[] = [
    EMPLOYEE_COLUMN,
    {
      accessorKey: "last_working_day",
      header: "Last working day",
      meta: {
        cellClassName: "whitespace-nowrap tabular-nums",
        text: (row) => (row.last_working_day ? formatDay(row.last_working_day, true) : "—"),
      },
      cell: ({ row }) => (row.original.last_working_day ? formatDay(row.original.last_working_day, true) : "—"),
    },
    {
      accessorKey: "approved_at",
      header: "Approved",
      meta: { cellClassName: "whitespace-nowrap tabular-nums", text: (row) => formatDate(row.approved_at) },
      cell: ({ row }) => formatDate(row.original.approved_at),
    },
    {
      accessorKey: "net_amount",
      header: "Net payable",
      meta: { className: "text-right", cellClassName: "font-medium" },
      cell: ({ row }) => <Money value={row.original.net_amount} />,
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", headClassName: "w-40", text: false },
      cell: ({ row }) => {
        const own = user?.employee_id != null && row.original.employee_id === user.employee_id;
        return canPay && !own ? (
          <Button size="sm" onClick={() => setPaying(row.original)}>
            <Banknote /> Mark as paid
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            {own ? "Your own settlement" : "An admin records payment"}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        title="Approved, waiting to be paid"
        description="Record each payment once the bank has sent it: the date and the bank's reference."
        columns={waitingColumns}
        data={waiting}
        noun="settlements"
        exportName="settlements-awaiting-payment"
        searchPlaceholder="Search by name or code"
        isLoading={approved.isLoading && !approved.data}
        error={approved.error?.detail}
        onRetry={approved.reload}
        empty={{
          icon: Banknote,
          title: "Nothing waiting to be paid",
          description:
            "A settlement appears here once it is approved. Demands on an employee are recovered, not paid, so they do not.",
        }}
      />

      <DataTable
        title="Paid"
        description="Settlements paid to leavers, with the bank reference each was paid under."
        columns={PAID_COLUMNS}
        data={done}
        noun="settlements"
        exportName="settlements-paid"
        searchPlaceholder="Search name, code or bank reference"
        isLoading={paid.isLoading && !paid.data}
        error={paid.error?.detail}
        onRetry={paid.reload}
        empty={{
          icon: CheckCircle2,
          title: "No settlement has been paid yet",
          description: "Payments you record above appear here.",
        }}
      />

      <MarkPaidDialog
        settlement={paying}
        onClose={() => setPaying(null)}
        onPaid={() => {
          setPaying(null);
          reload();
        }}
      />
    </>
  );
}

function MarkPaidDialog({
  settlement,
  onClose,
  onPaid,
}: {
  settlement: Settlement | null;
  onClose: () => void;
  onPaid: () => void;
}) {
  const today = toISODate(new Date());
  const [paidOn, setPaidOn] = useState(today);
  const [reference, setReference] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const approvedOn = settlement?.approved_at ? toISODate(new Date(settlement.approved_at)) : undefined;
  const referenceOk = reference.trim().length >= 3;

  const submit = async () => {
    if (!settlement) return;
    setIsSaving(true);
    setProblem(null);
    try {
      const body: SettlementPaymentInput = { paid_on: paidOn, payment_reference: reference.trim() };
      await post<Settlement>(`/exits/settlements/${settlement.id}/mark-paid`, body);
      toast.success(`Recorded the payment to ${settlement.employee_name ?? "the leaver"}`);
      setReference("");
      setPaidOn(today);
      onPaid();
    } catch (error) {
      setProblem(apiMessage(error, "The payment could not be recorded."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={settlement !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record the payment</DialogTitle>
          <DialogDescription>
            {settlement && (
              <>
                {settlement.employee_name ?? "The leaver"}&apos;s settlement of{" "}
                <Money value={settlement.net_amount} />. Record it once the bank has sent the money.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="settlement-paid-on" label="Paid on" required>
            <DatePicker
              id="settlement-paid-on"
              value={paidOn}
              onChange={setPaidOn}
              min={approvedOn}
              max={today}
            />
          </FormField>
          <FormField
            htmlFor="settlement-reference"
            label="Bank reference"
            hint="The UTR, NEFT/IMPS reference or cheque number."
            required
          >
            <Input
              id="settlement-reference"
              value={reference}
              maxLength={120}
              onChange={(event) => setReference(event.target.value)}
              autoComplete="off"
            />
          </FormField>
          {problem && <p className="text-sm text-destructive">{problem}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!referenceOk || !paidOn || isSaving} onClick={() => void submit()}>
            {isSaving && <Loader2 className="animate-spin" />}
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
