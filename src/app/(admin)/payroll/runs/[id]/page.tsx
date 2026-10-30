"use client";

import { AlertTriangle, ArrowLeft, FileSpreadsheet, Lock, LockOpen } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";

import { ErrorState } from "@/components/common/ErrorState";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { JournalExportMenu } from "@/components/payroll/accounting/JournalExportMenu";
import { InputSourcesPanel } from "@/components/payroll/InputSourcesPanel";
import {
  formatMoment,
  isImported,
  isRunLocked,
  periodLabel,
  RUN_TYPE,
} from "@/components/payroll/labels";
import { RegisterDownloadMenu } from "@/components/payroll/RegisterDownloadMenu";
import { RegisterPanel } from "@/components/payroll/RegisterPanel";
import { RunActions } from "@/components/payroll/RunActions";
import { ImportedBadge, RunStatusBadge } from "@/components/payroll/RunStatusBadge";
import { VariancePanel } from "@/components/payroll/VariancePanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { PayrollRun } from "@/lib/types/payroll";
import { formatDay } from "@/lib/utils";

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{children}</p>
    </div>
  );
}

/** "Imported and locked on 30 Oct 2026, 10:11 by Asha" — when the import was saved, not when it was paid. */
function importedAndLocked(run: PayrollRun): string {
  const summary = run.import_summary;
  const when = formatMoment(summary?.imported_at ?? run.approved_at);
  const who = summary?.imported_by_name ?? run.approved_by_name;
  return `Imported and locked on ${when}${who ? ` by ${who}` : ""}`;
}

/** The register file(s) an imported month was read from, as named when uploaded. */
function importedFiles(run: PayrollRun): string {
  const files = run.import_summary?.files ?? [];
  return files.length > 0 ? files.join(", ") : "the salary register";
}

/** Whether the run is locked, and what that allows. Approval is the lock. */
function LockNotice({ run }: { run: PayrollRun }) {
  if (run.status === "cancelled" || run.status === "processing") return null;
  if (isImported(run)) {
    return (
      <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground">
        <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>
          {importedAndLocked(run)}. These are the figures as paid on factoHR, read from{" "}
          {importedFiles(run)}. AskMira never recomputes them, and the run cannot be published,
          paid or posted to the books again.
        </span>
      </p>
    );
  }
  if (isRunLocked(run.status)) {
    return (
      <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground">
        <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>
          Locked {formatMoment(run.approved_at)}
          {run.approved_by_name ? ` by ${run.approved_by_name}` : ""}. It can no longer be recomputed
          or deleted; a correction is an arrears or off-cycle run.
        </span>
      </p>
    );
  }
  return (
    <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground">
      <LockOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span>
        {run.status === "pending_review"
          ? "Not locked yet. Check the numbers (Download gives the salary register in Excel), recompute after any change, or delete the run. When it is right, Approve & lock — someone other than whoever computed it."
          : run.status === "failed"
            ? "Not locked. Fix what the compute reported below and compute again, or delete the run."
            : "Not computed yet. Press Compute; if something is missing it says what. A run opened in error can be deleted."}
      </span>
    </p>
  );
}

/** Statuses whose notices come from a compute that succeeded; others may be stale. */
const COMPUTED = ["pending_review", "approved", "paid"];

/** People the compute left off because they have no salary, and how they get paid. */
function NoSalaryNotice({ run }: { run: PayrollRun }) {
  const left = run.input_notices.filter((notice) => notice.key === "no_salary");
  if (left.length === 0 || !COMPUTED.includes(run.status)) return null;
  const period = periodLabel(run.period_year, run.period_month);
  const lastDay = formatDay(run.effective_date, true);
  const people = left.length === 1 ? "1 person" : `${left.length} people`;
  const salaryMaster = (
    <Link href="/payroll/salaries" className="font-medium underline underline-offset-2">
      Salary master
    </Link>
  );
  return (
    <Alert variant="warning">
      <AlertTriangle />
      <AlertTitle>{people} not paid by this run: no salary</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {left.map((notice) => (
            <li key={notice.message}>{notice.message}</li>
          ))}
        </ul>
        <p className="mt-2">
          {isRunLocked(run.status) ? (
            <>
              To pay anyone not paid since: add their salary in {salaryMaster}, in force on or
              before {lastDay}, then open an off-cycle run for {period} with them in it. It pays
              their whole month, with their loan EMI, claims and allowances for it.
            </>
          ) : (
            <>
              Everyone else is computed. Add their salary in {salaryMaster}, in force on or before{" "}
              {lastDay}, and press Recompute to include them, or approve without them and pay them
              later with an off-cycle run for {period}.
            </>
          )}
        </p>
      </AlertDescription>
    </Alert>
  );
}

