"use client";

import { BookOpen, CalendarClock, Download, FileBarChart, Loader2, Play, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, downloadFile, post } from "@/lib/api";
import type { Catalogue, ReportCadence, ReportResult, ReportSchedule, SavedReport, Starter } from "@/lib/types/reports";
import { formatDateTime } from "@/lib/utils";

import { ReportBuilder } from "./ReportBuilder";
import { ReportResultTable } from "./ReportResultTable";

function detail(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Reports.
 *
 * Every role can build reports; what a report *returns* depends on who runs it.
 * A saved report always runs as the person opening it, never as its author, so
 * sharing a salary report with a manager shares the question and not the
 * salaries.
 */
export function ReportsScreen() {
  const [tab, setTab] = useState("library");
  const catalogue = useApiQuery<Catalogue>("/reports/catalogue");
  const reports = useApiQuery<SavedReport[]>("/reports");

  return (
    <PageShell title="Reports" description="Ready-made questions, your saved reports, and a builder for your own.">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="mine">Saved reports</TabsTrigger>
          <TabsTrigger value="build">Build</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
        </TabsList>
        <TabsContent value="library" className="mt-4">
          <LibraryTab
            onCloned={() => {
              reports.reload();
              setTab("mine");
            }}
          />
        </TabsContent>
        <TabsContent value="mine" className="mt-4">
          <SavedTab reports={reports} />
        </TabsContent>
        <TabsContent value="build" className="mt-4">
          {catalogue.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : catalogue.error ? (
            <ErrorState message={catalogue.error.detail} onRetry={catalogue.reload} />
          ) : catalogue.data ? (
            <ReportBuilder catalogue={catalogue.data} onSaved={reports.reload} />
          ) : null}
        </TabsContent>
        <TabsContent value="schedules" className="mt-4">
          <SchedulesTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function LibraryTab({ onCloned }: { onCloned: () => void }) {
  const { data, error, isLoading, reload } = useApiQuery<Starter[]>("/reports/starters");
  const [busy, setBusy] = useState<string | null>(null);

  const byCategory = useMemo(() => {
    const groups = new Map<string, Starter[]>();
    for (const starter of data ?? []) {
      groups.set(starter.category, [...(groups.get(starter.category) ?? []), starter]);
    }
    return [...groups.entries()];
  }, [data]);

  const clone = async (starter: Starter) => {
    setBusy(starter.key);
    try {
      await post("/reports/starters/clone", { starter_key: starter.key });
      toast.success(`${starter.name} added to your saved reports.`);
      onCloned();
    } catch (caught) {
      toast.error(detail(caught, "Could not add the report."));
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error) return <ErrorState message={error.detail} onRetry={reload} />;

  return (
    <div className="grid gap-6">
      <p className="text-sm text-muted-foreground">Only reports your role can actually run are listed.</p>
      {byCategory.map(([category, starters]) => (
        <section key={category} className="grid gap-3">
          <h2 className="text-sm font-semibold text-foreground capitalize">{category.replaceAll("_", " ")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {starters.map((starter) => (
              <Card key={starter.key} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base">{starter.name}</CardTitle>
                  <CardDescription>{starter.question}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 text-sm text-muted-foreground">{starter.description}</CardContent>
                <CardFooter className="flex items-center justify-between gap-2">
                  {starter.required_sensitivity !== "public" && (
                    <Badge variant="warning">{starter.required_sensitivity === "payroll_only" ? "Payroll data" : "HR data"}</Badge>
                  )}
                  <Button size="sm" variant="outline" className="ml-auto" disabled={busy !== null} onClick={() => clone(starter)}>
                    {busy === starter.key ? <Loader2 className="animate-spin" /> : <BookOpen />} Use this
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SavedTab({ reports }: { reports: ReturnType<typeof useApiQuery<SavedReport[]>> }) {
  const { user } = useAuth();
  const [running, setRunning] = useState<SavedReport | null>(null);
  const [deleting, setDeleting] = useState<SavedReport | null>(null);
  const [scheduling, setScheduling] = useState<SavedReport | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const exportCsv = async (report: SavedReport) => {
    setExporting(report.id);
    try {
      await downloadFile(`/reports/${report.id}/export?export_format=csv`, `${report.name}.csv`);
    } catch (caught) {
      // A 202 means it is too large to download and will be sent instead.
      toast[caught instanceof ApiError && caught.status === 202 ? "info" : "error"](detail(caught, "The export failed."));
    } finally {
      setExporting(null);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await del(`/reports/${deleting.id}`);
      toast.success("Report deleted.");
      reports.reload();
    } catch (caught) {
      toast.error(detail(caught, "Could not delete the report."));
      throw caught;
    }
  };

  return (
    <>
      <DataPanel
        title="Saved reports"
        isLoading={reports.isLoading}
        error={reports.error?.detail ?? null}
        onRetry={reports.reload}
        isEmpty={(reports.data ?? []).length === 0}
        empty={{ icon: FileBarChart, title: "No saved reports", description: "Start from the library or build your own." }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Report</TableHead>
              <TableHead>Shared with</TableHead>
              <TableHead>Last run</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(reports.data ?? []).map((report) => {
              const mine = report.owner_user_id === user?.id;
              return (
                <TableRow key={report.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{report.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {report.description ?? report.entity_key.replaceAll("_", " ")}
                      {!mine && " · shared with you"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm capitalize">
                    {report.visibility === "tenant" ? "Everyone" : report.visibility === "shared" ? "Named people" : "Only me"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{report.last_run_at ? formatDateTime(report.last_run_at) : "Never"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" onClick={() => setRunning(report)}>
                        <Play /> Run
                      </Button>
                      <Button size="sm" variant="outline" disabled={exporting === report.id} onClick={() => exportCsv(report)}>
                        {exporting === report.id ? <Loader2 className="animate-spin" /> : <Download />} CSV
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setScheduling(report)}>
                        <CalendarClock /> Schedule
                      </Button>
                      {mine && (
                        <Button size="sm" variant="ghost" aria-label={`Delete ${report.name}`} onClick={() => setDeleting(report)}>
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DataPanel>

      <RunSheet report={running} onOpenChange={(open) => !open && setRunning(null)} />
      <ScheduleDialog report={scheduling} onOpenChange={(open) => !open && setScheduling(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ""}?`}
        description="Its schedules stop too. Past runs stay in the activity log."
        confirmLabel="Delete report"
        destructive
        onConfirm={remove}
      />
    </>
  );
}

function RunSheet({ report, onOpenChange }: { report: SavedReport | null; onOpenChange: (open: boolean) => void }) {
  const { data, error, isLoading, reload } = useApiQuery<ReportResult>(report ? `/reports/${report.id}/run` : null);

  return (
    <Sheet open={report !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle>{report?.name}</SheetTitle>
          <SheetDescription>Run as you — you see only what your role allows, whoever built it.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : error ? (
            <ErrorState message={error.detail} onRetry={reload} />
          ) : data ? (
            <ReportResultTable result={data} />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ScheduleDialog({ report, onOpenChange }: { report: SavedReport | null; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const [cadence, setCadence] = useState<ReportCadence>("weekly");
  const [hour, setHour] = useState("9");
  const [day, setDay] = useState("0");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [skipEmpty, setSkipEmpty] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!report) return;
    setCadence("weekly");
    setHour("9");
    setDay("0");
    setDayOfMonth("1");
    setSkipEmpty(false);
  }, [report]);

  const submit = async () => {
    if (!report || !user) return;
    setIsBusy(true);
    try {
      await post("/reports/schedules", {
        report_id: report.id,
        cadence,
        hour_of_day: Number(hour),
        day_of_week: cadence === "weekly" ? Number(day) : null,
        day_of_month: cadence === "monthly" || cadence === "quarterly" ? Number(dayOfMonth) : null,
        timezone_name: "Asia/Kolkata",
        recipient_user_ids: [user.id],
        export_format: "csv",
        on_empty: skipEmpty ? "skip" : "send_anyway",
      });
      toast.success("Scheduled. It is sent to you as a CSV.");
      onOpenChange(false);
    } catch (caught) {
      toast.error(detail(caught, "Could not schedule the report."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={report !== null} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule {report?.name}</DialogTitle>
          <DialogDescription>Delivered to you by email, run as you at the time it sends.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="schedule-cadence" label="How often">
            <Select value={cadence} onValueChange={(next) => setCadence(next as ReportCadence)}>
              <SelectTrigger id="schedule-cadence" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Every day</SelectItem>
                <SelectItem value="weekly">Every week</SelectItem>
                <SelectItem value="monthly">Every month</SelectItem>
                <SelectItem value="quarterly">Every quarter</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {cadence === "weekly" && (
            <FormField htmlFor="schedule-day" label="On">
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger id="schedule-day" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((name, index) => (
                    <SelectItem key={name} value={String(index)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
          {(cadence === "monthly" || cadence === "quarterly") && (
            <FormField htmlFor="schedule-dom" label="Day of the month" hint="Past the month's end, it runs on the last day.">
              <Input id="schedule-dom" inputMode="numeric" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value.replace(/\D/g, "").slice(0, 2))} />
            </FormField>
          )}
          <FormField htmlFor="schedule-hour" label="At (hour, India time)">
            <Input id="schedule-hour" inputMode="numeric" value={hour} onChange={(e) => setHour(e.target.value.replace(/\D/g, "").slice(0, 2))} />
          </FormField>
          <div className="flex items-start gap-3">
            <Switch id="schedule-skip" checked={skipEmpty} onCheckedChange={setSkipEmpty} />
            <div className="grid gap-1">
              <Label htmlFor="schedule-skip" className="text-sm font-normal">
                Skip when there is nothing to report
              </Label>
              <p className="text-xs text-muted-foreground">
                Right for queues; wrong for checks where an empty result is the good news.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={isBusy || Number(hour) > 23 || ((cadence === "monthly" || cadence === "quarterly") && (Number(dayOfMonth) < 1 || Number(dayOfMonth) > 31))}
          >
            {isBusy && <Loader2 className="animate-spin" />} Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SchedulesTab() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("tenant_admin", "hr_admin");
  const { data, error, isLoading, reload, setData } = useApiQuery<ReportSchedule[]>("/reports/schedules");
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (row: ReportSchedule) => {
    setBusy(row.id);
    try {
      await post(`/reports/schedules/${row.id}/active`, { active: !row.is_active });
      setData((current) => (current ?? []).map((item) => (item.id === row.id ? { ...item, is_active: !row.is_active } : item)));
    } catch (caught) {
      toast.error(detail(caught, "Could not change the schedule."));
    } finally {
      setBusy(null);
    }
  };

  const runNow = async (row: ReportSchedule) => {
    setBusy(row.id);
    try {
      await post(`/reports/schedules/${row.id}/run`);
      toast.success("Sent now.");
      reload();
    } catch (caught) {
      toast.error(detail(caught, "It did not send."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <DataPanel
      title="Schedules"
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
      isEmpty={(data ?? []).length === 0}
      empty={{ icon: CalendarClock, title: "Nothing scheduled", description: "Schedule a saved report to have it sent to you." }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Report</TableHead>
            <TableHead>When</TableHead>
            <TableHead>Next / last</TableHead>
            <TableHead>Active</TableHead>
            {isAdmin && <TableHead className="text-right">Run now</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="font-medium text-foreground">{row.report_name}</div>
                <div className="text-xs text-muted-foreground">
                  {row.recipients} recipient{row.recipients === 1 ? "" : "s"} · {row.on_empty === "skip" ? "skipped when empty" : "sent even when empty"}
                </div>
              </TableCell>
              <TableCell className="text-sm capitalize">
                {row.cadence}
                {row.day_of_week !== null && ` on ${DAYS[row.day_of_week]}`}
                {row.day_of_month !== null && ` on day ${row.day_of_month}`} at {String(row.hour_of_day).padStart(2, "0")}:00
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {row.next_run_at ? formatDateTime(row.next_run_at) : "—"}
                <div>{row.last_run_at ? `last ${formatDateTime(row.last_run_at)}` : "not yet sent"}</div>
              </TableCell>
              <TableCell>
                <Switch
                  checked={row.is_active}
                  disabled={busy === row.id || !(row.mine || isAdmin)}
                  onCheckedChange={() => toggle(row)}
                  aria-label={`${row.report_name} schedule active`}
                />
              </TableCell>
              {isAdmin && (
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" disabled={busy === row.id} onClick={() => runNow(row)}>
                    {busy === row.id ? <Loader2 className="animate-spin" /> : <Play />} Send
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataPanel>
  );
}
