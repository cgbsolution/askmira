"use client";

import { AlertTriangle, Ban, Info, Loader2, Send } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type {
  Claim,
  ExpenseReport,
  SubmitClaimResult,
  TravelRequest,
} from "@/lib/types/expenses";
import { formatDateRange, formatDay } from "@/lib/utils";

import { CONVENTION_LABEL, DetailFigure } from "./ClaimVerdictPanel";
import { GstInvoiceSection } from "./GstInvoiceSection";
import { ReceiptDownloadButton } from "./ReceiptUpload";
import {
  CITY_TIER_LABEL,
  CLAIM_KIND_LABEL,
  ClaimStatusBadge,
  NON_SUBMITTABLE_VERDICTS,
  VerdictBadge,
  errorDetail,
  formatDateTime,
  formatMoney,
  humanizeKey,
  isPositiveAmount,
} from "./shared";

/** Everything about one of the person's claims, and what they can still do with it. */
export function ClaimDetailSheet({
  claim,
  currency,
  trips,
  reports,
  onOpenChange,
  onChanged,
}: {
  claim: Claim | null;
  currency: string;
  trips: TravelRequest[];
  reports: ExpenseReport[];
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    setJustification(claim?.justification ?? "");
    setError(null);
  }, [claim?.id, claim?.justification]);

  const submit = async () => {
    if (!claim) return;
    const needsReason = claim.policy_verdict === "needs_justification";
    if (needsReason && !justification.trim()) {
      setError("This claim is over the limit. Write why before submitting.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await post<SubmitClaimResult>(`/expenses/claims/${claim.id}/submit`, {
        justification: justification.trim() || null,
      });
      toast.success("Claim submitted", {
        description: [
          result.status === "pending_manager"
            ? "It goes to your line manager first, then finance."
            : "It goes to finance.",
          result.flagged_for_approver ? "It is flagged for your approver's attention." : "",
        ]
          .filter(Boolean)
          .join(" "),
      });
      onChanged();
    } catch (caught) {
      setError(errorDetail(caught, "Could not submit the claim."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancel = async () => {
    if (!claim) return;
    try {
      await post<Claim>(`/expenses/claims/${claim.id}/cancel`);
      toast.success("Claim cancelled");
      onChanged();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not cancel the claim."));
      throw caught;
    }
  };

  const trip = claim?.travel_request_id
    ? trips.find((item) => item.id === claim.travel_request_id)
    : undefined;
  const report = claim?.report_id ? reports.find((item) => item.id === claim.report_id) : undefined;
  const foreign = claim ? claim.original_currency !== currency : false;
  const cannotSubmit = claim ? NON_SUBMITTABLE_VERDICTS.includes(claim.policy_verdict) : false;

  return (
    <Sheet open={claim !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {claim && (
          <>
            <SheetHeader className="pr-10">
              <SheetTitle>{humanizeKey(claim.category_key)}</SheetTitle>
              <SheetDescription>
                {CLAIM_KIND_LABEL[claim.kind]} · {formatDay(claim.incurred_on, true)} ·{" "}
                {CITY_TIER_LABEL[claim.city_tier]}
              </SheetDescription>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <ClaimStatusBadge status={claim.status} />
                {claim.flagged_for_approver && <Badge variant="warning">Flagged for approver</Badge>}
                {claim.exceeds_route_tolerance && <Badge variant="warning">Beyond route tolerance</Badge>}
              </div>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <DetailFigure
                  label={`Amount (${currency})`}
                  value={<span className="text-base font-semibold">{formatMoney(claim.amount, currency)}</span>}
                />
                {foreign && (
                  <DetailFigure
                    label="Original amount"
                    value={formatMoney(claim.original_amount, claim.original_currency)}
                  />
                )}
                {claim.kind === "mileage" && (
                  <>
                    <DetailFigure label="Distance" value={claim.distance_km ? `${claim.distance_km} km` : "—"} />
                    <DetailFigure label="Declared route" value={claim.route_km ? `${claim.route_km} km` : "—"} />
                    <DetailFigure
                      label="Vehicle"
                      value={claim.vehicle_type ? humanizeKey(claim.vehicle_type) : "—"}
                    />
                  </>
                )}
                {claim.kind === "per_diem" && (
                  <DetailFigure label="Days" value={claim.per_diem_days ?? "—"} />
                )}
                <DetailFigure label="Trip" value={trip ? `${trip.purpose} (${formatDateRange(trip.from_date, trip.to_date)})` : claim.travel_request_id ? "Linked trip" : "—"} />
                <DetailFigure label="Report" value={report ? report.title : claim.report_id ? "Linked report" : "—"} />
                <DetailFigure label="Submitted" value={formatDateTime(claim.submitted_at)} />
                <DetailFigure label="Decided" value={formatDateTime(claim.decided_at)} />
              </dl>

              {claim.description && (
                <p className="text-sm text-foreground">
                  <span className="text-muted-foreground">Description: </span>
                  {claim.description}
                </p>
              )}

              {foreign && claim.exchange_rate && (
                <div className="rounded-md border border-border px-3 py-2.5 text-sm">
                  <p className="font-medium text-foreground">Conversion</p>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    1 {claim.original_currency} = {claim.exchange_rate} {currency}
                    {claim.conversion_convention && `, ${CONVENTION_LABEL[claim.conversion_convention]}`}
                    {claim.exchange_rate_date && ` (${formatDay(claim.exchange_rate_date, true)})`}
                    {claim.exchange_rate_source && `, source: ${claim.exchange_rate_source}`}
                  </p>
                </div>
              )}

              <Separator />

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Policy check</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <VerdictBadge kind={claim.policy_verdict} />
                  <span className="text-xs text-muted-foreground">
                    Checked {formatDateTime(claim.evaluated_at)}
                  </span>
                </div>
                <p className="text-sm text-foreground">{claim.verdict_message}</p>
                <dl className="grid grid-cols-3 gap-x-4 gap-y-2">
                  <DetailFigure
                    label="Limit"
                    value={claim.limit_amount === null ? "No limit" : formatMoney(claim.limit_amount, currency)}
                  />
                  <DetailFigure label="Already claimed" value={formatMoney(claim.already_claimed, currency)} />
                  <DetailFigure
                    label="Over the limit"
                    value={formatMoney(claim.overage, currency)}
                    emphasis={isPositiveAmount(claim.overage)}
                  />
                </dl>
                {claim.justification && claim.status !== "draft" && (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">Your justification: </span>
                    {claim.justification}
                  </p>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Receipt</h3>
                {claim.receipt_document_id ? (
                  <ReceiptDownloadButton receiptId={claim.receipt_document_id} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {claim.kind === "per_diem" ? "Per-diem claims need no receipt." : "No receipt attached."}
                  </p>
                )}
              </section>

              {(claim.manager_decided_at || claim.payment_note) && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Approval and payment</h3>
                  {claim.manager_decided_at && (
                    <p className="text-sm text-foreground">
                      <span className="text-muted-foreground">Line manager: </span>
                      {claim.manager_decided_by_name ?? "Your manager"} on{" "}
                      {formatDateTime(claim.manager_decided_at)}
                      {claim.manager_decision_note && ` — ${claim.manager_decision_note}`}
                    </p>
                  )}
                  {claim.payment_note && (
                    <p className="flex items-start gap-2 text-sm text-foreground">
                      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      {claim.payment_note}
                    </p>
                  )}
                </section>
              )}

              {claim.decision_note && claim.decision_note !== claim.manager_decision_note && (
                <section className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Decision note</h3>
                  <p className="text-sm text-foreground">{claim.decision_note}</p>
                </section>
              )}

              {claim.status === "draft" && (
                <section className="space-y-3 rounded-md border border-border px-3 py-3">
                  {cannotSubmit ? (
                    <p className="flex items-start gap-2 text-sm text-foreground">
                      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      The policy does not allow this claim to be submitted as it is. It stays a draft
                      until you cancel it.
                    </p>
                  ) : (
                    <>
                      {claim.policy_verdict === "needs_justification" && (
                        <div className="grid gap-1.5">
                          <Label htmlFor="sheet-justification">Justification</Label>
                          <Textarea
                            id="sheet-justification"
                            rows={3}
                            maxLength={2000}
                            value={justification}
                            onChange={(event) => setJustification(event.target.value)}
                            placeholder="Why this expense was over the limit. Your approver will read this."
                          />
                        </div>
                      )}
                    </>
                  )}
                  {error && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                    >
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      disabled={isSubmitting}
                      onClick={() => setConfirmCancel(true)}
                    >
                      <Ban /> Cancel claim
                    </Button>
                    {!cannotSubmit && (
                      <Button
                        disabled={
                          isSubmitting ||
                          (claim.policy_verdict === "needs_justification" && !justification.trim())
                        }
                        onClick={() => void submit()}
                      >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Send />}
                        Submit claim
                      </Button>
                    )}
                  </div>
                </section>
              )}

              <Separator />

              <GstInvoiceSection claim={claim} />
            </div>

            <ConfirmDialog
              open={confirmCancel}
              onOpenChange={setConfirmCancel}
              title="Cancel this claim?"
              description={`${humanizeKey(claim.category_key)}, ${formatMoney(claim.amount, currency)}. A cancelled claim cannot be submitted.`}
              confirmLabel="Cancel claim"
              cancelLabel="Keep it"
              destructive
              onConfirm={cancel}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
