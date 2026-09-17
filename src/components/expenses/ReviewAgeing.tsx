"use client";

import { Wallet } from "lucide-react";
import React from "react";

import { PersonCell } from "@/components/common/PersonCell";
import { EmptyState } from "@/components/common/EmptyState";
import { QueryBoundary, StatTile } from "@/components/expenses/ReviewCommon";
import { AdvanceStatusBadge, formatMoney } from "@/components/expenses/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Advance, AgeingReport } from "@/lib/types/expenses";
import { formatDay } from "@/lib/utils";

const BUCKETS: { key: keyof AgeingReport["buckets"]; label: string }[] = [
  { key: "0-30", label: "0–30 days" },
  { key: "31-45", label: "31–45 days" },
  { key: "46-90", label: "46–90 days" },
  { key: "over_90", label: "Over 90 days" },
];

/** Outstanding advances by age, and every advance on record. */
export function ReviewAgeing() {
  const ageing = useApiQuery<AgeingReport>("/expenses/advances/ageing");
  const advances = useApiQuery<Advance[]>("/expenses/advances?scope=all");

  return (
    <div className="grid gap-6">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Ageing</CardTitle>
          <CardDescription>
            {ageing.data
              ? `As of ${formatDay(ageing.data.as_of, true)}. An advance unsettled beyond ${ageing.data.block_after_days} days blocks a new one.`
              : "Outstanding advances by how long they have been open."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QueryBoundary query={ageing}>
            {(report) => (
              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatTile label="Total outstanding" value={formatMoney(report.total_outstanding)} />
                  <StatTile
                    label="Blocking a new advance"
                    tone={report.blocking_count > 0 ? "destructive" : "default"}
                    value={report.blocking_count}
                  />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Age</TableHead>
                      <TableHead className="text-right">Advances</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {BUCKETS.map((bucket) => {
                      const row = report.buckets[bucket.key];
                      return (
                        <TableRow key={bucket.key}>
                          <TableCell>{bucket.label}</TableCell>
                          <TableCell className="text-right tabular-nums">{row?.count ?? 0}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(row?.amount)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </QueryBoundary>
        </CardContent>
      </Card>

      <Card tier="tier1">
        <CardHeader>
          <CardTitle>All advances</CardTitle>
          <CardDescription>Every advance issued, settled or cancelled.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <QueryBoundary query={advances}>
            {(rows) =>
              rows.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="No advances yet"
                  description="Advances appear here once finance issues one against an approved trip."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Employee</TableHead>
                      <TableHead>Trip</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-right">Recovered</TableHead>
                      <TableHead className="text-right">Refunded</TableHead>
                      <TableHead className="text-right">Age</TableHead>
                      <TableHead className="pr-5">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((advance) => (
                      <TableRow key={advance.id}>
                        <TableCell className="pl-5">
                          <PersonCell size="sm" name={advance.employee_name ?? "—"} subtitle={advance.employee_code} />
                        </TableCell>
                        <TableCell className="max-w-56 truncate">{advance.trip_purpose ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDay(advance.issued_on, true)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(advance.amount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(advance.outstanding)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(advance.recovered_amount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(advance.refunded_amount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{advance.age_days}d</TableCell>
                        <TableCell className="pr-5">
                          <div className="flex flex-wrap gap-1">
                            <AdvanceStatusBadge status={advance.status} />
                            {advance.is_blocking && <Badge variant="destructive">Blocking</Badge>}
                            {advance.payroll_recovery_ref && (
                              <Badge variant="outline">Payroll recovery {advance.payroll_recovery_ref}</Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            }
          </QueryBoundary>
        </CardContent>
      </Card>
    </div>
  );
}
