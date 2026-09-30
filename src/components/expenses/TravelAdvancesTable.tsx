"use client";

import { Info } from "lucide-react";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Advance, TravelRequest } from "@/lib/types/expenses";
import { formatDay } from "@/lib/utils";

import { AdvanceStatusBadge, formatMoney } from "./shared";

/** Advances the person has been given, and how much of each is still to account for. */
export function TravelAdvancesTable({
  advances,
  trips,
  currency,
}: {
  advances: Advance[];
  trips: TravelRequest[];
  currency: string;
}) {
  return (
    <Card tier="tier1" className="gap-3 py-2">
      <CardContent className="overflow-x-auto px-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trip</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Issued on</TableHead>
              <TableHead className="text-right">Claimed against</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="text-right">Age (days)</TableHead>
              <TableHead>Blocking</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {advances.map((advance) => {
              const trip = trips.find((item) => item.id === advance.travel_request_id);
              const purpose = advance.trip_purpose ?? trip?.purpose ?? null;
              return (
                <TableRow key={advance.id}>
                  <TableCell className="max-w-xs whitespace-normal">
                    <p className="font-medium text-foreground">{purpose ?? "—"}</p>
                    {advance.trip_to_date && (
                      <p className="text-xs text-muted-foreground">
                        Trip ended {formatDay(advance.trip_to_date, true)}
                      </p>
                    )}
                    {advance.payroll_recovery_ref && (
                      <p className="text-xs text-muted-foreground">
                        Recovered through payroll
                      </p>
                    )}
                    {advance.payroll_refund_ref && (
                      <p className="text-xs text-muted-foreground">
                        Balance paid to you through payroll
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(advance.amount, currency)}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatDay(advance.issued_on, true)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(advance.claimed_against, currency)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(advance.outstanding, currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{advance.age_days}</TableCell>
                  <TableCell>
                    {advance.is_blocking ? (
                      <Badge variant="destructive">Blocking</Badge>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <AdvanceStatusBadge status={advance.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
      <CardContent>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          When an advance is settled, money owed back is recovered in your next payroll, within your
          net pay; money owed to you is paid in your next payroll. Each is marked here once a payroll
          run has taken or paid it.
        </p>
      </CardContent>
    </Card>
  );
}
