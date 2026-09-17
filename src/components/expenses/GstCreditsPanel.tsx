"use client";

import { Receipt } from "lucide-react";
import React, { useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { QueryBoundary } from "@/components/expenses/ReviewCommon";
import { EligibilityBadge, ReconciliationBadge, formatMoney, humanizeKey } from "@/components/expenses/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { GstCredit } from "@/lib/types/expenses";
import { formatDay } from "@/lib/utils";

const ALL = "__all__";

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
            <Input id="gst-credit-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gst-credit-end">Invoice to</Label>
            <Input id="gst-credit-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <Button type="submit" disabled={Boolean(periodProblem) || query.isLoading}>
            Apply
          </Button>
          {periodProblem && <p className="text-sm text-destructive sm:col-span-2">{periodProblem}</p>}
        </form>

        <QueryBoundary query={query} skeletonRows={5}>
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={path === "/gst/credits" ? "No credits captured yet" : "No credits match these filters"}
                description={
                  path === "/gst/credits"
                    ? "A credit is recorded when an invoice's GST details are captured on the Capture tab or with a claim."
                    : "Widen the filters to see more."
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Invoice</TableHead>
                    <TableHead>Vendor GSTIN</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Taxable</TableHead>
                    <TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead>
                    <TableHead className="text-right">IGST</TableHead>
                    <TableHead className="text-right">Cess</TableHead>
                    <TableHead className="text-right">Claimable</TableHead>
                    <TableHead>Eligibility</TableHead>
                    <TableHead className="pr-5">GSTR-2B</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((credit) => (
                    <TableRow key={credit.id} className="align-top">
                      <TableCell className="pl-5">
                        <p className="font-medium text-foreground">{credit.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">{formatDay(credit.invoice_date, true)}</p>
                      </TableCell>
                      <TableCell>
                        <p className="tabular-nums">{credit.vendor_gstin}</p>
                        {!credit.gstin_is_valid && (
                          <Badge variant="destructive" className="mt-1">
                            {credit.gstin_problem ?? "Invalid GSTIN"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {humanizeKey(credit.category_key)}
                        {credit.tax_split && (
                          <p className="text-xs text-muted-foreground">{humanizeKey(credit.tax_split)}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(credit.taxable_value)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(credit.cgst)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(credit.sgst)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(credit.igst)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(credit.cess)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(credit.claimable_amount)}</TableCell>
                      <TableCell className="max-w-64 whitespace-normal">
                        <EligibilityBadge eligibility={credit.eligibility} />
                        <p className="mt-1 text-xs text-muted-foreground">{credit.eligibility_reason}</p>
                        {credit.eligibility_reference && (
                          <p className="text-xs text-muted-foreground">{credit.eligibility_reference}</p>
                        )}
                      </TableCell>
                      <TableCell className="pr-5">
                        <ReconciliationBadge status={credit.reconciliation_status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          }
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}
