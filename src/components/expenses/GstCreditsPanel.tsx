"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Receipt } from "lucide-react";
import React, { useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { QueryBoundary } from "@/components/expenses/ReviewCommon";
import { EligibilityBadge, ReconciliationBadge, formatMoney, humanizeKey } from "@/components/expenses/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { GstCredit, GstEligibility, Gstr2bMatch } from "@/lib/types/expenses";
import { formatDay } from "@/lib/utils";
import { DatePicker } from "@/components/common/DatePicker";

const ALL = "__all__";

/** The badges' words, for sorting, the search and the CSV. */
const ELIGIBILITY_TEXT: Record<GstEligibility, string> = {
  eligible: "Eligible",
  ineligible: "Ineligible",
  uncertain: "Needs review",
};

const MATCH_TEXT: Record<Gstr2bMatch, string> = {
  not_reconciled: "Not reconciled",
  matched: "Matched in 2B",
  missing_in_2b: "Missing in 2B",
  value_mismatch: "Value mismatch",
};

type MoneyField = "taxable_value" | "cgst" | "sgst" | "igst" | "cess" | "claimable_amount";

function moneyColumn(key: MoneyField, header: string): ColumnDef<GstCredit> {
  return {
    accessorKey: key,
    header,
    sortingFn: "alphanumeric",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
    cell: ({ row }) => formatMoney(row.original[key]),
  };
}

const COLUMNS: ColumnDef<GstCredit>[] = [
  {
    accessorKey: "invoice_number",
    header: "Invoice",
    meta: { text: (credit) => `${credit.invoice_number} · ${formatDay(credit.invoice_date, true)}` },
    cell: ({ row }) => (
      <>
        <p className="font-medium text-foreground">{row.original.invoice_number}</p>
        <p className="text-xs text-muted-foreground">{formatDay(row.original.invoice_date, true)}</p>
      </>
    ),
  },
  {
    accessorKey: "vendor_gstin",
    header: "Vendor GSTIN",
    meta: {
      text: (credit) =>
        credit.gstin_is_valid
          ? credit.vendor_gstin
          : `${credit.vendor_gstin} · ${credit.gstin_problem ?? "Invalid GSTIN"}`,
    },
    cell: ({ row }) => (
      <>
        <p className="tabular-nums">{row.original.vendor_gstin}</p>
        {!row.original.gstin_is_valid && (
          <Badge variant="destructive" className="mt-1">
            {row.original.gstin_problem ?? "Invalid GSTIN"}
          </Badge>
        )}
      </>
    ),
  },
  {
    id: "category",
    header: "Category",
    accessorFn: (credit) => humanizeKey(credit.category_key),
    meta: {
      text: (credit) =>
        [humanizeKey(credit.category_key), credit.tax_split && humanizeKey(credit.tax_split)]
          .filter(Boolean)
          .join(" · "),
    },
    cell: ({ row }) => (
      <>
        {humanizeKey(row.original.category_key)}
        {row.original.tax_split && (
          <p className="text-xs text-muted-foreground">{humanizeKey(row.original.tax_split)}</p>
        )}
      </>
    ),
  },
  moneyColumn("taxable_value", "Taxable"),
  moneyColumn("cgst", "CGST"),
  moneyColumn("sgst", "SGST"),
  moneyColumn("igst", "IGST"),
  moneyColumn("cess", "Cess"),
  moneyColumn("claimable_amount", "Claimable"),
  {
    id: "eligibility",
    header: "Eligibility",
    accessorFn: (credit) => ELIGIBILITY_TEXT[credit.eligibility],
    meta: {
      cellClassName: "max-w-64 whitespace-normal",
      text: (credit) =>
        [ELIGIBILITY_TEXT[credit.eligibility], credit.eligibility_reason, credit.eligibility_reference]
          .filter(Boolean)
          .join(" · "),
    },
    cell: ({ row }) => (
      <>
        <EligibilityBadge eligibility={row.original.eligibility} />
        <p className="mt-1 text-xs text-muted-foreground">{row.original.eligibility_reason}</p>
        {row.original.eligibility_reference && (
          <p className="text-xs text-muted-foreground">{row.original.eligibility_reference}</p>
        )}
      </>
    ),
  },
  {
    id: "gstr2b",
    header: "GSTR-2B",
    accessorFn: (credit) => MATCH_TEXT[credit.reconciliation_status] ?? credit.reconciliation_status,
    cell: ({ row }) => <ReconciliationBadge status={row.original.reconciliation_status} />,
  },
];

/** Every captured credit, filterable by eligibility, 2B match and period. */
export function GstCreditsPanel() {
  const [eligibility, setEligibility] = useState(ALL);
  const [match, setMatch] = useState(ALL);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [path, setPath] = useState("/gst/credits");
  const query = useApiQuery<GstCredit[]>(path);

  const periodProblem = start && end && start > end ? "The start date is after the end date." : null;

  const apply = () => {
    if (periodProblem) return;
    const params = new URLSearchParams();
    if (eligibility !== ALL) params.set("eligibility", eligibility);
    if (match !== ALL) params.set("reconciliation_status", match);
    if (start) params.set("period_start", start);
    if (end) params.set("period_end", end);
    const qs = params.toString();
    setPath(qs ? `/gst/credits?${qs}` : "/gst/credits");
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Credits</CardTitle>
        <CardDescription>Invoices captured with GST, and what the rules made of each.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 p-0">
        <form
          className="grid gap-3 px-5 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="gst-credit-eligibility">Eligibility</Label>
            <Select value={eligibility} onValueChange={setEligibility}>
              <SelectTrigger id="gst-credit-eligibility" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any</SelectItem>
                <SelectItem value="eligible">Eligible</SelectItem>
                <SelectItem value="ineligible">Ineligible</SelectItem>
                <SelectItem value="uncertain">Needs review</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gst-credit-match">GSTR-2B</Label>
            <Select value={match} onValueChange={setMatch}>
              <SelectTrigger id="gst-credit-match" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any</SelectItem>
                <SelectItem value="not_reconciled">Not reconciled</SelectItem>
                <SelectItem value="matched">Matched</SelectItem>
                <SelectItem value="missing_in_2b">Missing in 2B</SelectItem>
                <SelectItem value="value_mismatch">Value mismatch</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gst-credit-start">Invoice from</Label>
            <DatePicker id="gst-credit-start" value={start} onChange={setStart} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gst-credit-end">Invoice to</Label>
            <DatePicker id="gst-credit-end" value={end} onChange={setEnd} />
          </div>
          <Button type="submit" disabled={Boolean(periodProblem) || query.isLoading}>
            Apply
          </Button>
          {periodProblem && <p className="text-sm text-destructive sm:col-span-2">{periodProblem}</p>}
        </form>

        <QueryBoundary query={query} skeletonRows={5}>
          {(rows) => (
            <DataTable
              bordered={false}
              columns={COLUMNS}
              data={rows}
              noun="credits"
              exportName="gst-credits"
              searchPlaceholder="Search invoice, GSTIN or category"
              rowClassName={() => "align-top"}
              filtered={path !== "/gst/credits"}
              empty={{
                icon: Receipt,
                title: "No credits captured yet",
                description:
                  "A credit is recorded when an invoice's GST details are captured on the Capture tab or with a claim.",
              }}
              emptyMessage="No credits match these filters. Widen the filters to see more."
            />
          )}
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}
