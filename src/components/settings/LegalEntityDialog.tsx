"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { weeklyOffLabel } from "@/components/attendance/shared";
import { patch, post } from "@/lib/api";
import type { Shift } from "@/lib/types/attendance";
import type { LegalEntity, SalaryDaysBasis } from "@/lib/types/people";

import { errorDetail } from "./settingsShared";

/** The workspace default shift applies: no work week of the entity's own. */
const WORKSPACE_DEFAULT = "__workspace_default";

export const SALARY_DAYS_OPTIONS: { value: SalaryDaysBasis; label: string; hint: string }[] = [
  {
    value: "calendar",
    label: "Calendar days (28–31)",
    hint: "The month's days. Weekly offs and holidays are paid; a day is worth less in a 31-day month.",
  },
  {
    value: "fixed",
    label: "Fixed days (26 or 30)",
    hint: "The same number every month, so a day's pay never changes.",
  },
  {
    value: "working_days",
    label: "Working days of the month",
    hint: "Each person's scheduled days: the month less their weekly offs — about 22 on a five-day week, 26 on a six-day week, 24 on alternate Saturdays. Holidays are paid working days.",
  },
];

/** "Fixed 26 days", "Calendar days", "Working days". */
export function salaryDaysLabel(entity: LegalEntity): string {
  if (entity.salary_days_basis === "fixed") return `Fixed ${entity.salary_fixed_days ?? "—"} days`;
  if (entity.salary_days_basis === "working_days") return "Working days";
  return "Calendar days";
}

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const TAN = /^[A-Z]{4}[0-9]{5}[A-Z]$/;
const GSTIN = /^[0-9]{2}[A-Z0-9]{13}$/;
const CODE = /^[A-Za-z0-9_-]+$/;

interface Values {
  name: string;
  code: string;
  pan: string;
  tan: string;
  gstin: string;
  pf_registration_no: string;
  esi_registration_no: string;
  registered_address: string;
  is_active: boolean;
  default_shift_id: string;
  salary_days_basis: SalaryDaysBasis;
  salary_fixed_days: string;
}

const EMPTY: Values = {
  name: "",
  code: "",
  pan: "",
  tan: "",
  gstin: "",
  pf_registration_no: "",
  esi_registration_no: "",
  registered_address: "",
  is_active: true,
  default_shift_id: WORKSPACE_DEFAULT,
  salary_days_basis: "calendar",
  salary_fixed_days: "26",
};

/**
 * Create or edit a legal entity.
 *
 * The identifier formats are checked here as well as on the API — not because
 * the client is trusted, but because a PAN typed one character short should be
 * caught while the person still has the document in front of them, rather than
 * at the moment a quarterly return is generated.
 */
