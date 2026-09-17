"use client";

import { FilePlus2, Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { humanize } from "@/components/hiring/labels";
import { ActionDialog } from "@/components/hiring/OfferActionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { Page } from "@/lib/types";
import type { CandidateSummary, OfferComponentKind, OfferInput } from "@/lib/types/hiring";
import type { SalaryStructure } from "@/lib/types/payroll";

export const OFFER_COMPONENT_KINDS: OfferComponentKind[] = [
  "joining_bonus",
  "retention_bonus",
  "variable_pay",
  "esop",
  "relocation",
];

/** A money amount as the API accepts it: positive, up to two decimals. */
export const OFFER_AMOUNT = /^\d{1,12}(\.\d{1,2})?$/;

interface ComponentRow {
  key: number;
  kind: OfferComponentKind | "";
  label: string;
  amount: string;
  payableTerms: string;
  countsTowardCtc: boolean;
}

let rowKey = 0;
const blankRow = (): ComponentRow => ({
  key: ++rowKey,
  kind: "",
  label: "",
  amount: "",
  payableTerms: "",
  countsTowardCtc: false,
});

/**
 * Draft an offer for a candidate at the human-interview stage. Creates a draft
 * only; approval and release are separate, deliberate steps.
 */
export function OfferFormDialog({ onCreated }: { onCreated: (offerId: string) => void }) {
  const [open, setOpen] = useState(false);
  const candidates = useApiQuery<Page<CandidateSummary>>(
    open ? "/hiring/candidates?stage=human_interview&page_size=200" : null,
  );
  const structures = useApiQuery<SalaryStructure[]>(open ? "/salary-structures" : null);

  const [candidateId, setCandidateId] = useState("");
  const [code, setCode] = useState("");
  const [structureId, setStructureId] = useState("");
  const [ctc, setCtc] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [designation, setDesignation] = useState("");
  const [grade, setGrade] = useState("");
  const [probation, setProbation] = useState("6");
  const [notice, setNotice] = useState("60");
  const [validUntil, setValidUntil] = useState("");
  const [rows, setRows] = useState<ComponentRow[]>([]);

  const reset = () => {
    setCandidateId("");
    setCode("");
    setStructureId("");
    setCtc("");
    setJoiningDate("");
    setDesignation("");
    setGrade("");
    setProbation("6");
    setNotice("60");
    setValidUntil("");
    setRows([]);
  };

  const updateRow = (key: number, changes: Partial<ComponentRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)));

  const validate = () => {
    if (!candidateId) return "Choose the candidate.";
    if (!/^[A-Za-z0-9-]{1,32}$/.test(code.trim())) return "Offer code: letters, digits and hyphens, up to 32.";
    if (!structureId) return "Choose a salary structure.";
    if (!OFFER_AMOUNT.test(ctc.trim()) || Number(ctc) <= 0) return "Annual CTC must be a positive amount.";
    if (!joiningDate) return "Choose the joining date.";
    if (!designation.trim()) return "Enter the designation.";
    if (!/^\d+$/.test(probation) || Number(probation) > 24) return "Probation must be 0 to 24 months.";
    if (!/^\d+$/.test(notice) || Number(notice) > 365) return "Notice period must be 0 to 365 days.";
    for (const [index, row] of rows.entries()) {
      if (!row.kind) return `Component ${index + 1}: choose its kind.`;
      if (!row.label.trim()) return `Component ${index + 1}: give it a label.`;
      if (!OFFER_AMOUNT.test(row.amount.trim())) return `Component ${index + 1}: enter a valid amount.`;
    }
    return null;
  };

  const submit = async () => {
    const body: OfferInput = {
      candidate_id: candidateId,
      code: code.trim(),
      salary_structure_id: structureId,
      ctc_annual: ctc.trim(),
      joining_date: joiningDate,
      designation: designation.trim(),
      grade: grade.trim() || null,
      probation_months: Number(probation),
      notice_period_days: Number(notice),
      valid_until: validUntil || null,
      components: rows.map((row) => ({
        kind: row.kind as OfferComponentKind,
        label: row.label.trim(),
        amount: row.amount.trim(),
        payable_terms: row.payableTerms.trim() || null,
        counts_toward_ctc: row.countsTowardCtc,
      })),
    };
    const created = await post<{ id: string; code?: string }>("/offers", body);
    toast.success(`Offer ${created.code ?? body.code} drafted`);
    reset();
    onCreated(created.id);
  };

  const candidateItems = candidates.data?.items ?? [];

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <FilePlus2 /> Draft offer
      </Button>
      <ActionDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        title="Draft offer"
        description="Saved as a draft. It goes for approval only when you submit it."
        submitLabel="Save draft"
        wide
        validate={validate}
        onSubmit={submit}
        errorFallback="The offer could not be drafted."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            htmlFor="offer-candidate"
            label="Candidate"
            error={candidates.error?.detail}
            hint={
              !candidates.isLoading && candidates.data && candidateItems.length === 0
                ? "No candidates are at the interview stage."
                : undefined
            }
          >
            <Select value={candidateId} onValueChange={setCandidateId} disabled={candidateItems.length === 0}>
              <SelectTrigger id="offer-candidate" className="w-full">
                <SelectValue placeholder={candidates.isLoading ? "Loading…" : "Choose a candidate"} />
              </SelectTrigger>
              <SelectContent>
                {candidateItems.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.full_name}
                    {candidate.requisition_code ? ` · ${candidate.requisition_code}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="offer-code" label="Offer code" hint="For example OFF-2026-014">
            <Input id="offer-code" maxLength={32} value={code} onChange={(e) => setCode(e.target.value)} />
          </FormField>
          <FormField htmlFor="offer-structure" label="Salary structure" error={structures.error?.detail}>
            <Select
              value={structureId}
              onValueChange={setStructureId}
              disabled={(structures.data ?? []).length === 0}
            >
              <SelectTrigger id="offer-structure" className="w-full">
                <SelectValue placeholder={structures.isLoading ? "Loading…" : "Choose a structure"} />
              </SelectTrigger>
              <SelectContent>
                {(structures.data ?? []).map((structure) => (
                  <SelectItem key={structure.id} value={structure.id}>
                    {structure.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="offer-ctc" label="Annual CTC (₹)">
            <Input
              id="offer-ctc"
              inputMode="decimal"
              className="tabular-nums"
              value={ctc}
              onChange={(e) => setCtc(e.target.value)}
            />
          </FormField>
          <FormField htmlFor="offer-designation" label="Designation">
            <Input
              id="offer-designation"
              maxLength={255}
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
            />
          </FormField>
          <FormField htmlFor="offer-grade" label="Grade" optional>
            <Input id="offer-grade" maxLength={32} value={grade} onChange={(e) => setGrade(e.target.value)} />
          </FormField>
          <FormField htmlFor="offer-joining" label="Joining date">
            <Input
              id="offer-joining"
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
            />
          </FormField>
          <FormField htmlFor="offer-valid-until" label="Valid until" optional>
            <Input
              id="offer-valid-until"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </FormField>
          <FormField htmlFor="offer-probation" label="Probation (months)">
            <Input
              id="offer-probation"
              type="number"
              min={0}
              max={24}
              value={probation}
              onChange={(e) => setProbation(e.target.value)}
            />
          </FormField>
          <FormField htmlFor="offer-notice" label="Notice period (days)">
            <Input
              id="offer-notice"
              type="number"
              min={0}
              max={365}
              value={notice}
              onChange={(e) => setNotice(e.target.value)}
            />
          </FormField>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">One-off and variable components</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={rows.length >= 20}
              onClick={() => setRows((current) => [...current, blankRow()])}
            >
              <Plus /> Add component
            </Button>
          </div>
          {rows.length === 0 && (
            <p className="text-xs text-muted-foreground">
              None. Add a joining bonus, retention bonus, variable pay, ESOP or relocation if the offer has one.
            </p>
          )}
          {rows.map((row, index) => (
            <div key={row.key} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
              <FormField htmlFor={`component-kind-${row.key}`} label={`Component ${index + 1}`}>
                <Select
                  value={row.kind}
                  onValueChange={(value) => updateRow(row.key, { kind: value as OfferComponentKind })}
                >
                  <SelectTrigger id={`component-kind-${row.key}`} className="w-full">
                    <SelectValue placeholder="Kind" />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFER_COMPONENT_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {kind === "esop" ? "ESOP" : humanize(kind)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField htmlFor={`component-label-${row.key}`} label="Label">
                <Input
                  id={`component-label-${row.key}`}
                  value={row.label}
                  maxLength={255}
                  onChange={(e) => updateRow(row.key, { label: e.target.value })}
                />
              </FormField>
              <FormField htmlFor={`component-amount-${row.key}`} label="Amount (₹)">
                <Input
                  id={`component-amount-${row.key}`}
                  inputMode="decimal"
                  className="tabular-nums"
                  value={row.amount}
                  onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                />
              </FormField>
              <FormField htmlFor={`component-terms-${row.key}`} label="Payable terms" optional>
                <Input
                  id={`component-terms-${row.key}`}
                  value={row.payableTerms}
                  onChange={(e) => updateRow(row.key, { payableTerms: e.target.value })}
                />
              </FormField>
              <div className="flex items-center justify-between gap-2 sm:col-span-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`component-ctc-${row.key}`}
                    checked={row.countsTowardCtc}
                    onCheckedChange={(checked) => updateRow(row.key, { countsTowardCtc: checked })}
                  />
                  <Label htmlFor={`component-ctc-${row.key}`}>Counts toward CTC</Label>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                >
                  <Trash2 /> Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ActionDialog>
    </>
  );
}
