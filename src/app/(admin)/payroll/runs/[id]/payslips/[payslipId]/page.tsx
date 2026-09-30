"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React from "react";

import { ErrorState } from "@/components/common/ErrorState";
import { PageShell } from "@/components/common/PageShell";
import { PayslipTrace } from "@/components/payroll/PayslipTrace";
import { DownloadButton } from "@/components/payroll-ops/shared";
import { RunStatusBadge } from "@/components/payroll/RunStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Payslip } from "@/lib/types/payroll";

/** One employee's payslip on a run, as HR sees it: the full computation trace. */
export default function RunPayslipPage() {
  const params = useParams<{ id: string; payslipId: string }>();
  const { data, error, isLoading, reload } = useApiQuery<Payslip>(
    `/payroll/runs/${params.id}/payslips/${params.payslipId}`,
  );

  return (
    <PageShell
      title="Payslip"
      description="Every line, the rule version behind it, and the income tax working."
      actions={
        <>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/payroll/runs/${params.id}`}>
              <ArrowLeft /> Back to the run
            </Link>
          </Button>
          {data && (
            <DownloadButton
              path={`/payroll/runs/${params.id}/payslips/${params.payslipId}/pdf`}
              fallbackName={`payslip-${data.employee_code}-${data.period_year}-${String(data.period_month).padStart(2, "0")}.pdf`}
              label="Download PDF"
            />
          )}
        </>
      }
    >
      {isLoading && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : error || !data ? (
        <ErrorState message={error?.detail ?? "This payslip could not be found."} onRetry={reload} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <RunStatusBadge status={data.run_status} />
            <Badge variant={data.is_published ? "success" : "muted"}>
              {data.is_published ? "Published to the employee" : "Not published"}
            </Badge>
          </div>
          <PayslipTrace payslip={data} />
        </>
      )}
    </PageShell>
  );
}
