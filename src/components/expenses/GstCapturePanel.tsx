"use client";

import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { InlineProblem, MONEY_RE, StatTile, errorDetail } from "@/components/expenses/ReviewCommon";
import { EligibilityBadge, formatMoney, humanizeKey } from "@/components/expenses/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import { get, post } from "@/lib/api";
import type { GstCaptureInput, GstCaptureResult, GstinVerdict, OrgLegalEntity } from "@/lib/types/expenses";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATE_RE = /^\d{2}$/;
const NO_ENTITY = "__none__";

interface FormState {
  vendor_gstin: string;
  invoice_number: string;
  invoice_date: string;
  category_key: string;
  taxable_value: string;
  cgst: string;
  sgst: string;
  igst: string;
  cess: string;
  expense_claim_id: string;
  employee_id: string;
  legal_entity_id: string;
  supplier_state_code: string;
  place_of_supply_state_code: string;
  hsn_sac: string;
}

const EMPTY: FormState = {
  vendor_gstin: "",
  invoice_number: "",
  invoice_date: "",
  category_key: "",
  taxable_value: "",
  cgst: "0",
  sgst: "0",
  igst: "0",
  cess: "0",
  expense_claim_id: "",
  employee_id: "",
  legal_entity_id: NO_ENTITY,
  supplier_state_code: "",
  place_of_supply_state_code: "",
  hsn_sac: "",
};

function GstinVerdictView({ verdict }: { verdict: GstinVerdict }) {
  return (
    <div className="grid gap-1 rounded-md border px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium tabular-nums text-foreground">{verdict.gstin}</span>
        <Badge variant={verdict.is_valid ? "success" : "destructive"}>
          {verdict.is_valid ? "Format and checksum valid" : "Invalid"}
        </Badge>
        <Badge variant="muted">Portal: {verdict.portal_status}</Badge>
      </div>
      {verdict.problem && <p className="text-destructive">{verdict.problem}</p>}
      {(verdict.state_name || verdict.pan) && (
        <p className="text-muted-foreground">
          {verdict.state_name && `State ${verdict.state_code} ${verdict.state_name}`}
          {verdict.state_name && verdict.pan && " · "}
          {verdict.pan && `PAN ${verdict.pan}`}
        </p>
      )}
      <p className="text-muted-foreground">{verdict.message}</p>
    </div>
  );
}

/**
 * Capture an invoice's GST details. Finance may capture against any claim.
 * An invalid GSTIN does not stop the capture; it makes the credit doubtful.
 */
