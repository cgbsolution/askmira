"use client";

import {
  Briefcase,
  CalendarDays,
  CalendarRange,
  Download,
  Fingerprint,
  ListChecks,
  Loader2,
  MapPinned,
  Sigma,
  TableProperties,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { MonthPicker } from "@/components/common/MonthPicker";
import { NONE, fromSelect } from "@/components/people/labels";
import { useOrgReference } from "@/components/people/useOrgReference";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, downloadFile } from "@/lib/api";
import { cn, formatDay, parseISODate, toISODate } from "@/lib/utils";

type Period = "day" | "week" | "month" | "custom" | "fy";
export type AttendanceExportKind =
  | "in_out"
  | "punches"
  | "daily"
  | "summary"
  | "visits"
  | "in_out_activities"
  | "monthly_summary"
  | "ytd";
type Kind = AttendanceExportKind;
type FileType = "xlsx" | "csv";

/** The API's limit on one export; the YTD report may run for a year. */
const MAX_DAYS = 93;
const MAX_YTD_DAYS = 366;

/** The old HRMS's report layouts: Excel only, copied column for column. */
const CLASSIC: Kind[] = ["in_out_activities", "monthly_summary", "ytd"];

export const ATTENDANCE_EXPORTS: {
  value: Kind;
  label: string;
  detail: string;
  icon: React.ElementType;
}[] = [
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
  {
    value: "visits",
    label: "Field visits",
    detail:
      "One row per client visit: who or where, visit in and out times, the street address and a Google Maps link for each, how long they stayed and the location accuracy.",
    icon: Briefcase,
  },
  {
    value: "in_out_activities",
    label: "In Out Activities Report",
    detail:
      "Every punch from the app, web and biometric devices: terminal, location, date, time, the time since the previous punch, punch details, a View Map link and upload time.",
    icon: Fingerprint,
  },
  {
    value: "monthly_summary",
    label: "Monthly Summary Attendance",
    detail:
      "One row per person: shift times, days in month, P, HD, WO, HO, AB, late coming, early going, overtime, and actual against standard working hours.",
    icon: TableProperties,
  },
  {
    value: "ytd",
    label: "YTD Attendance Report",
    detail:
      "One row per person per month: a code for every day (P, HD, ABS, MSP, WO, P/WO, leave type), then present, week-off, paid-holiday and paid days, each leave type, absent, late and early.",
    icon: CalendarDays,
  },
];
const KINDS = ATTENDANCE_EXPORTS.filter(
  (entry) => !CLASSIC.includes(entry.value),
);

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
  return [
    toISODate(new Date(year, month - 1, 1)),
    toISODate(new Date(year, month, 0)),
  ];
}

/** 1 April of the financial year a day falls in, to that day. */
function financialYearOf(iso: string): [string, string] {
  const date = parseISODate(iso);
  const year =
    date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return [toISODate(new Date(year, 3, 1)), iso];
}

