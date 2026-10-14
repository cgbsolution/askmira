"use client";

import { Loader2, Plus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { EmployeePicker } from "@/components/common/EmployeePicker";
import { FormField } from "@/components/common/FormField";
import { apiMessage, MONTHS } from "@/components/payroll/labels";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { post } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import type {
  Adjustment,
  AdjustmentCategory,
  AdjustmentInput,
  AdjustmentRecurrence,
} from "@/lib/types/payroll-inputs";

import { CATEGORY_LABEL, DEDUCTION_CATEGORIES, EARNING_CATEGORIES } from "./labels";

/** Key in an earning or deduction outside the salary structure. Approved by another admin. */
export function NewAdjustmentDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [category, setCategory] = useState<AdjustmentCategory>("incentive");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [recurrence, setRecurrence] = useState<AdjustmentRecurrence>("one_time");
  const [startYear, setStartYear] = useState(String(now.getFullYear()));
  const [startMonth, setStartMonth] = useState(String(now.getMonth() + 1));
  const [endYear, setEndYear] = useState("");
  const [endMonth, setEndMonth] = useState("");
  const [cap, setCap] = useState("");
  const [taxable, setTaxable] = useState(true);
  const [withinNet, setWithinNet] = useState(true);
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isEarning = EARNING_CATEGORIES.includes(category);
  const isWage = category === "overtime" || category === "shift_allowance";

  const reset = () => {
    setEmployee(null);
    setName("");
    setAmount("");
    setRecurrence("one_time");
    setEndYear("");
    setEndMonth("");
    setCap("");
    setReference("");
    setReason("");
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!employee) return setError("Choose the employee.");
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
      return setError("Enter the amount in rupees, like 5000 or 5000.50.");
    }
    if (cap && !/^\d+(\.\d{1,2})?$/.test(cap)) return setError("The total cap must be an amount.");
    if (reason.trim().length < 3) return setError("Say why this adjustment is due.");
    const hasEnd = recurrence === "monthly" && endYear && endMonth;
    setError(null);
    setIsSaving(true);
    try {
      const body: AdjustmentInput = {
        employee_id: employee.id,
        category,
        name: name.trim() || CATEGORY_LABEL[category],
        amount,
        taxable: isEarning ? taxable : false,
        counts_as_wages: isWage,
        within_net_pay: isEarning ? false : withinNet,
        recurrence,
        start_year: Number.parseInt(startYear, 10),
        start_month: Number.parseInt(startMonth, 10),
        end_year: hasEnd ? Number.parseInt(endYear, 10) : null,
        end_month: hasEnd ? Number.parseInt(endMonth, 10) : null,
        total_cap: recurrence === "monthly" && cap ? cap : null,
        reference: reference.trim() || null,
        reason: reason.trim(),
      };
      await post<Adjustment>("/payroll/adjustments", body);
      toast.success("Adjustment keyed in. Another admin approves it before any run pays it.");
      setOpen(false);
      reset();
      onCreated();
    } catch (caught) {
      setError(apiMessage(caught, "Could not save the adjustment."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && setOpen(next)}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New adjustment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New payroll adjustment</DialogTitle>
            <DialogDescription>
              An earning or deduction outside the salary structure. It is paid by the first run on
              or after its start month, once it has been approved by another admin.
            </DialogDescription>
          </DialogHeader>
          <FormField htmlFor="adj-employee" label="Employee" required>
            <EmployeePicker
              id="adj-employee"
              value={employee}
              onChange={setEmployee}
              excludeId={user?.employee_id ?? null}
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField htmlFor="adj-category" label="Type">
              <Select value={category} onValueChange={(v) => setCategory(v as AdjustmentCategory)}>
                <SelectTrigger id="adj-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Earnings</SelectLabel>
                    {EARNING_CATEGORIES.map((key) => (
                      <SelectItem key={key} value={key}>
                        {CATEGORY_LABEL[key]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Deductions</SelectLabel>
                    {DEDUCTION_CATEGORIES.map((key) => (
                      <SelectItem key={key} value={key}>
                        {CATEGORY_LABEL[key]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="adj-amount" label={recurrence === "monthly" ? "Each month (₹)" : "Amount (₹)"} required>
              <Input
                id="adj-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </FormField>
          </div>
          <FormField htmlFor="adj-name" label="Shown on the payslip as" optional>
            <Input
              id="adj-name"
              maxLength={128}
              value={name}
              placeholder={CATEGORY_LABEL[category]}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField htmlFor="adj-recurrence" label="How often">
              <Select
                value={recurrence}
                onValueChange={(v) => setRecurrence(v as AdjustmentRecurrence)}
              >
                <SelectTrigger id="adj-recurrence" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">Once</SelectItem>
                  <SelectItem value="monthly">Every month</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="adj-start-month" label="From month">
              <Select value={startMonth} onValueChange={setStartMonth}>
                <SelectTrigger id="adj-start-month" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={month} value={String(index + 1)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="adj-start-year" label="Year">
              <Input
                id="adj-start-year"
                inputMode="numeric"
                value={startYear}
                onChange={(event) => setStartYear(event.target.value)}
              />
            </FormField>
          </div>
          {recurrence === "monthly" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField htmlFor="adj-end-month" label="Last month" optional>
                <Select value={endMonth} onValueChange={setEndMonth}>
                  <SelectTrigger id="adj-end-month" className="w-full">
                    <SelectValue placeholder="No end" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month, index) => (
                      <SelectItem key={month} value={String(index + 1)}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField htmlFor="adj-end-year" label="Year" optional>
                <Input
                  id="adj-end-year"
                  inputMode="numeric"
                  value={endYear}
                  onChange={(event) => setEndYear(event.target.value)}
                />
              </FormField>
              <FormField
                htmlFor="adj-cap"
                label="Total cap (₹)"
                optional={category !== "court_attachment"}
                required={category === "court_attachment"}
              >
                <Input
                  id="adj-cap"
                  inputMode="decimal"
                  value={cap}
                  onChange={(event) => setCap(event.target.value)}
                />
              </FormField>
            </div>
          )}
          {isEarning ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Taxable</p>
                <p className="text-xs text-muted-foreground">
                  Taxed in the month it is paid.
                  {isWage && " Counts as wages for ESI and Professional Tax, never for PF."}
                </p>
              </div>
              <Switch checked={taxable} onCheckedChange={setTaxable} aria-label="Taxable" />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Only when net pay allows</p>
                <p className="text-xs text-muted-foreground">
                  Skipped and carried to the next run rather than taking net pay below zero.
                </p>
              </div>
              <Switch
                checked={withinNet}
                onCheckedChange={setWithinNet}
                aria-label="Only when net pay allows"
              />
            </div>
          )}
          <FormField
            htmlFor="adj-reference"
            label={category === "court_attachment" ? "Court order reference" : "Reference"}
            optional={category !== "court_attachment"}
            required={category === "court_attachment"}
          >
            <Input
              id="adj-reference"
              maxLength={128}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </FormField>
          <FormField htmlFor="adj-reason" label="Why it is due" required>
            <Textarea
              id="adj-reason"
              rows={2}
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              Save for approval
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
