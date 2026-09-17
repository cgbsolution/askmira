"use client";

import { Info, Layers, Receipt, TriangleAlert } from "lucide-react";
import React from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { Money } from "@/components/common/Money";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { HraWorking, OtherIncomeLine, TaxWorking } from "@/lib/types/tax";
import { cn } from "@/lib/utils";

import { REGIME_LABEL } from "./common";

/**
 * A tax working as the server computed it. Nothing here adds, subtracts or
 * rounds: every figure is the API's string, rendered.
 */

export function WorkingFigures({ working }: { working: TaxWorking }) {
  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: "Gross annual income", value: working.gross_annual_income },
    { label: "Exemptions", value: working.total_exemptions },
    { label: "Deductions", value: working.total_deductions },
    { label: "Taxable income", value: working.taxable_income, strong: true },
    { label: "Tax on slabs", value: working.tax_before_rebate },
    { label: "Rebate", value: working.rebate },
    { label: "Surcharge", value: working.surcharge },
    { label: "Health and education cess", value: working.cess },
    { label: "Annual tax liability", value: working.annual_tax_liability, strong: true },
  ];
  return (
    <dl className="divide-y divide-border">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 py-2 text-sm">
          <dt className={row.strong ? "font-medium text-foreground" : "text-muted-foreground"}>
            {row.label}
          </dt>
          <dd>
            <Money value={row.value} className={cn(row.strong && "font-semibold text-foreground")} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

const HRA_LABEL: Record<HraWorking["binding_constraint"], string> = {
  actual_hra: "Actual HRA received",
  rent_less_basic: "Rent paid, less the basic-salary offset",
  percentage_of_basic: "Share of basic salary",
};

function HraCard({ hra }: { hra: HraWorking }) {
  const candidates: { key: HraWorking["binding_constraint"]; value: string }[] = [
    { key: "actual_hra", value: hra.actual_hra_received },
    { key: "rent_less_basic", value: hra.rent_less_basic_percentage },
    { key: "percentage_of_basic", value: hra.percentage_of_basic },
  ];
  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>HRA exemption</CardTitle>
        <CardDescription>
          The exemption is the lowest of three limits. The one that applies to you is marked.
        </CardDescription>
        <CardAction>
          <Badge variant="muted">{hra.is_metro ? "Metro rate" : "Non-metro rate"}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-foreground">{hra.explanation}</p>
        <dl className="divide-y divide-border rounded-md border border-border">
          {candidates.map((candidate) => {
            const binding = candidate.key === hra.binding_constraint;
            return (
              <div
                key={candidate.key}
                className={cn(
                  "flex items-center justify-between gap-4 px-3 py-2 text-sm",
                  binding && "bg-secondary/60",
                )}
              >
                <dt className="flex items-center gap-2 text-muted-foreground">
                  {HRA_LABEL[candidate.key]}
                  {binding && <Badge variant="default">Binding limit</Badge>}
                </dt>
                <dd>
                  <Money value={candidate.value} className={cn(binding && "font-semibold")} />
                </dd>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
            <dt className="font-medium text-foreground">Exemption</dt>
            <dd>
              <Money value={hra.exemption} className="font-semibold" />
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function IncomeLinesTable({ lines }: { lines: OtherIncomeLine[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Income</TableHead>
          <TableHead className="hidden md:table-cell">From</TableHead>
          <TableHead>Basis</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line) => (
          <TableRow key={`${line.code}-${line.source}`}>
            <TableCell className="font-medium text-foreground">{line.label}</TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">
              {line.source.replace(/_/g, " ")}
            </TableCell>
            <TableCell className="whitespace-normal text-xs text-muted-foreground">
              {line.basis}
            </TableCell>
            <TableCell className="text-right">
              <Money value={line.amount} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function TaxWorkingView({ working }: { working: TaxWorking }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card tier="tier1">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>How the annual liability is reached.</CardDescription>
            <CardAction>
              <Badge variant="secondary">{REGIME_LABEL[working.regime] ?? working.regime}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <WorkingFigures working={working} />
          </CardContent>
        </Card>

        {working.hra ? (
          <HraCard hra={working.hra} />
        ) : (
          <Card tier="tier1">
            <CardHeader>
              <CardTitle>HRA exemption</CardTitle>
              <CardDescription>No HRA working is part of this projection.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      {working.pending_if_unclaimed.length > 0 && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>Would become taxable if still unclaimed at year end</AlertTitle>
          <AlertDescription>
            <p>Informational — these are not in the liability above.</p>
            <ul className="mt-1 space-y-1">
              {working.pending_if_unclaimed.map((line) => (
                <li key={`${line.code}-${line.source}`}>
                  <span className="font-medium">{line.label}</span>{" "}
                  <Money value={line.amount} /> — {line.basis}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <DataPanel
        title="Deductions"
        description="What you declared, what has been accepted, and what is allowed."
        isEmpty={working.deductions.length === 0}
        empty={{ icon: Receipt, title: "No deductions are part of this working" }}
      >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section</TableHead>
                  <TableHead className="text-right">Declared</TableHead>
                  <TableHead className="text-right">Accepted</TableHead>
                  <TableHead className="text-right">Allowed</TableHead>
                  <TableHead className="text-right">Ceiling</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {working.deductions.map((line) => (
                  <TableRow key={line.section}>
                    <TableCell className="font-medium text-foreground">{line.section}</TableCell>
                    <TableCell className="text-right">
                      <Money value={line.declared} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={line.accepted} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={line.allowed} className="font-medium" />
                    </TableCell>
                    <TableCell className="text-right">
                      {line.ceiling === null ? (
                        <span className="text-muted-foreground">No ceiling</span>
                      ) : (
                        <Money value={line.ceiling} className="text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="whitespace-normal text-xs text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {line.capped && <Badge variant="warning">Capped</Badge>}
                        <span>{line.note}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
      </DataPanel>

      {working.other_income.length > 0 && (
        <DataPanel
          title="Other taxable income reaching TDS"
          description="Taxable amounts from other modules — gratuity, leave encashment, arrears, loan perquisites — included in the income above."
        >
          <IncomeLinesTable lines={working.other_income} />
        </DataPanel>
      )}

      <DataPanel
        title="Slabs"
        description="Tax on each band of taxable income."
        isEmpty={working.slabs.length === 0}
        empty={{ icon: Layers, title: "No slab working is part of this projection" }}
      >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">From</TableHead>
                  <TableHead className="text-right">To</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {working.slabs.map((slab, index) => (
                  <TableRow key={`${slab.from}-${index}`}>
                    <TableCell className="text-right">
                      <Money value={slab.from} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={slab.to} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{slab.rate}%</TableCell>
                    <TableCell className="text-right">
                      <Money value={slab.tax} className="font-medium" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
      </DataPanel>

      {working.notes.length > 0 && (
        <Alert>
          <Info />
          <AlertTitle>Notes on this working</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {working.notes.map((note, index) => (
                <li key={index}>{note}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
