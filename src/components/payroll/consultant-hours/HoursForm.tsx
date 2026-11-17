"use client";

import { Loader2, Paperclip, Send, X } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { AttachmentList } from "@/components/payroll/consultant-hours/AttachmentList";
import {
  type DayCell,
  DayGrid,
  cellHours,
  cellValid,
} from "@/components/payroll/consultant-hours/DayGrid";
import {
  ACCEPT,
  daysBetween,
  isWeekend,
  previousMonth,
  sizeText,
} from "@/components/payroll/consultant-hours/labels";
import { apiMessage } from "@/components/payroll/labels";
import type { ProjectRow } from "@/components/time/TimesheetScreen";
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
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import { del, post, put } from "@/lib/api";
import type { ConsultantOption, HoursEntry, HoursPayload } from "@/lib/types/consultant-hours";

const DEFAULT_PROJECT = "__default";

/** Hours as typed: a number from 0 up, at most two decimals. */
const HOURS = /^\d{1,5}(\.\d{1,2})?$/;

/**
 * Enter or fix a consultant's hours: a total or day by day, with the customer's
 * timesheet attached. Saving a draft keeps it; Submit sends it for approval.
 * A draft or rejected entry opens here with `entry` set.
 */
export function HoursForm({
  entry,
  consultants,
  open,
  onOpenChange,
  onSaved,
}: {
  entry: HoursEntry | null;
  /** The consultants the caller may enter hours for. */
  consultants: ConsultantOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the entry as the server now holds it. */
  onSaved: (entry: HoursEntry) => void;
}) {
  const projects = useApiQuery<ProjectRow[]>("/timesheets/projects");
  const initial = useMemo(() => previousMonth(), []);
  const [saved, setSaved] = useState<HoursEntry | null>(entry);
  const [personId, setPersonId] = useState("");
  const [start, setStart] = useState(entry?.period_start ?? initial.start);
  const [end, setEnd] = useState(entry?.period_end ?? initial.end);
  const [projectId, setProjectId] = useState(entry?.project_id ?? DEFAULT_PROJECT);
  const [mode, setMode] = useState<"total" | "days">(entry?.days?.length ? "days" : "total");
  const [total, setTotal] = useState(entry && !entry.days?.length ? entry.total_billable_hours : "");
  const [cellMap, setCellMap] = useState<Record<string, DayCell>>(() =>
    Object.fromEntries(
      (entry?.days ?? []).map((d) => [d.date, { status: d.status, hours: String(d.hours) }]),
    ),
  );
  const [nonBillable, setNonBillable] = useState(entry?.non_billable_hours ?? "");
  const [reference, setReference] = useState(entry?.customer_reference ?? "");
  const [staged, setStaged] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const days = useMemo(() => daysBetween(start, end), [start, end]);
  // A new entry starts with weekends as week-off, as on the customer's sheet.
  const cellFor = (date: string): DayCell =>
    cellMap[date] ?? { status: !entry && isWeekend(date) ? "week_off" : "present", hours: "" };
  const gridTotal = days.reduce((sum, date) => sum + cellHours(cellFor(date)), 0);
  const shownTotal = mode === "days" ? gridTotal : Number(total) || 0;
  const attachmentCount = (saved?.attachments.length ?? 0) + staged.length;
  const employeeId = saved?.employee_id ?? personId;

  const problems: Record<string, string> = {};
  if (!employeeId) problems.person = "Choose the consultant.";
  if (!start || !end) problems.period = "Choose the first and last day.";
  else if (end < start) problems.period = "The period must end on or after the day it starts.";
  else if (days.length === 0) problems.period = "A period can be at most 31 days.";
  if (mode === "total") {
    if (!HOURS.test(total.trim()) || Number(total) <= 0) problems.total = "Hours, more than zero, like 176.";
    else if (days.length && Number(total) > 24 * days.length) problems.total = "That is more than 24 hours a day.";
  } else if (days.some((date) => !cellValid(cellFor(date)))) {
    problems.grid = "Each day takes 0 to 24 hours.";
  } else if (gridTotal <= 0) {
    problems.grid = "Enter the hours for at least one day.";
  }
  if (nonBillable !== "" && !HOURS.test(String(nonBillable).trim())) problems.nonBillable = "Hours, like 8.";

  const payload = (): HoursPayload => {
    const gridDays = days
      .map((date) => ({ date, cell: cellFor(date) }))
      .filter(({ cell }) => cell.hours.trim() !== "" || cell.status !== "present")
      .map(({ date, cell }) => ({ date, status: cell.status, hours: cellHours(cell) }));
    return {
      employee_id: employeeId,
      period_start: start,
      period_end: end,
      project_id: projectId === DEFAULT_PROJECT ? null : projectId,
      ...(mode === "total" ? { total_billable_hours: Number(total) } : {}),
      non_billable_hours: String(nonBillable).trim() === "" ? null : Number(nonBillable),
      days: mode === "days" ? gridDays : null,
      customer_reference: reference.trim() || null,
    };
  };

  /** Save the entry and upload the files chosen so far; returns the entry as it now stands. */
  const persist = async (): Promise<HoursEntry | null> => {
    setSubmitted(true);
    if (Object.keys(problems).length) return null;
    setError(null);
    let current: HoursEntry;
    try {
      current = saved
        ? await put<HoursEntry>(`/consultant-hours/${saved.id}`, payload())
        : await post<HoursEntry>("/consultant-hours", payload());
    } catch (caught) {
      setError(apiMessage(caught, "The hours could not be saved."));
      return null;
    }
    setSaved(current);
    for (const file of [...staged]) {
      try {
        const form = new FormData();
        form.append("file", file);
        current = await post<HoursEntry>(`/consultant-hours/${current.id}/attachments`, form, {
          timeout: 120_000,
        });
        setSaved(current);
        setStaged((list) => list.filter((f) => f !== file));
      } catch (caught) {
        setError(`${file.name}: ${apiMessage(caught, "The file could not be uploaded.")}`);
        onSaved(current);
        return null;
      }
    }
    return current;
  };

  const saveDraft = async () => {
    setBusy(true);
    try {
      const current = await persist();
      if (!current) return;
      toast.success("Draft saved.");
      onSaved(current);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const current = await persist();
      if (!current) return;
      try {
        const sent = await post<HoursEntry>(`/consultant-hours/${current.id}/submit`);
        toast.success("Sent for approval.");
        onSaved(sent);
        onOpenChange(false);
      } catch (caught) {
        setError(apiMessage(caught, "The hours could not be submitted."));
        onSaved(current);
      }
    } finally {
      setBusy(false);
    }
  };

  const removeSaved = async (attachmentId: string) => {
    if (!saved) return;
    try {
      setSaved(await del<HoursEntry>(`/consultant-hours/${saved.id}/attachments/${attachmentId}`));
    } catch (caught) {
      setError(apiMessage(caught, "The file could not be removed."));
    }
  };

  const fieldError = (key: string) => (submitted ? problems[key] : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit hours" : "Enter hours"}</DialogTitle>
          <DialogDescription>
            Billable hours for the period, from the customer&apos;s timesheet. A second person approves them.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {entry?.status === "rejected" && entry.decision_note && (
            <Alert variant="warning">
              <AlertDescription>Rejected: {entry.decision_note}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField htmlFor="hours-person" label="Consultant" required error={fieldError("person")}>
              {saved ? (
                <p className="text-sm font-medium">
                  {saved.employee_name}
                  {saved.employee_code && <span className="text-muted-foreground"> · {saved.employee_code}</span>}
                </p>
              ) : (
                <Select value={personId} onValueChange={setPersonId}>
                  <SelectTrigger id="hours-person" className="w-full" aria-invalid={Boolean(fieldError("person"))}>
                    <SelectValue placeholder="Choose a consultant" />
                  </SelectTrigger>
                  <SelectContent>
                    {consultants.map((c) => (
                      <SelectItem key={c.employee_id} value={c.employee_id}>
                        {c.name} · {c.code}
                        {c.project && <span className="text-muted-foreground"> · {c.project}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField htmlFor="hours-project" label="Project" optional hint="Without one, their current project.">
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="hours-project" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_PROJECT}>Their current project</SelectItem>
                  {(projects.data ?? [])
                    .filter((p) => p.active || p.id === projectId)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="hours-start" label="Period starts" required error={fieldError("period")}>
              <DatePicker id="hours-start" value={start} onChange={setStart} required invalid={Boolean(fieldError("period"))} />
            </FormField>
            <FormField htmlFor="hours-end" label="Period ends" required>
              <DatePicker id="hours-end" value={end} onChange={setEnd} required invalid={Boolean(fieldError("period"))} />
            </FormField>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2" role="group" aria-label="How to enter the hours">
              <Button type="button" size="sm" variant={mode === "total" ? "default" : "outline"} onClick={() => setMode("total")}>
                Total
              </Button>
              <Button type="button" size="sm" variant={mode === "days" ? "default" : "outline"} onClick={() => setMode("days")}>
                Day by day
              </Button>
            </div>
            <p className="text-sm">
              Billable hours: <span className="font-semibold tabular-nums">{Math.round(shownTotal * 100) / 100}</span>
            </p>
          </div>

          {mode === "total" ? (
            <FormField htmlFor="hours-total" label="Billable hours in the period" required error={fieldError("total")}>
              <Input
                id="hours-total"
                inputMode="decimal"
                placeholder="e.g. 176"
                value={total}
                aria-invalid={Boolean(fieldError("total"))}
                onChange={(event) => setTotal(event.target.value)}
              />
            </FormField>
          ) : (
            <div className="grid gap-2">
              <DayGrid days={days} cells={cellFor} onChange={(date, cell) => setCellMap((m) => ({ ...m, [date]: cell }))} />
              {fieldError("grid") && <p className="text-sm text-destructive">{fieldError("grid")}</p>}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <FormField htmlFor="hours-nonbillable" label="Non-billable hours" optional hint="Recorded only; never paid." error={fieldError("nonBillable")}>
              <Input
                id="hours-nonbillable"
                inputMode="decimal"
                value={nonBillable}
                aria-invalid={Boolean(fieldError("nonBillable"))}
                onChange={(event) => setNonBillable(event.target.value)}
              />
            </FormField>
            <FormField htmlFor="hours-reference" label="Customer reference" optional hint="For example the customer's timesheet or approval number.">
              <Input id="hours-reference" maxLength={120} value={reference} onChange={(event) => setReference(event.target.value)} />
            </FormField>
          </div>

          <FormField
            htmlFor="hours-file"
            label="Customer's timesheet"
            hint="Excel, CSV, PDF, PNG or JPG. Needed before you can submit."
          >
            <div className="grid gap-2">
              {saved && <AttachmentList entry={saved} onRemove={(id) => void removeSaved(id)} />}
              {staged.map((file) => (
                <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-2 rounded-md border border-dashed border-border px-3 py-1.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{sizeText(file.size)} · uploads when you save</span>
                  </span>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${file.name}`} onClick={() => setStaged((list) => list.filter((f) => f !== file))}>
                    <X />
                  </Button>
                </div>
              ))}
              <FileInput
                id="hours-file"
                accept={ACCEPT}
                multiple
                file={null}
                buttonLabel="Add a file"
                placeholder="Excel, CSV, PDF or an image"
                onChange={(event) => {
                  const picked = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  if (picked.length) setStaged((list) => [...list, ...picked]);
                }}
              />
            </div>
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void saveDraft()}>
            Save draft
          </Button>
          <Button disabled={busy || attachmentCount === 0} onClick={() => void submit()}>
            {busy ? <Loader2 className="animate-spin" /> : <Send />} Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
