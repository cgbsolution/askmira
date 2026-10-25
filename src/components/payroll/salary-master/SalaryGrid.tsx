"use client";

import { FileText } from "lucide-react";
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
import type { PayBasis, SalaryGroupTotal } from "@/lib/types/payroll";

const EMPTY: WageRow = { amount: "", basis: "monthly", remarks: "" };

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
 */
export function SalaryGrid({
  lines,
  rows,
  groupTotals,
  ctc,
  gross,
  readOnly = false,
  onChange,
}: {
  lines: WageLine[];
  rows: Record<string, WageRow>;
  groupTotals: SalaryGroupTotal[];
  ctc: CtcRow;
  gross: GrossRow;
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
        </TableBody>
      </Table>
    </div>
  );
}
