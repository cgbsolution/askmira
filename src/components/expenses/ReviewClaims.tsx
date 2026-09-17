"use client";

import { Check, Download, Inbox, Loader2, X } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { PersonCell } from "@/components/common/PersonCell";
import { EmptyState } from "@/components/common/EmptyState";
import { errorDetail, isZero } from "@/components/expenses/ReviewCommon";
import { CLAIM_KIND_LABEL, CITY_TIER_LABEL, VerdictBadge, formatMoney, humanizeKey } from "@/components/expenses/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { downloadFile, post } from "@/lib/api";
import type { Claim, DecisionInput } from "@/lib/types/expenses";
import { formatDate, formatDay } from "@/lib/utils";

/**
 * Submitted claims, each with the policy engine's verdict as it was recorded
 * at capture. Rejecting needs a reason — the server insists as well.
 */
export function ReviewClaims({ claims, onChanged }: { claims: Claim[]; onChanged: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Claim | null>(null);
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const decide = async (claim: Claim, approve: boolean, decisionNote: string | null) => {
    setBusyId(claim.id);
    setProblem(null);
    try {
      const body: DecisionInput = { approve, note: decisionNote };
      await post<{ claim_id: string; status: string; decided_at: string }>(
        `/expenses/claims/${claim.id}/decision`,
        body,
      );
      toast.success(
        `${approve ? "Approved" : "Rejected"} ${claim.employee_name ?? "the"} claim for ${formatMoney(claim.amount)}`,
      );
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

  const downloadReceipt = async (claim: Claim) => {
    if (!claim.receipt_document_id) return;
    try {
      await downloadFile(`/expenses/receipts/${claim.receipt_document_id}`, `receipt-${claim.id}`);
    } catch (error) {
      toast.error(errorDetail(error, "Could not download the receipt."));
    }
  };

  if (claims.length === 0) {
    return (
      <Card tier="tier1">
        <EmptyState
          icon={Inbox}
          title="No claims waiting"
          description="Claims appear here once an employee submits them. Your own claims go to another approver."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {claims.map((claim) => {
        const busy = busyId === claim.id;
        const foreign = claim.original_currency.toUpperCase() !== "INR";
        return (
          <Card key={claim.id} tier="tier1" className="gap-0 py-4">
            <CardContent className="flex flex-col gap-4 px-4 lg:flex-row lg:items-start">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <PersonCell name={claim.employee_name ?? "Unnamed employee"} subtitle={claim.employee_code} />
                  <Badge variant="secondary">{humanizeKey(claim.category_key)}</Badge>
                  <VerdictBadge kind={claim.policy_verdict} />
                  {claim.flagged_for_approver && <Badge variant="warning">Flagged for you</Badge>}
                  {claim.exceeds_route_tolerance && (
                    <Badge variant="warning">Distance beyond route tolerance</Badge>
                  )}
                  {!claim.has_receipt && <Badge variant="muted">No receipt</Badge>}
                </div>

                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="text-lg font-semibold tabular-nums text-foreground">
                    {formatMoney(claim.amount)}
                  </p>
                  {foreign && (
                    <p className="text-sm tabular-nums text-muted-foreground">
                      {formatMoney(claim.original_amount, claim.original_currency)}
                      {claim.exchange_rate &&
                        ` at ${claim.exchange_rate}${claim.exchange_rate_date ? ` (${formatDay(claim.exchange_rate_date, true)})` : ""}`}
                      {claim.exchange_rate_source && ` · ${claim.exchange_rate_source}`}
                    </p>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  {CLAIM_KIND_LABEL[claim.kind]} · {CITY_TIER_LABEL[claim.city_tier]} · incurred{" "}
                  {formatDay(claim.incurred_on, true)}
                  {claim.submitted_at && ` · submitted ${formatDate(claim.submitted_at)}`}
                </p>

                {claim.kind === "mileage" && claim.distance_km && (
                  <p className="text-sm text-muted-foreground">
                    <span className="tabular-nums">{claim.distance_km} km</span>
                    {claim.vehicle_type && ` by ${humanizeKey(claim.vehicle_type)}`}
                    {claim.route_km && (
                      <>
                        {" "}
                        · declared route <span className="tabular-nums">{claim.route_km} km</span>
                      </>
                    )}
                  </p>
                )}
                {claim.kind === "per_diem" && claim.per_diem_days !== null && (
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {claim.per_diem_days} {claim.per_diem_days === 1 ? "day" : "days"}
                  </p>
                )}

                {claim.description && <p className="text-sm text-foreground">{claim.description}</p>}

                <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                  <p className="text-foreground">{claim.verdict_message}</p>
                  {claim.limit_amount !== null && (
                    <p className="mt-1 tabular-nums text-muted-foreground">
                      Limit {formatMoney(claim.limit_amount)} · already claimed{" "}
                      {formatMoney(claim.already_claimed)}
                      {!isZero(claim.overage) && (
                        <span className="font-medium text-destructive">
                          {" "}
                          · over by {formatMoney(claim.overage)}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {claim.justification && (
                  <blockquote className="border-l-2 border-border pl-3 text-sm text-muted-foreground">
                    “{claim.justification}”
                  </blockquote>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {claim.receipt_document_id && (
                  <Button variant="outline" size="sm" onClick={() => void downloadReceipt(claim)}>
                    <Download /> Receipt
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setNote("");
                    setProblem(null);
                    setRejecting(claim);
                  }}
                >
                  <X /> Reject
                </Button>
                <Button size="sm" disabled={busy} onClick={() => void decide(claim, true, null)}>
                  {busy ? <Loader2 className="animate-spin" /> : <Check />}
                  Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this claim</DialogTitle>
            <DialogDescription>
              {rejecting &&
                `${rejecting.employee_name ?? "The employee"}'s ${humanizeKey(rejecting.category_key).toLowerCase()} claim for ${formatMoney(rejecting.amount)}. They will see your reason.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="claim-reject-note">Reason (required)</Label>
            <Textarea
              id="claim-reject-note"
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
              Reject claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
