"use client";

import { FolderOpen, Send } from "lucide-react";
import React, { useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Claim, ExpenseReport, TravelRequest } from "@/lib/types/expenses";
import { formatDateRange, formatDay } from "@/lib/utils";

import { ReportCreateDialog } from "./ReportCreateDialog";
import { ReportSubmitDialog } from "./ReportSubmitDialog";
import {
  ClaimStatusBadge,
  ReportStatusBadge,
  VerdictBadge,
  formatDateTime,
  formatMoney,
  humanizeKey,
} from "./shared";

/** The person's expense reports with their lines. */
export function ReportsPanel({
  reports,
  trips,
  currency,
  onChanged,
  onSelectClaim,
}: {
  reports: ExpenseReport[];
  trips: TravelRequest[];
  currency: string;
  onChanged: () => void;
  onSelectClaim: (claim: Claim) => void;
}) {
  const [submitting, setSubmitting] = useState<ExpenseReport | null>(null);

  if (reports.length === 0) {
    return (
      <Card tier="tier1">
        <EmptyState
          icon={FolderOpen}
          title="No expense reports"
          description="A report groups claims, usually from one trip, so they are approved together. Create one, then pick it when you add a claim."
          action={<ReportCreateDialog trips={trips} onCreated={onChanged} />}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ReportCreateDialog trips={trips} onCreated={onChanged} />
      </div>

      {reports.map((report) => {
        const trip = report.travel_request_id
          ? trips.find((item) => item.id === report.travel_request_id)
          : undefined;
        return (
          <Card key={report.id} tier="tier1">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {report.title}
                <ReportStatusBadge status={report.status} />
                {report.blocked_lines > 0 && (
                  <Badge variant="destructive">
                    {report.blocked_lines} blocked {report.blocked_lines === 1 ? "line" : "lines"}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="tabular-nums">
                {report.line_count} {report.line_count === 1 ? "claim" : "claims"} · Total{" "}
                <span className="font-semibold text-foreground">{formatMoney(report.total_amount, currency)}</span>
                {trip && ` · ${trip.purpose} (${formatDateRange(trip.from_date, trip.to_date)})`}
                {report.submitted_at && ` · Submitted ${formatDateTime(report.submitted_at)}`}
              </CardDescription>
              {report.status === "draft" && (
                <CardAction>
                  <Button size="sm" onClick={() => setSubmitting(report)}>
                    <Send /> Submit report
                  </Button>
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {report.lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No claims in this report yet. Pick this report when you add a claim.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Policy</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.lines.map((line) => (
                      <TableRow
                        key={line.id}
                        tabIndex={0}
                        className="cursor-pointer"
                        onClick={() => onSelectClaim(line)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSelectClaim(line);
                          }
                        }}
                      >
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {formatDay(line.incurred_on, true)}
                        </TableCell>
                        <TableCell>{humanizeKey(line.category_key)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(line.amount, currency)}
                        </TableCell>
                        <TableCell>
                          <VerdictBadge kind={line.policy_verdict} />
                        </TableCell>
                        <TableCell>
                          <ClaimStatusBadge status={line.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );
      })}

      <ReportSubmitDialog
        report={submitting}
        currency={currency}
        onOpenChange={(open) => !open && setSubmitting(null)}
        onSubmitted={onChanged}
      />
    </div>
  );
}
