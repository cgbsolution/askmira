"use client";

import { AlertTriangle, Info, Loader2, Plus, Tags } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type {
  CaptureResult,
  CityTier,
  ClaimInput,
  ClaimKind,
  ExpenseMeta,
  ExpenseReport,
  SubmitClaimResult,
  TravelRequest,
} from "@/lib/types/expenses";
import { formatDateRange, toISODate } from "@/lib/utils";

import { ClaimVerdictPanel } from "./ClaimVerdictPanel";
import { ReceiptPicker, receiptProblem, uploadReceipt } from "./ReceiptUpload";
import {
  CITY_TIER_LABEL,
  CLAIM_KIND_LABEL,
  errorDetail,
  humanizeKey,
  isMoneyInput,
  isPositiveAmount,
} from "./shared";

const NONE = "__none";
const ALL_KINDS: ClaimKind[] = ["receipted", "mileage", "per_diem"];
const ALL_TIERS = Object.keys(CITY_TIER_LABEL) as CityTier[];

/**
 * Capture a claim and see the policy verdict straight away.
 *
 * Saving creates a draft and returns what the policy thinks of it. Only then
 * does the person choose to submit, write a justification, or keep the draft —
 * a refusal is never a surprise after the fact.
 */
export function ClaimCaptureDialog({
  meta,
  trips,
  reports,
  onChanged,
}: {
  meta: ExpenseMeta;
  trips: TravelRequest[];
  reports: ExpenseReport[];
  onChanged: () => void;
}) {
  const today = toISODate(new Date());
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ClaimKind>("receipted");
  const [category, setCategory] = useState("");
  const [cityTier, setCityTier] = useState<CityTier | "">("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(meta.reporting_currency);
  const [incurredOn, setIncurredOn] = useState(today);
  const [settlementDate, setSettlementDate] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [distanceKm, setDistanceKm] = useState("");
  const [routeKm, setRouteKm] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [days, setDays] = useState("1");
  const [tripId, setTripId] = useState(NONE);
  const [reportId, setReportId] = useState(NONE);
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [submitJustification, setSubmitJustification] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const kinds = meta.claim_kinds.length > 0 ? meta.claim_kinds : ALL_KINDS;
  const tiers = meta.city_tiers.length > 0 ? meta.city_tiers : ALL_TIERS;
  const currencies = Array.from(new Set([meta.reporting_currency, "INR", ...meta.currencies]));
  const approvedTrips = trips.filter((trip) => trip.status === "approved");
  const draftReports = reports.filter((report) => report.status === "draft");
  const needsSettlementDate =
    kind === "receipted" &&
    currency !== meta.reporting_currency &&
    meta.conversion_convention === "settlement_date";

  const reset = () => {
    setKind("receipted");
    setCategory("");
    setCityTier("");
    setAmount("");
    setCurrency(meta.reporting_currency);
    setIncurredOn(today);
    setSettlementDate("");
    setDescription("");
    setFile(null);
    setFileError(null);
    setReceiptId(null);
    setDistanceKm("");
    setRouteKm("");
    setVehicleType("");
    setDays("1");
    setTripId(NONE);
    setReportId(NONE);
    setJustification("");
    setError(null);
    setResult(null);
    setSubmitJustification("");
  };

  const close = (keptDraft: boolean) => {
    if (keptDraft) {
      toast.info("Kept as a draft", { description: "You can submit or cancel it from My claims." });
    }
    setOpen(false);
    reset();
  };

  const validate = (): string | null => {
    if (!category.trim()) return "Choose a category.";
    if (!cityTier) return "Choose the city tier where this was spent.";
    if (!incurredOn) return "Enter the date the expense was incurred.";
    if (incurredOn > today) return "The expense date cannot be in the future.";
    if (kind === "receipted") {
      if (!isMoneyInput(amount) || !isPositiveAmount(amount)) {
        return "Enter the amount, for example 1250 or 1250.50.";
      }
      if (!currency) return "Choose the currency.";
      if (needsSettlementDate && !settlementDate) {
        return "Enter the settlement date: foreign amounts convert at the rate on that date.";
      }
    }
    if (kind === "mileage") {
      if (!isMoneyInput(distanceKm) || !isPositiveAmount(distanceKm)) {
        return "Enter the distance travelled in km.";
      }
      if (routeKm.trim() && !isMoneyInput(routeKm)) return "The declared route distance must be a number of km.";
      if (meta.vehicle_types.length > 0 && !vehicleType) return "Choose the vehicle type.";
    }
    if (kind === "per_diem" && (!/^\d+$/.test(days.trim()) || Number(days) < 1)) {
      return "Enter the number of days, at least 1.";
    }
    if (kind !== "per_diem" && file) {
      const problem = receiptProblem(file, meta);
      if (problem) return problem;
    }
    return null;
  };

  const capture = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      let receiptDocumentId = receiptId;
      if (kind !== "per_diem" && file && !receiptDocumentId) {
        try {
          const receipt = await uploadReceipt(file);
          receiptDocumentId = receipt.id;
          setReceiptId(receipt.id);
        } catch (caught) {
          setFileError(errorDetail(caught, "The receipt could not be uploaded."));
          setError(`Receipt not uploaded: ${errorDetail(caught, "the upload failed.")}`);
          return;
        }
      }

      const body: ClaimInput = {
        kind,
        category_key: category.trim(),
        city_tier: cityTier as CityTier,
        incurred_on: incurredOn,
        // Mileage and per-diem amounts are worked out by the server from its rates.
        amount: kind === "receipted" ? amount.trim() : "0",
        currency: kind === "receipted" ? currency : meta.reporting_currency,
        settlement_date: needsSettlementDate ? settlementDate : null,
        description: description.trim() || null,
        justification: justification.trim() || null,
        travel_request_id: tripId === NONE ? null : tripId,
        report_id: reportId === NONE ? null : reportId,
        receipt_document_id: kind === "per_diem" ? null : receiptDocumentId,
        distance_km: kind === "mileage" ? distanceKm.trim() : null,
        route_km: kind === "mileage" && routeKm.trim() ? routeKm.trim() : null,
        vehicle_type: kind === "mileage" && vehicleType ? vehicleType : null,
        per_diem_days: kind === "per_diem" ? Number(days.trim()) : null,
      };
      const captured = await post<CaptureResult>("/expenses/claims", body);
      setResult(captured);
      setSubmitJustification(justification.trim());
      onChanged();
    } catch (caught) {
      setError(errorDetail(caught, "Could not save the claim."));
    } finally {
      setIsSaving(false);
    }
  };

  const needsReason = result?.verdict.kind === "needs_justification";

  const submitClaim = async () => {
    if (!result) return;
    if (needsReason && !submitJustification.trim()) {
      setError("This claim is over the limit. Write why before submitting.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const submitted = await post<SubmitClaimResult>(`/expenses/claims/${result.claim_id}/submit`, {
        justification: submitJustification.trim() || null,
      });
      toast.success("Claim submitted", {
        description: submitted.flagged_for_approver
          ? "It is flagged for your approver's attention."
          : undefined,
      });
      onChanged();
      close(false);
    } catch (caught) {
      setError(errorDetail(caught, "Could not submit the claim."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const busy = isSaving || isSubmitting;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (next) setOpen(true);
        else close(result !== null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="accent">
          <Plus /> New claim
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{result ? "Policy check" : "New claim"}</DialogTitle>
          <DialogDescription>
            {result
              ? "Your claim is saved as a draft. This is what the expense policy says about it."
              : "The policy is checked when you save, before anything is submitted."}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="grid gap-4">
            <ClaimVerdictPanel result={result} currency={meta.reporting_currency} />

            {!result.may_submit ? (
              <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2.5 text-sm text-foreground">
                <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  {result.verdict.kind === "receipt_required"
                    ? "This claim needs a receipt, so it cannot be submitted as it is."
                    : result.verdict.kind === "pre_approval_required"
                      ? "This claim needs an approved travel request, so it cannot be submitted as it is."
                      : "The policy does not allow this claim to be submitted."}{" "}
                  It stays as a draft. You can cancel it from My claims.
                </span>
              </div>
            ) : (
              needsReason && (
                <div className="grid gap-1.5">
                  <Label htmlFor="claim-submit-justification">Justification</Label>
                  <Textarea
                    id="claim-submit-justification"
                    rows={3}
                    maxLength={2000}
                    value={submitJustification}
                    onChange={(event) => setSubmitJustification(event.target.value)}
                    placeholder="Why this expense was over the limit. Your approver will read this."
                  />
                </div>
              )
            )}
          </div>
        ) : (
          <form
            id="claim-capture-form"
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void capture();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="claim-kind">Type of claim</Label>
                <Select value={kind} onValueChange={(value) => setKind(value as ClaimKind)}>
                  <SelectTrigger id="claim-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {kinds.map((item) => (
                      <SelectItem key={item} value={item}>
                        {CLAIM_KIND_LABEL[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="claim-city-tier">City tier</Label>
                <Select value={cityTier} onValueChange={(value) => setCityTier(value as CityTier)}>
                  <SelectTrigger id="claim-city-tier" className="w-full">
                    <SelectValue placeholder="Where it was spent" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiers.map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {CITY_TIER_LABEL[tier]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {meta.categories.length > 0 ? (
              <div className="grid gap-1.5">
                <Label htmlFor="claim-category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="claim-category" className="w-full">
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {meta.categories.map((item) => (
                      <SelectItem key={item} value={item}>
                        {humanizeKey(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-2 rounded-md border border-border">
                <EmptyState
                  icon={Tags}
                  title="Finance has not configured an expense policy yet"
                  description="There are no categories to choose from. You can still claim: name the category yourself, and the claim is recorded with no policy rule."
                  className="py-5"
                />
                <div className="grid gap-1.5 px-3 pb-3">
                  <Label htmlFor="claim-category-text">Category</Label>
                  <Input
                    id="claim-category-text"
                    value={category}
                    maxLength={100}
                    onChange={(event) => setCategory(event.target.value)}
                    placeholder="e.g. Taxi"
                  />
                </div>
              </div>
            )}

            {kind === "receipted" && (
              <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
                <div className="grid gap-1.5">
                  <Label htmlFor="claim-amount">Amount</Label>
                  <Input
                    id="claim-amount"
                    inputMode="decimal"
                    className="tabular-nums"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="claim-currency">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="claim-currency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="claim-incurred-on">Incurred on</Label>
                <Input
                  id="claim-incurred-on"
                  type="date"
                  max={today}
                  value={incurredOn}
                  onChange={(event) => setIncurredOn(event.target.value)}
                />
              </div>
              {needsSettlementDate && (
                <div className="grid gap-1.5">
                  <Label htmlFor="claim-settlement-date">Settlement date</Label>
                  <Input
                    id="claim-settlement-date"
                    type="date"
                    min={incurredOn || undefined}
                    value={settlementDate}
                    onChange={(event) => setSettlementDate(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {currency} converts to {meta.reporting_currency} at the rate on this date.
                  </p>
                </div>
              )}
            </div>
            {kind === "receipted" && currency !== meta.reporting_currency && !needsSettlementDate && (
              <p className="-mt-2 text-xs text-muted-foreground">
                {currency} converts to {meta.reporting_currency} at the rate on the date incurred.
              </p>
            )}

            {kind === "mileage" && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="claim-distance">Distance (km)</Label>
                  <Input
                    id="claim-distance"
                    inputMode="decimal"
                    className="tabular-nums"
                    value={distanceKm}
                    onChange={(event) => setDistanceKm(event.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="claim-route-km">
                    Route km <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="claim-route-km"
                    inputMode="decimal"
                    className="tabular-nums"
                    value={routeKm}
                    onChange={(event) => setRouteKm(event.target.value)}
                    placeholder="From a map"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="claim-vehicle">Vehicle</Label>
                  {meta.vehicle_types.length > 0 ? (
                    <Select value={vehicleType} onValueChange={setVehicleType}>
                      <SelectTrigger id="claim-vehicle" className="w-full">
                        <SelectValue placeholder="Choose" />
                      </SelectTrigger>
                      <SelectContent>
                        {meta.vehicle_types.map((item) => (
                          <SelectItem key={item} value={item}>
                            {humanizeKey(item)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Finance has not set mileage rates for any vehicle.
                    </p>
                  )}
                </div>
              </div>
            )}

            {kind === "per_diem" && (
              <div className="grid gap-1.5 sm:max-w-40">
                <Label htmlFor="claim-days">Days</Label>
                <Input
                  id="claim-days"
                  inputMode="numeric"
                  className="tabular-nums"
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="claim-description">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="claim-description"
                value={description}
                maxLength={500}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What it was for"
              />
            </div>

            {kind === "per_diem" ? (
              <p className="flex items-start gap-2 rounded-md bg-muted px-3 py-2.5 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" />
                A per-diem claim needs no receipt: it is paid at the daily rate for your city tier.
              </p>
            ) : (
              <ReceiptPicker
                id="claim-receipt"
                meta={meta}
                file={file}
                error={fileError}
                disabled={isSaving}
                onChange={(chosen, problem) => {
                  setFile(chosen);
                  setFileError(problem);
                  setReceiptId(null);
                }}
              />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="claim-trip">
                  Trip <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Select value={tripId} onValueChange={setTripId}>
                  <SelectTrigger id="claim-trip" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not part of a trip</SelectItem>
                    {approvedTrips.map((trip) => (
                      <SelectItem key={trip.id} value={trip.id}>
                        {trip.purpose} ({formatDateRange(trip.from_date, trip.to_date)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="claim-report">
                  Report <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Select value={reportId} onValueChange={setReportId}>
                  <SelectTrigger id="claim-report" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not in a report</SelectItem>
                    {draftReports.map((report) => (
                      <SelectItem key={report.id} value={report.id}>
                        {report.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="claim-justification">
                Justification <span className="text-muted-foreground">(if it may be over the limit)</span>
              </Label>
              <Textarea
                id="claim-justification"
                rows={2}
                maxLength={2000}
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
              />
            </div>
          </form>
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

        <DialogFooter>
          {result ? (
            <>
              <Button variant="outline" disabled={busy} onClick={() => close(true)}>
                Keep as draft
              </Button>
              {result.may_submit && (
                <Button
                  disabled={busy || (needsReason && !submitJustification.trim())}
                  onClick={() => void submitClaim()}
                >
                  {isSubmitting && <Loader2 className="animate-spin" />}
                  Submit claim
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" disabled={busy} onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" form="claim-capture-form" disabled={busy}>
                {isSaving && <Loader2 className="animate-spin" />}
                Check policy and save
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
