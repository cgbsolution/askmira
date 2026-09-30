"use client";

import { Banknote, Check, Loader2, Plane, X } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { PersonCell } from "@/components/common/PersonCell";
import { EmptyState } from "@/components/common/EmptyState";
import { ReviewAdvanceIssueDialog } from "@/components/expenses/ReviewAdvanceIssueDialog";
import { errorDetail, isZero } from "@/components/expenses/ReviewCommon";
import { CITY_TIER_LABEL, TravelStatusBadge, formatMoney } from "@/components/expenses/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type { Advance, DecisionInput, TravelRequest } from "@/lib/types/expenses";
import { formatDate, formatDateRange } from "@/lib/utils";

function TripSummary({ trip }: { trip: TravelRequest }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <PersonCell name={trip.employee_name ?? "Unnamed employee"} subtitle={trip.employee_code} />
        <TravelStatusBadge status={trip.status} />
      </div>
      <p className="text-sm text-foreground">{trip.purpose}</p>
      <p className="text-sm text-muted-foreground">
        {formatDateRange(trip.from_date, trip.to_date)}
        {trip.destinations.length > 0 && " · "}
        {trip.destinations
          .map((d) => (d.city_tier ? `${d.city} (${CITY_TIER_LABEL[d.city_tier]})` : d.city))
          .join(", ")}
      </p>
      <p className="text-sm tabular-nums text-muted-foreground">
        Estimated {formatMoney(trip.estimated_cost)} · advance requested{" "}
        {formatMoney(trip.advance_requested)}
        {!isZero(trip.advance_issued) && ` · issued ${formatMoney(trip.advance_issued)}`}
      </p>
      {trip.created_at && (
        <p className="text-xs text-muted-foreground">Requested {formatDate(trip.created_at)}</p>
      )}
    </div>
  );
}

/**
 * Trips waiting on a decision. At the finance stage, trips approved in this
 * sitting also offer the advance; the advance dialog runs the block check
 * before anything is issued. At the manager stage an approval hands the trip
 * on to finance.
 */
export function ReviewTravel({
  requests,
  approvedTrips = [],
  onApproved,
  onAdvanceIssued,
  onChanged,
  stage = "finance",
}: {
  requests: TravelRequest[];
  approvedTrips?: TravelRequest[];
  onApproved?: (trip: TravelRequest) => void;
  onAdvanceIssued?: (advance: Advance) => void;
  onChanged: () => void;
  stage?: "manager" | "finance";
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<TravelRequest | null>(null);
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [issuing, setIssuing] = useState<TravelRequest | null>(null);

  const decide = async (trip: TravelRequest, approve: boolean, decisionNote: string | null) => {
    setBusyId(trip.id);
    setProblem(null);
    try {
      const body: DecisionInput = { approve, note: decisionNote };
      const path = stage === "manager" ? "manager-decision" : "decision";
      const updated = await post<TravelRequest>(`/expenses/travel-requests/${trip.id}/${path}`, body);
      toast.success(
        stage === "manager" && approve
          ? `Approved ${trip.employee_name ?? "the"} trip; it goes to finance next`
          : `${approve ? "Approved" : "Rejected"} ${trip.employee_name ?? "the"} trip`,
      );
      if (approve && updated.status === "approved") onApproved?.(updated);
      setRejecting(null);
      setNote("");
      onChanged();
    } catch (error) {
      const detail = errorDetail(error, "Could not record the decision.");
      if (!approve) setProblem(detail);
      toast.error(detail);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {approvedTrips.length > 0 && (
        <Card tier="tier1">
          <CardHeader>
            <CardTitle>Approved just now</CardTitle>
            <CardDescription>
              Trips you approved in this sitting. Issue the advance here; the block check runs first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {approvedTrips.map((trip) => {
              const wantsAdvance = !isZero(trip.advance_requested);
              const issued = !isZero(trip.advance_issued);
              return (
                <div
                  key={trip.id}
                  className="flex flex-col gap-3 rounded-md border px-3 py-3 md:flex-row md:items-center"
                >
                  <div className="flex-1">
                    <TripSummary trip={trip} />
                  </div>
                  <div className="shrink-0">
                    {!wantsAdvance ? (
                      <Badge variant="muted">No advance requested</Badge>
                    ) : issued ? (
                      <Badge variant="success">Advance issued</Badge>
                    ) : (
                      <Button size="sm" onClick={() => setIssuing(trip)}>
                        <Banknote /> Issue advance
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {requests.length === 0 ? (
        <Card tier="tier1">
          <EmptyState
            icon={Plane}
            title="No travel requests waiting"
            description={
              stage === "manager"
                ? "Trips from your team appear here when they are raised. Your own trips go to your manager."
                : "Trips appear here once a line manager approves them, or straight away for someone with no manager. Your own trips go to another approver."
            }
          />
        </Card>
      ) : (
        requests.map((trip) => {
          const busy = busyId === trip.id;
          return (
            <Card key={trip.id} tier="tier1" className="gap-0 py-4">
              <CardContent className="flex flex-col gap-4 px-4 md:flex-row md:items-center">
                <div className="flex-1">
                  <TripSummary trip={trip} />
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setNote("");
                      setProblem(null);
                      setRejecting(trip);
                    }}
                  >
                    <X /> Reject
                  </Button>
                  <Button size="sm" disabled={busy} onClick={() => void decide(trip, true, null)}>
                    {busy ? <Loader2 className="animate-spin" /> : <Check />}
                    Approve
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this trip</DialogTitle>
            <DialogDescription>
              {rejecting &&
                `${rejecting.employee_name ?? "The employee"}: ${rejecting.purpose}. They will see your reason.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="trip-reject-note">Reason (required)</Label>
            <Textarea
              id="trip-reject-note"
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          {problem && <p className="text-sm text-destructive">{problem}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Back
            </Button>
            <Button
              variant="destructive"
              disabled={!note.trim() || busyId === rejecting?.id}
              onClick={() => rejecting && void decide(rejecting, false, note.trim())}
            >
              {busyId === rejecting?.id && <Loader2 className="animate-spin" />}
              Reject trip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReviewAdvanceIssueDialog
        trip={issuing}
        onClose={() => setIssuing(null)}
        onIssued={(advance) => {
          onAdvanceIssued?.(advance);
          setIssuing(null);
          onChanged();
        }}
      />
    </div>
  );
}
