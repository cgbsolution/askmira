"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Clock, Loader2, Pencil, Plus } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import { useOrgReference } from "@/components/people/useOrgReference";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post, put, type ApiError } from "@/lib/api";
import type { Shift, ShiftCreateInput, ShiftInput, ShiftUpdateInput } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";

import { errorDetail, parseWholeNumber, shortTime, WEEKDAYS } from "./shared";

/**
 * LoadError's words, split the way DataTable takes them: a 403 is said as a
 * lack of access and offers no retry, since trying again cannot fix it.
 */
export function loadErrorProps(
  error: ApiError | null,
  onRetry: () => void,
): { error: string | null; onRetry?: () => void } {
  if (!error) return { error: null, onRetry };
  if (error.status === 403) {
    return {
      error: `You don't have access to this. ${error.detail} If you think you should, ask your admin to check your role.`,
    };
  }
  return { error: error.detail, onRetry };
}

export function ShiftsTab() {
  const { data, error, isLoading, reload } = useApiQuery<Shift[]>(
    "/attendance/shifts?include_inactive=true",
  );
  const [editing, setEditing] = useState<Shift | "new" | null>(null);
  const [defaulting, setDefaulting] = useState<string | null>(null);
  const org = useOrgReference();
  const shifts = [...(data ?? [])].sort(
    (a, b) =>
      Number(b.is_default) - Number(a.is_default) ||
      Number(b.active) - Number(a.active) ||
      a.code.localeCompare(b.code),
  );
  const hasDefault = shifts.some((shift) => shift.is_default && shift.active);

  const makeDefault = async (shift: Shift) => {
    setDefaulting(shift.id);
    try {
      await post<Shift>(`/attendance/shifts/${shift.id}/default`);
      toast.success(`${shift.name} is now the default shift`, {
        description: "It applies to anyone without a shift or roster. Recompute a period to re-judge days already computed.",
      });
      reload();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not change the default shift."));
    } finally {
      setDefaulting(null);
    }
  };

  const site = (shift: Shift) =>
    [shift.location_id ? org.locationName(shift.location_id) : null, shift.work_area]
      .filter(Boolean)
      .join(" · ");
  const hours = (shift: Shift) => `${shortTime(shift.start_time)}–${shortTime(shift.end_time)}`;

  const columns: ColumnDef<Shift>[] = [
    { accessorKey: "code", header: "Code", meta: { cellClassName: "font-medium" } },
    {
      accessorKey: "name",
      header: "Name",
      meta: {
        text: (shift) =>
          [shift.name, site(shift), shift.is_default ? "Default" : null].filter(Boolean).join(" · "),
      },
      cell: ({ row: { original: shift } }) => (
        <>
          {shift.name}
          {(shift.work_area || shift.location_id) && (
            <span className="block text-xs text-muted-foreground">{site(shift)}</span>
          )}
          {shift.is_default && (
            <Badge variant="success" className="ml-2">
              Default
            </Badge>
          )}
        </>
      ),
    },
    {
      id: "hours",
      header: "Hours",
      accessorFn: hours,
      meta: {
        cellClassName: "whitespace-nowrap tabular-nums",
        text: (shift) => `${hours(shift)}${shift.is_night_shift ? " Night" : ""}`,
      },
      cell: ({ row: { original: shift } }) => (
        <>
          {hours(shift)}
          {shift.is_night_shift && (
            <Badge variant="secondary" className="ml-2">
              Night
            </Badge>
          )}
        </>
      ),
    },
    {
      id: "break",
      header: "Break",
      accessorFn: (shift) => `${shift.break_minutes} min`,
      sortingFn: "alphanumeric",
      meta: { cellClassName: "tabular-nums" },
    },
    {
      id: "grace",
      header: "Grace in / out",
      accessorFn: (shift) => `${shift.grace_in_minutes} / ${shift.grace_out_minutes} min`,
      sortingFn: "alphanumeric",
      meta: { cellClassName: "tabular-nums" },
    },
    {
      id: "thresholds",
      header: "Half / full day",
      accessorFn: (shift) => `${shift.half_day_threshold_minutes} / ${shift.full_day_threshold_minutes} min`,
      sortingFn: "alphanumeric",
      meta: { cellClassName: "tabular-nums" },
    },
    {
      id: "weekly_off",
      header: "Weekly off",
      accessorFn: (shift) =>
        shift.weekly_off_days.length === 0
          ? "None"
          : WEEKDAYS.filter((day) => shift.weekly_off_days.includes(day.iso))
              .map((day) => day.label)
              .join(", "),
    },
    {
      id: "state",
      header: "State",
      accessorFn: (shift) => (shift.active ? "Active" : "Inactive"),
      cell: ({ row }) => (
        <Badge variant={row.original.active ? "success" : "muted"}>
          {row.original.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableHiding: false,
      meta: { className: "text-right", cellClassName: "whitespace-nowrap", text: false },
      cell: ({ row: { original: shift } }) => (
        <>
          {!shift.is_default && shift.active && (
            <Button
              variant="ghost"
              size="sm"
              disabled={defaulting !== null}
              onClick={() => void makeDefault(shift)}
            >
              {defaulting === shift.id && <Loader2 className="animate-spin" />}
              Make default
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setEditing(shift)}>
            <Pencil /> Edit
          </Button>
        </>
      ),
    },
  ];

  return (
    <>
      <DataTable
        tier="tier1"
        title="Shifts"
        description="Working hours, grace periods and the thresholds for a half or full day."
        actions={
          <Button size="sm" className="h-9" onClick={() => setEditing("new")}>
            <Plus /> New shift
          </Button>
        }
        // Under the header, where the card showed it before.
        tabs={
          !isLoading &&
          !error &&
          shifts.length > 0 &&
          !hasDefault && (
            <Alert variant="warning">
              <AlertDescription>
                No default shift. Anyone without a shift or roster assignment cannot be judged present
                or absent — their days show as needing regularisation. Make one shift the default.
              </AlertDescription>
            </Alert>
          )
        }
        columns={columns}
        data={shifts}
        noun="shifts"
        searchPlaceholder="Search shifts"
        rowClassName={(shift) => cn(!shift.active && "text-muted-foreground")}
        isLoading={isLoading && !data}
        loadingRows={4}
        {...loadErrorProps(error, reload)}
        empty={{
          icon: Clock,
          title: "No shifts defined",
          description:
            "Create a shift so attendance can be computed against working hours. The first shift you create becomes the company default for everyone without an assignment.",
        }}
      />

      <ShiftDialog
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
    </>
  );
}

interface ShiftForm {
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: string;
  grace_in_minutes: string;
  grace_out_minutes: string;
  half_day_threshold_minutes: string;
  full_day_threshold_minutes: string;
  is_night_shift: boolean;
  weekly_off_days: number[];
  active: boolean;
  allowance_per_day: string;
  allowance_name: string;
  min_headcount: string;
  required_course_ids: string[];
  location_id: string;
  work_area: string;
}

const ANY_SITE = "__any_site";

const EMPTY_FORM: ShiftForm = {
  code: "",
  name: "",
  start_time: "",
  end_time: "",
  break_minutes: "0",
  grace_in_minutes: "0",
  grace_out_minutes: "0",
  half_day_threshold_minutes: "",
  full_day_threshold_minutes: "",
  is_night_shift: false,
  weekly_off_days: [],
  active: true,
  allowance_per_day: "",
  allowance_name: "",
  min_headcount: "",
  required_course_ids: [],
  location_id: ANY_SITE,
  work_area: "",
};

const NUMBER_FIELDS: { key: keyof ShiftForm; label: string }[] = [
  { key: "break_minutes", label: "Break (min)" },
  { key: "grace_in_minutes", label: "Grace in (min)" },
  { key: "grace_out_minutes", label: "Grace out (min)" },
  { key: "half_day_threshold_minutes", label: "Half day after (min worked)" },
  { key: "full_day_threshold_minutes", label: "Full day after (min worked)" },
];

function validate(form: ShiftForm, isCreate: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  if (isCreate && !form.code.trim()) errors.code = "A code is required.";
  if (!form.name.trim()) errors.name = "A name is required.";
  if (!form.start_time) errors.start_time = "A start time is required.";
  if (!form.end_time) errors.end_time = "An end time is required.";
  if (form.allowance_per_day.trim() && !/^\d+(\.\d{1,2})?$/.test(form.allowance_per_day.trim())) {
    errors.allowance_per_day = "Enter rupees, like 150 or 150.50 — or leave it empty.";
  }
  if (form.min_headcount.trim() && !/^[1-9]\d{0,5}$/.test(form.min_headcount.trim())) {
    errors.min_headcount = "A whole number of people, 1 or more — or leave it empty.";
  }
  for (const field of NUMBER_FIELDS) {
    const value = parseWholeNumber(form[field.key] as string);
    if (value === null) errors[field.key] = "Enter whole minutes (0 or more).";
  }
  const half = parseWholeNumber(form.half_day_threshold_minutes);
  const full = parseWholeNumber(form.full_day_threshold_minutes);
  if (full !== null && full === 0) errors.full_day_threshold_minutes = "Must be more than 0.";
  if (half !== null && full !== null && half > full) {
    errors.half_day_threshold_minutes = "Cannot be more than the full-day threshold.";
  }
  if (
    form.start_time &&
    form.end_time &&
    form.end_time <= form.start_time &&
    !form.is_night_shift
  ) {
    errors.end_time = "Ends before it starts — switch on Night shift if it crosses midnight.";
  }
  return errors;
}

function ShiftDialog({
  target,
  onClose,
  onSaved,
}: {
  target: Shift | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isCreate = target === "new";
  const [form, setForm] = useState<ShiftForm>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const courses = useApiQuery<{ id: string; title: string; active: boolean }[]>(target ? "/learning/courses" : null);
  const org = useOrgReference();

  useEffect(() => {
    if (target === null) return;
    setSubmitted(false);
    setServerError(null);
    if (target === "new") {
      setForm(EMPTY_FORM);
      return;
    }
    setForm({
      code: target.code,
      name: target.name,
      start_time: shortTime(target.start_time),
      end_time: shortTime(target.end_time),
      break_minutes: String(target.break_minutes),
      grace_in_minutes: String(target.grace_in_minutes),
      grace_out_minutes: String(target.grace_out_minutes),
      half_day_threshold_minutes: String(target.half_day_threshold_minutes),
      full_day_threshold_minutes: String(target.full_day_threshold_minutes),
      is_night_shift: target.is_night_shift,
      weekly_off_days: [...target.weekly_off_days],
      active: target.active,
      allowance_per_day: target.allowance_per_day ?? "",
      allowance_name: target.allowance_name ?? "",
      min_headcount: target.min_headcount ? String(target.min_headcount) : "",
      required_course_ids: target.required_course_ids ?? [],
      location_id: target.location_id ?? ANY_SITE,
      work_area: target.work_area ?? "",
    });
  }, [target]);

  const errors = validate(form, isCreate);
  const shown = submitted ? errors : {};
  const set = <K extends keyof ShiftForm>(key: K, value: ShiftForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSubmitted(true);
    if (target === null || Object.keys(errors).length > 0) return;
    const base: ShiftInput = {
      name: form.name.trim(),
      start_time: form.start_time,
      end_time: form.end_time,
      break_minutes: Number(form.break_minutes),
      grace_in_minutes: Number(form.grace_in_minutes),
      grace_out_minutes: Number(form.grace_out_minutes),
      half_day_threshold_minutes: Number(form.half_day_threshold_minutes),
      full_day_threshold_minutes: Number(form.full_day_threshold_minutes),
      is_night_shift: form.is_night_shift,
      weekly_off_days: [...form.weekly_off_days].sort((a, b) => a - b),
      allowance_per_day: form.allowance_per_day.trim() || null,
      allowance_name: form.allowance_name.trim() || null,
      min_headcount: form.min_headcount.trim() ? Number(form.min_headcount.trim()) : null,
      required_course_ids: form.required_course_ids,
      location_id: form.location_id === ANY_SITE ? null : form.location_id,
      work_area: form.work_area.trim() || null,
    };
    setIsSaving(true);
    setServerError(null);
    try {
      if (target === "new") {
        const body: ShiftCreateInput = { ...base, code: form.code.trim() };
        const created = await post<Shift>("/attendance/shifts", body);
        toast.success(`Shift ${created.code} created`);
      } else {
        const body: ShiftUpdateInput = { ...base, active: form.active };
        const updated = await put<Shift>(`/attendance/shifts/${target.id}`, body);
        toast.success(`Shift ${updated.code} saved`);
      }
      onSaved();
    } catch (caught) {
      setServerError(errorDetail(caught, "Could not save the shift."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isCreate ? "New shift" : `Edit shift ${form.code}`}</DialogTitle>
          <DialogDescription>
            Thresholds are minutes worked: below the half-day threshold the day is absent, from it a
            half day, from the full-day threshold a full day.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field id="shift-code" label="Code" error={shown.code}>
              <Input
                id="shift-code"
                value={form.code}
                maxLength={20}
                disabled={!isCreate}
                aria-invalid={Boolean(shown.code)}
                onChange={(event) => set("code", event.target.value)}
                placeholder="GEN"
              />
            </Field>
            <Field id="shift-name" label="Name" error={shown.name} className="sm:col-span-2">
              <Input
                id="shift-name"
                value={form.name}
                maxLength={100}
                aria-invalid={Boolean(shown.name)}
                onChange={(event) => set("name", event.target.value)}
                placeholder="General shift"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field id="shift-start" label="Starts" error={shown.start_time}>
              <Input
                id="shift-start"
                type="time"
                value={form.start_time}
                aria-invalid={Boolean(shown.start_time)}
                onChange={(event) => set("start_time", event.target.value)}
              />
            </Field>
            <Field id="shift-end" label="Ends" error={shown.end_time}>
              <Input
                id="shift-end"
                type="time"
                value={form.end_time}
                aria-invalid={Boolean(shown.end_time)}
                onChange={(event) => set("end_time", event.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {NUMBER_FIELDS.map((field) => (
              <Field key={field.key} id={`shift-${field.key}`} label={field.label} error={shown[field.key]}>
                <Input
                  id={`shift-${field.key}`}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  className="tabular-nums"
                  value={form[field.key] as string}
                  aria-invalid={Boolean(shown[field.key])}
                  onChange={(event) => set(field.key, event.target.value)}
                />
              </Field>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field id="shift-allowance" label="Shift allowance a day (₹)" error={shown.allowance_per_day}>
              <Input
                id="shift-allowance"
                inputMode="decimal"
                className="tabular-nums"
                placeholder="None"
                value={form.allowance_per_day}
                aria-invalid={Boolean(shown.allowance_per_day)}
                onChange={(event) => set("allowance_per_day", event.target.value)}
              />
            </Field>
            <Field id="shift-allowance-name" label="Shown on the payslip as">
              <Input
                id="shift-allowance-name"
                maxLength={128}
                placeholder={form.name ? `${form.name} allowance` : "Night shift allowance"}
                value={form.allowance_name}
                onChange={(event) => set("allowance_name", event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="shift-site" label="Plant or site">
              <Select value={form.location_id} onValueChange={(value) => set("location_id", value)}>
                <SelectTrigger id="shift-site" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_SITE}>Any location</SelectItem>
                  {org.locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="shift-area" label="Line or area">
              <Input
                id="shift-area"
                maxLength={80}
                placeholder="Line 2, Packing…"
                value={form.work_area}
                onChange={(event) => set("work_area", event.target.value)}
              />
            </Field>
          </div>
          {form.location_id !== ANY_SITE && (
            <p className="-mt-2 text-xs text-muted-foreground">Only people based at this site can be rostered on it.</p>
          )}

          <Field id="shift-min-headcount" label="Fewest people needed (for coverage)" error={shown.min_headcount}>
            <Input
              id="shift-min-headcount"
              inputMode="numeric"
              className="tabular-nums"
              placeholder="No minimum"
              value={form.min_headcount}
              aria-invalid={Boolean(shown.min_headcount)}
              onChange={(event) => set("min_headcount", event.target.value)}
            />
          </Field>

          {(courses.data ?? []).length > 0 && (
            <fieldset className="grid gap-1.5">
              <legend className="mb-1 text-sm font-medium">Courses needed to work it</legend>
              <p className="text-xs text-muted-foreground">
                Nobody is assigned this shift, or swapped onto it, without these completed and in date.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {(courses.data ?? []).map((course) => (
                  <div key={course.id} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`shift-course-${course.id}`}
                      checked={form.required_course_ids.includes(course.id)}
                      onCheckedChange={(on) =>
                        set(
                          "required_course_ids",
                          on
                            ? [...form.required_course_ids, course.id]
                            : form.required_course_ids.filter((id) => id !== course.id),
                        )
                      }
                    />
                    <Label htmlFor={`shift-course-${course.id}`} className="font-normal">
                      {course.title}
                    </Label>
                  </div>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
            <div>
              <Label htmlFor="shift-night">Night shift</Label>
              <p className="text-xs text-muted-foreground">Crosses midnight; punches count to the start date.</p>
            </div>
            <Switch
              id="shift-night"
              checked={form.is_night_shift}
              onCheckedChange={(checked) => set("is_night_shift", checked)}
            />
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Weekly off days</legend>
            <div className="flex flex-wrap gap-3">
              {WEEKDAYS.map((day) => {
                const checked = form.weekly_off_days.includes(day.iso);
                return (
                  <div key={day.iso} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`shift-off-${day.iso}`}
                      checked={checked}
                      onCheckedChange={(next) =>
                        set(
                          "weekly_off_days",
                          next === true
                            ? [...form.weekly_off_days, day.iso]
                            : form.weekly_off_days.filter((iso) => iso !== day.iso),
                        )
                      }
                    />
                    <Label htmlFor={`shift-off-${day.iso}`} className="font-normal">
                      {day.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          </fieldset>

          {!isCreate && (
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="shift-active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  An inactive shift cannot be newly assigned; past days keep it.
                </p>
              </div>
              <Switch
                id="shift-active"
                checked={form.active}
                onCheckedChange={(checked) => set("active", checked)}
              />
            </div>
          )}

          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isSaving} onClick={() => void save()}>
            {isSaving && <Loader2 className="animate-spin" />}
            {isCreate ? "Create shift" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
