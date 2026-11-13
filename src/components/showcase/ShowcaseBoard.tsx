"use client";

import { Banknote, Briefcase, CalendarCheck, Laptop, LineChart, ListChecks, Scale, Users } from "lucide-react";
import React, { useMemo } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { cn, formatINR } from "@/lib/utils";

import { SystemDot } from "./SystemBadge";
import type { ShowcaseBoard as Board, ShowcaseRun } from "./types";

/** ₹6.15 L, ₹1.25 Cr, ₹35,020: amounts as people say them. Display only. */
export function lakh(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(amount)) return "—";
  const sign = amount < 0 ? "−" : "";
  const abs = Math.abs(amount);
  const short = (n: number) => n.toFixed(2).replace(/\.?0+$/, "");
  if (abs >= 1e7) return `${sign}₹${short(abs / 1e7)} Cr`;
  if (abs >= 1e5) return `${sign}₹${short(abs / 1e5)} L`;
  return `${sign}${formatINR(abs)}`;
}

function axis(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}k`;
  return `${sign}${abs.toFixed(0)}`;
}

function Section({
  icon: Icon,
  title,
  description,
  aside,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card tier="tier2" className={cn("gap-3 py-4", className)}>
      <CardHeader className="px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Icon className="size-4" />
            </span>
            <CardTitle className="truncate text-sm">{title}</CardTitle>
          </div>
          {aside}
        </div>
        {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="px-4">{children}</CardContent>
    </Card>
  );
}

function Figure({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", strong ? "font-semibold text-foreground" : "font-medium")}>{value}</span>
    </div>
  );
}

function MarginCard({ board }: { board: Board }) {
  const now = Number.parseFloat(board.margin.now);
  const floor = Number.parseFloat(board.margin.floor);
  const planned = board.margin.basis === "budget";
  const committed = board.budget.committed ? Number.parseFloat(board.budget.committed) : 0;
  const total = Number.parseFloat(board.budget.total);
  const used = total > 0 ? Math.min(100, Math.round((committed / total) * 100)) : 0;
  const under = !planned && now < floor - 0.0001;
  return (
    <Section
      icon={Scale}
      title="Margin and budget"
      aside={
        planned ? (
          <Badge variant="muted">Planned</Badge>
        ) : under ? (
          <Badge variant="warning">Under the floor</Badge>
        ) : (
          <Badge variant="success">Inside the floor</Badge>
        )
      }
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className={cn("font-display text-4xl leading-none tabular-nums", under ? "text-warning" : "text-foreground")}>
            {board.margin.now}%
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {planned ? "if the team costs the whole budget" : "on the offers made"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold leading-none tabular-nums">{board.margin.floor}%</p>
          <p className="mt-1 text-xs text-muted-foreground">floor</p>
        </div>
      </div>
      <div className="mt-4 grid gap-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Team budget used</span>
          <span className="tabular-nums">
            {board.budget.committed ? lakh(board.budget.committed) : "₹0"} of {lakh(board.budget.total)}
          </span>
        </div>
        <Progress value={used} aria-label="Team budget used" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Up to {lakh(board.budget.per_head)} a year each</span>
          {board.budget.raised ? (
            <span className="font-medium text-warning">Raised from {lakh(board.budget.original)}</span>
          ) : board.budget.headroom ? (
            <span className="tabular-nums">{lakh(board.budget.headroom)} left</span>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

function FunnelCard({ board }: { board: Board }) {
  const top = board.funnel[0]?.count ?? 20;
  return (
    <Section icon={Users} title="Hiring" description="AnytimeHire and HR, step by step">
      <ul className="grid gap-2">
        {board.funnel.map((stage) => (
          <li key={stage.key} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-sm">
            <span className={cn(stage.count === null && "text-muted-foreground")}>{stage.label}</span>
            <Progress value={stage.count === null ? 0 : Math.round((stage.count / Math.max(top, 1)) * 100)} aria-label={stage.label} />
            <span className="text-right font-semibold tabular-nums">{stage.count ?? "—"}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function DayOneCard({ board, run }: { board: Board; run: ShowcaseRun }) {
  const joining = new Date(`${board.joining}T00:00:00`);
  const label = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(joining);
  const hired = board.funnel.find((stage) => stage.key === "hired")?.count;
  return (
    <Section icon={CalendarCheck} title="Day one" description={`${run.scenario.headcount} joiners on ${label}`}>
      <div className="grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <SystemDot system="hrms" /> Joiners in the HRMS
          </span>
          <span className="font-medium tabular-nums">{hired ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <SystemDot system="procureflow" /> Laptops
          </span>
          <span className="text-right font-medium tabular-nums">
            {board.equipment.ordered ? `${board.equipment.count} · ${lakh(board.equipment.total)}` : "—"}
          </span>
        </div>
        {board.equipment.ordered ? (
          <p className="text-xs text-muted-foreground">
            {board.equipment.po} to {board.equipment.vendor}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <SystemDot system="helpdesk" /> IT set-up tickets
          </span>
          <span className="font-medium tabular-nums">{board.equipment.tickets || "—"}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <SystemDot system="expensegenie" /> Kick-off travel
          </span>
          <span className="font-medium tabular-nums">
            {board.travel.shown ? lakh(board.travel.total) : "—"}
            {board.travel.pending ? (
              <Badge variant="warning" className="ml-2">
                {board.travel.pending} to approve
              </Badge>
            ) : null}
          </span>
        </div>
      </div>
    </Section>
  );
}

const CASH_CONFIG = {
  net: { label: "This month", color: "var(--chart-3)" },
  cumulative: { label: "Cash to date", color: "var(--chart-1)" },
} satisfies ChartConfig;

function CashCard({ board, client }: { board: Board; client: string }) {
  const data = useMemo(
    () =>
      board.cash.months.map((month) => ({
        month: month.label.replace(/ (\d{2})(\d{2})$/, " ’$2"),
        net: Number.parseFloat(month.net),
        cumulative: Number.parseFloat(month.cumulative),
      })),
    [board.cash.months],
  );
  const lowest = Number.parseFloat(board.cash.lowest);
  const final = Number.parseFloat(board.cash.final);
  return (
    <Section
      icon={LineChart}
      title="Cash flow"
      description={
        board.cash.basis === "budget"
          ? "On the team budget until offers are accepted"
          : `${client} pays ${board.cash.lag_months === 1 ? "a month" : `${board.cash.lag_months} months`} after each invoice`
      }
      aside={final >= 0 ? <Badge variant="success">Positive</Badge> : <Badge variant="destructive">Negative</Badge>}
    >
      <ChartContainer config={CASH_CONFIG} className="aspect-auto h-48 w-full">
        <ComposedChart data={data} margin={{ left: 0, right: 4, top: 4 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={6} minTickGap={14} fontSize={10} />
          <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={axis} fontSize={10} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
                  <span className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">
                      {CASH_CONFIG[name as keyof typeof CASH_CONFIG]?.label ?? String(name)}
                    </span>
                    <span className="font-mono font-medium tabular-nums">{lakh(Number(value))}</span>
                  </span>
                )}
              />
            }
          />
          <Bar dataKey="net" radius={3} isAnimationActive={false}>
            {data.map((row) => (
              <Cell key={row.month} fill={row.net < 0 ? "var(--destructive)" : "var(--success)"} fillOpacity={0.55} />
            ))}
          </Bar>
          <Line
            dataKey="cumulative"
            type="monotone"
            stroke="var(--color-cumulative)"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted px-2 py-2">
          <p className={cn("text-sm font-semibold tabular-nums", lowest < 0 && "text-destructive")}>{lakh(lowest)}</p>
          <p className="text-[11px] text-muted-foreground">lowest{board.cash.lowest_at ? `, ${board.cash.lowest_at}` : ""}</p>
        </div>
        <div className="rounded-lg bg-muted px-2 py-2">
          <p className="text-sm font-semibold">{board.cash.positive_from ?? (lowest < 0 ? "Never" : "From start")}</p>
          <p className="text-[11px] text-muted-foreground">cash positive</p>
        </div>
        <div className="rounded-lg bg-muted px-2 py-2">
          <p className={cn("text-sm font-semibold tabular-nums", final < 0 ? "text-destructive" : "text-success")}>
            {lakh(final)}
          </p>
          <p className="text-[11px] text-muted-foreground">at the end</p>
        </div>
      </div>
    </Section>
  );
}

function PnlCard({ board }: { board: Board }) {
  const net = Number.parseFloat(board.pnl.net);
  return (
    <Section
      icon={Banknote}
      title="Account P&L"
      description={board.pnl.basis === "budget" ? "Planned, on the team budget" : "On the accepted offers"}
    >
      <Figure label="Revenue" value={lakh(board.pnl.revenue)} />
      <Figure label="Team" value={`−${lakh(board.pnl.team)}`} />
      <Figure label="Laptops" value={Number.parseFloat(board.pnl.laptops) ? `−${lakh(board.pnl.laptops)}` : "—"} />
      <Figure label="Travel" value={Number.parseFloat(board.pnl.travel) ? `−${lakh(board.pnl.travel)}` : "—"} />
      <div className="my-1 h-px bg-border" />
      <Figure
        label="Net"
        strong
        value={
          <span className={net < 0 ? "text-destructive" : "text-success"}>
            {lakh(board.pnl.net)} · {board.pnl.net_pct}%
          </span>
        }
      />
    </Section>
  );
}

function ActivityCard({ board }: { board: Board }) {
  return (
    <Section icon={ListChecks} title="What happened" description="Every step, in the system that did it">
      {board.activity.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet. Start with the order.</p>
      ) : (
        <ol className="grid gap-2.5">
          {board.activity.map((entry, index) => (
            <li key={`${entry.when}-${index}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 text-sm">
              <SystemDot system={entry.system} className="mt-1.5" />
              <div className="min-w-0">
                <p className="leading-5">{entry.text}</p>
                <p className="text-[11px] text-muted-foreground">{entry.when}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

/** The live board: every figure is worked out by the story from what happened in the chat. */
export function ShowcaseBoardView({ run, className }: { run: ShowcaseRun; className?: string }) {
  const board = run.board;
  return (
    <div className={cn("grid gap-3", className)}>
      <Section
        icon={Briefcase}
        title={run.scenario.client}
        description={`${run.scenario.headcount} × ${run.scenario.role} for ${run.scenario.months} months`}
        aside={board.order.booked ? <Badge variant="success">Booked</Badge> : <Badge variant="muted">Not signed</Badge>}
      >
        <Figure label="Order value" value={lakh(board.order.value)} strong />
        <Figure label="PO" value={board.order.booked ? board.order.po : "—"} />
      </Section>
      <MarginCard board={board} />
      <FunnelCard board={board} />
      <DayOneCard board={board} run={run} />
      <CashCard board={board} client={run.scenario.client} />
      <PnlCard board={board} />
      <ActivityCard board={board} />
      <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
        <Laptop className="size-3.5" /> Sample story: no company&apos;s real records are read or changed.
      </p>
    </div>
  );
}
