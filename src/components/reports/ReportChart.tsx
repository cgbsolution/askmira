"use client";

import React, { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartType, ReportResult, ResultColumn } from "@/lib/types/reports";

const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
const MAX_CATEGORIES = 40;

function isMeasure(column: ResultColumn): boolean {
  return column.data_type === "integer" || column.data_type === "decimal";
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function label(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

/** The safe key a series lives under in the chart data and its CSS variable. */
function seriesKey(index: number): string {
  return `s${index}`;
}

interface Shaped {
  data: Record<string, string | number>[];
  config: ChartConfig;
  series: string[];
  category: string;
  truncated: boolean;
}

/**
 * Turn a positional report result into chart data.
 *
 * The first non-numeric column is the category; numeric columns are series. A
 * stacked chart over two categories and one measure pivots the second
 * category into series — the shape "headcount by department, by location" needs.
 */
export function shapeForChart(result: ReportResult, chartType: ChartType): Shaped | null {
  const dims = result.columns.map((c, i) => ({ c, i })).filter(({ c }) => !isMeasure(c));
  const measures = result.columns.map((c, i) => ({ c, i })).filter(({ c }) => isMeasure(c));
  if (dims.length === 0 || measures.length === 0 || result.rows.length === 0) return null;

  const category = dims[0];
  if (chartType === "stacked" && dims.length >= 2 && measures.length === 1) {
    const pivot = dims[1];
    const measure = measures[0];
    const pivotValues = [...new Set(result.rows.map((row) => label(row[pivot.i])))].slice(0, 5);
    const byCategory = new Map<string, Record<string, string | number>>();
    for (const row of result.rows) {
      const cat = label(row[category.i]);
      const entry = byCategory.get(cat) ?? { category: cat };
      const idx = pivotValues.indexOf(label(row[pivot.i]));
      if (idx >= 0) entry[seriesKey(idx)] = toNumber(entry[seriesKey(idx)]) + toNumber(row[measure.i]);
      byCategory.set(cat, entry);
    }
    const config: ChartConfig = {};
    pivotValues.forEach((value, idx) => {
      config[seriesKey(idx)] = { label: value, color: SERIES_COLORS[idx % SERIES_COLORS.length] };
    });
    const data = [...byCategory.values()];
    return {
      data: data.slice(0, MAX_CATEGORIES),
      config,
      series: pivotValues.map((_, idx) => seriesKey(idx)),
      category: category.c.label,
      truncated: data.length > MAX_CATEGORIES,
    };
  }

  const used = measures.slice(0, chartType === "pie" ? 1 : 5);
  const config: ChartConfig = {};
  used.forEach(({ c }, idx) => {
    config[seriesKey(idx)] = { label: c.label, color: SERIES_COLORS[idx % SERIES_COLORS.length] };
  });
  const data = result.rows.map((row) => {
    const entry: Record<string, string | number> = { category: label(row[category.i]) };
    used.forEach(({ i }, idx) => {
      entry[seriesKey(idx)] = toNumber(row[i]);
    });
    return entry;
  });
  return {
    data: data.slice(0, MAX_CATEGORIES),
    config,
    series: used.map((_, idx) => seriesKey(idx)),
    category: category.c.label,
    truncated: data.length > MAX_CATEGORIES,
  };
}

/** A report result as a chart, in AskMira's palette, for the chart type the report keeps. */
export function ReportChart({
  result,
  chartType,
  className,
}: {
  result: ReportResult;
  chartType: ChartType;
  className?: string;
}) {
  const shaped = useMemo(() => shapeForChart(result, chartType), [result, chartType]);

  if (chartType === "table") return null;
  if (!shaped) {
    return (
      <p className="text-sm text-muted-foreground">
        A chart needs at least one label column and one number column. Add a count or a sum to
        chart this report.
      </p>
    );
  }

  const { data, config, series, truncated } = shaped;
  return (
    <div className={className}>
      <ChartContainer config={config} className="aspect-auto h-72 w-full">
        {chartType === "pie" ? (
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="category" />} />
            <Pie data={data} dataKey={series[0]} nameKey="category" innerRadius={50} outerRadius={110}>
              {data.map((entry, idx) => (
                <Cell key={String(entry.category)} fill={SERIES_COLORS[idx % SERIES_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        ) : chartType === "line" ? (
          <LineChart data={data} margin={{ left: 8, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="category" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={48} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
            {series.map((key) => (
              <Line key={key} dataKey={key} type="monotone" stroke={`var(--color-${key})`} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        ) : chartType === "stacked" ? (
          <AreaChart data={data} margin={{ left: 8, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="category" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={48} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {series.map((key) => (
              <Area
                key={key}
                dataKey={key}
                type="monotone"
                stackId="all"
                fill={`var(--color-${key})`}
                stroke={`var(--color-${key})`}
                fillOpacity={0.5}
              />
            ))}
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ left: 8, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="category" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={48} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
            {series.map((key) => (
              <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={4} />
            ))}
          </BarChart>
        )}
      </ChartContainer>
      {truncated && (
        <p className="pt-2 text-xs text-muted-foreground">
          The chart shows the first {MAX_CATEGORIES} groups; the table below has every row.
        </p>
      )}
    </div>
  );
}
