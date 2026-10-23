"use client";

import { Check } from "lucide-react";
import React from "react";

import { Money } from "@/components/common/Money";
import {
  BASIS_LABEL,
  SECTIONS,
  STATUTORY_LINES,
  type WageLine,
  type WageRow,
  isTypedAmount,
} from "@/components/payroll/salary-master/shared";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PayBasis, SalaryGroupTotal } from "@/lib/types/payroll";
import { cn } from "@/lib/utils";

const CALCULATED: WageRow = {
  manual: false,
  amount: "",
  basis: "monthly",
  remarks: "",
};

export interface CtcInput {
  value: string;
  basis: PayBasis;
  invalid: boolean;
  onChange: (value: string) => void;
  onBasis: (basis: PayBasis) => void;
}

/**
 * Every wage type of one salary revision in one grid, the way payroll people
 * read it: the CTC first, then each group numbered with its sub-total.
 *
 * Every figure besides what HR types comes from the server; the browser never
 * adds or multiplies money. A calculated amount is shaded; ticking "Manually"
 * (or typing over it) sets it for this person.
 */
export function SalaryGrid({
  lines,
  rows,
  groupTotals,
  ctc,
  ctcAnnual,
  ctcMonthly,
  grossMonthly,
  grossAnnual,
  readOnly = false,
  onChange,
}: {
  lines: WageLine[];
  rows: Record<string, WageRow>;
  groupTotals: SalaryGroupTotal[];
  /** The CTC input; omitted when read-only. */
  ctc?: CtcInput;
  ctcAnnual: string | null | undefined;
  ctcMonthly: string | null | undefined;
  grossMonthly: string | null | undefined;
  grossAnnual: string | null | undefined;
  readOnly?: boolean;
  onChange?: (code: string, row: WageRow) => void;
}) {
  const rowOf = (code: string): WageRow => rows[code] ?? CALCULATED;
  const shown = (line: WageLine, row: WageRow) =>
    row.manual ? row.amount : ((row.basis === "monthly" ? line.monthly : line.annual) ?? "");
  const totalOf = (key: string) => groupTotals.find((t) => t.wage_group === key);

  const changeBasis = (line: WageLine, row: WageRow, basis: PayBasis) => {
    // Keep a typed amount's value, shown in the other basis using the server's
    // own figure for it rather than working it out here.
    const converted = basis === "monthly" ? line.monthly : line.annual;
    onChange?.(line.code, {
      ...row,
      basis,
      amount: row.manual && converted ? converted : row.amount,
    });
  };

  const sectionRow = (label: string) => (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={6} className="pt-5 pb-2 text-base font-semibold text-foreground">
        {label}
      </TableCell>
    </TableRow>
  );

  const groupRow = (index: number, label: string) => (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={6} className="pt-4 pb-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
        <span className="mr-4 tabular-nums">{index}</span>
        {label}
      </TableCell>
    </TableRow>
  );

  const subTotal = (monthly: string | null | undefined, annual: string | null | undefined) => (
    <TableRow className="bg-muted/40 hover:bg-muted/40">
      <TableCell className="font-semibold uppercase">Sub total</TableCell>
      <TableCell />
      <TableCell className="text-right font-semibold">
        <Money value={monthly ?? null} />
      </TableCell>
      <TableCell className="text-right font-semibold">
        <Money value={annual ?? null} />
      </TableCell>
      <TableCell colSpan={2} />
    </TableRow>
  );

  const basisCell = (value: PayBasis, onBasis: (basis: PayBasis) => void, label: string, disabled = false) =>
    readOnly ? (
      <span className="text-sm">{BASIS_LABEL[value]}</span>
    ) : (
      <Select value={value} disabled={disabled} onValueChange={(next) => onBasis(next as PayBasis)}>
        <SelectTrigger size="sm" aria-label={`${label} pay basis`} className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="monthly">{BASIS_LABEL.monthly}</SelectItem>
          <SelectItem value="annual">{BASIS_LABEL.annual}</SelectItem>
        </SelectContent>
      </Select>
    );

  const lineRow = (line: WageLine) => {
    const row = rowOf(line.code);
    const value = shown(line, row);
    const invalid = row.manual && !isTypedAmount(row.amount);
    const amount = readOnly ? (
      <Money value={value || null} />
    ) : (
      <Input
        inputMode="decimal"
        aria-label={`${line.name} amount`}
        aria-invalid={invalid || undefined}
        disabled={line.balance}
        value={value}
        className={cn(
          "ml-auto h-9 w-36 text-right tabular-nums",
          !row.manual && "bg-muted/60 text-muted-foreground",
          line.balance && "disabled:opacity-100",
        )}
        onChange={(event) => {
          const typed = event.target.value;
          onChange?.(
            line.code,
            typed.trim() === "" ? { ...row, manual: false, amount: "" } : { ...row, manual: true, amount: typed },
          );
        }}
      />
    );
    return (
      <TableRow key={line.code}>
        <TableCell className="min-w-56">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{line.name}</span>
            {line.balance && <Badge variant="muted">Balance of CTC</Badge>}
            {!line.partOfCtc && <Badge variant="outline">Outside CTC</Badge>}
          </div>
        </TableCell>
        <TableCell className="w-32">
          {basisCell(row.basis, (basis) => changeBasis(line, row, basis), line.name, line.balance)}
        </TableCell>
        <TableCell className="w-40 text-right">
          {line.balance && !readOnly ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div>{amount}</div>
              </TooltipTrigger>
              <TooltipContent>
                What is left of the CTC after every other component. Change the CTC to move it.
              </TooltipContent>
            </Tooltip>
          ) : (
            amount
          )}
        </TableCell>
        <TableCell className="w-36 text-right text-muted-foreground">
          <Money value={line.annual} />
        </TableCell>
        <TableCell className="w-24 text-center">
          {readOnly ? (
            row.manual ? (
              <Check aria-label="Typed manually" className="mx-auto size-4 text-primary" />
            ) : null
          ) : (
            <Checkbox
              aria-label={`Set ${line.name} manually`}
              checked={row.manual}
              disabled={line.balance}
              onCheckedChange={(checked) =>
                onChange?.(
                  line.code,
                  checked === true ? { ...row, manual: true, amount: value } : { ...row, manual: false, amount: "" },
                )
              }
            />
          )}
        </TableCell>
        <TableCell className="min-w-44">
          {readOnly ? (
            <span className="text-sm text-muted-foreground">{row.remarks || "—"}</span>
          ) : (
            <Input
              aria-label={`${line.name} remarks`}
              maxLength={255}
              value={row.remarks}
              className="h-9"
              onChange={(event) => onChange?.(line.code, { ...row, remarks: event.target.value })}
            />
          )}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="rounded-xl border border-border">
      {/* table-ok: one form grid in sections (CTC wise input, numbered wage groups with sub-total rows spanning the table); DataTable has no section or sub-total rows */}
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="text-xs uppercase">Wage type description</TableHead>
            <TableHead className="text-xs uppercase">Pay basis</TableHead>
            <TableHead className="text-right text-xs uppercase">Amount (₹)</TableHead>
            <TableHead className="text-right text-xs uppercase">Annually</TableHead>
            <TableHead className="text-center text-xs uppercase">Manually</TableHead>
            <TableHead className="text-xs uppercase">Reference / remarks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sectionRow("CTC wise input")}
          <TableRow>
            <TableCell className="font-medium">CTC total</TableCell>
            <TableCell>
              {ctc ? basisCell(ctc.basis, ctc.onBasis, "CTC") : <span className="text-sm">Monthly</span>}
            </TableCell>
            <TableCell className="text-right">
              {ctc ? (
                <Input
                  id="sm-ctc"
                  inputMode="decimal"
                  aria-label="CTC"
                  aria-invalid={ctc.invalid || undefined}
                  value={ctc.value}
                  placeholder={ctc.basis === "annual" ? "Yearly CTC" : "Monthly CTC"}
                  className="ml-auto h-9 w-36 text-right tabular-nums"
                  onChange={(event) => ctc.onChange(event.target.value)}
                />
              ) : (
                <Money value={ctcMonthly ?? null} />
              )}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              <Money value={ctcAnnual ?? null} />
            </TableCell>
            <TableCell colSpan={2} className="text-xs text-muted-foreground">
              {ctc && ctc.basis === "annual" && ctcMonthly ? (
                <>
                  <Money value={ctcMonthly} /> a month
                </>
              ) : null}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Monthly gross</TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">Monthly</span>
            </TableCell>
            <TableCell className="text-right">
              <span className="ml-auto inline-flex h-9 w-36 items-center justify-end rounded-lg bg-muted/60 px-3">
                <Money value={grossMonthly ?? null} />
              </span>
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              <Money value={grossAnnual ?? null} />
            </TableCell>
            <TableCell colSpan={2} className="text-xs text-muted-foreground">
              Every earning, worked out
            </TableCell>
          </TableRow>

          {sectionRow("Salary structure")}
          {SECTIONS.map((section, index) => {
            if (section.key === "statutory") {
              return (
                <React.Fragment key={section.key}>
                  {groupRow(index + 1, section.title)}
                  {STATUTORY_LINES.map((name) => (
                    <TableRow key={name}>
                      <TableCell className="font-medium text-foreground">{name}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">Monthly</span>
                      </TableCell>
                      <TableCell colSpan={2} className="text-right text-xs text-muted-foreground">
                        Worked out in each payroll run
                      </TableCell>
                      <TableCell />
                      <TableCell className="text-xs text-muted-foreground">From the statutory rules in force</TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              );
            }
            const groupLines = lines.filter((line) => line.group === section.key);
            const total = totalOf(section.key);
            return (
              <React.Fragment key={section.key}>
                {groupRow(index + 1, section.title)}
                {groupLines.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="text-sm text-muted-foreground">
                      No wage types in this group. Add one under Payroll setup → Salary structures.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {groupLines.map(lineRow)}
                    {subTotal(total?.monthly, total?.annual)}
                  </>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