/** People this run pays in full who another open run of the month also pays in full. */
function PaidTwiceNotice({ run }: { run: PayrollRun }) {
  const twice = run.input_notices.filter((notice) => notice.key === "whole_month_elsewhere");
  if (twice.length === 0 || run.status !== "pending_review") return null;
  return (
    <Alert variant="warning">
      <AlertTriangle />
      <AlertTitle>Also paid on another open run</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {twice.map((notice) => (
            <li key={notice.message}>{notice.message}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

export default function PayrollRunPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const runId = params.id;
  const { data: run, error, isLoading, reload, setData } = useApiQuery<PayrollRun>(
    `/payroll/runs/${runId}`,
  );
  const [version, setVersion] = useState(0);

  const changed = (updated: PayrollRun) => {
    setData(updated);
    setVersion((current) => current + 1);
    reload();
  };

  const back = (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/payroll">
        <ArrowLeft /> All runs
      </Link>
    </Button>
  );

  if (isLoading && !run) {
    return (
      <PageShell title="Payroll run">
        <Skeleton className="h-40 w-full" />
      </PageShell>
    );
  }
  if (error || !run) {
    return (
      <PageShell title="Payroll run" actions={back}>
        <ErrorState message={error?.detail ?? "This run could not be found."} onRetry={reload} />
      </PageShell>
    );
  }

  const imported = isImported(run);

  return (
    <PageShell
      title={`${periodLabel(run.period_year, run.period_month)} payroll`}
      description={
        imported
          ? `${RUN_TYPE[run.run_type]} run · ${run.legal_entity_name ?? "legal entity"} · Imported from factoHR — ${importedFiles(run)} — figures as paid there, never recomputed`
          : `${RUN_TYPE[run.run_type]} run · ${run.legal_entity_name ?? "legal entity"} · rules resolved as of ${formatDay(run.effective_date, true)}`
      }
      actions={back}
    >
      <Card tier="tier1">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            {/* Top-aligned with the buttons: a hint under them must not push the row apart. */}
            <div className="flex flex-wrap items-center gap-1 pt-2">
              <RunStatusBadge status={run.status} />
              {imported && <ImportedBadge />}
            </div>
            <div className="flex flex-wrap items-start justify-end gap-2">
              <RegisterDownloadMenu run={run} />
              <JournalExportMenu run={run} />
              <RunActions run={run} onChanged={changed} onDeleted={() => router.push("/payroll")} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Employees">
              <span className="tabular-nums">{run.employee_count}</span>
            </Stat>
            <Stat label="Gross earnings">
              <Money value={run.total_gross} />
            </Stat>
            <Stat label="Deductions">
              <Money value={run.total_deductions} />
            </Stat>
            <Stat label="Net pay">
              <Money value={run.total_net} />
            </Stat>
            <Stat label="Employer cost">
              <Money value={run.total_employer_cost} />
            </Stat>
          </div>
          {imported ? (
            // The import time is not when the month was computed, approved or paid:
            // factoHR did that, and its dates were not imported.
            <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <li>{importedAndLocked(run)}</li>
              <li className="flex items-start gap-1">
                <FileSpreadsheet className="mt-px size-3.5 shrink-0" aria-hidden />
                <span>From: {importedFiles(run)}</span>
              </li>
              <li>Computed, approved and paid on factoHR; its dates were not imported.</li>
              <li>
                {run.published_at
                  ? "Payslips published to employees with the import."
                  : "Payslips not published to employees."}
              </li>
            </ul>
          ) : (
            <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <li>
                Computed: {formatMoment(run.processed_at)}
                {run.computed_by_name ? ` by ${run.computed_by_name}` : ""}
              </li>
              <li>
                Approved: {formatMoment(run.approved_at)}
                {run.approved_by_name ? ` by ${run.approved_by_name}` : ""}
              </li>
              <li>
                Published: {formatMoment(run.published_at)}
                {run.published_by_name ? ` by ${run.published_by_name}` : ""}
              </li>
              <li>
                Paid: {formatMoment(run.paid_at)}
                {run.payment_date ? ` · payment date ${formatDay(run.payment_date, true)}` : ""}
              </li>
            </ul>
          )}
          <LockNotice run={run} />
          {run.run_type !== "regular" && (
            <div className="grid gap-1 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p className="text-foreground">
                <span className="font-medium">Why: </span>
                {run.reason ?? "—"}
              </p>
              <p className="text-muted-foreground">
                Pays {run.employee_scope.length}{" "}
                {run.employee_scope.length === 1 ? "person" : "people"} on top of the month&apos;s
                approved regular run
                {run.included_sources?.length
                  ? `, from: ${run.included_sources.map((key) => key.replaceAll("_", " ")).join(", ")}`
                  : ""}
                . Anyone the regular run already paid gets a top-up payslip: their salary, PF and
                the month&apos;s TDS share are not paid again.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {run.status === "cancelled" && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>This run was cancelled</AlertTitle>
          <AlertDescription>
            {formatMoment(run.cancelled_at ?? null)}
            {run.cancelled_by_name ? ` by ${run.cancelled_by_name}` : ""}
            {run.cancel_reason ? `: ${run.cancel_reason}` : "."} Nothing on it was paid.
          </AlertDescription>
        </Alert>
      )}

      {run.error_log && run.status !== "cancelled" && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>The last compute failed</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {run.error_log.split("\n").map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <PaidTwiceNotice run={run} />
      <NoSalaryNotice run={run} />

      {run.review_flags.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>Payroll could not decide these — fix the record and recompute</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {run.review_flags.map((flag) => (
                <li key={flag}>{flag}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {imported ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Variances and other sources (loans, reimbursements, arrears, bonus): not checked —
          imported as paid.
        </p>
      ) : (
        <>
          <VariancePanel run={run} onChanged={changed} />
          <InputSourcesPanel run={run} />
        </>
      )}
      <RegisterPanel runId={run.id} version={version} />
    </PageShell>
  );
}
