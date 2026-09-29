"use client";

import React, { useState } from "react";

import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import {
  AnalyticsOfferOutcomesPanel,
  AnalyticsSourcesPanel,
  AnalyticsTimingsPanel,
} from "@/components/hiring/AnalyticsFunnelSections";
import { AnalyticsInterviewersPanel } from "@/components/hiring/AnalyticsInterviewersPanel";
import { type GroupBy, useAnalyticsNames } from "@/components/hiring/AnalyticsNames";
import { CostPerHirePanel } from "@/components/hiring/CostPerHirePanel";
import { DiversityPanel } from "@/components/hiring/DiversityPanel";
import { FunnelPanel } from "@/components/hiring/FunnelPanel";
import { ALL, PostingRequisitionSelect } from "@/components/hiring/PostingRequisitionSelect";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Page } from "@/lib/types";
import type { FunnelReport, RequisitionSummary } from "@/lib/types/hiring";

const GROUP_OPTIONS: { value: GroupBy | "none"; label: string }[] = [
  { value: "none", label: "No grouping" },
  { value: "requisition_id", label: "By requisition" },
  { value: "department_id", label: "By department" },
  { value: "recruiter_id", label: "By recruiter" },
  { value: "source", label: "By source" },
];

/**
 * Hiring analytics (HR): funnel, stage timings, sources, offer outcomes,
 * interviewer coaching signals, diversity and cost per hire. Every figure is
 * computed by the API from the records; where a sample is too small, the API's
 * note is shown instead of a number.
 */
export default function HiringAnalyticsPage() {
  const [groupBy, setGroupBy] = useState<GroupBy | "none">("none");
  const [requisitionId, setRequisitionId] = useState<string>(ALL);

  const requisitions = useApiQuery<Page<RequisitionSummary>>("/hiring/requisitions?page=1&page_size=200");
  const reqList = requisitions.data?.items ?? [];
  const nameFor = useAnalyticsNames(reqList);

  const params = new URLSearchParams();
  if (groupBy !== "none") params.set("group_by", groupBy);
  if (requisitionId !== ALL) params.set("requisition_id", requisitionId);
  const query = params.toString();
  const funnel = useApiQuery<FunnelReport>(
    `/recruiting/analytics/funnel${query ? `?${query}` : ""}`,
  );
  const sectionProps = {
    report: funnel.data,
    isLoading: funnel.isLoading && !funnel.data,
    error: funnel.error?.detail,
    onRetry: funnel.reload,
  };

  return (
    <PageShell
      title="Hiring analytics"
      description="Where candidates drop out, how long each step takes, what each source and hire costs — worked out from the hiring records."
    >
      <Card tier="tier1">
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
          <FormField htmlFor="analytics-group" label="Group the funnel">
            <Select value={groupBy} onValueChange={(next) => setGroupBy(next as GroupBy | "none")}>
              <SelectTrigger id="analytics-group" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            htmlFor="analytics-requisition"
            label="Requisition"
            hint={requisitions.error ? `Requisitions could not be loaded: ${requisitions.error.detail}` : undefined}
          >
            <PostingRequisitionSelect
              id="analytics-requisition"
              requisitions={reqList}
              value={requisitionId}
              onChange={setRequisitionId}
              allLabel="All requisitions"
              disabled={requisitions.isLoading && !requisitions.data}
            />
          </FormField>
        </CardContent>
      </Card>

      <FunnelPanel {...sectionProps} nameFor={nameFor} />
      <AnalyticsTimingsPanel {...sectionProps} />
      <AnalyticsSourcesPanel {...sectionProps} />
      <AnalyticsOfferOutcomesPanel {...sectionProps} nameFor={nameFor} />
      <AnalyticsInterviewersPanel />
      <DiversityPanel />
      <CostPerHirePanel />
    </PageShell>
  );
}
