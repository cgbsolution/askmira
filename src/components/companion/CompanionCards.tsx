"use client";

import { AlertTriangle, ChevronRight, ExternalLink, Info, UserRound } from "lucide-react";
import Link from "next/link";
import React from "react";

import { ReportChart } from "@/components/reports/ReportChart";
import { ReportResultTable } from "@/components/reports/ReportResultTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { CompanionCard, CompanionPick } from "./types";

const OUTCOME_LABEL = {
  answered: "Answered",
  partially_answered: "Partly answered",
  refused: "Not answered",
  withheld: "Withheld",
} as const;

/**
 * Where a row opens: in the product (through AskMira's sign-in, in a new tab),
 * or its own page in the portal (a helpdesk ticket), right here.
 */
function RowLink({ href }: { href: string | null | undefined }) {
  if (!href) return null;
  const inProduct = href.startsWith("/launch/");
  return (
    <Button asChild variant="link" size="sm" className="h-auto p-0">
      <Link href={href} {...(inProduct ? { target: "_blank", rel: "noopener" } : {})}>
        {inProduct ? (
          <>
            <ExternalLink /> Open
          </>
        ) : (
          <>
            <ChevronRight /> View
          </>
        )}
      </Link>
    </Button>
  );
}

/**
 * What the companion looked up, rendered under its reply. Each card is a
 * record AskMira read as the person; the model never saw it.
 */
