"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Calculator, FileCheck2, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import {
  apiErrorMessage,
  DownloadButton,
  InlineProblem,
  isMoneyInput,
  isZero,
  QueryBoundary,
} from "@/components/payroll-ops/shared";
import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { FormField } from "@/components/common/FormField";
import { employeeDisplayName } from "@/components/payroll-ops/disbursements/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { EmployeeSummary } from "@/lib/types";
import type {
  IssuedDocument,
  ReliefAllocation,
  ReliefInput,
  ReliefYears,
  SectionRelief,
} from "@/lib/types/payroll-ops";

type Regime = "old" | "new";

const ALLOCATION_COLUMNS: ColumnDef<ReliefAllocation>[] = [
  { accessorKey: "financial_year", header: "Financial year" },
  {
    accessorKey: "original_income",
    header: "Original income",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.original_income} />,
  },
  {
    accessorKey: "arrear_portion",
    header: "Arrear portion",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.arrear_portion} />,
  },
  {
    accessorKey: "tax_on_original",
    header: "Tax on original",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.tax_on_original} />,
  },
  {
    accessorKey: "tax_with_arrear",
    header: "Tax with arrear",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.tax_with_arrear} />,
  },
  {
    accessorKey: "additional_tax",
    header: "Additional tax",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.additional_tax} className="font-medium" />,
  },
];

/** Section 89(1) relief for one employee's arrears in a batch, and its Form 10E. */
export function ReliefPanel({
  batchId,
  employee,
  onComputed,
}: {
  batchId: string;
  employee: EmployeeSummary;
  onComputed: () => void;
}) {
  const years = useApiQuery<ReliefYears>(
    `/arrears/batches/${batchId}/relief-years?employee_id=${encodeURIComponent(employee.id)}`,
  );

  return (
    <div className="grid gap-4">
      <Alert>
        <FileCheck2 />
        <AlertTitle>Have a tax advisor review before filing</AlertTitle>
        <AlertDescription>
          <p>
            The relief working and Form 10E are computed from the incomes you enter. Have them
            reviewed by a tax advisor before the employee files. A relief of zero is a correct
            answer when spreading the arrear back does not lower the tax.
          </p>
        </AlertDescription>
      </Alert>
      <QueryBoundary query={years} skeletonRows={3}>
        {(data) => (
          <ReliefForm
            key={`${data.employee_id}-${data.receipt_financial_year}`}
            batchId={batchId}
            employee={employee}
            years={data}
            onComputed={onComputed}
          />
        )}
      </QueryBoundary>
    </div>
  );
}

