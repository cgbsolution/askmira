"use client";

import { Check, CheckCircle2, ChevronRight, Clock, Loader2, X, XCircle } from "lucide-react";
import Link from "next/link";
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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn, formatINR } from "@/lib/utils";

import type { CompanionChartCard, CompanionProposal } from "./types";

const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

/** The design system has five chart colours; past five they repeat, lighter. */
function seriesColor(index: number, name: string): string {
  if (name.startsWith("Others")) return "var(--muted-foreground)";
  return SERIES_COLORS[index % SERIES_COLORS.length];
}
function seriesOpacity(index: number, name: string): number {
  if (name.startsWith("Others")) return 0.45;
  return index >= SERIES_COLORS.length ? 0.55 : 1;
}

/** Short Indian amounts for an axis: ₹45.2L, ₹1.3Cr. */
function compactINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(0)}k`;
  return `${sign}₹${abs.toFixed(0)}`;
}

function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${(value / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${(value / 1e5).toFixed(1)}L`;
  if (abs >= 1e4) return `${(value / 1e3).toFixed(0)}k`;
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value);
}

function formatValue(unit: string, value: number): string {
  if (unit === "inr") return formatINR(value);
  if (unit === "percent") return `${value}%`;
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}

type Shape = "line" | "area" | "bar" | "stacked_bar" | "horizontal_bar" | "pie" | "donut";

/**
 * A figure Mira looked up, drawn the way that fits it: a line or area for a
 * trend, bars to compare, stacked bars for a breakdown, a pie or donut for
 * shares of a whole. An empty value is a gap, never a zero.
 */
