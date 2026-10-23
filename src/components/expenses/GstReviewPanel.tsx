"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ListChecks, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { InlineProblem, QueryBoundary, StatTile, errorDetail, todayISO } from "@/components/expenses/ReviewCommon";
import { formatMoney, humanizeKey } from "@/components/expenses/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { GstReviewInput, GstReviewQueue } from "@/lib/types/expenses";
import { formatDay } from "@/lib/utils";

type Line = GstReviewQueue["lines"][number];

/**
 * Lines the rules could not decide. A person decides, and writes down why —
 * the rationale is what an auditor reads.
 */
export function GstReviewPanel() {
  const query = useApiQuery<GstReviewQueue>("/gst/review-queue");
  const [reviewing, setReviewing] = useState<Line | null>(null);
  const [decision, setDecision] = useState<GstReviewInput["decision"] | "">("");
  const [rationale, setRationale] = useState("");
  const [decidedOn, setDecidedOn] = useState(todayISO());
  const [problem, setProblem] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const open = (line: Line) => {
    setReviewing(line);
    setDecision("");
    setRationale("");
    setDecidedOn(todayISO());
    setProblem(null);
  };

  const valid = Boolean(decision) && rationale.trim().length > 0 && Boolean(decidedOn);

  const columns: ColumnDef<Line>[] = [
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
      id: "category",
      header: "Category",
      accessorFn: (line) => humanizeKey(line.category_key),
    },
    {
      accessorKey: "amount_at_stake",
      header: "At stake",
      sortingFn: "alphanumeric",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
      cell: ({ row }) => formatMoney(row.original.amount_at_stake),
    },
    {
      accessorKey: "reason",
      header: "Why it needs review",
      meta: { cellClassName: "max-w-80 whitespace-normal text-muted-foreground" },
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <Button size="sm" onClick={() => open(row.original)}>
          Review
        </Button>
      ),
    },
  ];

  const save = async () => {
    if (!reviewing || !decision || !valid) return;
    setIsSaving(true);
    setProblem(null);
    try {
      const body: GstReviewInput = { decision, rationale: rationale.trim(), decided_on: decidedOn };
      await post(`/gst/credits/${reviewing.credit_id}/review`, body);
      toast.success(`Invoice ${reviewing.invoice_number} marked ${decision}`);
      setReviewing(null);
      query.reload();
    } catch (error) {
      setProblem(errorDetail(error, "Could not record the review."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Review queue</CardTitle>
        <CardDescription>Credits whose eligibility the rules could not decide on their own.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <QueryBoundary query={query}>
          {(data) => (
            <div className="grid gap-4">
              <div className="grid gap-3 px-5 sm:grid-cols-2">
                <StatTile label="Lines waiting" value={data.count} />
                <StatTile label="Tax at stake" tone="warning" value={formatMoney(data.total_at_stake)} />
              </div>
              {data.note && <p className="px-5 text-sm text-muted-foreground">{data.note}</p>}
              <DataTable
                bordered={false}
                columns={columns}
                data={data.lines}
                getRowId={(line) => line.credit_id}
                noun="lines"
                exportName="gst-review-queue"
                searchPlaceholder="Search invoice, GSTIN or category"
                empty={{
                  icon: ListChecks,
                  title: "Nothing to review",
                  description: "A credit lands here when its category has exceptions or its tax cannot be classified.",
                }}
              />
            </div>
          )}
        </QueryBoundary>
      </CardContent>

      <Dialog open={reviewing !== null} onOpenChange={(next) => !next && !isSaving && setReviewing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review invoice {reviewing?.invoice_number}</DialogTitle>
            <DialogDescription>
              {reviewing &&
                `${reviewing.vendor_gstin} · ${humanizeKey(reviewing.category_key)} · ${formatMoney(reviewing.amount_at_stake)} at stake. ${reviewing.reason}`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="gst-review-decision">Decision</Label>
                <Select
                  value={decision}
                  onValueChange={(value) => setDecision(value as GstReviewInput["decision"])}
                >
                  <SelectTrigger id="gst-review-decision" className="w-full">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eligible">Eligible — claim the credit</SelectItem>
                    <SelectItem value="ineligible">Ineligible — do not claim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="gst-review-date">Decided on</Label>
                <Input id="gst-review-date" type="date" value={decidedOn} onChange={(e) => setDecidedOn(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gst-review-rationale">Rationale (required)</Label>
              <Textarea
                id="gst-review-rationale"
                rows={4}
                maxLength={4000}
                value={rationale}
                placeholder="The provision relied on and the facts that make it apply."
                onChange={(e) => setRationale(e.target.value)}
              />
            </div>
            {problem && <InlineProblem>{problem}</InlineProblem>}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isSaving} onClick={() => setReviewing(null)}>
              Cancel
            </Button>
            <Button disabled={!valid || isSaving} onClick={() => void save()}>
              {isSaving && <Loader2 className="animate-spin" />}
              Record decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
