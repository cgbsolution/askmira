"use client";

import { Calculator, History, Loader2 } from "lucide-react";
import React from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { Money } from "@/components/common/Money";
import { QueryBoundary } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { TaxSnapshot, TaxWorking } from "@/lib/types/tax";
import { formatDate } from "@/lib/utils";

import { monthLabel, QueryPanel, REGIME_LABEL, useReloadOn } from "./common";
import { TaxWorkingView } from "./TaxWorkingView";

/**
 * The live TDS preview. It uses declared amounts, so it answers "what does
 * this claim do to my tax" while the employee is still deciding. It reloads
 * whenever a declaration, rent or previous-employer figure is saved.
 */
export function ProjectionPanel({
  financialYear,
  version,
}: {
  financialYear: string;
  version: number;
}) {
  const fy = encodeURIComponent(financialYear);
  const projection = useApiQuery<TaxWorking>(`/tax/projection?financial_year=${fy}`);
  const snapshots = useApiQuery<TaxSnapshot[]>(`/tax/snapshots?financial_year=${fy}`);
  useReloadOn(version, projection.reload);
  useReloadOn(version, snapshots.reload);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">
          A live projection for FY {financialYear} using the amounts you have declared, not only
          what has been proved. It updates when you save a declaration, rent or previous-employer
          figures.
        </p>
        {projection.isLoading && projection.data !== null && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Updating…
          </span>
        )}
      </div>

      {projection.error?.status === 422 ? (
        <Card tier="tier1" className="py-0">
          <EmptyState
            icon={Calculator}
            title={`Nothing can be projected for FY ${financialYear}`}
            description={projection.error.detail}
          />
        </Card>
      ) : projection.error || (projection.isLoading && projection.data === null) ? (
        <Card tier="tier1" className="py-0">
          <QueryBoundary query={projection} skeletonRows={6}>
            {() => null}
          </QueryBoundary>
        </Card>
      ) : (
        projection.data && <TaxWorkingView working={projection.data} />
      )}

      <QueryPanel
        query={snapshots}
        title={
          <span className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" /> Stored projections
          </span>
        }
        description="The projection payroll stored each time it worked out your TDS — so a change in monthly TDS can be traced back."
        loadingRows={3}
        isEmpty={(rows) => rows.length === 0}
        empty={{
          icon: History,
          title: "No stored projections yet",
          description: `Payroll has not stored a TDS projection for you in FY ${financialYear}.`,
        }}
      >
        {(rows) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stored</TableHead>
                <TableHead>For month</TableHead>
                <TableHead>Regime</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">Annual liability</TableHead>
                <TableHead className="text-right">Monthly TDS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground">{formatDate(row.created_at)}</TableCell>
                  <TableCell>{monthLabel(row.computed_for_month)}</TableCell>
                  <TableCell>
                    <Badge variant="muted">{REGIME_LABEL[row.regime] ?? row.regime}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={row.gross_annual_income} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={row.taxable_income} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={row.annual_tax_liability} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={row.monthly_tds} className="font-semibold" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </QueryPanel>
    </div>
  );
}
