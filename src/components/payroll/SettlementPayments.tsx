"use client";

import { Banknote, CheckCircle2, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
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
import { post } from "@/lib/api";
import type { Settlement, SettlementPaymentInput } from "@/lib/types/payroll-ops";
import { formatDate, formatDay, toISODate } from "@/lib/utils";

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

  return (
    <>
      <DataPanel
        title="Approved, waiting to be paid"
        description="Record each payment once the bank has sent it: the date and the bank's reference."
        isLoading={approved.isLoading && !approved.data}
        error={approved.error?.detail}
        onRetry={approved.reload}
        isEmpty={waiting.length === 0}
        empty={{
          icon: Banknote,
          title: "Nothing waiting to be paid",
          description:
            "A settlement appears here once it is approved. Demands on an employee are recovered, not paid, so they do not.",
        }}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Last working day</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead className="text-right">Net payable</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {waiting.map((row) => {
                const own = user?.employee_id != null && row.employee_id === user.employee_id;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <PersonCell
                        name={row.employee_name ?? "Unnamed employee"}
                        subtitle={row.employee_code}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {row.last_working_day ? formatDay(row.last_working_day, true) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatDate(row.approved_at)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <Money value={row.net_amount} />
                    </TableCell>
                    <TableCell className="text-right">
                      {canPay && !own ? (
                        <Button size="sm" onClick={() => setPaying(row)}>
                          <Banknote /> Mark as paid
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {own ? "Your own settlement" : "An admin records payment"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </DataPanel>

      <DataPanel
        title="Paid"
        description="Settlements paid to leavers, with the bank reference each was paid under."
        isLoading={paid.isLoading && !paid.data}
        error={paid.error?.detail}
        onRetry={paid.reload}
        isEmpty={done.length === 0}
        empty={{
          icon: CheckCircle2,
          title: "No settlement has been paid yet",
          description: "Payments you record above appear here.",
        }}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Paid on</TableHead>
                <TableHead>Bank reference</TableHead>
                <TableHead>Recorded by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {done.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <PersonCell
                      name={row.employee_name ?? "Unnamed employee"}
                      subtitle={row.employee_code}
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <Money value={row.net_amount} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {row.paid_on ? formatDay(row.paid_on, true) : formatDate(row.paid_at)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {row.payment_reference ?? <Badge variant="muted">Not recorded</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.paid_by_name ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DataPanel>

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
