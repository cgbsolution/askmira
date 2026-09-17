"use client";

import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { QueryBoundary, errorDetail } from "@/components/expenses/ReviewCommon";
import { EligibilityBadge, ReconciliationBadge, formatMoney } from "@/components/expenses/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { downloadFile } from "@/lib/api";
import type { GstRegister, GstRegisterLine } from "@/lib/types/expenses";
import { formatDay } from "@/lib/utils";

function RegisterTable({ lines }: { lines: GstRegisterLine[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-5">Invoice</TableHead>
          <TableHead>Vendor GSTIN</TableHead>
          <TableHead>HSN / SAC</TableHead>
          <TableHead>Place of supply</TableHead>
          <TableHead className="text-right">Taxable</TableHead>
          <TableHead className="text-right">CGST</TableHead>
          <TableHead className="text-right">SGST</TableHead>
          <TableHead className="text-right">IGST</TableHead>
          <TableHead className="text-right">Cess</TableHead>
          <TableHead>Eligibility</TableHead>
          <TableHead className="pr-5">GSTR-2B</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line, index) => (
          <TableRow key={`${line.vendor_gstin}-${line.invoice_number}-${index}`} className="align-top">
            <TableCell className="pl-5">
              <p className="font-medium text-foreground">{line.invoice_number}</p>
              <p className="text-xs text-muted-foreground">{formatDay(line.invoice_date, true)}</p>
            </TableCell>
            <TableCell className="tabular-nums">{line.vendor_gstin}</TableCell>
            <TableCell>{line.hsn_sac ?? "—"}</TableCell>
            <TableCell>{line.place_of_supply ?? "—"}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(line.taxable_value)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(line.cgst)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(line.sgst)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(line.igst)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(line.cess)}</TableCell>
            <TableCell className="max-w-64 whitespace-normal">
              <EligibilityBadge eligibility={line.eligibility} />
              <p className="mt-1 text-xs text-muted-foreground">{line.eligibility_reason}</p>
            </TableCell>
            <TableCell className="pr-5">
              <ReconciliationBadge status={line.reconciliation_status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

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
              <Input id="gst-reg-start" type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gst-reg-end">To</Label>
              <Input id="gst-reg-end" type="date" required value={end} onChange={(e) => setEnd(e.target.value)} />
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
              <Card tier="tier1">
                <CardHeader>
                  <CardTitle>Eligible</CardTitle>
                  <CardDescription>
                    {formatDay(register.period_start, true)} – {formatDay(register.period_end, true)} · total tax{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatMoney(register.eligible_total_tax)}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {register.eligible.length === 0 ? (
                    <p className="px-5 pb-2 text-sm text-muted-foreground">No eligible lines in this period.</p>
                  ) : (
                    <RegisterTable lines={register.eligible} />
                  )}
                </CardContent>
              </Card>
              <Card tier="tier1">
                <CardHeader>
                  <CardTitle>Awaiting review</CardTitle>
                  <CardDescription>
                    Not in the eligible total. Decide them on the Review queue tab before filing.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {register.awaiting_review.length === 0 ? (
                    <p className="px-5 pb-2 text-sm text-muted-foreground">Nothing awaiting review in this period.</p>
                  ) : (
                    <RegisterTable lines={register.awaiting_review} />
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </QueryBoundary>
      )}
    </div>
  );
}