function daysBetween(from: string, to: string): number {
  return (
    Math.round(
      (parseISODate(to).getTime() - parseISODate(from).getTime()) / 86_400_000,
    ) + 1
  );
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
  fixedKind,
  withOrgFilters = false,
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
  /** One report only: no layout chooser, and the dialog is named after it. */
  fixedKind?: Kind;
  /** Company, project, department and location choices inside the dialog. */
  withOrgFilters?: boolean;
}) {
  const [company, setCompany] = useState(NONE);
  const [project, setProject] = useState(NONE);
  const [department, setDepartment] = useState(NONE);
  const [location, setLocation] = useState(NONE);
  const [period, setPeriod] = useState<Period>("month");
  const [day, setDay] = useState(today);
  const [weekDay, setWeekDay] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [kind, setKind] = useState<Kind>(fixedKind ?? "in_out");
  const [fileType, setFileType] = useState<FileType>("xlsx");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDay(today);
    setWeekDay(today);
    setMonth(today.slice(0, 7));
    setFrom(today.slice(0, 8) + "01");
    setTo(today);
    if (fixedKind) setKind(fixedKind);
    // A report opened on its own starts on its natural period every time.
    if (fixedKind) setPeriod(fixedKind === "ytd" ? "fy" : "month");
    else setPeriod((current) => (current === "fy" ? "month" : current));
  }, [open, today, fixedKind]);

  const classic = CLASSIC.includes(kind);
  const limit = kind === "ytd" ? MAX_YTD_DAYS : MAX_DAYS;
  const chosenFilters = useMemo(() => {
    if (!withOrgFilters) return filters;
    const chosen: Record<string, string> = { ...filters };
    const pairs: [string, string][] = [
      ["legal_entity_id", company],
      ["project_id", project],
      ["department_id", department],
      ["location_id", location],
    ];
    for (const [key, value] of pairs) {
      const id = fromSelect(value);
      if (id) chosen[key] = id;
    }
    return chosen;
  }, [withOrgFilters, filters, company, project, department, location]);

  const [start, end] = useMemo<[string, string]>(() => {
    if (period === "day") return [day, day];
    if (period === "week") return weekOf(weekDay || today);
    if (period === "month") return monthOf(month || today.slice(0, 7));
    if (period === "fy") return financialYearOf(today);
    return [from, to];
  }, [period, day, weekDay, month, from, to, today]);

  const problem =
    !start || !end
      ? "Pick the dates."
      : end < start
        ? "The last day is before the first."
        : daysBetween(start, end) > limit
          ? kind === "ytd"
            ? "Download at most a year at a time."
            : `Export at most ${MAX_DAYS} days at a time (about three months).`
          : null;
  const chosen = ATTENDANCE_EXPORTS.find((entry) => entry.value === kind)!;
  const asExcel = classic || fileType === "xlsx";

  const download = async () => {
    if (problem) return;
    setBusy(true);
    try {
      await downloadFile(
        "/attendance/export",
        `${classic ? chosen.label : "attendance"}.${asExcel ? "xlsx" : "csv"}`,
        {
          method: "POST",
          body: {
            kind,
            start,
            end,
            file_type: asExcel ? "xlsx" : "csv",
            ...(people ? { employee_ids: people } : chosenFilters),
          },
          timeout: 180_000,
        },
      );
      toast.success(
        `${chosen.label} for ${formatDay(start, true)}${start === end ? "" : ` to ${formatDay(end, true)}`} downloaded.`,
      );
      onOpenChange(false);
    } catch (caught) {
      toast.error(
        caught instanceof ApiError
          ? caught.detail
          : "The attendance could not be exported.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {fixedKind ? chosen.label : "Export attendance"}
          </DialogTitle>
          <DialogDescription>
            {fixedKind
              ? `${chosen.detail} ${scopeText}.`
              : `${scopeText}. Choose the dates and what the file should hold.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="export-period" label="Period">
            <Select
              value={period}
              onValueChange={(value) => setPeriod(value as Period)}
            >
              <SelectTrigger id="export-period" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">One day</SelectItem>
                <SelectItem value="week">A week (Monday to Sunday)</SelectItem>
                <SelectItem value="month">A month</SelectItem>
                <SelectItem value="custom">Custom dates</SelectItem>
                {kind === "ytd" && (
                  <SelectItem value="fy">
                    This financial year to date
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </FormField>

          {period === "day" && (
            <FormField htmlFor="export-day" label="Day">
              <DatePicker
                id="export-day"
                value={day}
                onChange={setDay}
                max={today}
              />
            </FormField>
          )}
          {period === "week" && (
            <FormField htmlFor="export-week" label="Any day in the week">
              <DatePicker
                id="export-week"
                value={weekDay}
                onChange={setWeekDay}
                max={today}
              />
            </FormField>
          )}
          {period === "month" && (
            <FormField htmlFor="export-month" label="Month">
              <MonthPicker
                id="export-month"
                value={month}
                onChange={setMonth}
                max={today.slice(0, 7)}
              />
            </FormField>
          )}
          {period === "custom" && (
            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
              <FormField htmlFor="export-from" label="From">
                <DatePicker
                  id="export-from"
                  value={from}
                  onChange={setFrom}
                  max={today}
                />
              </FormField>
              <FormField htmlFor="export-to" label="To">
                <DatePicker
                  id="export-to"
                  value={to}
                  onChange={setTo}
                  min={from}
                  max={today}
                />
              </FormField>
            </div>
          )}
        </div>

        <p
          className="flex items-center gap-2 text-sm text-muted-foreground"
          aria-live="polite"
        >
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

        {withOrgFilters && !people && (
          <OrgFilterFields
            values={{ company, project, department, location }}
            set={{ setCompany, setProject, setDepartment, setLocation }}
          />
        )}

        {!fixedKind && (
          <div
            className="grid gap-2"
            role="radiogroup"
            aria-label="What to export"
          >
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
                      active &&
                        "border-primary bg-primary/5 ring-1 ring-primary",
                    )}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <Icon className="size-4 text-primary" /> {entry.label}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {entry.detail}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {classic ? (
          <p className="text-xs text-muted-foreground">
            Excel, in the classic report layout. Days not worked out yet (today
            and the days ahead) are never counted as absent; they are counted on
            their own.
          </p>
        ) : (
          <FormField htmlFor="export-file" label="File type">
            <Select
              value={fileType}
              onValueChange={(value) => setFileType(value as FileType)}
            >
              <SelectTrigger id="export-file" className="h-11 w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                <SelectItem value="csv">CSV (.csv)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        )}

        {(kind === "in_out" ||
          kind === "punches" ||
          kind === "visits" ||
          kind === "in_out_activities") && (
          <p className="text-xs text-muted-foreground">
            Addresses come from Google Maps and are kept once found. A large
            first export may leave a few addresses blank; exporting again fills
            them. The map link always works.
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void download()}
            disabled={busy || Boolean(problem)}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            Download {asExcel ? "Excel" : "CSV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Company, project, department and location, for a report opened on its own. */
function OrgFilterFields({
  values: { company, project, department, location },
  set: { setCompany, setProject, setDepartment, setLocation },
}: {
  values: {
    company: string;
    project: string;
    department: string;
    location: string;
  };
  set: {
    setCompany: (value: string) => void;
    setProject: (value: string) => void;
    setDepartment: (value: string) => void;
    setLocation: (value: string) => void;
  };
}) {
  const org = useOrgReference();
  if (
    !org.entities.length &&
    !org.staffedProjects.length &&
    !org.departments.length &&
    !org.locations.length
  ) {
    return null;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {org.entities.length > 0 && (
        <FormField htmlFor="export-company" label="Company">
          <Select value={company} onValueChange={setCompany}>
            <SelectTrigger id="export-company" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All companies</SelectItem>
              {org.entities.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )}
      {org.staffedProjects.length > 0 && (
        <FormField htmlFor="export-project" label="Project">
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger id="export-project" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All projects</SelectItem>
              {org.staffedProjects.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )}
      {org.departments.length > 0 && (
        <FormField htmlFor="export-department" label="Department">
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger id="export-department" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All departments</SelectItem>
              {org.departments.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )}
      {org.locations.length > 0 && (
        <FormField htmlFor="export-location" label="Location">
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger id="export-location" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All locations</SelectItem>
              {org.locations.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )}
    </div>
  );
}
