"use client";

import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import {
  apiErrorMessage,
  DownloadButton,
  InlineProblem,
  isMoneyInput,
} from "@/components/payroll-ops/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type { ProofDecisionInput, ProofQueueItem, TaxProof } from "@/lib/types/tax";
import { formatMoney } from "@/lib/utils";

import { compareDecimal } from "./common";

type Decision = ProofDecisionInput["decision"];

const DECISION_LABEL: Record<Decision, string> = {
  verified: "Verify in full",
  partially_accepted: "Accept part of it",
  rejected: "Reject",
};

/**
 * Decide one proof. Full verification accepts the proof amount; partial
 * acceptance takes an amount strictly between zero and the proof amount;
 * rejection accepts nothing. Anything but a full verification needs a remark
 * the employee will read.
 */
export function ProofDecisionDialog({
  item,
  onOpenChange,
  onDecided,
}: {
  item: ProofQueueItem | null;
  onOpenChange: (open: boolean) => void;
  onDecided: () => void;
}) {
  const open = item !== null;
  const [decision, setDecision] = useState<Decision>("verified");
  const [accepted, setAccepted] = useState("");
  const [remarks, setRemarks] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDecision("verified");
    setAccepted("");
    setRemarks("");
    setAttempted(false);
    setServerError(null);
  }, [open]);

  const acceptedError =
    decision !== "partially_accepted" || !item
      ? null
      : !accepted.trim()
        ? "Accepted amount is required."
        : !isMoneyInput(accepted)
          ? "Enter an amount in rupees, with at most two decimals."
          : compareDecimal(accepted, "0") <= 0 || compareDecimal(accepted, item.proof_amount) >= 0
            ? `Must be more than ₹0 and less than the proof amount of ${formatMoney(item.proof_amount)}.`
            : null;
  const remarksError =
    decision !== "verified" && !remarks.trim()
      ? "A remark is required — the employee sees it."
      : null;

  const decide = async () => {
    setAttempted(true);
    if (!item || acceptedError || remarksError) return;
    setIsSaving(true);
    setServerError(null);
    const body: ProofDecisionInput = {
      decision,
      accepted_amount:
        decision === "verified" ? item.proof_amount : decision === "rejected" ? "0" : accepted.trim(),
      remarks: remarks.trim(),
    };
    try {
      await post<TaxProof>(`/tax/proofs/${item.id}/verify`, body);
      toast.success(`Proof for ${item.employee_name} recorded as ${DECISION_LABEL[decision].toLowerCase()}`);
      onOpenChange(false);
      onDecided();
    } catch (error) {
      setServerError(apiErrorMessage(error, "The decision could not be recorded."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Verify proof</DialogTitle>
          <DialogDescription>
            {item &&
              `${item.employee_name} (${item.employee_code}) · ${item.section}${item.sub_category ? ` · ${item.sub_category}` : ""} · FY ${item.financial_year}`}
          </DialogDescription>
        </DialogHeader>

        {item && (
          <form
            noValidate
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void decide();
            }}
          >
            <dl className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/40 px-3 py-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Declared</dt>
                <dd>
                  <Money value={item.declared_amount} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">This proof</dt>
                <dd>
                  <Money value={item.proof_amount} className="font-semibold" />
                </dd>
              </div>
              <div className="col-span-2">
                {item.has_document ? (
                  <DownloadButton
                    path={`/tax/proofs/${item.id}/document`}
                    fallbackName={item.document_name ?? `proof-${item.id}`}
                    label={item.document_name ? `Open ${item.document_name}` : "Open document"}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">No document was attached.</span>
                )}
              </div>
            </dl>

            <FormField
              htmlFor="proof-decision"
              label="Decision"
              hint={
                decision === "verified"
                  ? `Accepts ${formatMoney(item.proof_amount)} in full.`
                  : decision === "rejected"
                    ? "Accepts nothing from this proof."
                    : "Accepts only the amount you enter."
              }
            >
              <Select value={decision} onValueChange={(value) => setDecision(value as Decision)}>
                <SelectTrigger id="proof-decision" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DECISION_LABEL) as Decision[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {DECISION_LABEL[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {decision === "partially_accepted" && (
              <FormField
                htmlFor="proof-accepted"
                label="Accepted amount (₹)"
                error={attempted ? acceptedError : null}
              >
                <Input
                  id="proof-accepted"
                  value={accepted}
                  inputMode="decimal"
                  autoComplete="off"
                  className="tabular-nums"
                  aria-invalid={attempted && Boolean(acceptedError)}
                  onChange={(event) => setAccepted(event.target.value)}
                />
              </FormField>
            )}

            <FormField
              htmlFor="proof-remarks"
              label="Remarks"
              optional={decision === "verified"}
              hint="The employee sees this remark."
              error={attempted ? remarksError : null}
            >
              <Textarea
                id="proof-remarks"
                value={remarks}
                rows={3}
                maxLength={2000}
                aria-invalid={attempted && Boolean(remarksError)}
                onChange={(event) => setRemarks(event.target.value)}
              />
            </FormField>

            {serverError && <InlineProblem>{serverError}</InlineProblem>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={decision === "rejected" ? "destructive" : "default"}
                disabled={isSaving}
              >
                {isSaving && <Loader2 className="animate-spin" />}
                Record decision
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