export function GstCapturePanel() {
  const entities = useApiQuery<OrgLegalEntity[]>("/org/legal-entities");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [verdict, setVerdict] = useState<GstinVerdict | null>(null);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<GstCaptureResult | null>(null);

  const set = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const errors = {
    vendor_gstin: !/^[0-9A-Z]{15}$/.test(form.vendor_gstin),
    invoice_number: !form.invoice_number.trim(),
    invoice_date: !form.invoice_date,
    category_key: !/^[a-z0-9_]{1,64}$/.test(form.category_key),
    taxable_value: !MONEY_RE.test(form.taxable_value),
    cgst: !MONEY_RE.test(form.cgst),
    sgst: !MONEY_RE.test(form.sgst),
    igst: !MONEY_RE.test(form.igst),
    cess: !MONEY_RE.test(form.cess),
    expense_claim_id: form.expense_claim_id !== "" && !UUID_RE.test(form.expense_claim_id),
    employee_id: form.employee_id !== "" && !UUID_RE.test(form.employee_id),
    supplier_state_code: form.supplier_state_code !== "" && !STATE_RE.test(form.supplier_state_code),
    place_of_supply_state_code:
      form.place_of_supply_state_code !== "" && !STATE_RE.test(form.place_of_supply_state_code),
  };
  const valid = Object.values(errors).every((bad) => !bad);
  const invalid = (key: keyof typeof errors) => touched && errors[key];

  const checkGstin = async () => {
    if (!form.vendor_gstin) return;
    setChecking(true);
    try {
      setVerdict(await get<GstinVerdict>(`/gst/validate-gstin?gstin=${encodeURIComponent(form.vendor_gstin)}`));
    } catch (error) {
      toast.error(errorDetail(error, "Could not check the GSTIN."));
    } finally {
      setChecking(false);
    }
  };

  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    setIsSaving(true);
    setProblem(null);
    try {
      const body: GstCaptureInput = {
        vendor_gstin: form.vendor_gstin,
        invoice_number: form.invoice_number.trim(),
        invoice_date: form.invoice_date,
        category_key: form.category_key,
        taxable_value: form.taxable_value,
        cgst: form.cgst,
        sgst: form.sgst,
        igst: form.igst,
        cess: form.cess,
        expense_claim_id: form.expense_claim_id || null,
        employee_id: form.employee_id || null,
        legal_entity_id: form.legal_entity_id === NO_ENTITY ? null : form.legal_entity_id,
        supplier_state_code: form.supplier_state_code || null,
        place_of_supply_state_code: form.place_of_supply_state_code || null,
        hsn_sac: form.hsn_sac.trim() || null,
      };
      const captured = await post<GstCaptureResult>("/gst/credits", body);
      setResult(captured);
      toast.success("GST details captured");
    } catch (error) {
      setProblem(errorDetail(error, "Could not capture the invoice."));
    } finally {
      setIsSaving(false);
    }
  };

  const reset = () => {
    setForm(EMPTY);
    setTouched(false);
    setVerdict(null);
    setProblem(null);
    setResult(null);
  };

  if (result) {
    const { assessment } = result;
    return (
      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Captured</CardTitle>
          <CardDescription>{result.note}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {result.duplicate_of.length > 0 && (
            <InlineProblem>
              {result.duplicate_across_employees
                ? `This invoice was already captured by another employee (${result.duplicate_of.length} earlier ${result.duplicate_of.length === 1 ? "credit" : "credits"}). Check it is not being claimed twice.`
                : `This invoice was already captured (${result.duplicate_of.length} earlier ${result.duplicate_of.length === 1 ? "credit" : "credits"}). Check it is not a duplicate.`}
            </InlineProblem>
          )}
          <div className="grid gap-1.5">
            <p className="text-sm font-medium text-foreground">Vendor GSTIN</p>
            <GstinVerdictView verdict={result.gstin} />
            {result.gstin.blocks_the_expense && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertTriangle className="size-4" /> This GSTIN result blocks the expense.
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">Eligibility</p>
              <EligibilityBadge eligibility={assessment.eligibility} />
              {assessment.needs_review && <Badge variant="warning">Sent to the review queue</Badge>}
              {assessment.tax_split && <Badge variant="outline">{humanizeKey(assessment.tax_split)}</Badge>}
            </div>
            <p className="text-sm text-foreground">{assessment.reason}</p>
            {assessment.reference && <p className="text-xs text-muted-foreground">{assessment.reference}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile label="Claimable" tone="success" value={formatMoney(assessment.claimable_amount)} />
              <StatTile label="At stake" tone="warning" value={formatMoney(assessment.amount_at_stake)} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {result.expense_recorded ? "Linked to an expense claim." : "Not linked to an expense claim."}
          </p>
          <div>
            <Button onClick={reset}>Capture another</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const moneyField = (key: "taxable_value" | "cgst" | "sgst" | "igst" | "cess", label: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`gst-cap-${key}`}>{label}</Label>
      <Input
        id={`gst-cap-${key}`}
        inputMode="decimal"
        className="tabular-nums"
        value={form[key]}
        aria-invalid={invalid(key)}
        onChange={(event) => set(key, event.target.value.trim())}
      />
    </div>
  );

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Capture an invoice</CardTitle>
        <CardDescription>
          Enter the GST details as printed on the invoice. OCR is not built, so every field is typed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1.5 md:col-span-2">
              <Label htmlFor="gst-cap-gstin">Vendor GSTIN</Label>
              <div className="flex gap-2">
                <Input
                  id="gst-cap-gstin"
                  value={form.vendor_gstin}
                  maxLength={15}
                  className="tabular-nums uppercase"
                  aria-invalid={invalid("vendor_gstin")}
                  onChange={(event) => {
                    set("vendor_gstin", event.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ""));
                    setVerdict(null);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={form.vendor_gstin.length === 0 || checking}
                  onClick={() => void checkGstin()}
                >
                  {checking ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                  Check
                </Button>
              </div>
              {invalid("vendor_gstin") && <p className="text-xs text-destructive">A GSTIN is 15 letters and digits.</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gst-cap-hsn">
                HSN / SAC <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input id="gst-cap-hsn" value={form.hsn_sac} maxLength={8} onChange={(e) => set("hsn_sac", e.target.value)} />
            </div>
          </div>
          {verdict && <GstinVerdictView verdict={verdict} />}

          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="gst-cap-number">Invoice number</Label>
              <Input
                id="gst-cap-number"
                value={form.invoice_number}
                maxLength={32}
                aria-invalid={invalid("invoice_number")}
                onChange={(e) => set("invoice_number", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gst-cap-date">Invoice date</Label>
              <Input
                id="gst-cap-date"
                type="date"
                value={form.invoice_date}
                aria-invalid={invalid("invoice_date")}
                onChange={(e) => set("invoice_date", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gst-cap-category">Category key</Label>
              <Input
                id="gst-cap-category"
                value={form.category_key}
                placeholder="e.g. hotel_stay"
                aria-invalid={invalid("category_key")}
                onChange={(e) => set("category_key", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {moneyField("taxable_value", "Taxable value (₹)")}
            {moneyField("cgst", "CGST (₹)")}
            {moneyField("sgst", "SGST (₹)")}
            {moneyField("igst", "IGST (₹)")}
            {moneyField("cess", "Cess (₹)")}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="gst-cap-supplier-state">
                Supplier state code <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="gst-cap-supplier-state"
                inputMode="numeric"
                maxLength={2}
                placeholder="29"
                value={form.supplier_state_code}
                aria-invalid={invalid("supplier_state_code")}
                onChange={(e) => set("supplier_state_code", e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gst-cap-pos">
                Place of supply code <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="gst-cap-pos"
                inputMode="numeric"
                maxLength={2}
                value={form.place_of_supply_state_code}
                aria-invalid={invalid("place_of_supply_state_code")}
                onChange={(e) => set("place_of_supply_state_code", e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gst-cap-entity">
                Legal entity <span className="text-muted-foreground">(optional)</span>
              </Label>
              {entities.error ? (
                <p className="text-sm text-destructive">{entities.error.detail}</p>
              ) : (
                <Select value={form.legal_entity_id} onValueChange={(value) => set("legal_entity_id", value)}>
                  <SelectTrigger id="gst-cap-entity" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ENTITY}>Not specified</SelectItem>
                    {(entities.data ?? []).map((entity) => (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.name} ({entity.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="gst-cap-claim">
                Expense claim ID <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="gst-cap-claim"
                value={form.expense_claim_id}
                aria-invalid={invalid("expense_claim_id")}
                onChange={(e) => set("expense_claim_id", e.target.value.trim())}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gst-cap-employee">
                Employee ID <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="gst-cap-employee"
                value={form.employee_id}
                aria-invalid={invalid("employee_id")}
                onChange={(e) => set("employee_id", e.target.value.trim())}
              />
            </div>
          </div>

          {touched && !valid && (
            <p className="text-sm text-destructive">
              Check the highlighted fields: amounts in rupees with up to two decimals, IDs as full UUIDs, state codes as
              two digits.
            </p>
          )}
          {problem && <InlineProblem>{problem}</InlineProblem>}

          <div className="flex gap-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              Capture
            </Button>
            <Button type="button" variant="outline" disabled={isSaving} onClick={reset}>
              Clear
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
