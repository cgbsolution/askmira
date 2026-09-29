"use client";

import React from "react";

import { ErrorState } from "@/components/common/ErrorState";
import { PageShell } from "@/components/common/PageShell";
import { CareersSiteForm } from "@/components/hiring/CareersSiteForm";
import { CareersSiteRetention } from "@/components/hiring/CareersSiteRetention";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { CareersConfig } from "@/lib/types/hiring";

/**
 * Careers site (admin): the public jobs page's address, content, branding,
 * privacy notice and retention, plus a manual retention purge.
 */
export default function CareersSitePage() {
  const { data, error, isLoading, reload } = useApiQuery<CareersConfig>("/careers/config");

  return (
    <PageShell
      title="Careers site"
      description="The public page where candidates see open roles and apply."
    >
      {isLoading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : error ? (
        <Card tier="tier1">
          <ErrorState message={error.detail} onRetry={reload} />
        </Card>
      ) : data ? (
        <>
          <CareersSiteForm config={data} onSaved={reload} />
          <CareersSiteRetention retentionDays={data.exists ? data.resume_retention_days : null} />
        </>
      ) : null}
    </PageShell>
  );
}
