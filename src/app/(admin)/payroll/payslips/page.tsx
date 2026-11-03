"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Download, FileText, History, Loader2, Mail } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { MonthPicker } from "@/components/common/MonthPicker";
import { PageShell } from "@/components/common/PageShell";
import { formatMoment } from "@/components/payroll/labels";
import { EmailPayslipsDialog } from "@/components/payroll/payslip-batches/EmailPayslipsDialog";
import {
  downloadBatch,
  fileSize,
  PayslipBatchDialog,
} from "@/components/payroll/payslip-batches/PayslipBatchDialog";
import { toastApiError } from "@/components/payroll-ops/shared";
import { EmploymentStatusBadge } from "@/components/people/StatusBadges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { EmploymentStatus } from "@/lib/types";
import type {
  PayslipBatch,
  PayslipPeople,
  PayslipPeriodMonths,
  PayslipPerson,
} from "@/lib/types/payslip-batches";

const PERIODS: { value: PayslipPeriodMonths; label: string }[] = [
  { value: 1, label: "Last month" },
  { value: 3, label: "Last 3 months" },
  { value: 6, label: "Last 6 months" },
  { value: 12, label: "Last 12 months (a year)" },
];

type StatusFilter = "all" | "working" | "left";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "working", label: "Working here" },
  { value: "left", label: "Left the company" },
];

const BATCH_STATUS: Record<
  PayslipBatch["status"],
  { label: string; variant: "muted" | "accent" | "success" | "destructive" }
> = {
  queued: { label: "Waiting", variant: "muted" },
  running: { label: "In progress", variant: "accent" },
  completed: { label: "Done", variant: "success" },
  failed: { label: "Stopped", variant: "destructive" },
};

/** `YYYY-MM` from the API's `YYYY-MM-01`. */
const monthOf = (day: string | null | undefined) => (day ? day.slice(0, 7) : null);

function RecentFile({ batch }: { batch: PayslipBatch }) {
  const [isBusy, setIsBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isBusy}
      aria-label={`Download ${batch.file_name ?? "the payslips"}`}
      onClick={async () => {
        setIsBusy(true);
        try {
          await downloadBatch(batch);
        } catch (caught) {
          toastApiError(caught, "The payslips could not be downloaded.");
        } finally {
          setIsBusy(false);
        }
      }}
    >
      {isBusy ? <Loader2 className="animate-spin" /> : <Download />}
      <span className="hidden sm:inline">Download {fileSize(batch.file_size)}</span>
    </Button>
  );
}

/**
 * Payroll → Payslips: pick anybody (working here or left), pick the last 1, 3,
 * 6 or 12 months, and download their payslips or email each person theirs.
 * Admins and sub-admins; the work runs in the background with progress.
 */
