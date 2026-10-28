"use client";

import { AlertTriangle, FileText, Info, Loader2, Plus, ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { get, post } from "@/lib/api";
import type {
  Claim,
  GstCaptureInput,
  GstCaptureResult,
  GstCredit,
  GstinVerdict,
} from "@/lib/types/expenses";
import { formatDay, toISODate } from "@/lib/utils";

import { DetailFigure } from "./ClaimVerdictPanel";
import {
  EligibilityBadge,
  ReconciliationBadge,
  errorDetail,
  formatMoney,
  isMoneyInput,
  isPositiveAmount,
} from "./shared";
import { DatePicker } from "@/components/common/DatePicker";

/**
 * GST invoices attached to one claim, and a form to add one.
 *
 * The vendor GSTIN is checked for shape only; whether the vendor is actually
 * registered and filing is a portal check that is not built. A GSTIN problem
 * never blocks the expense itself — it only affects whether tax is claimable.
 */
export function GstInvoiceSection({ claim }: { claim: Claim }) {
  const credits = useApiQuery<GstCredit[]>(`/gst/claims/${claim.id}/credits`);
  const [formOpen, setFormOpen] = useState(false);
  const [lastResult, setLastResult] = useState<GstCaptureResult | null>(null);
  const canCapture = claim.status !== "cancelled" && claim.status !== "rejected";

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileText className="size-4 text-muted-foreground" /> GST invoice
        </h3>
        {canCapture && !formOpen && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setLastResult(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Add GST invoice
          </Button>
        )}
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Checking the vendor with the GST portal and reading invoice details from the receipt (OCR)
        are not built. Enter the invoice details by hand.
      </p>

      {credits.isLoading && !credits.data ? (
        <Skeleton className="h-16 w-full" />
      ) : credits.error ? (
        <p className="text-sm text-muted-foreground">
          GST invoices could not be loaded: {credits.error.detail}
        </p>
      ) : (credits.data ?? []).length === 0 ? (
        !formOpen && <p className="text-sm text-muted-foreground">No GST invoice recorded for this claim.</p>
      ) : (
        <ul className="space-y-2">
          {(credits.data ?? []).map((credit) => (
            <li key={credit.id} className="rounded-md border border-border px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  Invoice {credit.invoice_number}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {formatDay(credit.invoice_date, true)}
                  </span>
                </p>
                <div className="flex flex-wrap gap-1">
                  <EligibilityBadge eligibility={credit.eligibility} />
                  <ReconciliationBadge status={credit.reconciliation_status} />
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                GSTIN {credit.vendor_gstin}
                {!credit.gstin_is_valid && (
                  <Badge variant="warning" className="ml-2">
                    GSTIN problem
                  </Badge>
                )}
              </p>
              {credit.gstin_problem && (
                <p className="mt-1 text-xs text-muted-foreground">{credit.gstin_problem}</p>
              )}
              <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1.5 sm:grid-cols-6">
                <DetailFigure label="Taxable" value={formatMoney(credit.taxable_value)} />
                <DetailFigure label="CGST" value={formatMoney(credit.cgst)} />
                <DetailFigure label="SGST" value={formatMoney(credit.sgst)} />
                <DetailFigure label="IGST" value={formatMoney(credit.igst)} />
                <DetailFigure label="Cess" value={formatMoney(credit.cess)} />
                <DetailFigure label="Claimable" value={formatMoney(credit.claimable_amount)} />
              </dl>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {credit.eligibility_reason}
                {credit.eligibility_reference && ` (${credit.eligibility_reference})`}
              </p>
            </li>
          ))}
        </ul>
      )}

      {lastResult && <CaptureOutcome result={lastResult} />}

      {formOpen && (
        <GstInvoiceForm
          claim={claim}
          onCancel={() => setFormOpen(false)}
          onCaptured={(result) => {
            setLastResult(result);
            setFormOpen(false);
            credits.reload();
          }}
        />
      )}
    </section>
  );
}

function CaptureOutcome({ result }: { result: GstCaptureResult }) {
  const { assessment } = result;
  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/50 px-3 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">Invoice recorded</span>
        <EligibilityBadge eligibility={assessment.eligibility} />
        {assessment.needs_review && <Badge variant="outline">Finance will review</Badge>}
      </div>
      <p className="text-foreground">
        {assessment.reason}
        {assessment.reference && (
          <span className="text-muted-foreground"> ({assessment.reference})</span>
        )}
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <DetailFigure label="Claimable tax" value={formatMoney(assessment.claimable_amount)} />
        <DetailFigure label="Tax at stake" value={formatMoney(assessment.amount_at_stake)} />
      </dl>
      {!result.gstin.is_valid && <p className="text-muted-foreground">{result.gstin.message}</p>}
      {result.duplicate_of.length > 0 && (
        <p className="flex items-start gap-2 text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {result.duplicate_across_employees
            ? "The same vendor invoice has already been claimed by someone else. Finance will look at it."
            : "You have already recorded this vendor invoice on another claim."}
        </p>
      )}
      {result.note && <p className="text-xs text-muted-foreground">{result.note}</p>}
    </div>
  );
}

