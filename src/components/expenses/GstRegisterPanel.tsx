"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { QueryBoundary, errorDetail } from "@/components/expenses/ReviewCommon";
import { EligibilityBadge, ReconciliationBadge, formatMoney } from "@/components/expenses/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useApiQuery } from "@/hooks/useApiQuery";
import { downloadFile } from "@/lib/api";
import type { GstEligibility, GstRegister, GstRegisterLine, Gstr2bMatch } from "@/lib/types/expenses";
import { formatDay } from "@/lib/utils";
import { DatePicker } from "@/components/common/DatePicker";

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

function moneyColumn(key: "taxable_value" | "cgst" | "sgst" | "igst" | "cess", header: string): ColumnDef<GstRegisterLine> {
  return {
    accessorKey: key,
    header,
    sortingFn: "alphanumeric",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
    cell: ({ row }) => formatMoney(row.original[key]),
  };
}

const COLUMNS: ColumnDef<GstRegisterLine>[] = [
  {
    accessorKey: "invoice_number",
    header: "Invoice",
    meta: { text: (line) => `${line.invoice_number} · ${formatDay(line.invoice_date, true)}` },
    cell: ({ row }) => (
      <>
        <p className="font-medium text-foreground">{row.original.invoice_number}</p>
        <p className="text-xs text-muted-foreground">{formatDay(row.original.invoice_date, true)}</p>
      </>
    ),
  },
  { accessorKey: "vendor_gstin", header: "Vendor GSTIN", meta: { cellClassName: "tabular-nums" } },
  {
    accessorKey: "hsn_sac",
    header: "HSN / SAC",
    cell: ({ row }) => row.original.hsn_sac ?? "—",
  },
  {
    accessorKey: "place_of_supply",
    header: "Place of supply",
    cell: ({ row }) => row.original.place_of_supply ?? "—",
  },
  moneyColumn("taxable_value", "Taxable"),
  moneyColumn("cgst", "CGST"),
  moneyColumn("sgst", "SGST"),
  moneyColumn("igst", "IGST"),
  moneyColumn("cess", "Cess"),
  {
    id: "eligibility",
    header: "Eligibility",
    accessorFn: (line) => ELIGIBILITY_TEXT[line.eligibility],
    meta: {
      cellClassName: "max-w-64 whitespace-normal",
      text: (line) => [ELIGIBILITY_TEXT[line.eligibility], line.eligibility_reason].filter(Boolean).join(" · "),
    },
    cell: ({ row }) => (
      <>
        <EligibilityBadge eligibility={row.original.eligibility} />
        <p className="mt-1 text-xs text-muted-foreground">{row.original.eligibility_reason}</p>
      </>
    ),
  },
  {
    id: "gstr2b",
    header: "GSTR-2B",
    accessorFn: (line) => MATCH_TEXT[line.reconciliation_status] ?? line.reconciliation_status,
    cell: ({ row }) => <ReconciliationBadge status={row.original.reconciliation_status} />,
  },
];

const lineId = (line: GstRegisterLine, index: number) => `${line.vendor_gstin}-${line.invoice_number}-${index}`;

/**
 * The register a CA prepares GSTR-3B from. Lines still awaiting review are
 * listed separately rather than dropped.
 */
export function GstRegisterPanel() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [applied, setApplied] = useState<{ start: string; end: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const qs = applied
    ? `period_start=${encodeURIComponent(applied.start)}&period_end=${encodeURIComponent(applied.end)}`
    : null;
  const query = useApiQuery<GstRegister>(qs ? `/gst/register?${qs}` : null);

  const periodProblem = start && end && start > end ? "The start date is after the end date." : null;
  const canLoad = Boolean(start && end) && !periodProblem;

  const download = async () => {
    if (!qs) return;
    setDownloading(true);
    try {
      await downloadFile(`/gst/register.csv?${qs}`, "gst-register.csv");
    } catch (error) {
      toast.error(errorDetail(error, "Could not download the register."));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="grid gap-4">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Register</CardTitle>
          <CardDescription>Choose the return period by invoice date.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))_auto_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (canLoad) setApplied({ start, end });
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="gst-reg-start">From</Label>
              <DatePicker id="gst-reg-start" required value={start} onChange={setStart} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gst-reg-end">To</Label>
              <DatePicker id="gst-reg-end" required value={end} onChange={setEnd} />
            </div>
            <Button type="submit" disabled={!canLoad || query.isLoading}>
              Load register
            </Button>
            <Button type="button" variant="outline" disabled={!qs || downloading} onClick={() => void download()}>
              {downloading ? <Loader2 className="animate-spin" /> : <Download />}
              CSV
            </Button>
          </form>
          {periodProblem && <p className="mt-2 text-sm text-destructive">{periodProblem}</p>}
        </CardContent>
      </Card>

      {!applied ? (
        <Card tier="tier1">
          <EmptyState
            icon={FileSpreadsheet}
            title="Choose a period"
            description="The register is built for a period; pick the dates above and load it."
          />
        </Card>
      ) : (
        <QueryBoundary query={query} skeletonRows={4}>
          {(register) => (
            <div className="grid gap-4">
              {register.note && <p className="text-sm text-muted-foreground">{register.note}</p>}
              <DataTable
                title="Eligible"
                description={
                  <>
                    {formatDay(register.period_start, true)} – {formatDay(register.period_end, true)} · total tax{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatMoney(register.eligible_total_tax)}
                    </span>
                  </>
                }
                columns={COLUMNS}
                data={register.eligible}
                getRowId={lineId}
                noun="lines"
                exportName={`gst-register-eligible-${register.period_start}-${register.period_end}`}
                searchPlaceholder="Search invoice or GSTIN"
                rowClassName={() => "align-top"}
                empty={{ icon: FileSpreadsheet, title: "No eligible lines in this period" }}
              />
              <DataTable
                title="Awaiting review"
                description="Not in the eligible total. Decide them on the Review queue tab before filing."
                columns={COLUMNS}
                data={register.awaiting_review}
                getRowId={lineId}
                noun="lines"
                exportName={`gst-register-awaiting-review-${register.period_start}-${register.period_end}`}
                searchPlaceholder="Search invoice or GSTIN"
                rowClassName={() => "align-top"}
                empty={{ icon: FileSpreadsheet, title: "Nothing awaiting review in this period" }}
              />
            </div>
          )}
        </QueryBoundary>
      )}
    </div>
  );
}