function ReliefForm({
  batchId,
  employee,
  years,
  onComputed,
}: {
  batchId: string;
  employee: EmployeeSummary;
  years: ReliefYears;
  onComputed: () => void;
}) {
  const [regime, setRegime] = useState<Regime>("new");
  const [receiptIncome, setReceiptIncome] = useState("");
  const [prior, setPrior] = useState(
    years.years.map((year) => ({
      financial_year: year.financial_year,
      regime: "new" as Regime,
      original_taxable_income: "",
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [result, setResult] = useState<SectionRelief | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!isMoneyInput(receiptIncome)) {
      setError(`Enter the taxable income for ${years.receipt_financial_year}, in rupees.`);
      return;
    }
    const missing = prior.find((year) => !isMoneyInput(year.original_taxable_income));
    if (missing) {
      setError(`Enter the original taxable income for ${missing.financial_year}, in rupees.`);
      return;
    }
    const body: ReliefInput = {
      employee_id: employee.id,
      receipt_financial_year: years.receipt_financial_year,
      regime,
      receipt_year_taxable_income: receiptIncome.trim(),
      prior_years: prior.map((year) => ({
        ...year,
        original_taxable_income: year.original_taxable_income.trim(),
      })),
    };
    setIsBusy(true);
    try {
      const relief = await post<SectionRelief>(`/arrears/batches/${batchId}/relief`, body);
      setResult(relief);
      onComputed();
    } catch (caught) {
      setError(apiErrorMessage(caught, "The relief could not be computed."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        {employeeDisplayName(employee)} receives arrears of{" "}
        <Money value={years.arrear_amount} className="text-foreground" /> in{" "}
        {years.receipt_financial_year}
        {years.years.length > 0
          ? `, relating to ${years.years.map((year) => year.financial_year).join(", ")}.`
          : ". None of it relates to an earlier financial year, so there is nothing to spread back."}
      </p>

      <form className="grid gap-4" onSubmit={(event) => void submit(event)} noValidate>
        <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
          <p className="text-sm font-medium text-foreground sm:col-span-2">
            Year of receipt: {years.receipt_financial_year}
          </p>
          <FormField htmlFor="relief-receipt-income" label="Taxable income including the arrear (₹)">
            <Input
              id="relief-receipt-income"
              inputMode="decimal"
              required
              value={receiptIncome}
              onChange={(event) => setReceiptIncome(event.target.value)}
              aria-invalid={receiptIncome !== "" && !isMoneyInput(receiptIncome)}
              className="tabular-nums"
            />
          </FormField>
          <RegimeSelect id="relief-receipt-regime" value={regime} onChange={setRegime} />
        </div>

        {years.years.map((year, index) => (
          <div
            key={year.financial_year}
            className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2"
          >
            <p className="text-sm font-medium text-foreground sm:col-span-2">
              {year.financial_year}{" "}
              <span className="font-normal text-muted-foreground">
                · arrear portion <Money value={year.arrear_portion} />
              </span>
            </p>
            <FormField
              htmlFor={`relief-prior-income-${index}`}
              label="Original taxable income, as filed (₹)"
            >
              <Input
                id={`relief-prior-income-${index}`}
                inputMode="decimal"
                required
                value={prior[index].original_taxable_income}
                onChange={(event) =>
                  setPrior((current) =>
                    current.map((item, position) =>
                      position === index
                        ? { ...item, original_taxable_income: event.target.value }
                        : item,
                    ),
                  )
                }
                aria-invalid={
                  prior[index].original_taxable_income !== "" &&
                  !isMoneyInput(prior[index].original_taxable_income)
                }
                className="tabular-nums"
              />
            </FormField>
            <RegimeSelect
              id={`relief-prior-regime-${index}`}
              value={prior[index].regime}
              onChange={(value) =>
                setPrior((current) =>
                  current.map((item, position) =>
                    position === index ? { ...item, regime: value } : item,
                  ),
                )
              }
            />
          </div>
        ))}

        {error && <InlineProblem>{error}</InlineProblem>}
        <div>
          <Button type="submit" disabled={isBusy}>
            {isBusy ? <Loader2 className="animate-spin" /> : <Calculator />}
            Compute relief
          </Button>
        </div>
      </form>

      {result && <ReliefResult relief={result} onIssued={onComputed} />}
    </div>
  );
}

function RegimeSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: Regime;
  onChange: (value: Regime) => void;
}) {
  return (
    <FormField htmlFor={id} label="Tax regime">
      <Select value={value} onValueChange={(next) => onChange(next as Regime)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="new">New regime</SelectItem>
          <SelectItem value="old">Old regime</SelectItem>
        </SelectContent>
      </Select>
    </FormField>
  );
}

/** The computed working, with Form 10E issue and download. */
export function ReliefResult({
  relief,
  onIssued,
}: {
  relief: SectionRelief;
  onIssued: () => void;
}) {
  const [document, setDocument] = useState<IssuedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const working = relief.working;
  const hasForm = Boolean(relief.form_10e_letter_id || document);

  const issue = async () => {
    setError(null);
    setIsIssuing(true);
    try {
      const issued = await post<IssuedDocument>(`/arrears/reliefs/${relief.id}/form-10e`);
      setDocument(issued);
      toast.success(`Form 10E issued (${issued.reference_number})`);
      onIssued();
    } catch (caught) {
      setError(apiErrorMessage(caught, "Form 10E could not be issued."));
    } finally {
      setIsIssuing(false);
    }
  };

  return (
    <div className="grid gap-4 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          Section 89(1) relief for {working.receipt_year}
        </p>
        <Badge variant={relief.is_beneficial ? "success" : "muted"}>
          {relief.is_beneficial ? "Relief lowers the tax" : "No benefit from spreading"}
        </Badge>
      </div>

      <dl className="grid gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Arrear</dt>
          <dd className="mt-1">
            <Money value={working.arrear_amount} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Tax without relief</dt>
          <dd className="mt-1">
            <Money value={working.tax_without_relief} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Tax with spreading</dt>
          <dd className="mt-1">
            <Money value={working.tax_with_spreading} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Relief</dt>
          <dd className="mt-1">
            <Money value={working.relief_amount} className="text-base font-semibold" />
          </dd>
        </div>
      </dl>

      {isZero(working.relief_amount) && (
        <p className="text-sm text-muted-foreground">
          The relief is zero. That is a correct result, not a failure: taxing the arrear in the
          year it relates to would not cost less than taxing it now.
        </p>
      )}

      {working.allocations.length > 0 && (
        <div className="overflow-hidden rounded-md border border-border">
          <DataTable
            variant="plain"
            bordered={false}
            columns={ALLOCATION_COLUMNS}
            data={working.allocations}
            getRowId={(allocation) => allocation.financial_year}
          />
        </div>
      )}

      {working.notes.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          {working.notes.map((note, index) => (
            <li key={`${note}-${index}`}>{note}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!hasForm && (
          <Button size="sm" variant="outline" onClick={() => void issue()} disabled={isIssuing}>
            {isIssuing ? <Loader2 className="animate-spin" /> : <FileCheck2 />}
            Issue Form 10E
          </Button>
        )}
        {hasForm && (
          <DownloadButton
            path={`/arrears/reliefs/${relief.id}/form-10e/pdf`}
            fallbackName={`form-10e-${relief.employee_code ?? relief.employee_id}.pdf`}
            label="Download Form 10E"
          />
        )}
        {document && (
          <span className="text-xs text-muted-foreground">
            Reference {document.reference_number}
          </span>
        )}
      </div>
      {error && <InlineProblem>{error}</InlineProblem>}
    </div>
  );
}
