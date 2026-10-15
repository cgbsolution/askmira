"use client";

import { Clock, Handshake, Megaphone } from "lucide-react";
import React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { DataPanel } from "@/components/common/DataPanel";
import { Money } from "@/components/common/Money";
import {
  type GroupBy,
  sourceLabel,
  stageLabel,
} from "@/components/hiring/AnalyticsNames";
import { percent } from "@/components/hiring/labels";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FunnelReport, OutcomeRates } from "@/lib/types/hiring";

interface SectionProps {
  report: FunnelReport | null;
  isLoading: boolean;
  error?: string | null;
  onRetry: () => void;
}

function days(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value} ${value === 1 ? "day" : "days"}`;
}

/** How long candidates sit between stages, where the sample is big enough to say. */
export function AnalyticsTimingsPanel({ report, isLoading, error, onRetry }: SectionProps) {
  const timings = report?.stage_timings;
  const rows = timings?.transitions ?? [];
  return (
    <DataPanel
      title="Time between stages"
      description={
        timings ? (
          <span className="tabular-nums">
            Median time to hire: {days(timings.median_time_to_hire_days)}
          </span>
        ) : undefined
      }
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={rows.length === 0}
      empty={{
        icon: Clock,
        title: "No stage moves recorded yet",
        description: timings?.note,
      }}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead className="text-right">Sample</TableHead>
              <TableHead className="text-right">Median</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.from_stage}-${row.to_stage}`}>
                <TableCell>{stageLabel(row.from_stage)}</TableCell>
                <TableCell>{stageLabel(row.to_stage)}</TableCell>
                <TableCell className="text-right tabular-nums">{row.sample}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.median_days !== null ? (
                    days(row.median_days)
                  ) : (
                    <span className="text-xs text-muted-foreground">{row.note}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="grid gap-1 px-5 py-4 text-sm">
        {timings?.stalls_at && (
          <p className="text-foreground">
            {timings.stalls_at.reading}{" "}
            <span className="tabular-nums text-muted-foreground">
              ({days(timings.stalls_at.median_days)}
              {timings.stalls_at.share_of_total !== null
                ? `, ${percent(timings.stalls_at.share_of_total)} of the time to hire`
                : ""}
              )
            </span>
          </p>
        )}
        {timings?.note && <p className="text-xs text-muted-foreground">{timings.note}</p>}
      </div>
    </DataPanel>
  );
}

const SOURCE_CHART: ChartConfig = {
  applied: { label: "Applied", color: "var(--chart-1)" },
  offered: { label: "Offered", color: "var(--chart-2)" },
  joined: { label: "Joined", color: "var(--chart-3)" },
};

/** Which sources bring people who get through, and what each hire from them cost. */
export function AnalyticsSourcesPanel({ report, isLoading, error, onRetry }: SectionProps) {
  const section = report?.source_effectiveness;
  const rows = section?.sources ?? [];
  return (
    <DataPanel
      title="Source effectiveness"
      description={section?.note}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={rows.length === 0}
      empty={{ icon: Megaphone, title: "No sources to compare yet" }}
    >
      <div className="px-5 pt-2">
        <ChartContainer config={SOURCE_CHART} className="h-56 w-full">
          <BarChart data={rows} margin={{ left: 8, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="source" tickLine={false} axisLine={false} interval={0} fontSize={11} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="applied" fill="var(--color-applied)" radius={4} />
            <Bar dataKey="offered" fill="var(--color-offered)" radius={4} />
            <Bar dataKey="joined" fill="var(--color-joined)" radius={4} />
          </BarChart>
        </ChartContainer>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Applied</TableHead>
              <TableHead className="text-right">Interviewed</TableHead>
              <TableHead className="text-right">Offered</TableHead>
              <TableHead className="text-right">Joined</TableHead>
              <TableHead className="text-right">Interview pass</TableHead>
              <TableHead className="text-right">To hire</TableHead>
              <TableHead className="text-right">Spend</TableHead>
              <TableHead className="text-right">Cost per hire</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.source}>
                <TableCell className="font-medium text-foreground">{sourceLabel(row.source)}</TableCell>
                <TableCell className="text-right tabular-nums">{row.applied}</TableCell>
                <TableCell className="text-right tabular-nums">{row.interviewed}</TableCell>
                <TableCell className="text-right tabular-nums">{row.offered}</TableCell>
                <TableCell className="text-right tabular-nums">{row.joined}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {percent(row.interview_pass_rate)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {percent(row.conversion_to_hire)}
                </TableCell>
                <TableCell className="text-right">
                  <Money value={row.spend} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={row.cost_per_hire} />
                </TableCell>
                <TableCell className="max-w-72 whitespace-normal text-xs text-muted-foreground">
                  {row.note}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DataPanel>
  );
}

function OutcomeTable({
  title,
  rows,
  keyLabel,
}: {
  title: string;
  rows: (OutcomeRates & { key: string })[];
  keyLabel: (key: string) => string;
}) {
  return (
    <section className="grid gap-1 border-t border-border pt-3">
      <p className="px-5 text-sm font-medium text-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="px-5 pb-2 text-sm text-muted-foreground">No offers to group.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead className="text-right">Offers</TableHead>
                <TableHead className="text-right">Accepted</TableHead>
                <TableHead className="text-right">Declined / lapsed</TableHead>
                <TableHead className="text-right">Joined</TableHead>
                <TableHead className="text-right">Did not join</TableHead>
                <TableHead className="text-right">Revoked</TableHead>
                <TableHead className="text-right">Acceptance</TableHead>
                <TableHead className="text-right">Drop rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="text-foreground">{keyLabel(row.key)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.offers}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.accepted}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.declined_or_lapsed}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.joined}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.dropped}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.revoked}</TableCell>
                  <TableCell className="text-right tabular-nums">{percent(row.acceptance_rate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{percent(row.drop_rate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

/** Offer acceptance and drop, overall and by department, recruiter and notice period. */
export function AnalyticsOfferOutcomesPanel({
  report,
  isLoading,
  error,
  onRetry,
  nameFor,
}: SectionProps & { nameFor: (kind: GroupBy, key: string) => string }) {
  const outcomes = report?.offer_outcomes;
  const overall = outcomes?.overall;
  const stats: [string, React.ReactNode][] = overall
    ? [
        ["Offers", overall.offers],
        ["Accepted", overall.accepted],
        ["Declined or lapsed", overall.declined_or_lapsed],
        ["Joined", overall.joined],
        ["Did not join", overall.dropped],
        ["Revoked", overall.revoked],
        ["Acceptance rate", percent(overall.acceptance_rate)],
        ["Drop rate", percent(overall.drop_rate)],
      ]
    : [];

  return (
    <DataPanel
      title="Offer outcomes"
      description={outcomes?.note}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!overall || overall.offers === 0}
      empty={{ icon: Handshake, title: "No offers made yet" }}
    >
      {outcomes && overall && (
        <div className="grid gap-3 pb-3">
          <dl className="grid grid-cols-2 gap-3 px-5 pt-4 sm:grid-cols-4">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-md border border-border px-3 py-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          <OutcomeTable
            title="By department"
            rows={outcomes.by_department}
            keyLabel={(key) => nameFor("department_id", key)}
          />
          <OutcomeTable
            title="By recruiter"
            rows={outcomes.by_recruiter}
            keyLabel={(key) => nameFor("recruiter_id", key)}
          />
          <OutcomeTable
            title="By notice period"
            rows={outcomes.by_notice_period}
            keyLabel={(key) => (key === "unknown" || key === "unassigned" ? "Not recorded" : key)}
          />
        </div>
      )}
    </DataPanel>
  );
}
