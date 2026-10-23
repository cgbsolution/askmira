"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Clock, Handshake, Megaphone } from "lucide-react";
import React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { DataTable } from "@/components/common/data-table/DataTable";
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

/** Counts and rates: right-aligned, in tabular figures. */
const FIGURE = { className: "text-right", cellClassName: "tabular-nums" };

type Transition = FunnelReport["stage_timings"]["transitions"][number];

const TIMING_COLUMNS: ColumnDef<Transition>[] = [
  { id: "from_stage", header: "From", accessorFn: (row) => stageLabel(row.from_stage) },
  { id: "to_stage", header: "To", accessorFn: (row) => stageLabel(row.to_stage) },
  { accessorKey: "sample", header: "Sample", meta: FIGURE },
  {
    accessorKey: "median_days",
    header: "Median",
    meta: { ...FIGURE, text: (row) => (row.median_days !== null ? days(row.median_days) : row.note) },
    cell: ({ row }) =>
      row.original.median_days !== null ? (
        days(row.original.median_days)
      ) : (
        <span className="text-xs text-muted-foreground">{row.original.note}</span>
      ),
  },
];

/** How long candidates sit between stages, where the sample is big enough to say. */
export function AnalyticsTimingsPanel({ report, isLoading, error, onRetry }: SectionProps) {
  const timings = report?.stage_timings;
  const rows = timings?.transitions ?? [];
  return (
    <DataTable
      title="Time between stages"
      description={
        timings ? (
          <span className="grid gap-1">
            <span className="tabular-nums">
              Median time to hire: {days(timings.median_time_to_hire_days)}
            </span>
            {/* With the table only: with no moves, the note is the empty state's text. */}
            {rows.length > 0 && timings.stalls_at && (
              <span className="text-foreground">
                {timings.stalls_at.reading}{" "}
                <span className="tabular-nums text-muted-foreground">
                  ({days(timings.stalls_at.median_days)}
                  {timings.stalls_at.share_of_total !== null
                    ? `, ${percent(timings.stalls_at.share_of_total)} of the time to hire`
                    : ""}
                  )
                </span>
              </span>
            )}
            {rows.length > 0 && timings.note && <span className="text-xs">{timings.note}</span>}
          </span>
        ) : undefined
      }
      columns={TIMING_COLUMNS}
      data={rows}
      getRowId={(row) => `${row.from_stage}-${row.to_stage}`}
      noun="stage moves"
      exportName="hiring-stage-timings"
      searchPlaceholder="Search stages"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      empty={{
        icon: Clock,
        title: "No stage moves recorded yet",
        description: timings?.note,
      }}
    />
  );
}

const SOURCE_CHART: ChartConfig = {
  applied: { label: "Applied", color: "var(--chart-1)" },
  offered: { label: "Offered", color: "var(--chart-2)" },
  joined: { label: "Joined", color: "var(--chart-3)" },
};

type SourceRow = FunnelReport["source_effectiveness"]["sources"][number];

const SOURCE_COLUMNS: ColumnDef<SourceRow>[] = [
  {
    id: "source",
    header: "Source",
    accessorFn: (row) => sourceLabel(row.source),
    meta: { cellClassName: "font-medium text-foreground" },
  },
  { accessorKey: "applied", header: "Applied", meta: FIGURE },
  { accessorKey: "interviewed", header: "Interviewed", meta: FIGURE },
  { accessorKey: "offered", header: "Offered", meta: FIGURE },
  { accessorKey: "joined", header: "Joined", meta: FIGURE },
  {
    accessorKey: "interview_pass_rate",
    header: "Interview pass",
    meta: { ...FIGURE, text: (row) => percent(row.interview_pass_rate) },
    cell: ({ row }) => percent(row.original.interview_pass_rate),
  },
  {
    accessorKey: "conversion_to_hire",
    header: "To hire",
    meta: { ...FIGURE, text: (row) => percent(row.conversion_to_hire) },
    cell: ({ row }) => percent(row.original.conversion_to_hire),
  },
  {
    accessorKey: "spend",
    header: "Spend",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.spend} />,
  },
  {
    accessorKey: "cost_per_hire",
    header: "Cost per hire",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.cost_per_hire} />,
  },
  {
    accessorKey: "note",
    header: "Note",
    meta: { cellClassName: "max-w-72 whitespace-normal text-xs text-muted-foreground" },
  },
];

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
      <DataTable
        columns={SOURCE_COLUMNS}
        data={rows}
        getRowId={(row) => row.source}
        noun="sources"
        exportName="hiring-source-effectiveness"
        searchPlaceholder="Search sources"
        bordered={false}
        className="border-t border-border"
      />
    </DataPanel>
  );
}

type OutcomeRow = OutcomeRates & { key: string };

function OutcomeTable({
  title,
  rows,
  keyLabel,
  exportName,
}: {
  title: string;
  rows: OutcomeRow[];
  keyLabel: (key: string) => string;
  exportName: string;
}) {
  const columns: ColumnDef<OutcomeRow>[] = [
    {
      id: "group",
      header: "Group",
      accessorFn: (row) => keyLabel(row.key),
      meta: { cellClassName: "text-foreground" },
    },
    { accessorKey: "offers", header: "Offers", meta: FIGURE },
    { accessorKey: "accepted", header: "Accepted", meta: FIGURE },
    { accessorKey: "declined_or_lapsed", header: "Declined / lapsed", meta: FIGURE },
    { accessorKey: "joined", header: "Joined", meta: FIGURE },
    { accessorKey: "dropped", header: "Did not join", meta: FIGURE },
    { accessorKey: "revoked", header: "Revoked", meta: FIGURE },
    {
      accessorKey: "acceptance_rate",
      header: "Acceptance",
      meta: { ...FIGURE, text: (row) => percent(row.acceptance_rate) },
      cell: ({ row }) => percent(row.original.acceptance_rate),
    },
    {
      accessorKey: "drop_rate",
      header: "Drop rate",
      meta: { ...FIGURE, text: (row) => percent(row.drop_rate) },
      cell: ({ row }) => percent(row.original.drop_rate),
    },
  ];
  return (
    <section className="grid gap-1 border-t border-border pt-3">
      <p className="px-5 text-sm font-medium text-foreground">{title}</p>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.key}
        noun="groups"
        exportName={exportName}
        searchPlaceholder="Search groups"
        bordered={false}
        empty={{ icon: Handshake, title: "No offers to group" }}
      />
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
            exportName="offer-outcomes-by-department"
          />
          <OutcomeTable
            title="By recruiter"
            rows={outcomes.by_recruiter}
            keyLabel={(key) => nameFor("recruiter_id", key)}
            exportName="offer-outcomes-by-recruiter"
          />
          <OutcomeTable
            title="By notice period"
            rows={outcomes.by_notice_period}
            keyLabel={(key) => (key === "unknown" || key === "unassigned" ? "Not recorded" : key)}
            exportName="offer-outcomes-by-notice-period"
          />
        </div>
      )}
    </DataPanel>
  );
}
