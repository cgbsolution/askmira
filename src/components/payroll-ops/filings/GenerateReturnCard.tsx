"use client";

import { FileCog, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import {
  InlineProblem,
  longFinancialYear,
  MONTH_NAMES,
  recentFinancialYears,
} from "@/components/payroll-ops/shared";
import { FormField } from "@/components/common/FormField";
import { ExceptionsTable } from "@/components/payroll-ops/filings/ExceptionsTable";
import { RETURN_LABEL } from "@/components/payroll-ops/filings/labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, post } from "@/lib/api";
import type {
  FilingException,
  GenerationResult,
  LegalEntity,
  ReturnType,
} from "@/lib/types/payroll-ops";

const ENDPOINT: Record<ReturnType, string> = {
  pf_ecr: "/filings/pf-ecr",
  // Arrears paid with the chosen month's payroll, on the EPFO's separate arrear ECR.
  pf_ecr_arrear: "/filings/pf-ecr-arrear",
  esic: "/filings/esic",
  professional_tax: "/filings/professional-tax",
  tds_24q: "/filings/tds-24q",
};

/**
 * Generate one return. Monthly returns take a month; 24Q takes a financial
 * year and quarter. A 422 means validation blocked the file: the parent
 * reloads the list and opens the blocked record's findings.
 */
export function GenerateReturnCard({
  entities,
  onGenerated,
  onBlocked,
}: {
  entities: LegalEntity[];
  onGenerated: () => void;
  onBlocked: (returnType: ReturnType, legalEntityId: string, message: string) => void;
}) {
  const now = new Date();
  const [returnType, setReturnType] = useState<ReturnType | "">("");
  const [entityId, setEntityId] = useState(entities.length === 1 ? entities[0].id : "");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [fyStart, setFyStart] = useState(String(recentFinancialYears(1)[0]));
  const [quarter, setQuarter] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<FilingException[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  const isQuarterly = returnType === "tds_24q";
  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setProblem(null);
    setWarnings([]);
    if (!returnType || !entityId) {
      setProblem("Choose a return and a legal entity.");
      return;
    }
    if (isQuarterly && !quarter) {
      setProblem("Choose a quarter.");
      return;
    }
    const body = isQuarterly
      ? {
          legal_entity_id: entityId,
          financial_year: longFinancialYear(Number(fyStart)),
          quarter: Number(quarter),
        }
      : { legal_entity_id: entityId, year: Number(year), month: Number(month) };

    setIsBusy(true);
    try {
      if (returnType === "professional_tax") {
        const results = await post<GenerationResult[]>(ENDPOINT[returnType], body);
        setWarnings(results.flatMap((result) => result.warnings));
        toast.success(
          results.length === 0
            ? "No Professional Tax was due for this month."
            : `${results.length} Professional Tax ${results.length === 1 ? "challan" : "challans"} generated`,
        );
      } else {
        const result = await post<GenerationResult>(ENDPOINT[returnType], body);
        setWarnings(result.warnings);
        toast.success(`${RETURN_LABEL[returnType]} generated`);
      }
      onGenerated();
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        const message = error.detail.startsWith("Request failed")
          ? "Generation was blocked by validation. The findings are listed below the returns."
          : error.detail;
        setProblem(message);
        onBlocked(returnType, entityId, message);
      } else {
        setProblem(error instanceof ApiError ? error.detail : "The return could not be generated.");
      }
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Generate a return</CardTitle>
        <CardDescription>
          Reads the payroll for the period, validates every record first, and refuses to build a
          file that would be rejected for a known reason.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={(event) => void submit(event)} noValidate>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField htmlFor="filing-return-type" label="Return">
              <Select
                value={returnType}
                onValueChange={(value) => setReturnType(value as ReturnType)}
              >
                <SelectTrigger id="filing-return-type" className="w-full" aria-required>
                  <SelectValue placeholder="Choose a return" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(RETURN_LABEL) as ReturnType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {RETURN_LABEL[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="filing-entity" label="Legal entity">
              <Select value={entityId} onValueChange={setEntityId}>
                <SelectTrigger id="filing-entity" className="w-full" aria-required>
                  <SelectValue placeholder="Choose an entity" />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {isQuarterly ? (
              <>
                <FormField htmlFor="filing-fy" label="Financial year">
                  <Select value={fyStart} onValueChange={setFyStart}>
                    <SelectTrigger id="filing-fy" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {recentFinancialYears().map((start) => (
                        <SelectItem key={start} value={String(start)}>
                          {longFinancialYear(start)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField htmlFor="filing-quarter" label="Quarter">
                  <Select value={quarter} onValueChange={setQuarter}>
                    <SelectTrigger id="filing-quarter" className="w-full" aria-required>
                      <SelectValue placeholder="Choose a quarter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Q1 (April – June)</SelectItem>
                      <SelectItem value="2">Q2 (July – September)</SelectItem>
                      <SelectItem value="3">Q3 (October – December)</SelectItem>
                      <SelectItem value="4">Q4 (January – March)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </>
            ) : (
              <>
                <FormField htmlFor="filing-month" label="Month">
                  <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger id="filing-month" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.map((name, index) => (
                        <SelectItem key={name} value={String(index + 1)}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField htmlFor="filing-year" label="Year">
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger id="filing-year" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </>
            )}
          </div>

          {isQuarterly && (
            <p className="text-sm text-muted-foreground">
              Every payslip&apos;s TDS in the quarter must be mapped to a deposited challan before a
              24Q can be generated. Check the TDS challans tab first.
            </p>
          )}

          {problem && <InlineProblem>{problem}</InlineProblem>}

          <div>
            <Button type="submit" disabled={isBusy || entities.length === 0}>
              {isBusy ? <Loader2 className="animate-spin" /> : <FileCog />}
              Validate and generate
            </Button>
          </div>
        </form>

        {warnings.length > 0 && (
          <div className="mt-5 overflow-hidden rounded-md border border-border">
            <p className="border-b border-border bg-muted/50 px-3 py-2 text-sm font-medium text-foreground">
              Generated with {warnings.length} {warnings.length === 1 ? "warning" : "warnings"} —
              review before filing
            </p>
            <ExceptionsTable exceptions={warnings} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
