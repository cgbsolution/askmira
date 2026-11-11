"use client";

import { FileText, Landmark, Wallet } from "lucide-react";
import React from "react";

import { AmountInput } from "@/components/common/AmountInput";
import { Money } from "@/components/common/Money";
import {
  BASES,
  BASIS_LABEL,
  SECTIONS,
  type WageLine,
  type WageRow,
  isTypedAmount,
} from "@/components/payroll/salary-master/shared";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PayBasis, SalaryGroupTotal, TakeHome, TakeHomeLine } from "@/lib/types/payroll";

const EMPTY: WageRow = { amount: "", basis: "monthly", remarks: "" };

/** Each statutory line on the employee's side, and the MANUAL wage type that overrides it. */
const STATUTORY_MANUAL: Record<string, { code: string; name: string }> = {
  PF_EMPLOYEE: { code: "PF_MANUAL", name: "Provident Fund (employee)" },
  ESI_EMPLOYEE: { code: "ESIC_MANUAL", name: "ESIC (employee)" },
  PT: { code: "PT_MANUAL", name: "Professional Tax" },
  LWF_EMPLOYEE: { code: "LWF_MANUAL", name: "Labour Welfare Fund (employee)" },
  TDS: { code: "TDS_MANUAL", name: "TDS" },
};
const EMPLOYEE_ORDER = ["PF_EMPLOYEE", "VPF", "ESI_EMPLOYEE", "PT", "LWF_EMPLOYEE", "TDS"];

export interface GrossRow {
  /** As typed; empty means the earnings' sum stands. */
  amount: string;
  basis: PayBasis;
  /** The earnings' sum a month, shown in the box while nothing is typed. */
  earnings: string | null | undefined;
  annual: string | null | undefined;
  /** A typed gross that differs from the earnings: said beside it. */
  differs: boolean;
  onAmount: (value: string) => void;
  onBasis: (basis: PayBasis) => void;
}

export interface CtcRow {
  amount: string;
  basis: PayBasis;
  /** The CTC row's Reference / Remarks: the revision's reason. */
  remarks: string;
  annual: string | null | undefined;
  onAmount: (value: string) => void;
  onBasis: (basis: PayBasis) => void;
  onRemarks: (value: string) => void;
}

/**
 * The Employee Salary Master grid: CTC Wise Input, then the Salary Structure in
 * numbered groups with their sub-totals. Every amount is typed by hand; the
 * yearly figures and sub-totals come from the server, which also turns a
 * weekly, daily or hourly figure into a month's. The browser never does sums.
 * Take home closes the grid: worked out by the payroll engine (PF, ESIC and PT
 * from the statutory rules), with what it took off said beside it.
 */
