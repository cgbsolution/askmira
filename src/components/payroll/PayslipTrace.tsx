import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Info } from "lucide-react";
import React from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import {
  COMPONENT_TYPE_LABEL,
  IMPORTED_TDS_NOTE,
  isImported,
  isZero,
  periodLabel,
  REGISTER_PROVIDER,
  registerRowsLabel,
  RULE_TYPE_LABEL,
} from "@/components/payroll/labels";
import { ImportedBadge } from "@/components/payroll/RunStatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Payslip, PayslipInputLine, RuleSetUsed, TdsWorking } from "@/lib/types/payroll";
import { formatDay, formatDays } from "@/lib/utils";

const INPUT_KIND_LABEL: Record<PayslipInputLine["kind"], string> = {
  earning: "Earning",
  reimbursement: "Reimbursement",
  deduction: "Deduction",
  recovery: "Recovery",
  perquisite: "Perquisite (non-cash)",
  employer_contribution: "Employer",
};

/** A salary or statutory line of the payslip, or its income tax line. */
type TraceLine = {
  key: string;
  code: string;
  name: string;
  typeLabel: string;
  basis: string;
  amount: string;
  rule?: RuleSetUsed;
};

type TaxSlab = TdsWorking["computation"]["slabs"][number];

const TRACE_COLUMNS: ColumnDef<TraceLine>[] = [
  {
    accessorKey: "name",
    header: "Line",
    meta: { text: (line) => `${line.name} ${line.code}` },
    cell: ({ row }) => (
      <>
        <p className="font-medium text-foreground">{row.original.name}</p>
        <p className="text-xs text-muted-foreground">{row.original.code}</p>
      </>
    ),
  },
  {
    accessorKey: "typeLabel",
    header: "Type",
    cell: ({ row }) => <Badge variant="muted">{row.original.typeLabel}</Badge>,
  },
  {
    accessorKey: "basis",
    header: "How it was worked out",
    meta: { cellClassName: "max-w-md whitespace-normal text-sm text-muted-foreground" },
    cell: ({ row }) => {
      const { basis, rule } = row.original;
      return (
        <>
          {basis}
          {rule && (
            <span className="block text-xs">
              {RULE_TYPE_LABEL[rule.rule_type] ?? rule.rule_type} · {rule.jurisdiction}{" "}
              · version {rule.version} from {formatDay(rule.effective_from, true)}
            </span>
          )}
        </>
      );
    },
  },
  {
    accessorKey: "amount",
    header: "Amount",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.amount} />,
  },
];

const INPUT_COLUMNS: ColumnDef<PayslipInputLine>[] = [
  {
    accessorKey: "name",
    header: "Line",
    meta: { text: (line) => `${line.name} ${line.code}` },
    cell: ({ row }) => (
      <>
        <p className="font-medium text-foreground">{row.original.name}</p>
        <p className="text-xs text-muted-foreground">
          {row.original.code} · {String(row.original.source.type ?? row.original.provider)}
        </p>
      </>
    ),
  },
  {
    accessorKey: "kind",
    header: "Kind",
    meta: { text: (line) => INPUT_KIND_LABEL[line.kind] ?? line.kind },
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        <Badge variant="muted">{INPUT_KIND_LABEL[row.original.kind] ?? row.original.kind}</Badge>
        {row.original.skipped && <Badge variant="warning">Not taken this month</Badge>}
      </div>
    ),
  },
  {
    accessorKey: "basis",
    header: "Why",
    meta: { cellClassName: "max-w-md whitespace-normal text-sm text-muted-foreground" },
  },
  {
    accessorKey: "taxable_amount",
    header: "Taxable",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.taxable_amount} />,
  },
  {
    accessorKey: "amount",
    header: "Amount",
    meta: { className: "text-right" },
    cell: ({ row }) => (
      <>
        <Money value={row.original.amount} />
        {row.original.skipped && (
          <p className="text-xs text-muted-foreground">
            of <Money value={row.original.requested} /> due
          </p>
        )}
      </>
    ),
  },
];

/** "Sep-23.xlsx · Sheet1 · Row 12" for a line an imported register carried. */
function registerSourceText(source: Record<string, unknown>): string {
  const rows = Array.isArray(source.rows)
    ? source.rows.filter((row): row is number => typeof row === "number")
    : typeof source.row === "number"
      ? [source.row]
      : [];
  return [source.file, source.sheet, registerRowsLabel(rows)]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" · ");
}

/** Differences an imported register carried (net set by hand, adjustment, rounding). */
const REGISTER_COLUMNS: ColumnDef<PayslipInputLine>[] = [
  {
    accessorKey: "name",
    header: "Line",
    meta: { text: (line) => `${line.name} ${line.code}` },
    cell: ({ row }) => {
      const where = registerSourceText(row.original.source);
      return (
        <>
          <p className="font-medium text-foreground">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.code}
            {where ? ` · ${where}` : ""}
          </p>
        </>
      );
    },
  },
  {
    accessorKey: "basis",
    header: "How it was worked out",
    meta: { cellClassName: "max-w-md whitespace-normal text-sm text-muted-foreground" },
  },
  {
    accessorKey: "amount",
    header: "Amount",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.amount} />,
  },
];

