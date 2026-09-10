"use client";

import { AlertTriangle, Calculator, CheckCircle2, Loader2 } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageShell } from "@/components/common/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, get } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * The CTC builder — Tier 1 throughout.
 *
 * Amounts arrive from the API as strings and are rendered as strings. Parsing
 * them into JavaScript numbers would reintroduce exactly the float error the
 * backend goes to some length to avoid: `0.1 + 0.2 !== 0.3` is as true here as
 * it is in Python, and a payroll figure that drifts in the browser is still a
 * payroll figure that drifts.
 */

interface SalaryStructure {
  id: string;
  name: string;
  description: string | null;
  effective_from: string;
  effective_to: string | null;
  rounding_mode: string;
  rounding_precision: number;
  active: boolean;
}

interface ResolvedComponent {
  code: string;
  name: string;
  component_type: "earning" | "deduction" | "employer_contribution" | "reimbursement";
  annual_amount: string;
  monthly_amount: string;
  taxable: boolean;
  part_of_ctc: boolean;
  counts_toward_pf: boolean;
  counts_toward_esi: boolean;
  display_order: number;
}

interface SalaryBreakdown {
  structure_id: string;
  structure_name: string;
  ctc_annual: string;
  annual_total_in_ctc: string;
  monthly_total_in_ctc: string;
  components: ResolvedComponent[];
}

const TYPE_LABEL: Record<ResolvedComponent["component_type"], string> = {
  earning: "Earning",
  deduction: "Deduction",
  employer_contribution: "Employer",
  reimbursement: "Reimbursement",
};

/** Group Indian-style (12,34,567) without converting to a Number. */
function groupIndian(amount: string): string {
  const [whole, fraction] = amount.split(".");
  const negative = whole.startsWith("-");
  const digits = negative ? whole.slice(1) : whole;

  let grouped: string;
  if (digits.length <= 3) {
    grouped = digits;
  } else {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    grouped = `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`;
  }
  return `${negative ? "-" : ""}${grouped}${fraction ? `.${fraction}` : ""}`;
}

export default function SalaryStructuresPage() {
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ctc, setCtc] = useState("1200000");
  const [breakdown, setBreakdown] = useState<SalaryBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    get<SalaryStructure[]>("/salary-structures")
      .then((rows) => {
        setStructures(rows);
        if (rows.length > 0) setSelectedId(rows[0].id);
      })
      .catch((error) => {
        toast.error(
          error instanceof ApiError ? error.detail : "Could not load salary structures.",
        );
      })
      .finally(() => setIsLoading(false));
  }, []);

  const runPreview = useCallback(async () => {
    if (!selectedId) return;
    setIsPreviewing(true);
    setPreviewError(null);
    try {
      // `ctc` goes over the wire as a string, never as a number.
      const result = await get<SalaryBreakdown>(
        `/salary-structures/${selectedId}/preview?ctc=${encodeURIComponent(ctc.trim())}`,
      );
      setBreakdown(result);
    } catch (error) {
      // A 422 here is a real configuration message from the engine — it names
      // the offending component or the cycle. Show it verbatim.
      setBreakdown(null);
      setPreviewError(
        error instanceof ApiError ? error.detail : "Could not resolve this CTC.",
      );
    } finally {
      setIsPreviewing(false);
    }
  }, [selectedId, ctc]);

  useEffect(() => {
    if (selectedId) void runPreview();
    // Re-run when the structure changes; the CTC is applied on submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const reconciles =
    breakdown !== null && breakdown.annual_total_in_ctc === breakdown.ctc_annual;

  return (
    <PageShell
      title="Salary structures"
      description="Configure a CTC template, then preview how any CTC resolves against it."
    >
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : structures.length === 0 ? (
        <Card tier="tier1">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Calculator className="size-6" />
            </span>
            <div>
              <p className="font-medium text-foreground">No salary structures yet</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                A structure defines how a CTC splits into Basic, HRA, allowances and employer
                contributions. Every payroll capability reads from it, so this is the first
                thing to configure.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* ── Structure picker ─────────────────────────────────────── */}
          <Card tier="tier1" className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Structures</CardTitle>
              <CardDescription>Effective-dated templates.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {structures.map((structure) => (
                <button
                  key={structure.id}
                  type="button"
                  onClick={() => setSelectedId(structure.id)}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left transition-colors",
                    selectedId === structure.id
                      ? "border-brand-300 bg-mint-50 dark:bg-mint-900/20"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <p className="truncate text-sm font-medium text-foreground">{structure.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    From {structure.effective_from}
                    {structure.rounding_precision === 0 ? " · whole rupees" : " · paise"}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* ── Preview ──────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            <Card tier="tier1">
              <CardContent>
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void runPreview();
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="ctc">Annual CTC (₹)</Label>
                    <Input
                      id="ctc"
                      value={ctc}
                      onChange={(event) => setCtc(event.target.value)}
                      inputMode="decimal"
                      className="w-48 font-mono"
                    />
                  </div>
                  <Button type="submit" disabled={isPreviewing}>
                    {isPreviewing ? <Loader2 className="animate-spin" /> : <Calculator />}
                    Resolve
                  </Button>
                </form>
              </CardContent>
            </Card>

            {previewError && (
              <Card tier="tier1" className="border-destructive/40">
                <CardContent className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      This CTC does not resolve
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{previewError}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {breakdown && (
              <Card tier="tier1" className="gap-0 py-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {breakdown.structure_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Resolved breakdown for ₹{groupIndian(breakdown.ctc_annual)} per year
                    </p>
                  </div>
                  {/* The guarantee the endpoint makes, shown rather than assumed. */}
                  <Badge variant={reconciles ? "success" : "destructive"}>
                    {reconciles ? (
                      <>
                        <CheckCircle2 /> Sums exactly to CTC
                      </>
                    ) : (
                      <>
                        <AlertTriangle /> Does not reconcile
                      </>
                    )}
                  </Badge>
                </div>

                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Component</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Monthly</TableHead>
                        <TableHead className="text-right">Annual</TableHead>
                        <TableHead>Statutory</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {breakdown.components.map((component) => (
                        <TableRow key={component.code}>
                          <TableCell>
                            <p className="font-medium text-foreground">{component.name}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {component.code}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="muted">
                              {TYPE_LABEL[component.component_type]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {groupIndian(component.monthly_amount)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {groupIndian(component.annual_amount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {component.counts_toward_pf && (
                                <Badge variant="outline" title="Counts toward the PF wage base">
                                  PF
                                </Badge>
                              )}
                              {component.counts_toward_esi && (
                                <Badge variant="outline" title="Counts toward the ESI wage base">
                                  ESI
                                </Badge>
                              )}
                              {!component.part_of_ctc && (
                                <Badge variant="warning" title="Sits outside the CTC">
                                  Outside CTC
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2} className="font-semibold">
                          Total in CTC
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {groupIndian(breakdown.monthly_total_in_ctc)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {groupIndian(breakdown.annual_total_in_ctc)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