export default function PayslipsPage() {
  const [months, setMonths] = useState<PayslipPeriodMonths>(1);
  const [upTo, setUpTo] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [everyone, setEveryone] = useState(false);
  const [emailing, setEmailing] = useState<{ people: PayslipPerson[]; clear?: () => void } | null>(null);
  const [following, setFollowing] = useState<{ id: string; fresh: boolean } | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  const query = `/payroll/payslip-batches/people?months=${months}${upTo ? `&to=${upTo}-01` : ""}`;
  const { data, error, isLoading, reload } = useApiQuery<PayslipPeople>(query);
  const recent = useApiQuery<PayslipBatch[]>("/payroll/payslip-batches");

  const latest = monthOf(data?.latest_month);
  const to = upTo ? `${upTo}-01` : null;

  // Requests still running keep the list fresh.
  const busy = (recent.data ?? []).some((batch) => batch.status === "queued" || batch.status === "running");
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(recent.reload, 4000);
    return () => clearInterval(timer);
  }, [busy, recent.reload]);

  const rows = useMemo(() => {
    const people = data?.people ?? [];
    return people.filter((person) => {
      if (!everyone && person.payslips === 0) return false;
      if (status === "working" && person.employment_status === "exited") return false;
      if (status === "left" && person.employment_status !== "exited") return false;
      return true;
    });
  }, [data, everyone, status]);

  const download = async (people: PayslipPerson[], clear?: () => void) => {
    const key = people.length === 1 ? people[0].employee_id : "bulk";
    setStarting(key);
    try {
      const batch = await post<PayslipBatch>("/payroll/payslip-batches/export", {
        employee_ids: people.map((person) => person.employee_id),
        months,
        to,
      });
      clear?.();
      setFollowing({ id: batch.id, fresh: true });
      recent.reload();
    } catch (caught) {
      toastApiError(caught, "The payslips could not be prepared.");
    } finally {
      setStarting(null);
    }
  };

  const emailReady = data?.email_ready ?? false;
  const emailTitle = emailReady
    ? undefined
    : "Email is not set up for this workspace. An admin sets the mail server under Settings, Notifications.";

  const columns: ColumnDef<PayslipPerson>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (row) => `${row.full_name} ${row.employee_code}`,
      meta: { text: (row) => `${row.full_name} (${row.employee_code})`, cellClassName: "whitespace-normal" },
      cell: ({ row }) => (
        <>
          <p className="font-medium text-foreground">{row.original.full_name}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.employee_code}
            {row.original.designation ? (
              <span className="hidden sm:inline"> · {row.original.designation}</span>
            ) : null}
          </p>
        </>
      ),
    },
    {
      id: "department",
      header: "Department",
      accessorFn: (row) => row.department ?? "",
      // On a phone the row keeps the person, the count and the buttons.
      meta: { className: "hidden lg:table-cell", cellClassName: "text-muted-foreground" },
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => row.employment_status,
      meta: { className: "hidden sm:table-cell" },
      cell: ({ row }) => (
        <EmploymentStatusBadge status={row.original.employment_status as EmploymentStatus} />
      ),
    },
    {
      id: "email",
      header: "Email",
      accessorFn: (row) => row.work_email ?? "",
      meta: { className: "hidden md:table-cell", cellClassName: "text-sm" },
      cell: ({ row }) => (
        <>
          <p className="text-foreground">{row.original.work_email ?? "—"}</p>
          {row.original.personal_email && (
            <p className="text-xs text-muted-foreground">{row.original.personal_email}</p>
          )}
        </>
      ),
    },
    {
      id: "payslips",
      header: "Payslips",
      accessorFn: (row) => row.payslips,
      meta: { headClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) =>
        row.original.payslips === 0 ? (
          <span className="text-muted-foreground">None</span>
        ) : (
          <>
            <p className="tabular-nums text-foreground">{row.original.payslips}</p>
            {row.original.released < row.original.payslips && (
              <p className="text-xs text-muted-foreground">{row.original.released} released</p>
            )}
          </>
        ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { text: false, cellClassName: "text-right" },
      cell: ({ row }) => {
        const person = row.original;
        return (
          <div className="flex justify-end gap-1 sm:gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={person.payslips === 0 || starting !== null}
              onClick={() => void download([person])}
              aria-label={`Download payslips of ${person.full_name}`}
            >
              {starting === person.employee_id ? <Loader2 className="animate-spin" /> : <Download />}
              <span className="hidden sm:inline">Download</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={person.released === 0 || !emailReady}
              title={emailTitle}
              onClick={() => setEmailing({ people: [person] })}
              aria-label={`Email payslips to ${person.full_name}`}
            >
              <Mail /> <span className="hidden sm:inline">Email</span>
            </Button>
          </div>
        );
      },
    },
  ];

  const recentColumns: ColumnDef<PayslipBatch>[] = [
    {
      id: "when",
      header: "Asked",
      accessorFn: (row) => row.created_at,
      meta: { text: (row) => formatMoment(row.created_at) },
      cell: ({ row }) => (
        <>
          <p className="text-foreground">{formatMoment(row.original.created_at)}</p>
          <p className="text-xs text-muted-foreground">{row.original.requested_by_name ?? "—"}</p>
          <p className="text-xs text-muted-foreground md:hidden">
            {row.original.action === "download" ? "Download" : "Email"} · {row.original.period_label}
          </p>
        </>
      ),
    },
    {
      id: "what",
      header: "What",
      meta: { className: "hidden md:table-cell" },
      accessorFn: (row) =>
        row.action === "download"
          ? "Download"
          : `Email to ${row.send_to === "personal" ? "personal" : "work"} address`,
    },
    { accessorKey: "period_label", header: "Period", meta: { className: "hidden sm:table-cell" } },
    {
      id: "people",
      header: "People",
      accessorFn: (row) => row.total_people,
      meta: { className: "hidden md:table-cell", headClassName: "text-right", cellClassName: "text-right tabular-nums" },
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => BATCH_STATUS[row.status].label,
      cell: ({ row }) => {
        const batch = row.original;
        return (
          <>
            <Badge variant={BATCH_STATUS[batch.status].variant}>
              {batch.status === "running"
                ? `${batch.processed} of ${batch.total_people}`
                : BATCH_STATUS[batch.status].label}
            </Badge>
            {batch.status === "completed" && (batch.skipped > 0 || batch.failed > 0) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {[batch.skipped ? `${batch.skipped} skipped` : null, batch.failed ? `${batch.failed} failed` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </>
        );
      },
    },
    {
      id: "result",
      header: "",
      enableSorting: false,
      meta: { text: false, cellClassName: "text-right" },
      cell: ({ row }) => {
        const batch = row.original;
        return (
          <div className="flex justify-end gap-1 sm:gap-2">
            {batch.action === "download" && batch.file_available && <RecentFile batch={batch} />}
            <Button size="sm" variant="ghost" onClick={() => setFollowing({ id: batch.id, fresh: false })}>
              Details
            </Button>
          </div>
        );
      },
    },
  ];

  const description = data
    ? data.latest_month
      ? `Showing payslips for ${data.period_label}.`
      : "No payroll month has been approved yet, so there are no payslips."
    : undefined;

  return (
    <PageShell
      title="Payslips"
      description="Download or email the payslips of anybody in the company for the last 1, 3, 6 or 12 months."
    >
      {data && !data.email_ready && (
        <Alert>
          <Mail />
          <AlertTitle>Email is not set up</AlertTitle>
          <AlertDescription>
            Payslips can be downloaded, but not emailed until an admin sets the mail server under Settings,
            Notifications.
          </AlertDescription>
        </Alert>
      )}

      <DataTable
        title="Choose people and a period"
        description={description}
        tier="tier1"
        columns={columns}
        data={rows}
        getRowId={(row) => row.employee_id}
        noun="people"
        exportName={false}
        isLoading={isLoading && !data}
        error={error ? (error.detail ?? "The list could not be loaded.") : null}
        onRetry={reload}
        filtered={!everyone || status !== "all"}
        empty={{
          icon: FileText,
          title: "No payslips in this period",
          description: "Pick a longer period or an earlier month, or show everybody.",
        }}
        emptyMessage={
          everyone
            ? "No one matches. Try a different name or filter."
            : `Nobody has a payslip for ${data?.period_label || "this period"}. Pick another period, or turn on “Show people without payslips”.`
        }
        searchPlaceholder="Name, code or email"
        filters={
          <>
            <Select value={String(months)} onValueChange={(value) => setMonths(Number(value) as PayslipPeriodMonths)}>
              <SelectTrigger aria-label="Period" className="h-9 w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((period) => (
                  <SelectItem key={period.value} value={String(period.value)}>
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Label htmlFor="payslips-up-to" className="text-sm font-normal text-muted-foreground">
                Up to
              </Label>
              <MonthPicker
                id="payslips-up-to"
                aria-label="Up to month"
                className="h-9 w-40"
                value={upTo ?? latest}
                max={latest ?? undefined}
                onChange={(value) => setUpTo(value && value !== latest ? value : null)}
                disabled={!latest}
              />
            </div>
            <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
              <SelectTrigger aria-label="Status" className="h-9 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch id="payslips-everyone" checked={everyone} onCheckedChange={setEveryone} />
              <Label htmlFor="payslips-everyone" className="text-sm font-normal">
                Show people without payslips
              </Label>
            </div>
          </>
        }
        bulkActions={(selected, clear) => {
          const withPayslips = selected.filter((person) => person.payslips > 0);
          const withReleased = selected.filter((person) => person.released > 0);
          return (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={withPayslips.length === 0 || starting !== null}
                onClick={() => void download(withPayslips, clear)}
              >
                {starting === "bulk" ? <Loader2 className="animate-spin" /> : <Download />}
                Download payslips
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={withReleased.length === 0 || !emailReady}
                title={emailTitle}
                onClick={() => setEmailing({ people: selected, clear })}
              >
                <Mail /> Email payslips
              </Button>
            </>
          );
        }}
      />

      <DataTable
        title="Recent requests"
        description="Downloads are kept for a day. Emails show who was sent what."
        tier="tier1"
        columns={recentColumns}
        data={recent.data ?? []}
        noun="requests"
        selectable={false}
        exportName={false}
        columnPicker={false}
        searchPlaceholder={false}
        isLoading={recent.isLoading && !recent.data}
        error={recent.error ? (recent.error.detail ?? "Recent requests could not be loaded.") : null}
        onRetry={recent.reload}
        empty={{
          icon: History,
          title: "Nothing asked for yet",
          description: "Downloads and emails you start appear here with their progress.",
        }}
        pageSize={10}
      />

      {emailing && data && (
        <EmailPayslipsDialog
          people={emailing.people}
          months={months}
          to={to}
          periodLabel={data.period_label}
          passwordProtected={data.password_protected}
          passwordRule={data.password_rule}
          onClose={() => setEmailing(null)}
          onStarted={(batch) => {
            emailing.clear?.();
            setEmailing(null);
            setFollowing({ id: batch.id, fresh: true });
            recent.reload();
          }}
        />
      )}

      {following && (
        <PayslipBatchDialog
          batchId={following.id}
          autoDownload={following.fresh}
          onClose={() => setFollowing(null)}
          onChange={recent.reload}
        />
      )}
    </PageShell>
  );
}
