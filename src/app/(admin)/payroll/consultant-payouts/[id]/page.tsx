"use client";

import { ArrowLeft, Lock, LockOpen } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React from "react";

import { ErrorState } from "@/components/common/ErrorState";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { PayoutStatusBadge } from "@/components/payroll/consultant-payouts/PayoutStatusBadge";
import { RunActions } from "@/components/payroll/consultant-payouts/RunActions";
import { RunLines } from "@/components/payroll/consultant-payouts/RunLines";
import { formatMoment } from "@/components/payroll/labels";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { PayoutRun } from "@/lib/types/consultant-payouts";
import { formatDay } from "@/lib/utils";

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{children}</p>
    </div>
  );
}

function StateNotice({ run }: { run: PayoutRun }) {
  const Icon = run.status === "draft" ? LockOpen : Lock;
  return (
    <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <span>
        {run.status === "draft"
          ? "Not locked yet. Check each line, fix or leave out any that are held, and Recalculate after any change. Approve & lock needs someone other than whoever drafted the run."
          : run.status === "approved"
            ? `Approved ${formatMoment(run.approved_at)}. It can no longer be recalculated or deleted. Prepare the bank file, then mark it paid with the bank reference.`
            : `Paid on ${run.paid_on ? formatDay(run.paid_on, true) : "—"}${run.payment_reference ? `, reference ${run.payment_reference}` : ""}.`}
      </span>
    </p>
  );
}

export default function ConsultantPayoutRunPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    data: run,
    error,
    isLoading,
    reload,
    setData,
  } = useApiQuery<PayoutRun>(`/consultant-payouts/${params.id}`);

  const back = (
    <Link
      href="/payroll/consultant-payouts"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> All payout runs
    </Link>
  );

  if (isLoading && !run) {
    return (
      <PageShell title="Payout run">
        <Skeleton className="h-40 w-full" />
      </PageShell>
    );
  }
  if (error || !run) {
    return (
      <PageShell title="Payout run" actions={back}>
        <ErrorState
          message={error?.detail ?? "This run could not be found."}
          onRetry={reload}
        />
      </PageShell>
    );
  }

  const changed = (updated: PayoutRun) => {
    setData(updated);
    reload();
  };

  return (
    <PageShell
      title={`Payout run, ${formatDay(run.pay_date, true)}`}
      description={`Weeks ending by ${formatDay(run.cut_off, true)}.`}
      actions={back}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PayoutStatusBadge status={run.status} />
        <RunActions
          run={run}
          onChanged={changed}
          onDeleted={() => router.push("/payroll/consultant-payouts")}
        />
      </div>
      <StateNotice run={run} />
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Consultants paid">{run.totals.lines_included}</Stat>
          <Stat label="Held">{run.totals.lines_held}</Stat>
          <Stat label="Gross">
            <Money value={run.totals.gross} />
          </Stat>
          <Stat label="GST">
            <Money value={run.totals.gst_amount} />
          </Stat>
          <Stat label="TDS deducted">
            <Money value={run.totals.tds_amount} />
          </Stat>
          <Stat label="Net pay">
            <Money value={run.totals.net_payable} />
          </Stat>
        </CardContent>
      </Card>
      <RunLines run={run} onChanged={changed} />
    </PageShell>
  );
}