function GstInvoiceForm({
  claim,
  onCancel,
  onCaptured,
}: {
  claim: Claim;
  onCancel: () => void;
  onCaptured: (result: GstCaptureResult) => void;
}) {
  const today = toISODate(new Date());
  const [gstin, setGstin] = useState("");
  const [verdict, setVerdict] = useState<GstinVerdict | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(claim.incurred_on.slice(0, 10));
  const [taxable, setTaxable] = useState("");
  const [cgst, setCgst] = useState("0");
  const [sgst, setSgst] = useState("0");
  const [igst, setIgst] = useState("0");
  const [cess, setCess] = useState("0");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [hsnSac, setHsnSac] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const checkGstin = async () => {
    const value = gstin.trim().toUpperCase();
    if (!value) {
      setError("Enter the vendor's GSTIN to check it.");
      return;
    }
    setError(null);
    setIsChecking(true);
    try {
      setVerdict(await get<GstinVerdict>(`/gst/validate-gstin?gstin=${encodeURIComponent(value)}`));
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not check the GSTIN."));
    } finally {
      setIsChecking(false);
    }
  };

  const validate = (): string | null => {
    if (!gstin.trim()) return "Enter the vendor's GSTIN.";
    if (!invoiceNumber.trim()) return "Enter the invoice number.";
    if (!invoiceDate) return "Enter the invoice date.";
    if (invoiceDate > today) return "The invoice date cannot be in the future.";
    if (!isMoneyInput(taxable) || !isPositiveAmount(taxable)) return "Enter the taxable value.";
    const taxes: [string, string][] = [
      ["CGST", cgst],
      ["SGST", sgst],
      ["IGST", igst],
      ["Cess", cess],
    ];
    for (const [label, value] of taxes) {
      if (!isMoneyInput(value)) return `${label} must be an amount, 0 if none.`;
    }
    if (placeOfSupply.trim() && !/^\d{2}$/.test(placeOfSupply.trim())) {
      return "Place of supply is the two-digit state code, for example 29.";
    }
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const body: GstCaptureInput = {
        vendor_gstin: gstin.trim().toUpperCase(),
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        category_key: claim.category_key,
        taxable_value: taxable.trim(),
        expense_claim_id: claim.id,
        cgst: cgst.trim(),
        sgst: sgst.trim(),
        igst: igst.trim(),
        cess: cess.trim(),
        place_of_supply_state_code: placeOfSupply.trim() || null,
        hsn_sac: hsnSac.trim() || null,
      };
      const result = await post<GstCaptureResult>("/gst/credits", body);
      toast.success("GST invoice recorded");
      onCaptured(result);
    } catch (caught) {
      setError(errorDetail(caught, "Could not record the GST invoice."));
    } finally {
      setIsSaving(false);
    }
  };

  const taxField = (id: string, label: string, value: string, set: (value: string) => void) => (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        className="tabular-nums"
        value={value}
        onChange={(event) => set(event.target.value)}
      />
    </div>
  );

  return (
    <form
      className="grid gap-3 rounded-md border border-border px-3 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="gst-gstin">Vendor GSTIN</Label>
        <div className="flex gap-2">
          <Input
            id="gst-gstin"
            value={gstin}
            maxLength={15}
            className="uppercase tabular-nums"
            onChange={(event) => {
              setGstin(event.target.value);
              setVerdict(null);
            }}
            placeholder="15 characters"
          />
          <Button
            type="button"
            variant="outline"
            disabled={isChecking || !gstin.trim()}
            onClick={() => void checkGstin()}
          >
            {isChecking ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            Validate
          </Button>
        </div>
      </div>

      {verdict && (
        <Alert variant={verdict.is_valid ? "success" : "warning"}>
          {verdict.is_valid ? <ShieldCheck /> : <AlertTriangle />}
          <AlertTitle>
            {verdict.is_valid ? "GSTIN format is valid" : "GSTIN has a problem"}
            {verdict.state_name && ` · ${verdict.state_name}`}
          </AlertTitle>
          <AlertDescription>
            <p>{verdict.message}</p>
            {!verdict.is_valid && verdict.problem && <p>{verdict.problem}</p>}
            {!verdict.blocks_the_expense && <p>This does not stop the expense claim.</p>}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="gst-invoice-number">Invoice number</Label>
          <Input
            id="gst-invoice-number"
            value={invoiceNumber}
            maxLength={16}
            onChange={(event) => setInvoiceNumber(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="gst-invoice-date">Invoice date</Label>
          <DatePicker
            id="gst-invoice-date"
            max={today}
            value={invoiceDate}
            onChange={setInvoiceDate}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        {taxField("gst-taxable", "Taxable value (₹)", taxable, setTaxable)}
        <div className="grid gap-1.5">
          <Label htmlFor="gst-pos">
            Place of supply <span className="text-muted-foreground">(state code)</span>
          </Label>
          <Input
            id="gst-pos"
            inputMode="numeric"
            maxLength={2}
            className="tabular-nums"
            value={placeOfSupply}
            onChange={(event) => setPlaceOfSupply(event.target.value)}
            placeholder="29"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="gst-hsn">
            HSN/SAC <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="gst-hsn"
            maxLength={8}
            className="tabular-nums"
            value={hsnSac}
            onChange={(event) => setHsnSac(event.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {taxField("gst-cgst", "CGST (₹)", cgst, setCgst)}
        {taxField("gst-sgst", "SGST (₹)", sgst, setSgst)}
        {taxField("gst-igst", "IGST (₹)", igst, setIgst)}
        {taxField("gst-cess", "Cess (₹)", cess, setCess)}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={isSaving} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="animate-spin" />}
          Record invoice
        </Button>
      </div>
    </form>
  );
}
