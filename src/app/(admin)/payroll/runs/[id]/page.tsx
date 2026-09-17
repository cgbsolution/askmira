"use client";

import { AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useState } from "react";

import { ErrorState } from "@/components/common/ErrorState";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { InputSourcesPanel } from "@/components/payroll/InputSourcesPanel";
import { formatMoment, periodLabel, RUN_TYPE } from "@/components/payroll/labels";
import { RegisterPanel } from "@/components/payroll/RegisterPanel";
import { RunActions } from "@/components/payroll/RunActions";
import { RunStatusBadge } from "@/components/payroll/RunStatusBadge";
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

export default function PayrollRunPage() {
  const params = useParams<{ id: string }>();
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
        <SectionNav section="payroll" />
        <Skeleton className="h-40 w-full" />
      </PageShell>
    );
  }
  if (error || !run) {
    return (
      <PageShell title="Payroll run" actions={back}>
        <SectionNav section="payroll" />
        <ErrorState message={error?.detail ?? "This run could not be found."} onRetry={reload} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={`${periodLabel(run.period_year, run.period_month)} payroll`}
      description={`${RUN_TYPE[run.run_type]} run · ${run.legal_entity_name ?? "legal entity"} · rules resolved as of ${formatDay(run.effective_date, true)}`}
      actions={back}
    >
      <SectionNav section="payroll" />

      <Card tier="tier1">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <RunStatusBadge status={run.status} />
            <RunActions run={run} onChanged={changed} />
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
        </CardContent>
      </Card>

      {run.error_log && (
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

      <VariancePanel run={run} onChanged={changed} />
      <InputSourcesPanel run={run} />
      <RegisterPanel runId={run.id} version={version} />
    </PageShell>
  );
}
