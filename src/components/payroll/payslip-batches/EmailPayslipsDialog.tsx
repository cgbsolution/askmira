"use client";

import { Info, Loader2, Mail } from "lucide-react";
import React, { useMemo, useState } from "react";

import { FormField } from "@/components/common/FormField";
import { apiMessage } from "@/components/payroll/labels";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { post } from "@/lib/api";
import type { PayslipBatch, PayslipPerson } from "@/lib/types/payslip-batches";

type SendTo = "work" | "personal";

/**
 * Confirm emailing each picked person their released payslips for the period:
 * which address, how many go out, and who will get nothing and why.
 */
export function EmailPayslipsDialog({
  people,
  months,
  to,
  periodLabel,
  passwordProtected,
  passwordRule,
  onClose,
  onStarted,
}: {
  people: PayslipPerson[];
  months: number;
  /** `YYYY-MM-01`, or null for the latest approved month. */
  to: string | null;
  periodLabel: string;
  passwordProtected: boolean;
  passwordRule: string;
  onClose: () => void;
  onStarted: (batch: PayslipBatch) => void;
}) {
  const [sendTo, setSendTo] = useState<SendTo>("work");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    const address = (person: PayslipPerson) =>
      sendTo === "personal" ? (person.personal_email ?? person.work_email) : person.work_email;
    const receiving = people.filter((person) => person.released > 0 && address(person));
    return {
      receiving: receiving.length,
      payslips: receiving.reduce((total, person) => total + person.released, 0),
      noneReleased: people.filter((person) => person.released === 0).length,
      unreleased: people.filter((person) => person.payslips > person.released).length,
      noAddress: people.filter((person) => person.released > 0 && !address(person)).length,
    };
  }, [people, sendTo]);

  const send = async () => {
    setIsSending(true);
    setError(null);
    try {
      const batch = await post<PayslipBatch>("/payroll/payslip-batches/email", {
        employee_ids: people.map((person) => person.employee_id),
        months,
        to,
        send_to: sendTo,
      });
      onStarted(batch);
    } catch (caught) {
      setError(apiMessage(caught, "The payslips could not be emailed."));
      setIsSending(false);
    }
  };

  const one = people.length === 1 ? people[0] : null;

  return (
    <Dialog open onOpenChange={(open) => !open && !isSending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Email payslips</DialogTitle>
          <DialogDescription>
            {one ? `${one.full_name} (${one.employee_code})` : `${people.length} people`} · {periodLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <FormField htmlFor="payslip-send-to" label="Send to">
            <Select value={sendTo} onValueChange={(value) => setSendTo(value as SendTo)}>
              <SelectTrigger id="payslip-send-to" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="work">Work email</SelectItem>
                <SelectItem value="personal">Personal email (work email if none)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <div className="grid gap-1 rounded-md border bg-muted/40 p-3 text-sm">
            <p className="font-medium text-foreground">
              {summary.payslips} payslip{summary.payslips === 1 ? "" : "s"} to {summary.receiving}{" "}
              {summary.receiving === 1 ? "person" : "people"}, one email each with the PDFs attached
            </p>
            {one && one.released > 0 && (
              <p className="text-muted-foreground">
                To {sendTo === "personal" ? (one.personal_email ?? one.work_email) : one.work_email}
              </p>
            )}
            {summary.noneReleased > 0 && (
              <p className="text-muted-foreground">
                {summary.noneReleased} {summary.noneReleased === 1 ? "has" : "have"} no payslip released for this
                period and will be skipped.
              </p>
            )}
            {summary.unreleased > 0 && (
              <p className="text-muted-foreground">
                Months not yet released to employees are left out; download them instead.
              </p>
            )}
            {summary.noAddress > 0 && (
              <p className="text-muted-foreground">
                {summary.noAddress} {summary.noAddress === 1 ? "has" : "have"} no email address on record and will be
                skipped.
              </p>
            )}
          </div>

          {passwordProtected && (
            <Alert>
              <Info />
              <AlertDescription>The PDFs open with a password. {passwordRule}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={() => void send()} disabled={isSending || summary.receiving === 0}>
            {isSending ? <Loader2 className="animate-spin" /> : <Mail />}
            Email {summary.payslips} payslip{summary.payslips === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
