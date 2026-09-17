import { AlertTriangle, Info } from "lucide-react";
import React from "react";

import { Money } from "@/components/common/Money";
import { COMPONENT_TYPE_LABEL, isZero, periodLabel, RULE_TYPE_LABEL } from "@/components/payroll/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Payslip, PayslipInputLine } from "@/lib/types/payroll";
import { formatDay, formatDays } from "@/lib/utils";

const INPUT_KIND_LABEL: Record<PayslipInputLine["kind"], string> = {
  earning: "Earning",
  reimbursement: "Reimbursement",
  deduction: "Deduction",
  recovery: "Recovery",
  perquisite: "Perquisite (non-cash)",
  employer_contribution: "Employer",
};

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">
        <Money value={value} />
      </p>
    </div>
  );
}

/**
 * One payslip and every step behind it: the structure's lines, the statutory
 * deductions with the rule-set version each used, lines from other modules with
 * their source, and the income tax projection. Shared by HR and the employee.
 */
export function PayslipTrace({ payslip }: { payslip: Payslip }) {
  const ruleSetById = new Map(payslip.rule_sets.map((rs) => [rs.id, rs]));
  const tds = payslip.tds_working;

  return (
    <div className="flex flex-col gap-4">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle>
            {payslip.employee_name} · {periodLabel(payslip.period_year, payslip.period_month)}
          </CardTitle>
          <CardDescription>
            {payslip.employee_code}
            {payslip.designation ? ` · ${payslip.designation}` : ""}
            {payslip.legal_entity_name ? ` · ${payslip.legal_entity_name}` : ""}
            {payslip.payment_date ? ` · paid on ${formatDay(payslip.payment_date, true)}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Figure label="Gross earnings" value={payslip.gross_earnings} />
          <Figure label="Other payments" value={payslip.other_earnings} />
          <Figure label="Deductions" value={payslip.total_deductions} />
          <Figure label="Net pay" value={payslip.net_pay} />
        </CardContent>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {formatDays(payslip.paid_days)} of {formatDays(payslip.working_days)} days paid
            {isZero(payslip.lop_days) ? "" : ` · ${formatDays(payslip.lop_days)} days loss of pay`}
            {payslip.salary && (
              <>
                {" "}
                · CTC <Money value={payslip.salary.ctc_annual} /> on{" "}
                {payslip.salary.structure_name ?? "a salary structure"} from{" "}
                {formatDay(payslip.salary.effective_from, true)}
              </>
            )}
          </p>
        </CardContent>
      </Card>

      {payslip.review_flags.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>Payroll could not decide everything on this payslip</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {payslip.review_flags.map((flag) => (
                <li key={flag}>{flag}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card tier="tier1" className="gap-0 py-0">
        <CardHeader className="border-b border-border py-4">
          <CardTitle>Salary and statutory lines</CardTitle>
          <CardDescription>
            Each line says how it was worked out and which approved rule version it used.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Line</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>How it was worked out</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payslip.lines.map((line) => {
                const rule = line.rule_set_id ? ruleSetById.get(line.rule_set_id) : undefined;
                return (
                  <TableRow key={line.code}>
                    <TableCell>
                      <p className="font-medium text-foreground">{line.name}</p>
                      <p className="text-xs text-muted-foreground">{line.code}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted">{COMPONENT_TYPE_LABEL[line.type] ?? line.type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md whitespace-normal text-sm text-muted-foreground">
                      {line.basis}
                      {rule && (
                        <span className="block text-xs">
                          {RULE_TYPE_LABEL[rule.rule_type] ?? rule.rule_type} · {rule.jurisdiction}{" "}
                          · version {rule.version} from {formatDay(rule.effective_from, true)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={line.amount} />
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell>
                  <p className="font-medium text-foreground">Income tax (TDS)</p>
                  <p className="text-xs text-muted-foreground">TDS</p>
                </TableCell>
                <TableCell>
                  <Badge variant="muted">Deduction</Badge>
                </TableCell>
                <TableCell className="max-w-md whitespace-normal text-sm text-muted-foreground">
                  {payslip.tds_note}
                </TableCell>
                <TableCell className="text-right">
                  <Money value={payslip.tds} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {payslip.input_lines.length > 0 && (
        <Card tier="tier1" className="gap-0 py-0">
          <CardHeader className="border-b border-border py-4">
            <CardTitle>From other modules</CardTitle>
            <CardDescription>
              Loans, reimbursements, arrears, bonuses and recoveries, each with the record it
              came from.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Why</TableHead>
                  <TableHead className="text-right">Taxable</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslip.input_lines.map((line, index) => (
                  <TableRow key={`${line.code}-${index}`}>
                    <TableCell>
                      <p className="font-medium text-foreground">{line.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {line.code} · {String(line.source.type ?? line.provider)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="muted">{INPUT_KIND_LABEL[line.kind] ?? line.kind}</Badge>
                        {line.skipped && <Badge variant="warning">Not taken this month</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md whitespace-normal text-sm text-muted-foreground">
                      {line.basis}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={line.taxable_amount} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={line.amount} />
                      {line.skipped && (
                        <p className="text-xs text-muted-foreground">
                          of <Money value={line.requested} /> due
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Income tax working</CardTitle>
          <CardDescription>{payslip.tds_note}</CardDescription>
        </CardHeader>
        <CardContent>
          {tds ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Regime</dt>
                <dd className="text-right capitalize">{tds.regime}</dd>
                <dt className="text-muted-foreground">Projected annual income</dt>
                <dd className="text-right">
                  <Money value={tds.computation.gross_annual_income} />
                </dd>
                <dt className="text-muted-foreground">Exemptions</dt>
                <dd className="text-right">
                  <Money value={tds.computation.total_exemptions} />
                </dd>
                <dt className="text-muted-foreground">Deductions</dt>
                <dd className="text-right">
                  <Money value={tds.computation.total_deductions} />
                </dd>
                <dt className="text-muted-foreground">Taxable income</dt>
                <dd className="text-right">
                  <Money value={tds.computation.taxable_income} />
                </dd>
                <dt className="text-muted-foreground">Annual tax liability</dt>
                <dd className="text-right">
                  <Money value={tds.annual_liability} />
                </dd>
                <dt className="text-muted-foreground">Already deducted this year</dt>
                <dd className="text-right">
                  <Money value={tds.tds_already_deducted} />
                </dd>
                <dt className="text-muted-foreground">
                  This month: spread over {tds.months_remaining} month(s)
                </dt>
                <dd className="text-right">
                  <Money value={tds.recurring_tds} />
                </dd>
                <dt className="text-muted-foreground">This month: on one-off pay</dt>
                <dd className="text-right">
                  <Money value={tds.one_off_tds} />
                </dd>
              </dl>
              <div className="space-y-3">
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  {tds.declaration_basis}
                </p>
                {tds.computation.slabs.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Slab</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Tax</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tds.computation.slabs.map((slab) => (
                        <TableRow key={`${slab.from}-${slab.to}`}>
                          <TableCell>
                            <Money value={slab.from} /> – <Money value={slab.to} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{slab.rate}%</TableCell>
                          <TableCell className="text-right">
                            <Money value={slab.tax} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2}>Rebate · surcharge · cess</TableCell>
                        <TableCell className="text-right">
                          <Money value={tds.computation.rebate} /> ·{" "}
                          <Money value={tds.computation.surcharge} /> ·{" "}
                          <Money value={tds.computation.cess} />
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                )}
                {tds.computation.deductions.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {tds.computation.deductions.map((line) => (
                      <li key={line.section} className="flex justify-between gap-3">
                        <span className="text-muted-foreground">
                          {line.section}
                          {line.note ? ` — ${line.note}` : ""}
                        </span>
                        <Money value={line.allowed} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No projection is stored for this payslip.
            </p>
          )}
        </CardContent>
      </Card>

      {payslip.rule_sets.length > 0 && (
        <Card tier="tier1">
          <CardHeader>
            <CardTitle>Rule versions used</CardTitle>
            <CardDescription>
              Resolved by the run&apos;s own date ({formatDay(payslip.effective_date, true)}), not
              today&apos;s.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {payslip.rule_sets.map((rs) => (
                <li key={rs.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {RULE_TYPE_LABEL[rs.rule_type] ?? rs.rule_type} · {rs.jurisdiction} · version{" "}
                    {rs.version}
                  </span>
                  <span className="text-muted-foreground">
                    from {formatDay(rs.effective_from, true)}
                    {rs.source_reference ? ` · ${rs.source_reference}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
