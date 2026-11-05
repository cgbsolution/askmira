"use client";

import { CalendarRange, Download, Fingerprint, ListChecks, Loader2, MapPinned, Sigma } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { MonthPicker } from "@/components/common/MonthPicker";
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
import { ApiError, downloadFile } from "@/lib/api";
import { cn, formatDay, parseISODate, toISODate } from "@/lib/utils";

type Period = "day" | "week" | "month" | "custom";
type Kind = "in_out" | "punches" | "daily" | "summary";
type FileType = "xlsx" | "csv";

/** The API's limit on one export. */
const MAX_DAYS = 93;

const KINDS: { value: Kind; label: string; detail: string; icon: React.ElementType }[] = [
  {
    value: "in_out",
    label: "Punch in and out",
    detail:
      "One row per person per day: in and out times, the office or how far from it, the street address and a Google Maps link for each, then status and hours.",
    icon: MapPinned,
  },
  {
    value: "punches",
    label: "Every punch",
    detail:
      "One row per punch: time, in or out, app / web / device, place, address, Google Maps link and coordinates.",
    icon: Fingerprint,
  },
  {
    value: "daily",
    label: "Day-wise attendance",
    detail:
      "One row per person per day: status, shift, first in, last out, hours, late, early, overtime, payable day and corrections.",
    icon: ListChecks,
  },
  {
    value: "summary",
    label: "Summary",
    detail:
      "One row per person for the whole period: present, half days, absent, leave, holidays, week offs, late, hours, payable and loss-of-pay days.",
    icon: Sigma,
  },
];

function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Monday to Sunday around a day. */
function weekOf(iso: string): [string, string] {
  const date = parseISODate(iso);
  const monday = addDays(iso, -((date.getDay() + 6) % 7));
  return [monday, addDays(monday, 6)];
}

function monthOf(yyyymm: string): [string, string] {
  const [year, month] = yyyymm.split("-").map(Number);
  return [toISODate(new Date(year, month - 1, 1)), toISODate(new Date(year, month, 0))];
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86_400_000) + 1;
}

/**
 * Attendance review → Export: a day, a week, a month or any dates, in one of
 * four layouts, as Excel or CSV. The screen's company, project, department and
 * location filters apply; ticked people narrow it to them.
 */
export function AttendanceExportDialog({
  open,
  onOpenChange,
  today,
  people,
  filters,
  scopeText,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The workspace's today (YYYY-MM-DD). */
  today: string;
  /** Ticked people's ids; null exports everyone the filters match. */
  people: string[] | null;
  filters: Record<string, string>;
  /** Who is in the file, in words. */
  scopeText: string;
}) {
  const [period, setPeriod] = useState<Period>("month");
  const [day, setDay] = useState(today);
  const [weekDay, setWeekDay] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [kind, setKind] = useState<Kind>("in_out");
  const [fileType, setFileType] = useState<FileType>("xlsx");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDay(today);
    setWeekDay(today);
    setMonth(today.slice(0, 7));
    setFrom(today.slice(0, 8) + "01");
    setTo(today);
  }, [open, today]);

  const [start, end] = useMemo<[string, string]>(() => {
    if (period === "day") return [day, day];
    if (period === "week") return weekOf(weekDay || today);
    if (period === "month") return monthOf(month || today.slice(0, 7));
    return [from, to];
  }, [period, day, weekDay, month, from, to, today]);

  const problem = !start || !end
    ? "Pick the dates."
    : end < start
      ? "The last day is before the first."
      : daysBetween(start, end) > MAX_DAYS
        ? `Export at most ${MAX_DAYS} days at a time (about three months).`
        : null;
  const chosen = KINDS.find((entry) => entry.value === kind)!;

  const download = async () => {
    if (problem) return;
    setBusy(true);
    try {
      await downloadFile("/attendance/export", `attendance.${fileType}`, {
        method: "POST",
        body: {
          kind,
          start,
          end,
          file_type: fileType,
          ...(people ? { employee_ids: people } : filters),
        },
        timeout: 180_000,
      });
      toast.success(`${chosen.label} for ${formatDay(start, true)}${start === end ? "" : ` to ${formatDay(end, true)}`} downloaded.`);
      onOpenChange(false);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The attendance could not be exported.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export attendance</DialogTitle>
          <DialogDescription>{scopeText}. Choose the dates and what the file should hold.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="export-period" label="Period">
            <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
              <SelectTrigger id="export-period" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">One day</SelectItem>
                <SelectItem value="week">A week (Monday to Sunday)</SelectItem>
                <SelectItem value="month">A month</SelectItem>
                <SelectItem value="custom">Custom dates</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          {period === "day" && (
            <FormField htmlFor="export-day" label="Day">
              <DatePicker id="export-day" value={day} onChange={setDay} max={today} />
            </FormField>
          )}
          {period === "week" && (
            <FormField htmlFor="export-week" label="Any day in the week">
              <DatePicker id="export-week" value={weekDay} onChange={setWeekDay} max={today} />
            </FormField>
          )}
          {period === "month" && (
            <FormField htmlFor="export-month" label="Month">
              <MonthPicker id="export-month" value={month} onChange={setMonth} max={today.slice(0, 7)} />
            </FormField>
          )}
          {period === "custom" && (
            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
              <FormField htmlFor="export-from" label="From">
                <DatePicker id="export-from" value={from} onChange={setFrom} max={today} />
              </FormField>
              <FormField htmlFor="export-to" label="To">
                <DatePicker id="export-to" value={to} onChange={setTo} min={from} max={today} />
              </FormField>
            </div>
          )}
        </div>

        <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <CalendarRange className="size-4" />
          {start && end && !problem
            ? `${formatDay(start, true)}${start === end ? "" : ` to ${formatDay(end, true)}`} · ${daysBetween(start, end)} day${daysBetween(start, end) === 1 ? "" : "s"}`
            : null}
        </p>
        {problem && (
          <Alert variant="destructive">
            <AlertDescription>{problem}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-2" role="radiogroup" aria-label="What to export">
          <p className="text-sm font-medium">What to export</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {KINDS.map((entry) => {
              const Icon = entry.icon;
              const active = entry.value === kind;
              return (
                <Button
                  key={entry.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  variant="outline"
                  onClick={() => setKind(entry.value)}
                  className={cn(
                    "h-auto flex-col items-start gap-1 whitespace-normal p-3 text-left",
                    active && "border-primary bg-primary/5 ring-1 ring-primary",
                  )}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Icon className="size-4 text-primary" /> {entry.label}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">{entry.detail}</span>
                </Button>
              );
            })}
          </div>
        </div>

        <FormField htmlFor="export-file" label="File type">
          <Select value={fileType} onValueChange={(value) => setFileType(value as FileType)}>
            <SelectTrigger id="export-file" className="h-11 w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
              <SelectItem value="csv">CSV (.csv)</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        {(kind === "in_out" || kind === "punches") && (
          <p className="text-xs text-muted-foreground">
            Addresses come from Google Maps and are kept once found. A large first export may leave a few
            addresses blank; exporting again fills them. The map link always works.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void download()} disabled={busy || Boolean(problem)}>
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            Download {fileType === "xlsx" ? "Excel" : "CSV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
