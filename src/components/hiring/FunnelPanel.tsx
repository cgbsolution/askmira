"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Filter, TrendingDown } from "lucide-react";
import React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { DataTable } from "@/components/common/data-table/DataTable";
import { DataPanel } from "@/components/common/DataPanel";
import { type GroupBy, stageLabel } from "@/components/hiring/AnalyticsNames";
import { percent } from "@/components/hiring/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import type { FunnelReport, FunnelStageRow } from "@/lib/types/hiring";

const GROUP_TITLE: Record<GroupBy, string> = {
  requisition_id: "By requisition",
  department_id: "By department",
  recruiter_id: "By recruiter",
  source: "By source",
};

const FUNNEL_CHART: ChartConfig = { count: { label: "Candidates", color: "var(--chart-1)" } };

/** The funnel as a chart: candidates reaching each stage, in pipeline order. */
export function FunnelChart({ stages }: { stages: FunnelStageRow[] }) {
  if (stages.length === 0) return null;
  const data = stages.map((row) => ({ stage: stageLabel(row.stage), count: row.count }));
  return (
    <ChartContainer config={FUNNEL_CHART} className="h-56 w-full">
      <BarChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="stage" tickLine={false} axisLine={false} interval={0} fontSize={11} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

/** One funnel as rows: stage, count, drop-off from the stage before, and a bar of the share. */
export function FunnelStageTable({ stages, total }: { stages: FunnelStageRow[]; total: number }) {
  const columns: ColumnDef<FunnelStageRow>[] = [
    {
      accessorKey: "stage",
      header: "Stage",
      meta: { cellClassName: "font-medium text-foreground" },
      cell: ({ row }) => stageLabel(row.original.stage),
    },
    {
      accessorKey: "count",
      header: "Candidates",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
    },
    {
      accessorKey: "dropped_from_previous",
      header: "Dropped",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => row.original.dropped_from_previous ?? "—",
    },
    {
      accessorKey: "drop_off_rate",
      header: "Drop-off",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => percent(row.original.drop_off_rate),
    },
    {
      id: "share",
      header: "Share of all candidates",
      meta: { headClassName: "w-2/5" },
      cell: ({ row }) => {
        const share = total > 0 ? (row.original.count / total) * 100 : 0;
        return (
          <div className="flex items-center gap-2">
            <Progress
              value={share}
              aria-label={`${stageLabel(row.original.stage)}: ${Math.round(share)}% of candidates`}
            />
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {Math.round(share)}%
            </span>
          </div>
        );
      },
    },
  ];
  return (
    <DataTable variant="plain" bordered={false} columns={columns} data={stages} getRowId={(row) => row.stage} />
  );
}

/**
 * The hiring funnel. When the stage counts do not reconcile with the source
 * tables, the discrepancy is shown instead of the funnel: a chart built on
 * numbers that disagree with the records would be worse than none.
 */
export function FunnelPanel({
  report,
  isLoading,
  error,
  onRetry,
  nameFor,
}: {
  report: FunnelReport | null;
  isLoading: boolean;
  error?: string | null;
  onRetry: () => void;
  nameFor: (kind: GroupBy, key: string) => string;
}) {
  const funnel = report?.funnel;
  const recon = report?.reconciliation;
  const groupBy = funnel?.grouped_by as GroupBy | undefined;

  return (
    <DataPanel
      title="Funnel"
      description={funnel ? `${funnel.total_candidates} candidates in scope.` : undefined}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!funnel || (Boolean(recon?.reconciles) && funnel.total_candidates === 0)}
      empty={{
        icon: Filter,
        title: "No candidates in scope",
        description: "The funnel fills in as candidates are added to requisitions.",
      }}
    >
      {funnel && recon && !recon.reconciles ? (
        <div className="p-5">
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>The funnel does not reconcile with the records</AlertTitle>
            <AlertDescription>
              <p>{recon.note}</p>
              {recon.total_breaks.length > 0 && (
                <ul className="list-disc space-y-1 pl-4">
                  {recon.total_breaks.map((item) => (
                    <li key={`total-${item.stage}`}>
                      {stageLabel(item.stage)}: counted {item.computed ?? "—"}, records say{" "}
                      {item.expected}. {item.detail}
                    </li>
                  ))}
                </ul>
              )}
              {recon.monotonic_breaks.length > 0 && (
                <ul className="list-disc space-y-1 pl-4">
                  {recon.monotonic_breaks.map((item) => (
                    <li key={`mono-${item.stage}`}>
                      {stageLabel(item.stage)}: {item.detail}
                    </li>
                  ))}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        </div>
      ) : funnel ? (
        <div className="grid gap-4 pb-5">
          <div className="px-5 pt-2">
            <FunnelChart stages={funnel.stages} />
          </div>
          <FunnelStageTable stages={funnel.stages} total={funnel.total_candidates} />
          <div className="grid gap-3 px-5">
            {funnel.largest_drop_off && (
              <Alert variant="warning">
                <TrendingDown />
                <AlertTitle>Largest drop-off</AlertTitle>
                <AlertDescription>
                  <p className="tabular-nums">
                    Into {stageLabel(funnel.largest_drop_off.into_stage)}:{" "}
                    {funnel.largest_drop_off.count} candidates ({percent(funnel.largest_drop_off.rate)}
                    ) did not continue.
                  </p>
                </AlertDescription>
              </Alert>
            )}
            <p className="text-xs text-muted-foreground">{funnel.note}</p>
          </div>

          {groupBy && funnel.groups && (
            <section className="grid gap-3 border-t border-border pt-4">
              <p className="px-5 text-sm font-medium text-foreground">{GROUP_TITLE[groupBy]}</p>
              {funnel.groups.length === 0 && (
                <p className="px-5 text-sm text-muted-foreground">No groups to show.</p>
              )}
              {funnel.groups.map((group) => (
                <div key={group.key} className="grid gap-1">
                  <p className="px-5 text-sm text-foreground">
                    {nameFor(groupBy, group.key)}{" "}
                    <span className="tabular-nums text-muted-foreground">
                      · {group.total} candidates
                    </span>
                  </p>
                  <FunnelStageTable stages={group.stages} total={group.total} />
                </div>
              ))}
            </section>
          )}
        </div>
      ) : null}
    </DataPanel>
  );
}
