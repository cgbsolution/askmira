"use client";

import { Rocket } from "lucide-react";
import React, { useCallback, useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { AddJoinerDialog } from "@/components/onboarding/JoinerWizard";
import { PlanDetailSheet } from "@/components/onboarding/PlanDetailSheet";
import {
  dayOrDash,
  PLAN_STATUS_LABELS,
  pluralCount,
  PlanStatusBadge,
} from "@/components/onboarding/shared";
import { StartOnboardingDialog } from "@/components/onboarding/StartOnboardingDialog";
import { ForbiddenState } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { OnboardingPlan, OnboardingPlanStatus } from "@/lib/types/onboarding";

type NamedRef = { id: string; name: string };

const ANY = "__any";

/**
 * /onboarding/plans — every new joiner's onboarding, for HR: progress, what is
 * overdue or has nobody to do it, and the plan itself in a sheet.
 */
export function PlansScreen() {
  const [status, setStatus] = useState<OnboardingPlanStatus | typeof ANY>("in_progress");
  const [department, setDepartment] = useState<string>(ANY);
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (status !== ANY) params.set("status", status);
  if (department !== ANY) params.set("department_id", department);
  const search = params.toString();
  const query = useApiQuery<OnboardingPlan[]>(`/onboarding/plans${search ? `?${search}` : ""}`);
  const departments = useApiQuery<NamedRef[]>("/org/departments");
  const reload = query.reload;
  const refresh = useCallback(() => reload(), [reload]);

  const rows = query.data ?? [];
  const forbidden = query.error?.status === 403;
  const filtered = status !== ANY || department !== ANY;

  return (
    <PageShell
      title="New joiners"
      description="Onboarding for everyone joining: checklists, owners, what is overdue and who is stuck."
      actions={
        <>
          <StartOnboardingDialog
            onStarted={(plan) => {
              refresh();
              setOpenPlanId(plan.id);
            }}
          />
          <AddJoinerDialog onAdded={refresh} onOpenPlan={setOpenPlanId} />
        </>
      }
    >
      <DataPanel
        tier="tier1"
        isLoading={query.isLoading && query.data === null}
        error={forbidden ? null : (query.error?.detail ?? null)}
        onRetry={query.reload}
        isEmpty={!forbidden && query.data !== null && rows.length === 0}
        empty={{
          icon: Rocket,
          title: filtered ? "No plans match these filters" : "No onboarding plans yet",
          description: filtered
            ? "Try another status or department."
            : "Add a new joiner: their record, a dated checklist for them, their manager, buddy and IT, and their login, in three steps.",
        }}
        toolbar={
          <>
            <Select
              value={status}
              onValueChange={(next) => setStatus(next as OnboardingPlanStatus | typeof ANY)}
            >
              <SelectTrigger size="sm" className="w-40" aria-label="Plan status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any status</SelectItem>
                {(Object.keys(PLAN_STATUS_LABELS) as OnboardingPlanStatus[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {PLAN_STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger size="sm" className="w-48" aria-label="Department">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Every department</SelectItem>
                {(departments.data ?? []).map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              {query.isLoading ? "Loading…" : query.data ? pluralCount(rows.length, "plan") : ""}
            </span>
          </>
        }
      >
        {forbidden ? (
          <ForbiddenState message={query.error?.detail} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>New joiner</TableHead>
                <TableHead>Joining</TableHead>
                <TableHead>Checklist</TableHead>
                <TableHead>Buddy</TableHead>
                <TableHead className="w-56">Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setOpenPlanId(row.id)}
                >
                  <TableCell>
                    <PersonCell
                      size="sm"
                      name={row.employee_name}
                      subtitle={[row.employee_code, row.designation, row.department_name]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    <span className="block">{dayOrDash(row.joining_date)}</span>
                    {row.employee_status === "pre_joining" && (
                      <Badge variant="accent" className="mt-0.5">
                        Pre-joining
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-48 truncate">{row.template_name}</TableCell>
                  <TableCell>{row.buddy_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={row.progress.percent}
                        className="h-1.5"
                        aria-label={`${row.progress.percent}% complete`}
                      />
                      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                        {row.progress.percent}%
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {row.progress.done + row.progress.skipped}/{row.progress.total} done
                      </span>
                      {row.status === "in_progress" && row.progress.overdue > 0 && (
                        <Badge variant="warning">{row.progress.overdue} overdue</Badge>
                      )}
                      {row.status === "in_progress" && row.progress.unassigned > 0 && (
                        <Badge variant="destructive">{row.progress.unassigned} unassigned</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <PlanStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenPlanId(row.id);
                      }}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataPanel>

      <PlanDetailSheet
        planId={openPlanId}
        onClose={() => setOpenPlanId(null)}
        onChanged={refresh}
      />
    </PageShell>
  );
}
