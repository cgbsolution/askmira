"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { RotateCcw } from "lucide-react";
import React from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { BASIS_LABEL, type WageLine, type WageRow, isTypedAmount } from "@/components/payroll/salary-master/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PayBasis, SalaryTypeTotal } from "@/lib/types/payroll";
import { cn } from "@/lib/utils";

const CALCULATED = { manual: false, amount: "", basis: "monthly", remarks: "" } satisfies WageRow;

/**
 * One kind of wage type (earnings, deductions…) as an editable grid: pay basis,
 * amount, the yearly figure and a remark per line, with the kind's sub-total.
 *
 * Every figure besides what HR types comes from the server's preview; the
 * browser never adds or multiplies money. A calculated amount shows shaded,
 * a typed one white with a Manual badge and a reset.
 */
export function WageTypeTable({
  title,
  lines,
  rows,
  total,
  readOnly = false,
  onChange,
}: {
  title: string;
  lines: WageLine[];
  rows: Record<string, WageRow>;
  total: SalaryTypeTotal | undefined;
  readOnly?: boolean;
  onChange?: (code: string, row: WageRow) => void;
}) {
  const rowOf = (code: string): WageRow => rows[code] ?? CALCULATED;
  const shown = (line: WageLine, row: WageRow) =>
    row.manual ? row.amount : ((row.basis === "monthly" ? line.monthly : line.annual) ?? "");

  const changeBasis = (line: WageLine, row: WageRow, basis: PayBasis) => {
    // Keep a typed amount's value: show it in the other basis using the
    // server's own figure for it rather than working it out here.
    const converted = basis === "monthly" ? line.monthly : line.annual;
    onChange?.(line.code, { ...row, basis, amount: row.manual && converted ? converted : row.amount });
  };

  const columns: ColumnDef<WageLine>[] = [
    {
      accessorKey: "name",
      header: "Wage type",
      meta: { cellClassName: "min-w-52" },
      cell: ({ row: { original: line } }) => {
        const row = rowOf(line.code);
        return (
          <div className="flex items-center gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{line.name}</p>
              <p className="text-xs text-muted-foreground">{line.code}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {line.balance && <Badge variant="muted">Balance of CTC</Badge>}
              {!line.partOfCtc && <Badge variant="outline">Outside CTC</Badge>}
              {row.manual && <Badge variant="accent">Manual</Badge>}
            </div>
            {!readOnly && row.manual && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`Let the structure work out ${line.name} again`}
                    onClick={() => onChange?.(line.code, { ...row, manual: false, amount: "" })}
                  >
                    <RotateCcw />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {line.inStructure ? "Back to the structure's amount" : "Remove this wage type"}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      },
      footer: () => <span className="font-semibold">Sub total</span>,
    },
    {
      id: "basis",
      header: "Pay basis",
      meta: { className: "w-36", text: false },
      cell: ({ row: { original: line } }) => {
        const row = rowOf(line.code);
        if (readOnly) return <span className="text-sm">{BASIS_LABEL[row.basis]}</span>;
        return (
          <Select
            value={row.basis}
            disabled={line.balance}
            onValueChange={(value) => changeBasis(line, row, value as PayBasis)}
          >
            <SelectTrigger size="sm" aria-label={`${line.name} pay basis`} className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">{BASIS_LABEL.monthly}</SelectItem>
              <SelectItem value="annual">{BASIS_LABEL.annual}</SelectItem>
            </SelectContent>
          </Select>
        );
      },
      footer: () => null,
    },
    {
      id: "amount",
      header: "Amount (₹)",
      meta: { className: "w-44 text-right", text: false },
      cell: ({ row: { original: line } }) => {
        const row = rowOf(line.code);
        const value = shown(line, row);
        if (readOnly) return <Money value={value || null} />;
        const invalid = row.manual && !isTypedAmount(row.amount);
        const input = (
          <Input
            inputMode="decimal"
            aria-label={`${line.name} amount`}
            aria-invalid={invalid || undefined}
            disabled={line.balance}
            value={value}
            placeholder={line.inStructure ? "" : "—"}
            className={cn(
              "h-9 text-right tabular-nums",
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
        return line.balance ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div>{input}</div>
            </TooltipTrigger>
            <TooltipContent>What is left of the CTC after every other component. Change the CTC to move it.</TooltipContent>
          </Tooltip>
        ) : (
          input
        );
      },
      footer: () => (
        <Money value={total?.monthly ?? null} className="font-semibold" />
      ),
    },
    {
      id: "annual",
      header: "Yearly",
      meta: { className: "w-36 text-right", text: false },
      cell: ({ row: { original: line } }) => <Money value={line.annual} className="text-muted-foreground" />,
      footer: () => <Money value={total?.annual ?? null} className="font-semibold" />,
    },
    {
      id: "remarks",
      header: "Reference / remarks",
      meta: { className: "min-w-48", text: false },
      cell: ({ row: { original: line } }) => {
        const row = rowOf(line.code);
        if (readOnly) return <span className="text-sm text-muted-foreground">{row.remarks || "—"}</span>;
        return (
          <Input
            aria-label={`${line.name} remarks`}
            maxLength={255}
            value={row.remarks}
            className="h-9"
            onChange={(event) => onChange?.(line.code, { ...row, remarks: event.target.value })}
          />
        );
      },
      footer: () => null,
    },
  ];

  return (
    <section className="space-y-2">
      <h3 className="px-1 text-sm font-semibold uppercase tracking-wide text-primary">{title}</h3>
      <DataTable variant="plain" columns={columns} data={lines} getRowId={(line) => line.code} />
    </section>
  );
}