/** The projection's tax slabs, with its rebate, surcharge and cess beneath. */
function slabColumns(computation: TdsWorking["computation"]): ColumnDef<TaxSlab>[] {
  return [
    {
      id: "slab",
      header: "Slab",
      accessorFn: (slab) => `${slab.from} – ${slab.to}`,
      cell: ({ row }) => (
        <>
          <Money value={row.original.from} /> – <Money value={row.original.to} />
        </>
      ),
      footer: () => "Rebate · surcharge · cess",
    },
    {
      accessorKey: "rate",
      header: "Rate",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => `${row.original.rate}%`,
      footer: () => null,
    },
    {
      accessorKey: "tax",
      header: "Tax",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.tax} />,
      footer: () => (
        <>
          <Money value={computation.rebate} /> · <Money value={computation.surcharge} /> ·{" "}
          <Money value={computation.cess} />
        </>
      ),
    },
  ];
}

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
  const imported = isImported(payslip);
  const tds = payslip.tds_working;
  const tdsNote = imported ? IMPORTED_TDS_NOTE : payslip.tds_note;
  const registerLines = payslip.input_lines.filter((line) => line.provider === REGISTER_PROVIDER);
  const moduleLines = payslip.input_lines.filter((line) => line.provider !== REGISTER_PROVIDER);
  const source = payslip.import_summary;
  const traceLines: TraceLine[] = [
    ...payslip.lines.map((line) => ({
      key: line.code,
      code: line.code,
      name: line.name,
      typeLabel: COMPONENT_TYPE_LABEL[line.type] ?? line.type,
      basis: line.basis,
      amount: line.amount,
      rule: line.rule_set_id ? ruleSetById.get(line.rule_set_id) : undefined,
    })),
    {
      key: "__income-tax",
      code: "TDS",
      name: "Income tax (TDS)",
      typeLabel: "Deduction",
      basis: tdsNote,
      amount: payslip.tds,
    },
  ];

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
          {imported && (
            <ImportedBadge className="whitespace-normal text-left">
              Imported from factoHR — figures as paid there
            </ImportedBadge>
          )}
        </CardHeader>
        {imported && source && (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              From the factoHR salary register: {source.file}
              {source.sheet ? ` · sheet ${source.sheet}` : ""}
              {source.rows?.length ? ` · ${registerRowsLabel(source.rows).toLowerCase()}` : ""}
              {source.status ? ` · status “${source.status}”` : ""}
              {source.client ? ` · client “${source.client}”` : ""}
            </p>
          </CardContent>
        )}
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Figure label="Gross earnings" value={payslip.gross_earnings} />
          <Figure
            label={imported ? "Register adjustments" : "Other payments"}
            value={payslip.other_earnings}
          />
          <Figure label="Deductions" value={payslip.total_deductions} />
          <Figure label="Net pay" value={payslip.net_pay} />
        </CardContent>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {formatDays(payslip.paid_days)} of {formatDays(payslip.working_days)} days paid
            {isZero(payslip.lop_days) ? "" : ` · ${formatDays(payslip.lop_days)} days loss of pay`}
            {isZero(payslip.not_employed_days)
              ? ""
              : ` · Not employed: ${formatDays(payslip.not_employed_days)} days`}
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

      <DataTable
        variant="plain"
        tier="tier1"
        title="Salary and statutory lines"
        description={
          imported
            ? "Each line as paid on factoHR, with the register row it came from. No AskMira rule worked it out."
            : "Each line says how it was worked out and which approved rule version it used."
        }
        columns={TRACE_COLUMNS}
        data={traceLines}
        getRowId={(line) => line.key}
      />

      {registerLines.length > 0 && (
        <DataTable
          variant="plain"
          tier="tier1"
          title="From the register"
          description="Differences the factoHR register carried, kept as they were so the payslip adds up to what was paid: a net salary set by hand, the adjustment to the bank transfer, and rounding."
          columns={REGISTER_COLUMNS}
          data={registerLines}
          getRowId={(line, index) => `${line.code}-${index}`}
        />
      )}

      {moduleLines.length > 0 && (
        <DataTable
          variant="plain"
          tier="tier1"
          title="From other modules"
          description="Loans, reimbursements, arrears, bonuses and recoveries, each with the record it came from."
          columns={INPUT_COLUMNS}
          data={moduleLines}
          getRowId={(line, index) => `${line.code}-${index}`}
        />
      )}

      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Income tax working</CardTitle>
          <CardDescription>{tdsNote}</CardDescription>
        </CardHeader>
        <CardContent>
          {tds ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                {Number(tds.tds_assumed_deducted_by_previous_payroll ?? 0) > 0 && (
                  <>
                    <dt className="text-muted-foreground">
                      Taken as deducted on your previous payroll
                    </dt>
                    <dd className="text-right">
                      <Money value={tds.tds_assumed_deducted_by_previous_payroll ?? "0"} />
                    </dd>
                  </>
                )}
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
              <div className="min-w-0 space-y-3">
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  {tds.declaration_basis}
                </p>
                {Number(tds.projection?.earlier_months_from_salary_structure ?? 0) > 0 && (
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    <span>
                      {tds.projection.earlier_months_from_salary_structure} earlier month(s) of
                      this year were paid on the previous payroll. They are counted at the salary
                      structure, and their tax is taken as deducted at the year&apos;s steady
                      monthly rate.
                    </span>
                  </p>
                )}
                {tds.computation.slabs.length > 0 && (
                  <DataTable
                    variant="plain"
                    columns={slabColumns(tds.computation)}
                    data={tds.computation.slabs}
                    getRowId={(slab) => `${slab.from}-${slab.to}`}
                  />
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
              {imported
                ? "The TDS line is what factoHR deducted. Its projection for the year was not part of the register."
                : "No projection is stored for this payslip."}
            </p>
          )}
        </CardContent>
      </Card>

      {!imported && payslip.rule_sets.length > 0 && (
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
