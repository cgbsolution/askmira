"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import React from "react";

import { ErrorState } from "@/components/common/ErrorState";
import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { PayslipTrace } from "@/components/payroll/PayslipTrace";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Payslip } from "@/lib/types/payroll";

/** One of your own payslips, with how every figure on it was reached. */
export default function MyPayslipPage() {
  const params = useParams<{ id: string }>();
  const { data, error, isLoading, reload } = useApiQuery<Payslip>(
    `/payroll/my-payslips/${params.id}`,
  );

  return (
    <PageShell
      title="Payslip"
      description="Every line on your payslip, and how it was worked out."
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link href="/pay">
            <ArrowLeft /> All payslips
          </Link>
        </Button>
      }
    >
      <SectionNav section="pay" />
      {isLoading && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : error || !data ? (
        <ErrorState
          message={
            error?.status === 404
              ? "This payslip does not exist, or is not one of yours."
              : (error?.detail ?? "This payslip could not be loaded.")
          }
          onRetry={error?.status === 404 ? undefined : reload}
        />
      ) : (
        <PayslipTrace payslip={data} />
      )}
    </PageShell>
  );
}
