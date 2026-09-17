"use client";

import { Ban } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { post } from "@/lib/api";
import type { TravelRequest } from "@/lib/types/expenses";
import { formatDateRange } from "@/lib/utils";

import { CITY_TIER_LABEL, TravelStatusBadge, errorDetail, formatDateTime, formatMoney } from "./shared";

/** The person's trips, with the advance asked for and given, and who decided. */
export function TravelTripsTable({
  trips,
  currency,
  onChanged,
}: {
  trips: TravelRequest[];
  currency: string;
  onChanged: () => void;
}) {
  const [cancelling, setCancelling] = useState<TravelRequest | null>(null);

  const cancel = async () => {
    if (!cancelling) return;
    try {
      await post<TravelRequest>(`/expenses/travel-requests/${cancelling.id}/cancel`);
      toast.success("Travel request cancelled");
      onChanged();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not cancel the travel request."));
      throw caught;
    }
  };

  return (
    <Card tier="tier1" className="py-2">
      <CardContent className="overflow-x-auto px-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trip</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead className="text-right">Estimated</TableHead>
              <TableHead className="text-right">Advance requested / issued</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Decisions</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trips.map((trip) => (
              <TableRow key={trip.id}>
                <TableCell className="max-w-xs whitespace-normal">
                  <p className="font-medium text-foreground">{trip.purpose}</p>
                  <p className="text-xs text-muted-foreground">
                    {trip.destinations
                      .map((stop) => (stop.city_tier ? `${stop.city} (${CITY_TIER_LABEL[stop.city_tier]})` : stop.city))
                      .join(", ") || "—"}
                  </p>
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {formatDateRange(trip.from_date, trip.to_date)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(trip.estimated_cost, currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(trip.advance_requested, currency)} /{" "}
                  {formatMoney(trip.advance_issued, currency)}
                </TableCell>
                <TableCell>
                  <TravelStatusBadge status={trip.status} />
                </TableCell>
                <TableCell className="max-w-xs whitespace-normal">
                  {trip.approvals.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <ul className="space-y-1.5">
                      {trip.approvals.map((step, index) => (
                        <li key={`${step.user_id}-${step.at}-${index}`} className="text-xs">
                          <Badge variant={step.decision === "approved" ? "success" : "destructive"}>
                            {step.decision === "approved" ? "Approved" : "Rejected"}
                          </Badge>{" "}
                          <span className="text-muted-foreground tabular-nums">{formatDateTime(step.at)}</span>
                          {step.note && <p className="mt-0.5 text-foreground">{step.note}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {trip.status === "submitted" && (
                    <Button size="sm" variant="outline" onClick={() => setCancelling(trip)}>
                      <Ban /> Cancel
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title="Cancel this travel request?"
        description={
          cancelling
            ? `${cancelling.purpose}, ${formatDateRange(cancelling.from_date, cancelling.to_date)}. Finance will no longer review it.`
            : undefined
        }
        confirmLabel="Cancel request"
        cancelLabel="Keep it"
        destructive
        onConfirm={cancel}
      />
    </Card>
  );
}
