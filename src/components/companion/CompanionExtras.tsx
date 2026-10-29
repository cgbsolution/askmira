"use client";

import { Check, CheckCircle2, ChevronRight, Clock, Loader2, X, XCircle } from "lucide-react";
import Link from "next/link";
import React, { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

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

/** Short Indian amounts for an axis: ₹45.2L, ₹1.3Cr. */
function compactINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(0)}k`;
  return `${sign}₹${abs.toFixed(0)}`;
}

function formatValue(unit: string, value: number): string {
  if (unit === "inr") return formatINR(value);
  if (unit === "percent") return `${value}%`;
  return new Intl.NumberFormat("en-IN").format(value);
}

/** A month-by-month series Mira looked up, as a line or bar chart. */
export function CompanionChart({ card }: { card: CompanionChartCard }) {
  const { data, config, keys } = useMemo(() => {
    const keys = card.series.map((_, index) => `s${index}`);
    const config: ChartConfig = {};
    card.series.forEach((series, index) => {
      config[keys[index]] = { label: series.name, color: SERIES_COLORS[index % SERIES_COLORS.length] };
    });
    const data = card.x.map((label, row) => {
      const entry: Record<string, string | number> = { month: label };
      card.series.forEach((series, index) => {
        // An empty value is a month with nothing to show: a gap, never a zero.
        const raw = series.values[row] ?? "";
        const parsed = raw === "" ? Number.NaN : Number.parseFloat(raw);
        if (Number.isFinite(parsed)) entry[keys[index]] = parsed;
      });
      return entry;
    });
    return { data, config, keys };
  }, [card]);

  const tick = (value: number) => (card.unit === "inr" ? compactINR(value) : String(value));
  const tooltip = (
    <ChartTooltipContent
      formatter={(value, name) => (
        <span className="flex w-full justify-between gap-4">
          <span className="text-muted-foreground">{config[String(name)]?.label ?? name}</span>
          <span className="font-mono font-medium tabular-nums">{formatValue(card.unit, Number(value))}</span>
        </span>
      )}
    />
  );

  return (
    <div className="grid gap-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{card.title}</p>
        <p className="text-xs text-muted-foreground">{card.caption}</p>
      </div>
      <ChartContainer config={config} className="aspect-auto h-56 w-full">
        {card.chart === "line" ? (
          <LineChart data={data} margin={{ left: 4, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
            <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={tick} />
            <ChartTooltip content={tooltip} />
            {keys.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
            {keys.map((key) => (
              <Line key={key} dataKey={key} type="monotone" stroke={`var(--color-${key})`} strokeWidth={2} dot />
            ))}
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ left: 4, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
            <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={tick} />
            <ChartTooltip content={tooltip} />
            {keys.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
            {keys.map((key) => (
              <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={4} />
            ))}
          </BarChart>
        )}
      </ChartContainer>
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