export function CompanionCardView({
  card,
  onPick,
  picking = false,
}: {
  card: CompanionCard;
  /** Sends a choice as the person's next message; absent where choices cannot be sent. */
  onPick?: (pick: CompanionPick) => void;
  picking?: boolean;
}) {
  switch (card.type) {
    case "notice":
      return (
        <Alert variant={card.tone === "warning" ? "destructive" : "default"}>
          {card.tone === "warning" ? <AlertTriangle /> : <Info />}
          <AlertDescription>{card.text}</AlertDescription>
        </Alert>
      );

    case "table":
      return (
        <div className="grid gap-2 rounded-lg border bg-card p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{card.title}</p>
              {card.source ? <Badge variant="outline">From {card.source}</Badge> : null}
            </div>
            <p className="text-xs text-muted-foreground">{card.caption}</p>
          </div>
          <div className="overflow-x-auto">
            {/* table-ok: a compact read-only result inside a chat bubble, not a list screen */}
            <Table>
              <TableHeader>
                <TableRow>
                  {card.columns.map((column) => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                  {card.links ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {card.rows.map((row, index) => (
                  <TableRow key={index}>
                    {row.map((cell, cellIndex) => (
                      <TableCell key={cellIndex} className="whitespace-nowrap">
                        {cell === null || cell === undefined || cell === "" ? "—" : String(cell)}
                      </TableCell>
                    ))}
                    {card.links ? (
                      <TableCell className="whitespace-nowrap text-right">
                        <RowLink href={card.links[index]} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {card.source && card.open ? (
            <Button asChild variant="link" className="h-auto justify-start p-0">
              <Link href={card.open} target="_blank" rel="noopener">
                <ExternalLink /> Open in {card.source}
              </Link>
            </Button>
          ) : null}
        </div>
      );

    case "policy":
      return (
        <div className="grid gap-3 rounded-lg border bg-card p-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant={card.outcome === "answered" ? "secondary" : "outline"}>
              {card.answered_from === "your_record" ? "From your record" : OUTCOME_LABEL[card.outcome]}
            </Badge>
            {card.confidence_band ? <Badge variant="outline">Confidence: {card.confidence_band}</Badge> : null}
          </div>
          <p className="whitespace-pre-line text-sm leading-6">{card.answer}</p>
          {card.citations.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {card.citations.map((citation) => (
                <Button key={citation.id} asChild variant="outline" size="sm">
                  <Link href={citation.href ?? "#"}>
                    [{citation.number}] {citation.label}
                  </Link>
                </Button>
              ))}
            </div>
          ) : null}
          {card.open ? (
            <Button asChild variant="link" className="h-auto justify-start p-0">
              <Link href={card.open}>Open the page</Link>
            </Button>
          ) : null}
        </div>
      );

    case "report": {
      const single =
        card.result && card.result.rows.length === 1 && card.result.columns.length === 1
          ? card.result.rows[0][0]
          : null;
      return (
        <div className="grid gap-3 rounded-lg border bg-card p-3">
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">Read as</p>
            <p className="text-sm font-medium">{card.interpretation}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Confidence: {card.confidence_band}</Badge>
              {!card.answered ? <Badge variant="outline">Not answered</Badge> : null}
            </div>
          </div>
          {card.problem ? (
            <Alert>
              <AlertTitle>The report could not run</AlertTitle>
              <AlertDescription>{card.problem}</AlertDescription>
            </Alert>
          ) : null}
          {card.result ? (
            single !== null ? (
              <p className="text-4xl font-semibold tabular-nums">{String(single)}</p>
            ) : (
              <>
                {card.chart === "bar" || card.chart === "line" ? (
                  <ReportChart result={card.result} chartType={card.chart} className="h-64" />
                ) : null}
                <ReportResultTable result={card.result} />
              </>
            )
          ) : null}
        </div>
      );
    }

    case "own_record":
      return (
        <div className="grid gap-2 rounded-lg border bg-card p-3">
          <Badge variant="secondary" className="w-fit">
            From your record
          </Badge>
          <p className="text-sm leading-6">{card.text}</p>
          <Button asChild variant="link" className="h-auto justify-start p-0">
            <Link href={card.open}>Open the page</Link>
          </Button>
        </div>
      );

    case "record":
      return (
        <div className="grid gap-3 rounded-lg border bg-card p-3">
          <div className="grid gap-0.5">
            <p className="text-sm font-semibold">{card.title}</p>
            {card.subtitle ? <p className="text-xs text-muted-foreground">{card.subtitle}</p> : null}
          </div>
          {card.heading ? (
            <Badge variant="secondary" className="w-fit">
              {card.heading}
            </Badge>
          ) : null}
          {card.figures.length > 0 ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              {card.figures.map((figure) => (
                <div key={figure.label} className="grid min-w-0 gap-0.5">
                  <dt className="text-xs text-muted-foreground">{figure.label}</dt>
                  <dd className="break-words text-sm font-medium tabular-nums">{figure.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {card.table && card.table.rows.length > 0 ? (
            <div className="overflow-x-auto">
              {/* table-ok: a compact read-only result inside a chat bubble, not a list screen */}
              <Table>
                <TableHeader>
                  <TableRow>
                    {card.table.columns.map((column, index) => (
                      <TableHead key={column} className={index > 0 ? "text-right" : undefined}>
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {card.table.rows.map((row, index) => (
                    <TableRow key={index}>
                      {row.map((cell, cellIndex) => (
                        <TableCell
                          key={cellIndex}
                          className={cn("whitespace-nowrap", cellIndex > 0 && "text-right tabular-nums")}
                        >
                          {cell === null || cell === undefined || cell === "" ? "—" : String(cell)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
          {card.note ? <p className="text-xs leading-5 text-muted-foreground">{card.note}</p> : null}
          {card.open ? (
            <Button asChild variant="link" className="h-auto justify-start p-0">
              <Link href={card.open}>
                <ChevronRight /> {card.open_label ?? "Open the page"}
              </Link>
            </Button>
          ) : null}
        </div>
      );

    case "choices":
      return (
        <div className="grid gap-2 rounded-lg border bg-card p-3">
          <div className="grid gap-0.5">
            <p className="text-sm font-medium">{card.title}</p>
            <p className="text-xs text-muted-foreground">{card.caption}</p>
          </div>
          <div className="grid gap-1.5">
            {card.options.map((option) => (
              <Button
                key={`${option.tool}-${JSON.stringify(option.inputs)}`}
                variant="outline"
                className="h-auto w-full justify-start gap-3 px-3 py-2 text-left"
                disabled={!onPick || picking}
                onClick={() => onPick?.(option)}
              >
                <UserRound className="shrink-0 text-muted-foreground" />
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate text-sm font-medium">{option.label}</span>
                  {option.detail ? (
                    <span className="truncate text-xs font-normal text-muted-foreground">{option.detail}</span>
                  ) : null}
                </span>
              </Button>
            ))}
          </div>
        </div>
      );

    case "launch":
      return (
        <Button asChild className="w-fit">
          <Link href={card.href} target="_blank" rel="noopener">
            <ExternalLink /> Open {card.name}
          </Link>
        </Button>
      );

    default:
      return null;
  }
}