export function SalaryGrid({
  lines,
  rows,
  groupTotals,
  ctc,
  gross,
  takeHome,
  readOnly = false,
  onChange,
}: {
  lines: WageLine[];
  rows: Record<string, WageRow>;
  groupTotals: SalaryGroupTotal[];
  ctc: CtcRow;
  gross: GrossRow;
  /** Undefined: nothing to work it out from yet (no CTC, or an amount to fix); null: being worked out. */
  takeHome?: TakeHome | null;
  readOnly?: boolean;
  onChange?: (code: string, row: WageRow) => void;
}) {
  const rowOf = (code: string): WageRow => rows[code] ?? EMPTY;
  const totalOf = (key: string) => groupTotals.find((t) => t.wage_group === key);

  const basisSelect = (value: PayBasis, onBasis: (basis: PayBasis) => void, label: string) =>
    readOnly ? (
      <span className="text-sm">{BASIS_LABEL[value]}</span>
    ) : (
      <Select value={value} onValueChange={(next) => onBasis(next as PayBasis)}>
        <SelectTrigger size="sm" aria-label={`${label} pay basis`} className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BASES.map((basis) => (
            <SelectItem key={basis} value={basis}>
              {BASIS_LABEL[basis]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );

  const amountBox = (value: string, onValue: (value: string) => void, label: string, placeholder?: string) =>
    readOnly ? (
      <Money value={value || null} />
    ) : (
      <AmountInput
        aria-label={`${label} amount`}
        aria-invalid={(value.trim() !== "" && !isTypedAmount(value)) || undefined}
        value={value}
        placeholder={placeholder}
        className="ml-auto h-9 w-36"
        onValueChange={onValue}
      />
    );

  const remarksBox = (value: string, onValue: (value: string) => void, label: string) =>
    readOnly ? (
      <span className="text-sm text-muted-foreground">{value}</span>
    ) : (
      <Input
        aria-label={`${label} remarks`}
        maxLength={255}
        value={value}
        className="h-9"
        onChange={(event) => onValue(event.target.value)}
      />
    );

  const name = (label: string) => (
    <span className="flex items-center gap-2 text-sm text-foreground">
      <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      {label}
    </span>
  );

  const lineRow = (line: WageLine) => {
    const row = rowOf(line.code);
    const set = (patch: Partial<WageRow>) => onChange?.(line.code, { ...row, ...patch });
    return (
      <TableRow key={line.code}>
        <TableCell className="min-w-64">{name(line.name)}</TableCell>
        <TableCell className="w-32">{basisSelect(row.basis, (basis) => set({ basis }), line.name)}</TableCell>
        <TableCell className="w-40 text-right">
          {amountBox(row.amount, (amount) => set({ amount }), line.name)}
        </TableCell>
        <TableCell className="w-36 text-right">{row.amount.trim() ? <Money value={line.annual} /> : null}</TableCell>
        <TableCell className="w-24" />
        <TableCell className="min-w-44">{remarksBox(row.remarks, (remarks) => set({ remarks }), line.name)}</TableCell>
      </TableRow>
    );
  };

  const sectionRow = (label: string) => (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={6} className="pt-5 pb-2 text-base font-semibold text-foreground">
        {label}
      </TableCell>
    </TableRow>
  );

  const ctcInputs = lines.filter((line) => line.group === "ctc_input");

  // The employee's statutory lines, each typeable through its MANUAL wage type.
  // A line payroll took nothing for still gets a row while its MANUAL type exists,
  // so a PT or TDS can be typed in from here too.
  const manualOf = (code: string) => STATUTORY_MANUAL[code]?.code;
  const editableManual = (code: string) => {
    const manual = manualOf(code);
    return !readOnly && manual && lines.some((line) => line.code === manual) ? manual : null;
  };
  const employeeRows: TakeHomeLine[] | undefined = takeHome?.employee
    ? EMPLOYEE_ORDER.map(
        (code) =>
          takeHome.employee?.find((line) => line.code === code) ??
          (editableManual(code)
            ? {
                code,
                name: STATUTORY_MANUAL[code].name,
                monthly: "0.00",
                annual: "0.00",
                basis: "Not deducted. Type an amount to deduct it.",
              }
            : null),
      )
        .filter((line): line is TakeHomeLine => line !== null)
        .concat(takeHome.employee.filter((line) => !EMPLOYEE_ORDER.includes(line.code)))
    : undefined;

  return (
    <div className="rounded-xl border border-border">
      {/* table-ok: the Employee Salary Master form grid, in sections with numbered group and sub-total rows spanning the table; DataTable has no section or sub-total rows */}
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="text-xs uppercase">Wage type description</TableHead>
            <TableHead className="text-xs uppercase">Pay basis</TableHead>
            <TableHead className="text-right text-xs uppercase">Amount</TableHead>
            <TableHead className="text-right text-xs uppercase">Annually</TableHead>
            <TableHead className="text-xs uppercase">Manually</TableHead>
            <TableHead className="text-xs uppercase">Reference / remarks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sectionRow("CTC Wise Input")}
          <TableRow>
            <TableCell>{name("CTC TOTAL")}</TableCell>
            <TableCell>{basisSelect(ctc.basis, ctc.onBasis, "CTC")}</TableCell>
            <TableCell className="text-right">{amountBox(ctc.amount, ctc.onAmount, "CTC TOTAL")}</TableCell>
            <TableCell className="text-right">
              {ctc.amount.trim() ? <Money value={ctc.annual ?? null} /> : null}
            </TableCell>
            <TableCell />
            <TableCell>{remarksBox(ctc.remarks, ctc.onRemarks, "CTC TOTAL")}</TableCell>
          </TableRow>
          {ctcInputs.map(lineRow)}
          <TableRow>
            <TableCell>{name("MONTHLY GROSS")}</TableCell>
            <TableCell>{basisSelect(gross.basis, gross.onBasis, "Monthly gross")}</TableCell>
            <TableCell className="text-right">
              {readOnly ? (
                <Money value={gross.amount || gross.earnings || null} />
              ) : (
                amountBox(gross.amount, gross.onAmount, "MONTHLY GROSS", gross.earnings ?? undefined)
              )}
            </TableCell>
            <TableCell className="text-right">
              <Money value={gross.annual ?? null} />
            </TableCell>
            <TableCell />
            <TableCell className="text-xs text-muted-foreground">
              {gross.differs ? (
                <>
                  Earnings add up to <Money value={gross.earnings ?? null} /> a month
                </>
              ) : !readOnly && !gross.amount ? (
                "Empty: the earnings' sum"
              ) : null}
            </TableCell>
          </TableRow>

          {sectionRow("Salary Structure")}
          {SECTIONS.map((section, index) => {
            const groupLines = lines.filter((line) => line.group === section.key);
            const total = totalOf(section.key);
            const showTotal = total !== undefined && !/^0+(\.0+)?$/.test(total.monthly);
            return (
              <React.Fragment key={section.key}>
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={6}
                    className="pt-4 pb-1.5 text-xs font-semibold tracking-wide text-primary uppercase"
                  >
                    <span className="mr-5 tabular-nums">{index + 1}</span>
                    {section.title}
                  </TableCell>
                </TableRow>
                {groupLines.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="text-sm text-muted-foreground">
                      No wage types in this group.
                    </TableCell>
                  </TableRow>
                ) : (
                  groupLines.map(lineRow)
                )}
                {showTotal && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="font-semibold uppercase">Sub total</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-semibold">
                      <Money value={total.monthly} />
                    </TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}

          {sectionRow("Statutory Contributions")}
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={6} className="pt-0 pb-2 text-xs text-muted-foreground">
              Worked out by payroll for a full month from Payroll → Statutory rules.{" "}
              {!readOnly && (
                <>
                  Type in an employee&apos;s box to deduct your own amount instead (0 deducts nothing); leave it empty
                  and payroll works it out.{" "}
                </>
              )}
              The employer&apos;s share follows the PF and ESI rules.
            </TableCell>
          </TableRow>
          {(
            [
              ["Employee's contribution", employeeRows, takeHome?.employee_total],
              ["Employer's contribution", takeHome?.employer, takeHome?.employer_total],
            ] as const
          ).map(([title, rowsOf, total]) => (
            <React.Fragment key={title}>
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={6}
                  className="pt-4 pb-1.5 text-xs font-semibold tracking-wide text-primary uppercase"
                >
                  {title}
                </TableCell>
              </TableRow>
              {takeHome?.monthly && rowsOf ? (
                <>
                  {rowsOf.map((line) => {
                    const manual = editableManual(line.code);
                    const typed = manual ? rowOf(manual) : null;
                    const setTyped = (patch: Partial<WageRow>) =>
                      manual && typed && onChange?.(manual, { ...typed, ...patch });
                    return (
                      <TableRow key={line.code}>
                        <TableCell>
                          <span className="flex items-center gap-2 text-sm text-foreground">
                            <Landmark aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                            {line.name.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell>
                          {typed ? (
                            basisSelect(typed.basis, (basis) => setTyped({ basis }), line.name)
                          ) : (
                            <span className="text-sm text-muted-foreground">Monthly</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {typed ? (
                            amountBox(typed.amount, (amount) => setTyped({ amount }), line.name, line.monthly)
                          ) : (
                            <Money value={line.monthly} />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={line.annual ?? null} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {typed?.amount.trim() ? "Typed" : null}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{line.basis}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="font-semibold uppercase">Sub total</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-semibold">
                      <Money value={total ?? null} />
                    </TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                </>
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">
                    <TakeHomeNote takeHome={takeHome} />
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}

          {sectionRow("Take Home")}
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableCell>
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Wallet aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                TAKE HOME SALARY
              </span>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">Monthly</TableCell>
            <TableCell className="text-right font-semibold">
              {takeHome?.monthly ? <Money value={takeHome.monthly} /> : null}
            </TableCell>
            <TableCell className="text-right">
              {takeHome?.annual && takeHome.monthly ? <Money value={takeHome.annual} /> : null}
            </TableCell>
            <TableCell />
            <TableCell className="text-xs text-muted-foreground">
              <TakeHomeNote takeHome={takeHome} />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

/** What take home is: the gross less what payroll takes off, each named. */
export function TakeHomeNote({ takeHome }: { takeHome?: TakeHome | null }) {
  if (takeHome === undefined) return <>Shows once CTC TOTAL and the amounts are filled in correctly.</>;
  if (takeHome === null) return <>Working out…</>;
  if (!takeHome.monthly) return <>{takeHome.note ?? "Can't be worked out yet."}</>;
  if (!takeHome.deductions.length) return <>Gross, with nothing taken off.</>;
  return (
    <>
      Gross less{" "}
      {takeHome.deductions.map((line, index) => (
        <React.Fragment key={line.code}>
          {index > 0 && ", "}
          {line.name} <Money value={line.monthly} />
        </React.Fragment>
      ))}
    </>
  );
}
