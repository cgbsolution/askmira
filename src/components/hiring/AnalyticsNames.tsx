"use client";

import { useCallback } from "react";

import { CANDIDATE_STAGE, humanize, SOURCE_LABEL } from "@/components/hiring/labels";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { EmployeeSummary, Page } from "@/lib/types";
import type { RequisitionSummary } from "@/lib/types/hiring";

export type GroupBy = "requisition_id" | "department_id" | "recruiter_id" | "source";

interface NamedRef {
  id: string;
  name: string;
}

const FUNNEL_STAGE: Record<string, string> = {
  applied: "Applied",
  screened: "Screened",
  interviewed: "Interviewed",
  offered: "Offered",
  accepted: "Accepted",
  joined: "Joined",
};

/** A funnel or candidate stage key in words. */
export function stageLabel(stage: string): string {
  return (
    FUNNEL_STAGE[stage] ??
    (CANDIDATE_STAGE as Record<string, [string, string]>)[stage]?.[0] ??
    humanize(stage)
  );
}

export function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? humanize(source);
}

/**
 * Turns the ids the analytics API groups by (requisition, department,
 * recruiter) into names from the reference lists. An id the lists do not know
 * is shown as a short id, never guessed at.
 */
export function useAnalyticsNames(requisitions: RequisitionSummary[]) {
  const departments = useApiQuery<NamedRef[]>("/org/departments");
  const employees = useApiQuery<Page<EmployeeSummary>>("/employees?page=1&page_size=200");

  return useCallback(
    (kind: GroupBy, key: string): string => {
      if (!key || key === "unassigned") return "Not assigned";
      if (kind === "source") return sourceLabel(key);
      if (kind === "requisition_id") {
        const found = requisitions.find((item) => item.id === key);
        if (found) return `${found.code} · ${found.title}`;
      }
      if (kind === "department_id") {
        const found = departments.data?.find((item) => item.id === key);
        if (found) return found.name;
      }
      if (kind === "recruiter_id") {
        const found = employees.data?.items.find((item) => item.id === key);
        if (found) {
          return found.display_name ?? [found.first_name, found.last_name].filter(Boolean).join(" ");
        }
      }
      return `Unlisted (${key.slice(0, 8)})`;
    },
    [requisitions, departments.data, employees.data],
  );
}
