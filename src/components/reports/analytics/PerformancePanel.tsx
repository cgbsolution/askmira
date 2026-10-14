"use client";

import { Goal, Scale, Star } from "lucide-react";
import React, { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { DataPanel } from "@/components/common/DataPanel";
import { Badge } from "@/components/ui/badge";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { PerformanceOverview } from "@/lib/types/reports";

const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

/**
 * Ratings across recent cycles, goal attainment, and — for HR — how far each
 * manager's ratings sit from everyone's. Spread is shown with its rule and the
 * number of ratings behind it; it is a calibration prompt, not a verdict.
 */
export function PerformancePanel() {
  const { data, error, isLoading, reload } = useApiQuery<PerformanceOverview>("/reports/analytics/performance");

  // Rating labels are free text; chart keys become CSS variables, so they get safe keys.
  const ratings = useMemo(() => {
    const labels = data?.rating_trend.ratings ?? [];
    const config: ChartConfig = {};
    labels.forEach((label, index) => {
      config[`r${index}`] = { label, color: SERIES_COLORS[index % SERIES_COLORS.length] };
    });
    const rows = (data?.rating_trend.cycles ?? []).map((cycle) => {
      const entry: Record<string, string | number> = { label: cycle.cycle };
      labels.forEach((label, index) => {
        entry[`r${index}`] = cycle.ratings[label] ?? 0;
      });
      return entry;
    });
    return { config, rows, keys: labels.map((_, index) => `r${index}`) };
  }, [data]);

  const cycles = data?.rating_trend.cycles ?? [];
  const goals = data?.goal_attainment;
  const spread = data?.rater_spread ?? null;

  return (
    <div className="grid gap-6">
      <DataPanel
        tier="tier1"
        title="Ratings by cycle"
        description="Final ratings in the last six cycles, best first by the scores behind them."
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={cycles.length === 0}
        empty={{ icon: Star, title: "No appraisal cycles yet", description: "Ratings appear once a cycle is launched." }}
      >
        <div className="grid gap-5 p-5">
          {ratings.keys.length > 0 && (
            <ChartContainer config={ratings.config} className="aspect-auto h-64 w-full">
              <BarChart data={ratings.rows} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {ratings.keys.map((key) => (
                  <Bar key={key} dataKey={key} stackId="ratings" fill={`var(--color-${key})`} />
                ))}
              </BarChart>
            </ChartContainer>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cycle</TableHead>
                <TableHead className="text-right">Appraisals</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Mean final score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cycles.map((cycle) => (
                <TableRow key={cycle.cycle_id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{cycle.cycle}</div>
                    <div className="text-xs capitalize text-muted-foreground">{cycle.status.replaceAll("_", " ")}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{cycle.appraisal_count}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {cycle.completed} ({cycle.completion_percent}%)
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{cycle.mean_final_score ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DataPanel>

      <DataPanel
        tier="tier1"
        title="Goal attainment"
        description="Active and completed goals per cycle. Cancelled goals are left out: a goal the business withdrew is not one the person missed."
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={(goals?.cycles ?? []).every((row) => row.goals === 0)}
        empty={{ icon: Goal, title: "No goals linked to a cycle" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cycle</TableHead>
              <TableHead className="text-right">Goals</TableHead>
              <TableHead className="text-right">Completed</TableHead>
              <TableHead className="text-right">Average progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(goals?.cycles ?? []).map((row) => (
              <TableRow key={row.cycle_id}>
                <TableCell className="font-medium text-foreground">{row.cycle}</TableCell>
                <TableCell className="text-right tabular-nums">{row.goals}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.completed} ({row.completed_percent}%)
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.average_progress_percent}%</TableCell>
              </TableRow>
            ))}
            {(goals?.departments ?? []).length > 0 && (
              <TableRow>
                <TableCell colSpan={4} className="bg-muted/40 text-xs font-medium text-muted-foreground">
                  By department, {goals?.departments_cycle}
                </TableCell>
              </TableRow>
            )}
            {(goals?.departments ?? []).map((row) => (
              <TableRow key={row.department}>
                <TableCell className="pl-6 text-sm">{row.department}</TableCell>
                <TableCell className="text-right tabular-nums">{row.goals}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.completed} ({row.completed_percent}%)
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.average_progress_percent}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      {spread && (
        <DataPanel
          tier="tier1"
          title={spread.cycle ? `Rater spread, ${spread.cycle}` : "Rater spread"}
          description={spread.rule}
          isEmpty={spread.raters.length === 0}
          empty={{
            icon: Scale,
            title: "Not enough ratings to compare",
            description: "A rater appears once they have submitted enough manager-stage scores.",
          }}
        >
          {spread.overall_mean && (
            <p className="px-5 pt-4 text-sm text-muted-foreground">
              Everyone&apos;s mean {spread.overall_mean}, standard deviation {spread.standard_deviation}, across{" "}
              {spread.scores} scores. A gap can mean a stronger team as easily as a softer rater.
            </p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rater</TableHead>
                <TableHead className="text-right">Scores given</TableHead>
                <TableHead className="text-right">Their mean</TableHead>
                <TableHead className="text-right">Gap</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {spread.raters.map((row) => (
                <TableRow key={row.rater}>
                  <TableCell className="font-medium text-foreground">{row.rater}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.ratings}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.mean_score}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.gap}</TableCell>
                  <TableCell>
                    {row.flagged && <Badge variant="warning">Rates {row.direction} than most</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>
      )}
    </div>
  );
}
