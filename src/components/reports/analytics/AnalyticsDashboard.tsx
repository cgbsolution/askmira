"use client";

import { Activity, HeartPulse, LineChart as LineChartIcon, UsersRound } from "lucide-react";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { StatTile } from "@/components/expenses/ReviewCommon";
import { Badge } from "@/components/ui/badge";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Attrition, HeadcountPoint, LeaveTrend, PersonSignals, Signal } from "@/lib/types/reports";

import { AbsenceScoresPanel } from "./AbsenceScoresPanel";
import { PerformancePanel } from "./PerformancePanel";
import { PinnedReports } from "./PinnedReports";

const WINDOWS = ["6", "12", "24"] as const;
const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-09` → `Sep 26`. */
function monthLabel(month: string): string {
  const [year, index] = month.split("-");
  return `${MONTHS[Number(index) - 1] ?? index} ${year.slice(2)}`;
}

const SIGNAL_TONE: Record<Signal["kind"], "destructive" | "warning" | "muted"> = {
  burnout_risk: "destructive",
  no_leave: "warning",
  bridge_absences: "muted",
  unpaid_absence: "warning",
  frequent_absence: "warning",
  pay_revision: "muted",
};

/**
 * People analytics: headcount, attrition as a rate, leave, and the signals.
 *
 * Every figure comes from the API, scoped the way the API scopes it — HR sees
 * the company, a line manager their reporting line. The signals are rules with
 * their evidence, never a score.
 */
export function AnalyticsDashboard() {
  const [months, setMonths] = useState<(typeof WINDOWS)[number]>("12");

  return (
    <PageShell
      title="People analytics"
      description="Headcount, attrition and leave over time, and the patterns worth a conversation."
      tier="tier1"
      actions={
        <Select value={months} onValueChange={(next) => setMonths(next as (typeof WINDOWS)[number])}>
          <SelectTrigger className="w-40" aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WINDOWS.map((value) => (
              <SelectItem key={value} value={value}>
                Last {value} months
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <Tabs defaultValue="workforce">
        <TabsList>
          <TabsTrigger value="workforce">Workforce</TabsTrigger>
          <TabsTrigger value="absence">Leave and absence</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="pinned">Pinned reports</TabsTrigger>
        </TabsList>
        <TabsContent value="workforce" className="mt-4 grid gap-6">
          <Workforce months={months} />
        </TabsContent>
        <TabsContent value="absence" className="mt-4 grid gap-6">
          <SignalsPanel />
          <LeavePanel months={months} />
          <AbsenceScoresPanel />
        </TabsContent>
        <TabsContent value="performance" className="mt-4">
          <PerformancePanel />
        </TabsContent>
        <TabsContent value="pinned" className="mt-4">
          <PinnedReports />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function Workforce({ months }: { months: string }) {
  const headcount = useApiQuery<HeadcountPoint[]>(`/reports/analytics/headcount?months=${months}`);
  const attrition = useApiQuery<Attrition>(`/reports/analytics/attrition?months=${months}&by_department=true`);

  const latest = headcount.data?.at(-1);
  const joiners = (headcount.data ?? []).reduce((sum, row) => sum + row.joiners, 0);
  const headcountData = useMemo(
    () => (headcount.data ?? []).map((row) => ({ ...row, label: monthLabel(row.month) })),
    [headcount.data],
  );
  const attritionData = useMemo(
    () =>
      (attrition.data?.monthly ?? []).map((row) => ({
        label: monthLabel(row.month),
        total: Number(row.rate_percent),
        voluntary: Number(row.voluntary_rate_percent),
        exits: row.exits,
      })),
    [attrition.data],
  );

  const headcountConfig: ChartConfig = {
    headcount: { label: "Headcount", color: SERIES_COLORS[0] },
    joiners: { label: "Joiners", color: SERIES_COLORS[1] },
    leavers: { label: "Leavers", color: SERIES_COLORS[3] },
  };
  const attritionConfig: ChartConfig = {
    total: { label: "All exits %", color: SERIES_COLORS[3] },
    voluntary: { label: "Voluntary %", color: SERIES_COLORS[1] },
  };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Headcount today" value={latest ? latest.headcount : "—"} hint="People employed at the end of this month" />
        <StatTile label={`Joiners, last ${months} months`} value={headcount.data ? joiners : "—"} />
        <StatTile
          label="Attrition"
          value={attrition.data ? `${attrition.data.attrition_percent}%` : "—"}
          hint={attrition.data ? `${attrition.data.exits} exits over an average of ${attrition.data.average_headcount}` : undefined}
        />
        <StatTile
          label="Voluntary attrition"
          value={attrition.data ? `${attrition.data.voluntary_attrition_percent}%` : "—"}
          hint={attrition.data ? `${attrition.data.voluntary_exits} resignations and retirements` : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DataPanel
          tier="tier1"
          title="Headcount"
          description="At each month end, with that month's joiners and leavers."
          isLoading={headcount.isLoading}
          error={headcount.error?.detail ?? null}
          onRetry={headcount.reload}
          isEmpty={headcountData.every((row) => row.headcount === 0)}
          empty={{ icon: UsersRound, title: "Nobody in this period", description: "Nobody you can see was employed in these months." }}
        >
          <div className="p-5">
            <ChartContainer config={headcountConfig} className="aspect-auto h-72 w-full">
              <ComposedChart data={headcountData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis yAxisId="people" tickLine={false} axisLine={false} width={40} />
                <YAxis yAxisId="moves" orientation="right" tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar yAxisId="moves" dataKey="joiners" fill="var(--color-joiners)" radius={3} />
                <Bar yAxisId="moves" dataKey="leavers" fill="var(--color-leavers)" radius={3} />
                <Line yAxisId="people" dataKey="headcount" type="monotone" stroke="var(--color-headcount)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ChartContainer>
          </div>
        </DataPanel>

        <DataPanel
          tier="tier1"
          title="Attrition by month"
          description={attrition.data?.basis}
          isLoading={attrition.isLoading}
          error={attrition.error?.detail ?? null}
          onRetry={attrition.reload}
          isEmpty={attritionData.length === 0}
          empty={{ icon: Activity, title: "No months to show" }}
        >
          <div className="p-5">
            <ChartContainer config={attritionConfig} className="aspect-auto h-72 w-full">
              <BarChart data={attritionData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={40} unit="%" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={3} />
                <Bar dataKey="voluntary" fill="var(--color-voluntary)" radius={3} />
              </BarChart>
            </ChartContainer>
          </div>
        </DataPanel>
      </div>

      {(attrition.data?.by_department ?? []).length > 0 && (
        <DataPanel tier="tier1" title="Attrition by department" description={`From ${attrition.data?.from} to ${attrition.data?.to}.`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Average headcount</TableHead>
                <TableHead className="text-right">Exits</TableHead>
                <TableHead className="text-right">Attrition</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(attrition.data?.by_department ?? []).map((row) => (
                <TableRow key={row.department}>
                  <TableCell className="font-medium text-foreground">{row.department}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.average_headcount}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.exits}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.attrition_percent}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>
      )}
    </>
  );
}

function LeavePanel({ months }: { months: string }) {
  const { data, error, isLoading, reload } = useApiQuery<LeaveTrend>(`/reports/analytics/leave-trend?months=${months}`);

  // Leave type names are free text; chart keys become CSS variables, so they get safe keys.
  const { rows, config, keys } = useMemo(() => {
    const types = data?.leave_types ?? [];
    const chartConfig: ChartConfig = {};
    types.forEach((name, index) => {
      chartConfig[`t${index}`] = { label: name, color: SERIES_COLORS[index % SERIES_COLORS.length] };
    });
    const chartRows = (data?.months ?? []).map((row) => {
      const entry: Record<string, string | number> = { label: monthLabel(row.month) };
      types.forEach((name, index) => {
        entry[`t${index}`] = Number(row[name] ?? 0);
      });
      return entry;
    });
    return { rows: chartRows, config: chartConfig, keys: types.map((_, index) => `t${index}`) };
  }, [data]);

  return (
    <DataPanel
      tier="tier1"
      title="Leave taken"
      description="Approved leave days, by the month the leave starts."
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
      isEmpty={keys.length === 0}
      empty={{ icon: LineChartIcon, title: "No approved leave in this period" }}
    >
      <div className="p-5">
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <BarChart data={rows} margin={{ left: 8, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {keys.map((key) => (
              <Bar key={key} dataKey={key} stackId="leave" fill={`var(--color-${key})`} />
            ))}
          </BarChart>
        </ChartContainer>
      </div>
    </DataPanel>
  );
}

function SignalsPanel() {
  const { data, error, isLoading, reload } = useApiQuery<PersonSignals[]>("/reports/analytics/signals");

  return (
    <DataPanel
      tier="tier1"
      title="Signals"
      description="Rules, not predictions: each flag shows the rule it applied and the record behind it. Check it before acting on it."
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
      isEmpty={(data ?? []).length === 0}
      empty={{ icon: HeartPulse, title: "Nothing flagged", description: "No one you can see meets any of the rules today." }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>Signal</TableHead>
            <TableHead>Evidence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).flatMap((person) =>
            person.signals.map((signal, index) => (
              <TableRow key={`${person.employee_id}-${signal.kind}`}>
                <TableCell className="align-top">
                  {index === 0 && (
                    <Link href={`/people/${person.employee_id}`} className="hover:underline">
                      <PersonCell name={person.employee_name} subtitle={person.employee_code} size="sm" />
                    </Link>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  <Badge variant={SIGNAL_TONE[signal.kind]}>{signal.label}</Badge>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">{signal.rule}</p>
                </TableCell>
                <TableCell className="align-top text-sm">
                  <ul className="grid gap-0.5">
                    {signal.evidence.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </TableCell>
              </TableRow>
            )),
          )}
        </TableBody>
      </Table>
    </DataPanel>
  );
}
