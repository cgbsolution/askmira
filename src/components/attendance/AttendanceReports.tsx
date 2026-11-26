"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toISODate } from "@/lib/utils";

import { AttendanceExportDialog, type AttendanceExportKind } from "./AttendanceExportDialog";

interface ReportEntry {
  kind: AttendanceExportKind;
  title: string;
  subtitle: string;
}

/**
 * The reports, grouped the way HR knows them from the old HRMS's Reports tab:
 * daily, summary and periodic. Only reports that download real data are
 * listed.
 */
const SECTIONS: { title: string; description: string; reports: ReportEntry[] }[] = [
  {
    title: "Daily reports",
    description: "Punch by punch, day by day.",
    reports: [
      {
        kind: "in_out_activities",
        title: "In Out Activities Report",
        subtitle: "In and out punches from the app, web and biometric devices, in the classic layout",
      },
      {
        kind: "in_out",
        title: "Punch In and Out Report",
        subtitle: "First in and last out per day, with office, street address and Google Maps link",
      },
      {
        kind: "punches",
        title: "Every Punch Report",
        subtitle: "One row per punch with source, place, address and coordinates",
      },
      {
        kind: "daily",
        title: "Daily Detail Attendance Report",
        subtitle: "Status, shift, first in, last out, hours, late, early and overtime per day",
      },
      {
        kind: "visits",
        title: "Field Visits Report",
        subtitle: "Every client visit: who or where, visit in and out with address and Google Maps link, time there",
      },
    ],
  },
  {
    title: "Summary reports",
    description: "One row per person for the period.",
    reports: [
      {
        kind: "monthly_summary",
        title: "Monthly Summary Attendance",
        subtitle: "P, HD, WO, HO, AB, late coming, early going, overtime and hours, in the classic layout",
      },
      {
        kind: "summary",
        title: "Attendance Summary Report",
        subtitle: "Present, half days, absent, leave, holidays, week offs, payable and loss-of-pay days",
      },
    ],
  },
  {
    title: "Periodic reports",
    description: "Month by month, up to a year.",
    reports: [
      {
        kind: "ytd",
        title: "YTD Attendance Report",
        subtitle: "A code for every day of each month, paid days, leave by type, absent, late and early",
      },
    ],
  },
];

/**
 * Attendance → Reports: every attendance download in one place, each opened
 * on its own with its dates and company, project, department and location.
 * HR downloads everyone; a manager, their reporting line.
 */
export function AttendanceReports() {
  const today = useMemo(() => toISODate(new Date()), []);
  const [open, setOpen] = useState<AttendanceExportKind | null>(null);
  const [last, setLast] = useState<AttendanceExportKind>("in_out_activities");

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <Card key={section.title} tier="tier1" className="gap-0 py-0">
            <CardHeader className="border-b py-4">
              <CardTitle className="text-base uppercase tracking-wide">{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y">
                {section.reports.map((report) => (
                  <li key={report.kind}>
                    <Button
                      variant="ghost"
                      className="h-auto w-full items-start justify-between gap-3 whitespace-normal rounded-none px-6 py-3 text-left"
                      onClick={() => {
                        setLast(report.kind);
                        setOpen(report.kind);
                      }}
                    >
                      <span className="grid gap-0.5">
                        <span className="font-medium text-foreground">{report.title}</span>
                        <span className="text-xs font-normal text-muted-foreground">{report.subtitle}</span>
                      </span>
                      <Download className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <span className="sr-only">Download {report.title}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <AttendanceExportDialog
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
        today={today}
        people={null}
        filters={{}}
        scopeText="Everyone you can review, narrowed by the company, project, department and location you pick"
        fixedKind={open ?? last}
        withOrgFilters
      />
    </>
  );
}