export function LegalEntityDialog({
  open,
  editing,
  shifts = [],
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  editing: LegalEntity | null;
  /** Shifts that can be a work week; the active ones are offered. */
  shifts?: Shift[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(
      editing
        ? {
            name: editing.name,
            code: editing.code,
            pan: editing.pan ?? "",
            tan: editing.tan ?? "",
            gstin: editing.gstin ?? "",
            pf_registration_no: editing.pf_registration_no ?? "",
            esi_registration_no: editing.esi_registration_no ?? "",
            registered_address: editing.registered_address ?? "",
            is_active: editing.is_active,
            default_shift_id: editing.default_shift_id ?? WORKSPACE_DEFAULT,
            salary_days_basis: editing.salary_days_basis ?? "calendar",
            salary_fixed_days: editing.salary_fixed_days ? String(editing.salary_fixed_days) : "26",
          }
        : EMPTY,
    );
  }, [open, editing]);

  // Inactive shifts are not offered, except the one already chosen.
  const workWeeks = shifts.filter(
    (shift) => shift.active || shift.id === values.default_shift_id,
  );

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const errors: Partial<Record<keyof Values, string>> = {};
  if (values.name.trim().length < 1) errors.name = "A name is required.";
  if (!CODE.test(values.code.trim()))
    errors.code = "Letters, digits, hyphen and underscore only.";
  if (values.pan && !PAN.test(values.pan.toUpperCase()))
    errors.pan = "A PAN is five letters, four digits, then a letter.";
  if (values.tan && !TAN.test(values.tan.toUpperCase()))
    errors.tan = "A TAN is four letters, five digits, then a letter.";
  if (values.gstin && !GSTIN.test(values.gstin.toUpperCase()))
    errors.gstin = "A GSTIN is two digits then thirteen letters or digits.";
  const fixedDays = Number(values.salary_fixed_days);
  if (
    values.salary_days_basis === "fixed" &&
    (!/^\d{1,2}$/.test(values.salary_fixed_days) || fixedDays < 20 || fixedDays > 31)
  )
    errors.salary_fixed_days = "A whole number of days from 20 to 31, such as 26 or 30.";
  const invalid = Object.keys(errors).length > 0;

  const submit = async () => {
    setIsBusy(true);
    const blankToNull = (value: string) => (value.trim() === "" ? null : value.trim());
    const body = {
      name: values.name.trim(),
      code: values.code.trim(),
      pan: blankToNull(values.pan.toUpperCase()),
      tan: blankToNull(values.tan.toUpperCase()),
      gstin: blankToNull(values.gstin.toUpperCase()),
      pf_registration_no: blankToNull(values.pf_registration_no),
      esi_registration_no: blankToNull(values.esi_registration_no),
      registered_address: blankToNull(values.registered_address),
      default_shift_id:
        values.default_shift_id === WORKSPACE_DEFAULT ? null : values.default_shift_id,
      salary_days_basis: values.salary_days_basis,
      salary_fixed_days: values.salary_days_basis === "fixed" ? fixedDays : null,
    };
    try {
      if (editing) {
        await patch(`/org/legal-entities/${editing.id}`, {
          ...body,
          is_active: values.is_active,
        });
        toast.success("Entity updated.");
      } else {
        await post("/org/legal-entities", body);
        toast.success("Entity created.");
      }
      onSaved();
      onOpenChange(false);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not save the entity."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.name}` : "Add a legal entity"}</DialogTitle>
          <DialogDescription>
            Statutory returns are filed per entity, under these registration numbers.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="entity-name" label="Registered name" error={errors.name}>
            <Input
              id="entity-name"
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="Acme Technologies Private Limited"
            />
          </FormField>
          <FormField
            htmlFor="entity-code"
            label="Short code"
            error={errors.code}
            hint="Used on filings and file names."
          >
            <Input
              id="entity-code"
              value={values.code}
              onChange={(event) => set("code", event.target.value)}
              placeholder="ACME"
              className="font-mono"
            />
          </FormField>

          <FormField htmlFor="entity-pan" label="PAN" optional error={errors.pan}>
            <Input
              id="entity-pan"
              value={values.pan}
              onChange={(event) => set("pan", event.target.value.toUpperCase())}
              placeholder="AAACA1234A"
              className="font-mono uppercase"
              maxLength={10}
            />
          </FormField>
          <FormField
            htmlFor="entity-tan"
            label="TAN"
            optional
            error={errors.tan}
            hint="Required for the quarterly TDS return (24Q)."
          >
            <Input
              id="entity-tan"
              value={values.tan}
              onChange={(event) => set("tan", event.target.value.toUpperCase())}
              placeholder="BLRA12345B"
              className="font-mono uppercase"
              maxLength={10}
            />
          </FormField>

          <FormField
            htmlFor="entity-pf"
            label="PF registration number"
            optional
            hint="Required for the monthly ECR."
          >
            <Input
              id="entity-pf"
              value={values.pf_registration_no}
              onChange={(event) => set("pf_registration_no", event.target.value)}
              className="font-mono"
            />
          </FormField>
          <FormField htmlFor="entity-esi" label="ESI registration number" optional>
            <Input
              id="entity-esi"
              value={values.esi_registration_no}
              onChange={(event) => set("esi_registration_no", event.target.value)}
              className="font-mono"
            />
          </FormField>

          <FormField
            htmlFor="entity-gstin"
            label="GSTIN"
            optional
            error={errors.gstin}
            hint="Used when claiming input credit on expense invoices."
          >
            <Input
              id="entity-gstin"
              value={values.gstin}
              onChange={(event) => set("gstin", event.target.value.toUpperCase())}
              placeholder="29AAACA1234A1Z5"
              className="font-mono uppercase"
              maxLength={15}
            />
          </FormField>

          <FormField
            htmlFor="entity-address"
            label="Registered address"
            optional
            className="sm:col-span-2"
          >
            <Textarea
              id="entity-address"
              value={values.registered_address}
              onChange={(event) => set("registered_address", event.target.value)}
              rows={2}
            />
          </FormField>

          <div className="sm:col-span-2">
            <Separator />
            <p className="mt-4 text-sm font-medium text-foreground">Work week and salary days</p>
            <p className="text-xs text-muted-foreground">
              How this company works and how its monthly salary is split into days for loss of pay
              and part months.
            </p>
          </div>

          <FormField
            htmlFor="entity-work-week"
            label="Work week"
            hint="For people here with no shift of their own. A person's own shift or roster still wins."
          >
            <Select
              value={values.default_shift_id}
              onValueChange={(next) => set("default_shift_id", next)}
            >
              <SelectTrigger id="entity-work-week" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={WORKSPACE_DEFAULT}>Workspace default shift</SelectItem>
                {workWeeks.map((shift) => (
                  <SelectItem key={shift.id} value={shift.id}>
                    {shift.name} — off {weeklyOffLabel(shift)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            htmlFor="entity-salary-days"
            label="Salary days"
            hint={SALARY_DAYS_OPTIONS.find((o) => o.value === values.salary_days_basis)?.hint}
          >
            <Select
              value={values.salary_days_basis}
              onValueChange={(next) => set("salary_days_basis", next as SalaryDaysBasis)}
            >
              <SelectTrigger id="entity-salary-days" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SALARY_DAYS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {values.salary_days_basis === "fixed" && (
            <FormField
              htmlFor="entity-fixed-days"
              label="Days in a salary month"
              error={errors.salary_fixed_days}
              hint="One day's loss of pay is the monthly amount divided by this."
            >
              <Input
                id="entity-fixed-days"
                inputMode="numeric"
                value={values.salary_fixed_days}
                onChange={(event) =>
                  set("salary_fixed_days", event.target.value.replace(/\D/g, "").slice(0, 2))
                }
                placeholder="26"
                className="tabular-nums"
              />
            </FormField>
          )}

          {editing && (
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch
                id="entity-active"
                checked={values.is_active}
                onCheckedChange={(next) => set("is_active", next)}
              />
              <Label htmlFor="entity-active" className="text-sm font-normal">
                Active. An inactive entity stays on historical filings but cannot be chosen for
                new ones.
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || invalid}>
            {isBusy && <Loader2 className="animate-spin" />}
            {editing ? "Save changes" : "Create entity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
