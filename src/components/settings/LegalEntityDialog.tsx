"use client";

import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { HiddenFileInput } from "@/components/ui/file-input";
import { weeklyOffLabel } from "@/components/attendance/shared";
import { useAuth } from "@/context/AuthContext";
import { del, patch, post } from "@/lib/api";
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

/** The API's limit for a logo; checked here too, so a big file is refused before upload. */
const LOGO_MAX_BYTES = 1024 * 1024;
const LOGO_TYPES = ["image/png", "image/jpeg"];

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
  const { reloadSession } = useAuth();
  const [values, setValues] = useState<Values>(EMPTY);
  const [isBusy, setIsBusy] = useState(false);
  // The logo is sent after the entity is saved (a new entity has no id before).
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLogoFile(null);
    setRemoveLogo(false);
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

  // The picked file's preview, released when it is replaced or the dialog closes.
  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const pickLogo = (file: File | undefined) => {
    if (logoInput.current) logoInput.current.value = "";
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      toast.error("A logo has to be a PNG or JPEG image.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error("That image is over 1 MB. Save a smaller PNG or JPEG and try again.");
      return;
    }
    setLogoFile(file);
    setRemoveLogo(false);
  };

  const shownLogo = logoPreview ?? (removeLogo ? null : (editing?.logo_url ?? null));

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
    let saved: LegalEntity;
    try {
      saved = editing
        ? await patch<LegalEntity>(`/org/legal-entities/${editing.id}`, {
            ...body,
            is_active: values.is_active,
          })
        : await post<LegalEntity>("/org/legal-entities", body);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not save the entity."));
      setIsBusy(false);
      return;
    }
    // The entity is saved. A logo that fails now is said plainly; the dialog
    // still closes, so a second Save cannot create the entity twice.
    try {
      if (logoFile) {
        const form = new FormData();
        form.set("file", logoFile);
        await post(`/org/legal-entities/${saved.id}/logo`, form);
      } else if (removeLogo && editing?.logo_url) {
        await del(`/org/legal-entities/${saved.id}/logo`);
      }
      toast.success(editing ? "Entity updated." : "Entity created.");
    } catch (caught) {
      toast.error(
        `${saved.name} was saved, but the logo was not: ${errorDetail(caught, "the upload failed")}`,
      );
    } finally {
      setIsBusy(false);
    }
    // Their own company's name and logo may be the ones at the top of the navigation.
    void reloadSession();
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.name}` : "Add a legal entity"}</DialogTitle>
          <DialogDescription>
            A company of your group — your own, a sister company, or a client whose staff you
            employ. It has its own payroll run and logo, and files returns under these numbers.
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

          <div className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:col-span-2 sm:flex-row sm:items-center">
            <div className="flex h-16 w-full shrink-0 items-center justify-center rounded-lg border border-border bg-logo-plate p-2 sm:w-40">
              {shownLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shownLogo} alt={`${values.name || "Company"} logo`} className="max-h-full max-w-full object-contain" />
              ) : (
                <ImageIcon className="size-6 text-muted-foreground" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Logo</p>
              <p className="text-xs text-muted-foreground">
                This company&apos;s people see it at the top of the portal and on the app&apos;s Home
                after they sign in. PNG or JPEG, up to 1 MB. Without one, they see the workspace logo.
              </p>
              {logoFile && <p className="mt-1 truncate text-xs text-foreground">{logoFile.name} — saved with the entity</p>}
              {removeLogo && !logoFile && (
                <p className="mt-1 text-xs text-foreground">The logo is removed when you save.</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <HiddenFileInput
                ref={logoInput}
                accept="image/png,image/jpeg"
                onChange={(event) => pickLogo(event.target.files?.[0])}
              />
              <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={() => logoInput.current?.click()}>
                <Upload /> {shownLogo ? "Replace" : "Upload"}
              </Button>
              {shownLogo && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  aria-label="Remove logo"
                  onClick={() => {
                    if (logoFile) setLogoFile(null);
                    else setRemoveLogo(true);
                  }}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          </div>

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
