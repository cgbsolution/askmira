"use client";

import { AlertTriangle, Loader2, Plus, ReceiptText, Wallet } from "lucide-react";
import React, { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { NoEmployeeRecord, useHasEmployeeRecord } from "@/components/common/NoEmployeeRecord";
import { Money } from "@/components/common/Money";
import {
  apiErrorMessage,
  financialYearStart,
  InlineProblem,
  isMoneyInput,
  isZero,
  longFinancialYear,
} from "@/components/payroll-ops/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type {
  EntitlementPosition,
  ReimbursementClaim,
  ReimbursementComponent,
} from "@/lib/types/payroll-ops";
import { formatMoney, toISODate } from "@/lib/utils";

import { ClaimsTable } from "./ClaimsTable";
import { Fact } from "./common";
import { FinancialYearSelect } from "./FinancialYearSelect";
import { MyFlexiDeclaration } from "./FlexiDeclaration";
import { QueryPanel } from "./QueryPanel";

const MAX_BILL_BYTES = 5 * 1024 * 1024;
const BILL_TYPES = ["application/pdf", "image/png", "image/jpeg"];

/** Your reimbursement entitlement for a year, what you have claimed, and new claims. */
export function MyReimbursements() {
  const [year, setYear] = useState(longFinancialYear(financialYearStart()));
  const positions = useApiQuery<EntitlementPosition[]>(
    `/reimbursements/position?financial_year=${encodeURIComponent(year)}`,
  );
  const claims = useApiQuery<ReimbursementClaim[]>(
    `/reimbursements/claims?financial_year=${encodeURIComponent(year)}`,
  );
  const components = useApiQuery<ReimbursementComponent[]>("/reimbursements/components");

  const refresh = () => {
    positions.reload();
    claims.reload();
  };

  const warnings = (positions.data ?? []).filter((position) => position.should_warn);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <FinancialYearSelect value={year} onChange={setYear} />
        <div className="ml-auto">
          <SubmitClaimDialog
            year={year}
            components={(components.data ?? []).filter((component) => component.active)}
            componentsError={components.error?.detail ?? null}
            onSubmitted={refresh}
          />
        </div>
      </div>

      {warnings.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>Unclaimed entitlement becomes taxable at year end</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {warnings.map((position) => (
                <li key={position.component_code}>
                  <span className="font-medium">{position.component_name}:</span> {position.warning}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <MyFlexiDeclaration year={year} onChanged={refresh} />

      <QueryPanel
        query={positions}
        title={`Entitlement for FY ${year}`}
        description="What each component allows this year, what has been accepted against bills, and what is still unclaimed."
        isEmpty={(rows) => rows.length === 0}
        empty={{
          icon: Wallet,
          title: "No reimbursement entitlement",
          description: `Your salary structure carries no reimbursement components for FY ${year}.`,
        }}
      >
        {(rows) => (
          <div className="grid gap-4 p-5 md:grid-cols-2">
            {rows.map((position) => (
              <PositionCard key={position.component_code} position={position} />
            ))}
          </div>
        )}
      </QueryPanel>

      <QueryPanel
        query={claims}
        title="My claims"
        isEmpty={(rows) => rows.length === 0}
        empty={{
          icon: ReceiptText,
          title: "No claims this year",
          description: `You have not submitted any claims for FY ${year}.`,
        }}
      >
        {(rows) => <ClaimsTable rows={rows} />}
      </QueryPanel>
    </div>
  );
}

function PositionCard({ position }: { position: EntitlementPosition }) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-foreground">{position.component_name}</p>
        {position.should_warn && (
          <AlertTriangle
            className="size-4 shrink-0 text-warning"
            aria-label="Unclaimed entitlement warning"
          />
        )}
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <Fact label="Entitlement">
          <Money value={position.entitlement} />
        </Fact>
        <Fact label="Claimed">
          <Money value={position.claimed} />
        </Fact>
        <Fact label="Accepted">
          <Money value={position.accepted} />
        </Fact>
        <Fact label="Unclaimed">
          <Money
            value={position.unclaimed}
            className={position.should_warn ? "text-warning" : undefined}
          />
        </Fact>
        {!isZero(position.excess_accepted) && (
          <Fact label="Accepted over entitlement">
            <Money value={position.excess_accepted} />
          </Fact>
        )}
        <Fact label="Taxable if the year ended now">
          <Money value={position.taxable_if_year_ended_now} />
        </Fact>
      </dl>
      {position.should_warn && position.warning && (
        <p className="text-sm text-warning">{position.warning}</p>
      )}
      {position.notes.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
          {position.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SubmitClaimDialog({
  year,
  components,
  componentsError,
  onSubmitted,
}: {
  year: string;
  components: ReimbursementComponent[];
  componentsError: string | null;
  onSubmitted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [billDate, setBillDate] = useState("");
  const [billReference, setBillReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const component = useMemo(
    () => components.find((candidate) => candidate.code === code) ?? null,
    [components, code],
  );

  const reset = () => {
    setCode("");
    setAmount("");
    setBillDate("");
    setBillReference("");
    setFile(null);
    setProblem(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const submit = async () => {
    if (!component) return setProblem("Choose what you are claiming for.");
    if (!isMoneyInput(amount) || isZero(amount)) {
      return setProblem("Enter the amount in rupees, with at most two decimals.");
    }
    if (component.bill_required && !file) {
      return setProblem(`${component.name} needs a bill. Attach a PDF, PNG or JPEG.`);
    }
    if (file && file.size > MAX_BILL_BYTES) {
      return setProblem("The bill is larger than 5 MB. Attach a smaller file.");
    }
    if (file && file.type && !BILL_TYPES.includes(file.type)) {
      return setProblem("The bill must be a PDF, PNG or JPEG.");
    }
    setProblem(null);
    setIsBusy(true);
    const form = new FormData();
    form.append("component_code", component.code);
    form.append("financial_year", year);
    form.append("amount", amount.trim());
    if (billDate) form.append("bill_date", billDate);
    if (billReference.trim()) form.append("bill_reference", billReference.trim());
    if (file) form.append("file", file);
    try {
      const created = await post<ReimbursementClaim>("/reimbursements/claims", form);
      toast.success(`Claim for ${formatMoney(created.amount)} submitted`, {
        description: "HR verifies it against the bill.",
      });
      setOpen(false);
      reset();
      onSubmitted();
    } catch (error) {
      setProblem(apiErrorMessage(error, "The claim could not be submitted."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isBusy) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="accent" size="sm">
          <Plus /> New claim
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Claim a reimbursement</DialogTitle>
          <DialogDescription>For FY {year}. HR checks the bill before accepting it.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <FormField
            htmlFor="claim-component"
            label="Component"
            hint={
              component
                ? `Annual entitlement ${formatMoney(component.annual_entitlement)}${
                    component.bill_required ? " · a bill is required" : ""
                  }`
                : undefined
            }
          >
            {componentsError ? (
              <InlineProblem>{componentsError}</InlineProblem>
            ) : components.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                There are no active reimbursement components to claim against.
              </p>
            ) : (
              <Select value={code} onValueChange={setCode} disabled={isBusy}>
                <SelectTrigger id="claim-component" className="w-full">
                  <SelectValue placeholder="Choose a component" />
                </SelectTrigger>
                <SelectContent>
                  {components.map((option) => (
                    <SelectItem key={option.id} value={option.code}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField htmlFor="claim-amount" label="Amount (₹)">
              <Input
                id="claim-amount"
                inputMode="decimal"
                className="tabular-nums"
                required
                value={amount}
                disabled={isBusy}
                onChange={(event) => setAmount(event.target.value)}
              />
            </FormField>
            <FormField htmlFor="claim-bill-date" label="Bill date" optional>
              <Input
                id="claim-bill-date"
                type="date"
                max={toISODate(new Date())}
                value={billDate}
                disabled={isBusy}
                onChange={(event) => setBillDate(event.target.value)}
              />
            </FormField>
          </div>

          <FormField htmlFor="claim-bill-reference" label="Bill number" optional>
            <Input
              id="claim-bill-reference"
              maxLength={100}
              value={billReference}
              disabled={isBusy}
              onChange={(event) => setBillReference(event.target.value)}
            />
          </FormField>

          <FormField
            htmlFor="claim-file"
            label="Bill"
            optional={!component?.bill_required}
            hint="PDF, PNG or JPEG, up to 5 MB. The server checks the file's contents, not just its name."
          >
            <Input
              ref={fileInput}
              id="claim-file"
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              required={Boolean(component?.bill_required)}
              disabled={isBusy}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </FormField>

          {problem && <InlineProblem>{problem}</InlineProblem>}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isBusy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={isBusy || components.length === 0} onClick={() => void submit()}>
            {isBusy && <Loader2 className="animate-spin" />}
            Submit claim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Expenses → Salary reimbursements: the person's own, or why there is nothing to show. */
export function MySalaryReimbursements() {
  const hasRecord = useHasEmployeeRecord();
  return hasRecord ? <MyReimbursements /> : <NoEmployeeRecord what="Salary reimbursements" />;
}