export function CompanionChart({ card }: { card: CompanionChartCard }) {
  const shape: Shape = (["line", "area", "bar", "stacked_bar", "horizontal_bar", "pie", "donut"] as const).includes(
    card.chart as Shape,
  )
    ? (card.chart as Shape)
    : "bar";
  const { data, config, keys, slices, total } = useMemo(() => {
    const keys = card.series.map((_, index) => `s${index}`);
    const config: ChartConfig = {};
    card.series.forEach((series, index) => {
      config[keys[index]] = { label: series.name, color: seriesColor(index, series.name) };
    });
    const data = card.x.map((label, row) => {
      const entry: Record<string, string | number> = { month: label };
      card.series.forEach((series, index) => {
        const raw = series.values[row] ?? "";
        const parsed = raw === "" ? Number.NaN : Number.parseFloat(raw);
        if (Number.isFinite(parsed)) entry[keys[index]] = parsed;
      });
      return entry;
    });
    // A pie: one slice per label on x, from the first series.
    const slices = card.x
      .map((label, index) => {
        const value = Number.parseFloat(card.series[0]?.values[index] ?? "");
        return { key: `c${index}`, label, value: Number.isFinite(value) ? value : 0 };
      })
      .filter((slice) => slice.value > 0);
    if (shape === "pie" || shape === "donut") {
      slices.forEach((slice, index) => {
        config[slice.key] = { label: slice.label, color: seriesColor(index, slice.label) };
      });
    }
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    return { data, config, keys, slices, total };
  }, [card, shape]);

  const tick = (value: number) => (card.unit === "inr" ? compactINR(value) : compactNumber(value));
  const formatter = (value: unknown, name: unknown) => (
    <span className="flex w-full justify-between gap-4">
      <span className="text-muted-foreground">{config[String(name)]?.label ?? String(name)}</span>
      <span className="font-mono font-medium tabular-nums">
        {formatValue(card.unit, Number(value))}
        {(shape === "pie" || shape === "donut") && total > 0
          ? ` (${((Number(value) / total) * 100).toFixed(1)}%)`
          : ""}
      </span>
    </span>
  );
  const tooltip = <ChartTooltipContent formatter={formatter} />;
  const legend = keys.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null;
  // Tall enough for every bar's label when they run down the side.
  const rows = card.x.length;
  const height =
    shape === "horizontal_bar"
      ? rows <= 6
        ? "h-56"
        : rows <= 10
          ? "h-80"
          : rows <= 16
            ? "h-[28rem]"
            : "h-[40rem]"
      : shape === "pie" || shape === "donut"
        ? "h-72"
        : "h-56";

  let chart: React.ReactElement;
  if (shape === "pie" || shape === "donut") {
    chart = (
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel formatter={formatter} />} />
        <Pie
          data={slices}
          dataKey="value"
          nameKey="key"
          innerRadius={shape === "donut" ? "55%" : 0}
          outerRadius="80%"
          strokeWidth={2}
          isAnimationActive={false}
        >
          {slices.map((slice, index) => (
            <Cell
              key={slice.key}
              fill={`var(--color-${slice.key})`}
              fillOpacity={seriesOpacity(index, slice.label)}
              stroke="var(--card)"
            />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="key" className="flex-wrap gap-x-3 gap-y-1" />} />
      </PieChart>
    );
  } else if (shape === "horizontal_bar") {
    chart = (
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={tick} />
        <YAxis type="category" dataKey="month" tickLine={false} axisLine={false} width={128} interval={0} />
        <ChartTooltip content={tooltip} />
        {legend}
        {keys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            fill={`var(--color-${key})`}
            fillOpacity={seriesOpacity(index, card.series[index].name)}
            radius={4}
          />
        ))}
      </BarChart>
    );
  } else if (shape === "line") {
    chart = (
      <LineChart data={data} margin={{ left: 4, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={tick} />
        <ChartTooltip content={tooltip} />
        {legend}
        {keys.map((key, index) => (
          <Line
            key={key}
            dataKey={key}
            type="monotone"
            stroke={`var(--color-${key})`}
            strokeOpacity={seriesOpacity(index, card.series[index].name)}
            strokeWidth={2}
            dot
          />
        ))}
      </LineChart>
    );
  } else if (shape === "area") {
    chart = (
      <AreaChart data={data} margin={{ left: 4, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={tick} />
        <ChartTooltip content={tooltip} />
        {legend}
        {keys.map((key) => (
          <Area
            key={key}
            dataKey={key}
            type="monotone"
            stroke={`var(--color-${key})`}
            fill={`var(--color-${key})`}
            fillOpacity={0.2}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    );
  } else {
    const stacked = shape === "stacked_bar";
    chart = (
      <BarChart data={data} margin={{ left: 4, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={tick} />
        <ChartTooltip content={tooltip} />
        {legend}
        {keys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            stackId={stacked ? "stack" : undefined}
            fill={`var(--color-${key})`}
            fillOpacity={seriesOpacity(index, card.series[index].name)}
            radius={stacked ? (index === keys.length - 1 ? [4, 4, 0, 0] : 0) : 4}
          />
        ))}
      </BarChart>
    );
  }

  return (
    <div className="grid gap-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{card.title}</p>
        <p className="text-xs text-muted-foreground">{card.caption}</p>
      </div>
      {(shape === "pie" || shape === "donut") && slices.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing to draw: every value is zero.</p>
      ) : (
        <ChartContainer config={config} className={cn("aspect-auto w-full", height)}>
          {chart}
        </ChartContainer>
      )}
    </div>
  );
}

const STATUS: Record<CompanionProposal["status"], { label: string; icon: React.ElementType; tone: string }> = {
  proposed: { label: "Waiting for you", icon: Clock, tone: "text-muted-foreground" },
  done: { label: "Done", icon: CheckCircle2, tone: "text-success" },
  cancelled: { label: "Cancelled", icon: XCircle, tone: "text-muted-foreground" },
  failed: { label: "Not done", icon: XCircle, tone: "text-destructive" },
  expired: { label: "Expired — ask again", icon: Clock, tone: "text-muted-foreground" },
};

/**
 * Something Mira offered to do. Nothing has happened while it waits: Confirm
 * runs the module's own check and sends it, as the person; Cancel drops it.
 */
export function CompanionProposalCard({
  card,
  onDecide,
  busy,
}: {
  card: CompanionProposal;
  onDecide?: (card: CompanionProposal, confirm: boolean) => void;
  busy?: boolean;
}) {
  const state = STATUS[card.status] ?? STATUS.proposed;
  const Icon = state.icon;
  const open = card.status === "proposed";
  return (
    <div className={cn("grid gap-3 rounded-lg border bg-card p-3", open && "border-primary/40")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{card.title}</p>
        <Badge variant={open ? "secondary" : "outline"} className="gap-1">
          <Icon className={cn("size-3.5", state.tone)} /> {state.label}
        </Badge>
      </div>
      {card.figures.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {card.figures.map((figure) => (
            <div key={`${figure.label}-${figure.value}`} className="grid min-w-0 gap-0.5">
              <dt className="text-xs text-muted-foreground">{figure.label}</dt>
              <dd className="break-words text-sm font-medium tabular-nums">{figure.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {card.notes.filter(Boolean).length > 0 ? (
        <ul className="grid gap-1 text-xs leading-5 text-muted-foreground">
          {card.notes.filter(Boolean).map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      {card.result?.text && !open ? (
        <p className={cn("text-sm", card.result.error && "text-destructive")}>{card.result.text}</p>
      ) : null}
      {open && onDecide ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={busy} onClick={() => onDecide(card, true)}>
            {busy ? <Loader2 className="animate-spin" /> : <Check />} {card.confirm_label || "Confirm"}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide(card, false)}>
            <X /> Cancel
          </Button>
          <p className="text-xs text-muted-foreground">Or reply “yes” to {card.confirm_label.toLowerCase() || "confirm"}.</p>
        </div>
      ) : null}
      {card.result?.open && card.status === "done" ? (
        <Button asChild variant="link" className="h-auto justify-start p-0">
          <Link href={card.result.open}>
            <ChevronRight /> Open the page
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

/** One line of a reply, with **bold** kept and nothing else interpreted. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
          <strong key={index} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

/**
 * Mira's reply: paragraphs, "- " lists and **bold**. Rendered as text, never
 * as HTML, so nothing the model writes can become markup.
 */
export function ChatText({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className="grid gap-2 text-sm leading-6">
      {blocks.map((block, index) => {
        const lines = block.split("\n").filter((line) => line.trim() !== "");
        const bullets = lines.filter((line) => /^\s*[-•*]\s+/.test(line));
        if (lines.length > 0 && bullets.length === lines.length) {
          return (
            <ul key={index} className="grid list-disc gap-1 pl-5">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>
                  <Inline text={line.replace(/^\s*[-•*]\s+/, "")} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="whitespace-pre-line">
            <Inline text={block} />
          </p>
        );
      })}
    </div>
  );
}
