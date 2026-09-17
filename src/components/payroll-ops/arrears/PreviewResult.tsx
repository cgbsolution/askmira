"use client";

import { AlertTriangle, FileWarning } from "lucide-react";
import React from "react";

import {
  isNegative,
} from "@/components/payroll-ops/shared";
import { DetailField } from "@/components/payroll-ops/disbursements/common";
import { Money } from "@/components/common/Money";
import { displayPeriod, humanize } from "@/components/payroll-ops/arrears/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ArrearPreview } from "@/lib/types/payroll-ops";
import { cn } from "@/lib/utils";

/** What a revision would pay: summary, guardrails, then every component difference. */
export function PreviewResult({ preview }: { preview: ArrearPreview }) {
  const { summary } = preview;
  const employeeIds = Object.keys(preview.per_employee);

  return (
    <div className="grid gap-4">
      {preview.guardrails.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            The commit will be refused for {preview.guardrails.length}{" "}
            {preview.guardrails.length === 1 ? "reason" : "reasons"}
          </AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {preview.guardrails.map((guardrail, index) => (
                <li key={`${guardrail.employee_id}-${index}`}>
                  <span className="font-medium">
                    {guardrail.employee_code ??
                      preview.employees[guardrail.employee_id]?.employee_code ??
                      "Employee"}
                  </span>
                  : {guardrail.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>
            Employer contributions are shown separately; they are a cost to the company and are
            not netted into what the employee receives.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <DetailField label="Employees">
              <span className="tabular-nums">{summary.employee_count}</span>
            </DetailField>
            <DetailField label="Periods">
              <span className="tabular-nums">{summary.period_count}</span>
            </DetailField>
            <DetailField label="Earnings arrear">
              <Money value={summary.earnings} />
            </DetailField>
            <DetailField label="Employee deductions">
              <Money value={summary.employee_deductions} />
            </DetailField>
            <DetailField label="Employer contributions">
              <Money value={summary.employer_contributions} />
            </DetailField>
            <DetailField label="Net payable">
              <Money value={summary.net_payable} className="text-base font-semibold" />
            </DetailField>
          </dl>
          {summary.affected_filings.length > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-border bg-muted/50 px-3 py-2.5 text-sm">
              <FileWarning className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Returns already filed that this touches</p>
                <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                  {summary.affected_filings.map((filing) => (
                    <li key={filing}>{filing}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {employeeIds.map((employeeId) => {
        const person = preview.employees[employeeId];
        const periods = preview.per_employee[employeeId];
        return (
          <Card key={employeeId} tier="tier1" className="gap-0 py-0">
            <CardHeader className="border-b border-border py-4">
              <CardTitle>{person?.employee_name ?? "Employee"}</CardTitle>
              <CardDescription>{person?.employee_code ?? employeeId}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-0 p-0">
              {periods.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">
                  No closed period is affected for this employee.
                </p>
              ) : (
                periods.map((period) => (
                  <div key={period.period} className="border-b border-border last:border-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 bg-muted/40 px-5 py-2 text-sm">
                      <span className="font-medium text-foreground">
                        {displayPeriod(period.period)}
                      </span>
                      <span className="text-muted-foreground">
                        Net payable <Money value={period.net_payable} className="text-foreground" />
                      </span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Component</TableHead>
                          <TableHead className="hidden sm:table-cell">Type</TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                          <TableHead className="text-right">Should have been</TableHead>
                          <TableHead className="text-right">Difference</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {period.components.map((component) => (
                          <TableRow key={component.code}>
                            <TableCell>
                              <span className="text-foreground">{component.name}</span>
                              <span className="block text-xs text-muted-foreground">
                                {component.code}
                              </span>
                            </TableCell>
                            <TableCell className="hidden text-muted-foreground sm:table-cell">
                              {humanize(component.component_type)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Money value={component.paid} className="text-muted-foreground" />
                            </TableCell>
                            <TableCell className="text-right">
                              <Money value={component.should_have_been} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Money
                                value={component.difference}
                                className={cn(
                                  "font-medium",
                                  isNegative(component.difference) && "text-destructive",
                                )}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {period.notes.length > 0 && (
                      <ul className="list-disc px-5 py-2 pl-9 text-xs text-muted-foreground">
                        {period.notes.map((note, index) => (
                          <li key={`${note}-${index}`}>{note}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

