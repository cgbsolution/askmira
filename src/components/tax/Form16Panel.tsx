"use client";

import { FileText } from "lucide-react";
import React from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { Money } from "@/components/common/Money";
import { DownloadButton } from "@/components/payroll-ops/shared";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Form16Year } from "@/lib/types/tax";

/**
 * Form 16 Part B for each financial year with approved payroll.
 *
 * Computed from the year's approved payslips once the year has ended — before
 * then it would be a projection presented as a certificate, so the year says
 * why it is not ready instead. Part A comes from the employer's TRACES account
 * and is not produced here.
 */
export function Form16Panel() {
  const query = useApiQuery<Form16Year[]>("/tax/form-16");
  const years = query.data ?? [];

  return (
    <DataPanel
      title="Form 16 (Part B)"
      description="Your salary and the tax deducted from it for each financial year, from approved payroll. Part A is issued by your employer from the Income Tax department's TRACES portal."
      isLoading={query.isLoading && !query.data}
      error={query.error?.detail}
      onRetry={query.reload}
      isEmpty={years.length === 0}
      empty={{
        icon: FileText,
        title: "No approved payroll yet",
        description:
          "Form 16 Part B is produced from approved payroll. It appears here after your first payroll month is approved, and can be downloaded once that financial year ends.",
      }}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Financial year</TableHead>
              <TableHead className="text-right">Taxable income</TableHead>
              <TableHead className="text-right">Tax for the year</TableHead>
              <TableHead className="text-right">TDS deducted</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {years.map((year) => (
              <TableRow key={year.financial_year}>
                <TableCell>
                  <p className="font-medium text-foreground">{year.financial_year}</p>
                  <p className="text-xs text-muted-foreground">
                    Assessment year {year.assessment_year}
                  </p>
                </TableCell>
                {year.available ? (
                  <>
                    <TableCell className="text-right">
                      <Money value={year.taxable_income} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={year.tax_payable} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={year.tds_deducted} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DownloadButton
                        path={`/tax/form-16/pdf?financial_year=${encodeURIComponent(year.financial_year)}`}
                        fallbackName={`Form16-PartB-${year.financial_year}.pdf`}
                        label="Part B PDF"
                      />
                    </TableCell>
                  </>
                ) : (
                  <TableCell colSpan={4} className="max-w-md whitespace-normal">
                    <Badge variant="muted">Not ready</Badge>
                    <p className="mt-1 text-sm text-muted-foreground">{year.reason}</p>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DataPanel>
  );
}
