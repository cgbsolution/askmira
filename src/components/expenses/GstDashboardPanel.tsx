"use client";

import { Info } from "lucide-react";
import React, { useState } from "react";

import { QueryBoundary, StatTile } from "@/components/expenses/ReviewCommon";
import { formatMoney } from "@/components/expenses/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { GstDashboard } from "@/lib/types/expenses";

/** Captured, eligible, confirmed and at-risk credit for a period, in rupees. */
export function GstDashboardPanel() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [label, setLabel] = useState("");
  const [path, setPath] = useState("/gst/dashboard");
  const query = useApiQuery<GstDashboard>(path);

  const periodProblem =
    (start && !end) || (!start && end)
      ? "Give both a start and an end date, or neither."
      : start && end && start > end
        ? "The start date is after the end date."
        : null;

  const apply = () => {
    if (periodProblem) return;
    const params = new URLSearchParams();
    if (start) params.set("period_start", start);
    if (end) params.set("period_end", end);
    if (label.trim()) params.set("period_label", label.trim());
    const qs = params.toString();
    setPath(qs ? `/gst/dashboard?${qs}` : "/gst/dashboard");
  };

  return (
    <div className="grid gap-4">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Period</CardTitle>
          <CardDescription>Leave the dates blank to see every captured credit.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              apply();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="gst-dash-start">From</Label>
              <Input id="gst-dash-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gst-dash-end">To</Label>
              <Input id="gst-dash-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gst-dash-label">
                Return period label <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="gst-dash-label"
                value={label}
                maxLength={16}
                placeholder="As used for the GSTR-2B import"
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={Boolean(periodProblem) || query.isLoading}>
              Show
            </Button>
          </form>
          {periodProblem && <p className="mt-2 text-sm text-destructive">{periodProblem}</p>}
        </CardContent>
      </Card>

      <Card tier="tier1">
        <CardContent>
          <QueryBoundary query={query} skeletonRows={3}>
            {(data) => (
              <div className="grid gap-4">
                <p className="text-sm text-muted-foreground">
                  Period: <span className="font-medium text-foreground">{data.period || "All captured credits"}</span>
                </p>
                {!data.reconciled && (
                  <Alert>
                    <Info />
                    <AlertTitle>Not reconciled</AlertTitle>
                    <AlertDescription>
                      <p>
                        No GSTR-2B has been reconciled for this period, so no credit is confirmed yet. Upload the
                        GSTR-2B and run a reconciliation on the GSTR-2B tab.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <StatTile label="Tax captured" value={formatMoney(data.captured_tax)} />
                  <StatTile label="Eligible" tone="success" value={formatMoney(data.eligible_tax)} />
                  <StatTile
                    label="Confirmed claimable"
                    value={formatMoney(data.confirmed_claimable_tax)}
                    hint={
                      data.reconciled ? (
                        "Eligible and matched in GSTR-2B"
                      ) : (
                        <Badge variant="muted">Not reconciled</Badge>
                      )
                    }
                  />
                  <StatTile
                    label="At risk — vendor has not filed"
                    tone="destructive"
                    value={formatMoney(data.at_risk_from_unfiled_vendors)}
                    hint={data.reconciled ? "Eligible lines missing from GSTR-2B" : "Known only after reconciliation"}
                  />
                  <StatTile
                    label="Uncertain — needs review"
                    tone="warning"
                    value={formatMoney(data.uncertain_tax)}
                    hint={`${data.uncertain_lines} ${data.uncertain_lines === 1 ? "line" : "lines"} in the review queue`}
                  />
                  <StatTile label="Ineligible" value={formatMoney(data.ineligible_tax)} />
                </div>
                {data.note && <p className="text-sm text-muted-foreground">{data.note}</p>}
              </div>
            )}
          </QueryBoundary>
        </CardContent>
      </Card>
    </div>
  );
}
