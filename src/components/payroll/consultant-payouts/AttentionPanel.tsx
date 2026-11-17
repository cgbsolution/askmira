"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { toast } from "sonner";

import { AmountInput } from "@/components/common/AmountInput";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DatePicker } from "@/components/common/DatePicker";
import { EmployeePicker } from "@/components/common/EmployeePicker";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { SECTION_LABEL } from "@/components/payroll/consultant-payouts/labels";
import { apiMessage } from "@/components/payroll/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { post, put } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import type {
  AttentionConsultant,
  PayoutAttention,
  TdsSection,
} from "@/lib/types/consultant-payouts";
import { todayISO } from "@/lib/utils";

const HAS_SALARY = "Has a current salary";

const isNoHours = (reason: string) => reason.startsWith("No hours entered");

/** The 1 April that starts the financial year containing today. */
function currentFyStart(): string {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-04-01`;
}

/** Fees and tax already counted for a consultant this year, before payout runs began. */
function OpeningDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [person, setPerson] = useState<EmployeeSummary | null>(null);
  const [fyStart, setFyStart] = useState(currentFyStart());
  const [section, setSection] = useState<TdsSection>("194J_professional");
  const [feesPaid, setFeesPaid] = useState("");
  const [taxedBase, setTaxedBase] = useState("");
  const [tdsDeducted, setTdsDeducted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!person) return setError("Choose the consultant.");
    if (!fyStart.endsWith("-04-01"))
      return setError("The financial year starts on 1 April.");
    setError(null);
    setIsSaving(true);
    try {
      await put("/consultant-payouts/openings", {
        employee_id: person.id,
        fy_start: fyStart,
        section,
        fees_paid: feesPaid || "0",
        taxed_base: taxedBase || "0",
        tds_deducted: tdsDeducted || "0",
      });
      toast.success("Opening figures saved.");
      onOpenChange(false);
    } catch (caught) {
      setError(apiMessage(caught, "Could not save the opening figures."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !isSaving && onOpenChange(next)}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={(event) => void save(event)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Opening this year</DialogTitle>
            <DialogDescription>
              What a consultant was paid, and had tax taken on, earlier in this
              financial year before payouts started here. It keeps the tax
              threshold and catch-up right.
            </DialogDescription>
          </DialogHeader>
          <FormField htmlFor="opening-person" label="Consultant">
            <EmployeePicker
              id="opening-person"
              excludeId={null}
              value={person}
              onChange={setPerson}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              htmlFor="opening-fy"
              label="Year starting"
              hint="Always 1 April."
            >
              <DatePicker
                id="opening-fy"
                required
                value={fyStart}
                onChange={setFyStart}
              />
            </FormField>
            <FormField htmlFor="opening-section" label="TDS section">
              <Select
                value={section}
                onValueChange={(value) => setSection(value as TdsSection)}
              >
                <SelectTrigger id="opening-section" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SECTION_LABEL) as TdsSection[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {SECTION_LABEL[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField htmlFor="opening-fees" label="Fees paid so far (₹)">
            <AmountInput
              id="opening-fees"
              value={feesPaid}
              onValueChange={setFeesPaid}
            />
          </FormField>
          <FormField
            htmlFor="opening-base"
            label="Of which tax was taken on (₹)"
            hint="Cannot be more than the fees paid."
          >
            <AmountInput
              id="opening-base"
              value={taxedBase}
              onValueChange={setTaxedBase}
            />
          </FormField>
          <FormField
            htmlFor="opening-tds"
            label="Tax (TDS) already deducted (₹)"
          >
            <AmountInput
              id="opening-tds"
              value={tdsDeducted}
              onValueChange={setTdsDeducted}
            />
          </FormField>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * What to sort out before payouts start: consultants still on a salary, with no
 * rate or no finance approver, and payroll adjustments still pending for them. The
 * "Opening this year" editor is always offered.
 */
export function AttentionPanel({
  attention,
  onChanged,
}: {
  attention: PayoutAttention;
  onChanged: () => void;
}) {
  const [ending, setEnding] = useState<AttentionConsultant[] | null>(null);
  const [lastDay, setLastDay] = useState(todayISO());
  const [openingOpen, setOpeningOpen] = useState(false);

  const { consultants, pending_adjustments: adjustments } = attention;
  const salaried = consultants.filter((person) =>
    person.reasons.includes(HAS_SALARY),
  );

  const endSalaries = async () => {
    if (!ending) return;
    try {
      await post("/consultant-payouts/attention/end-salaries", {
        employee_ids: ending.map((person) => person.employee_id),
        effective_to: lastDay,
      });
      toast.success(ending.length === 1 ? "Salary ended." : "Salaries ended.");
      onChanged();
    } catch (caught) {
      toast.error(apiMessage(caught, "The salary could not be ended."));
      throw caught;
    }
  };

  return (
    <div className="grid gap-3">
      {consultants.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>
            {consultants.length === 1
              ? "1 consultant needs attention before payouts"
              : `${consultants.length} consultants need attention before payouts`}
          </AlertTitle>
          <AlertDescription>
            <ul className="grid gap-2">
              {consultants.map((person) => (
                <li
                  key={person.employee_id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1"
                >
                  <Link
                    href={`/people/${person.employee_id}`}
                    className="font-medium underline underline-offset-2"
                  >
                    {person.name} ({person.code})
                  </Link>
                  <span>{person.reasons.join(" · ")}</span>
                  {person.reasons.some(isNoHours) && (
                    <Link
                      href="/payroll/consultant-hours"
                      className="font-medium underline underline-offset-2"
                    >
                      Enter hours
                    </Link>
                  )}
                  {person.old_gst_amount && (
                    <span>
                      Earlier GST on file:{" "}
                      <Money value={person.old_gst_amount} />. Use it as a guide
                      when you set their GST rate.
                    </span>
                  )}
                  {person.reasons.includes(HAS_SALARY) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEnding([person])}
                    >
                      End salary
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {salaried.length > 1 && (
              <Button
                size="sm"
                className="mt-3"
                onClick={() => setEnding(salaried)}
              >
                End all {salaried.length} salaries
              </Button>
            )}
            <p className="mt-2">
              A consultant is paid through payouts, not a salary. Add their
              hourly rate and finance approver on their record, and enter
              their hours under Consultant hours.
            </p>
          </AlertDescription>
        </Alert>
      )}
      {adjustments.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>
            Consultant timesheet pay still waiting in payroll
          </AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {adjustments.map((item) => (
                <li key={item.adjustment_id}>
                  {item.name} ({item.employee_code}):{" "}
                  <Money value={item.amount} />
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Payroll will pay these once. To pay this as a consultant payout
              instead, cancel it under{" "}
              <Link
                href="/payroll/adjustments"
                className="font-medium underline underline-offset-2"
              >
                Payroll → Adjustments
              </Link>
              ; the hours can then go into a consultant payout.
            </p>
          </AlertDescription>
        </Alert>
      )}
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpeningOpen(true)}
        >
          Opening this year
        </Button>
      </div>

      <ConfirmDialog
        open={ending !== null}
        onOpenChange={(open) => !open && setEnding(null)}
        title={
          ending && ending.length === 1
            ? `End ${ending[0].name}'s salary?`
            : `End ${ending?.length ?? 0} salaries?`
        }
        description="They are paid through consultant payouts from now on. Past payslips are not changed."
        confirmLabel="End salary"
        onConfirm={endSalaries}
      >
        <FormField htmlFor="salary-last-day" label="Last day of the salary">
          <DatePicker
            id="salary-last-day"
            required
            value={lastDay}
            onChange={setLastDay}
          />
        </FormField>
      </ConfirmDialog>
      <OpeningDialog open={openingOpen} onOpenChange={setOpeningOpen} />
    </div>
  );
}
