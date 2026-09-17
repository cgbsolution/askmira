"use client";

import { Clock, Loader2, Pencil, Plus } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post, put } from "@/lib/api";
import type { Shift, ShiftCreateInput, ShiftInput, ShiftUpdateInput } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";

import {
  errorDetail,
  LoadError,
  parseWholeNumber,
  shortTime,
  TableSkeleton,
  WEEKDAYS,
} from "./shared";

export function ShiftsTab() {
  const { data, error, isLoading, reload } = useApiQuery<Shift[]>(
    "/attendance/shifts?include_inactive=true",
  );
  const [editing, setEditing] = useState<Shift | "new" | null>(null);
  const shifts = [...(data ?? [])].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.code.localeCompare(b.code),
  );

  return (
    <Card tier="tier1" className="pb-0">
      <CardHeader>
        <CardTitle>Shifts</CardTitle>
        <CardDescription>Working hours, grace periods and the thresholds for a half or full day.</CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus /> New shift
          </Button>
        </CardAction>
      </CardHeader>

      {isLoading ? (
        <div className="pb-5">
          <TableSkeleton />
        </div>
      ) : error ? (
        <LoadError error={error} onRetry={reload} />
      ) : shifts.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No shifts defined"
          description="Create a shift so attendance can be computed against working hours."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Break</TableHead>
              <TableHead>Grace in / out</TableHead>
              <TableHead>Half / full day</TableHead>
              <TableHead>Weekly off</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="pr-5 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.map((shift) => (
              <TableRow key={shift.id} className={cn(!shift.active && "text-muted-foreground")}>
                <TableCell className="pl-5 font-medium">{shift.code}</TableCell>
                <TableCell>{shift.name}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {shortTime(shift.start_time)}–{shortTime(shift.end_time)}
                  {shift.is_night_shift && (
                    <Badge variant="secondary" className="ml-2">
                      Night
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{shift.break_minutes} min</TableCell>
                <TableCell className="tabular-nums">
                  {shift.grace_in_minutes} / {shift.grace_out_minutes} min
                </TableCell>
                <TableCell className="tabular-nums">
                  {shift.half_day_threshold_minutes} / {shift.full_day_threshold_minutes} min
                </TableCell>
                <TableCell>
                  {shift.weekly_off_days.length === 0
                    ? "None"
                    : WEEKDAYS.filter((day) => shift.weekly_off_days.includes(day.iso))
                        .map((day) => day.label)
                        .join(", ")}
                </TableCell>
                <TableCell>
                  <Badge variant={shift.active ? "success" : "muted"}>
                    {shift.active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="pr-5 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(shift)}>
                    <Pencil /> Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ShiftDialog
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
    </Card>
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
}

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
