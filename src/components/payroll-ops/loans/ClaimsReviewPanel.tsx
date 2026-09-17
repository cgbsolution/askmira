"use client";

import { Loader2, ReceiptText } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import {
  apiErrorMessage,
  DownloadButton,
  financialYearStart,
  InlineProblem,
  isMoneyInput,
  longFinancialYear,
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
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { patch } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import type { ClaimStatus, ClaimVerifyInput, ReimbursementClaim } from "@/lib/types/payroll-ops";

import { ClaimsTable } from "./ClaimsTable";
import { CLAIM_STATUS_LABEL, HR_ROLES, toPaise } from "./common";
import { EmployeePicker } from "./EmployeePicker";
import { FinancialYearSelect } from "./FinancialYearSelect";
import { QueryPanel } from "./QueryPanel";

/** Reimbursement claims awaiting (or past) verification by HR. */
export function ClaimsReviewPanel() {
  const { user, hasRole } = useAuth();
  const [year, setYear] = useState(longFinancialYear(financialYearStart()));
  const [status, setStatus] = useState<ClaimStatus | "any">("submitted");
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [verifying, setVerifying] = useState<ReimbursementClaim | null>(null);

  const params = new URLSearchParams({ financial_year: year });
  if (status !== "any") params.set("status", status);
  if (employee) params.set("employee_id", employee.id);
  const query = useApiQuery<ReimbursementClaim[]>(`/reimbursements/claims?${params}`);
  const canVerify = hasRole(...HR_ROLES);

  return (
    <>
      <QueryPanel
        query={query}
        title="Reimbursement claims"
        toolbar={
          <>
            <FinancialYearSelect value={year} onChange={setYear} />
            <Select value={status} onValueChange={(value) => setStatus(value as ClaimStatus | "any")}>
              <SelectTrigger size="sm" className="w-40" aria-label="Claim status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any status</SelectItem>
                {(Object.keys(CLAIM_STATUS_LABEL) as ClaimStatus[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {CLAIM_STATUS_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <EmployeePicker
              className="w-full sm:w-72"
              value={employee}
              onChange={setEmployee}
              placeholder="Filter by employee"
            />
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              {query.data ? `${query.data.length} ${query.data.length === 1 ? "claim" : "claims"}` : ""}
            </span>
          </>
        }
        isEmpty={(rows) => rows.length === 0}
        empty={{
          icon: ReceiptText,
          title: status === "submitted" ? "No claims waiting for verification" : "No claims match",
          description: `Nothing ${
            status === "any" ? "" : `with status “${CLAIM_STATUS_LABEL[status]}” `
          }for FY ${year}${employee ? " for this employee" : ""}.`,
        }}
      >
        {(rows) => (
          <ClaimsTable
            rows={rows}
            showEmployee
            actions={(claim) => {
              const isOwn = Boolean(user?.employee_id) && claim.employee_id === user?.employee_id;
              return canVerify && claim.status === "submitted" && !isOwn ? (
                <Button size="sm" variant="outline" onClick={() => setVerifying(claim)}>
                  Verify
                </Button>
              ) : null;
            }}
          />
        )}
      </QueryPanel>

      <VerifyClaimDialog
        claim={verifying}
        onClose={() => setVerifying(null)}
        onVerified={query.reload}
      />
    </>
  );
}

type Outcome = ClaimVerifyInput["status"];

function VerifyClaimDialog({
  claim,
  onClose,
  onVerified,
}: {
  claim: ReimbursementClaim | null;
  onClose: () => void;
  onVerified: () => void;
}) {
  const [outcome, setOutcome] = useState<Outcome>("verified");
  const [accepted, setAccepted] = useState("");
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const reset = () => {
    setOutcome("verified");
    setAccepted("");
    setNote("");
    setProblem(null);
  };

  const close = () => {
    if (isBusy) return;
    reset();
    onClose();
  };

  const acceptedAmount = !claim
    ? ""
    : outcome === "verified"
      ? claim.amount
      : outcome === "rejected"
        ? "0"
        : accepted.trim();

  const submit = async () => {
    if (!claim) return;
    if (outcome === "partial") {
      if (!isMoneyInput(accepted)) {
        return setProblem("Enter the accepted amount in rupees, with at most two decimals.");
      }
      if (toPaise(accepted) > toPaise(claim.amount)) {
        return setProblem("The accepted amount cannot be more than the amount claimed.");
      }
    }
    if (outcome !== "verified" && !note.trim()) {
      return setProblem("Say why the claim was not accepted in full — the employee sees this note.");
    }
    setProblem(null);
    setIsBusy(true);
    const body: ClaimVerifyInput = {
      status: outcome,
      accepted_amount: acceptedAmount,
      verification_note: note.trim() || null,
    };
    try {
      await patch<ReimbursementClaim>(`/reimbursements/claims/${claim.id}`, body);
      toast.success(`Claim marked ${CLAIM_STATUS_LABEL[outcome].toLowerCase()}`);
      setIsBusy(false);
      reset();
      onClose();
      onVerified();
    } catch (error) {
      setProblem(apiErrorMessage(error, "The claim could not be updated."));
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={claim !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verify claim</DialogTitle>
          <DialogDescription>
            {claim &&
              `${claim.employee_name ?? "Employee"} · ${claim.component_name ?? claim.component_code} · FY ${claim.financial_year}`}
          </DialogDescription>
        </DialogHeader>

        {claim && (
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Claimed: <Money value={claim.amount} className="font-medium text-foreground" />
              {!claim.has_bill && " · no bill attached"}
            </p>
            {claim.has_bill && (
              <DownloadButton
                path={`/reimbursements/claims/${claim.id}/bill`}
                fallbackName={`bill-${claim.id}`}
                label="Open the bill"
              />
            )}
            <FormField htmlFor="verify-outcome" label="Outcome">
              <Select
                value={outcome}
                disabled={isBusy}
                onValueChange={(value) => setOutcome(value as Outcome)}
              >
                <SelectTrigger id="verify-outcome" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="verified">Verified — accept in full</SelectItem>
                  <SelectItem value="partial">Partly accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="verify-accepted" label="Accepted amount (₹)">
              <Input
                id="verify-accepted"
                inputMode="decimal"
                className="tabular-nums"
                required={outcome === "partial"}
                disabled={isBusy || outcome !== "partial"}
                value={outcome === "partial" ? accepted : acceptedAmount}
                onChange={(event) => setAccepted(event.target.value)}
              />
            </FormField>
            <FormField
              htmlFor="verify-note"
              label="Note"
              optional={outcome === "verified"}
              hint="The employee sees this note."
            >
              <Textarea
                id="verify-note"
                rows={3}
                maxLength={1000}
                required={outcome !== "verified"}
                disabled={isBusy}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </FormField>
            {problem && <InlineProblem>{problem}</InlineProblem>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={close}>
            Cancel
          </Button>
          <Button
            variant={outcome === "rejected" ? "destructive" : "default"}
            disabled={isBusy}
            onClick={() => void submit()}
          >
            {isBusy && <Loader2 className="animate-spin" />}
            Save decision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
