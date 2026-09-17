"use client";

import { Calculator, CheckCircle2, Info, Lock, Scale } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Money } from "@/components/common/Money";
import { toastApiError } from "@/components/payroll-ops/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type {
  RegimeComparison,
  RegimeElection,
  RegimeElectionInput,
  RegimeElectionResult,
  TaxRegime,
} from "@/lib/types/tax";
import { cn, formatDate } from "@/lib/utils";

import { pendingState, REGIME_LABEL, regimeLabel, useHasLoaded, useReloadOn } from "./common";
import { WorkingFigures } from "./TaxWorkingView";

const REGIMES: TaxRegime[] = ["old", "new"];

/** Current election and a side-by-side projection of both regimes. */
export function RegimePanel({
  financialYear,
  version,
  onChanged,
}: {
  financialYear: string;
  version: number;
  onChanged: () => void;
}) {
  const fy = encodeURIComponent(financialYear);
  const election = useApiQuery<RegimeElection | null>(`/tax/regime?financial_year=${fy}`);
  const electionLoaded = useHasLoaded(election);
  const comparison = useApiQuery<RegimeComparison>(`/tax/regime/compare?financial_year=${fy}`);
  useReloadOn(version, comparison.reload);

  const [target, setTarget] = useState<TaxRegime | null>(null);
  const [lastResult, setLastResult] = useState<RegimeElectionResult | null>(null);

  const current = election.data ?? null;

  const elect = async () => {
    if (!target) return;
    const body: RegimeElectionInput = { financial_year: financialYear, regime: target };
    try {
      const result = await post<RegimeElectionResult>("/tax/regime", body);
      setLastResult(result);
      toast.success(`${REGIME_LABEL[result.regime]} elected for FY ${result.financial_year}`);
      election.reload();
      comparison.reload();
      onChanged();
    } catch (error) {
      toastApiError(error, "The regime could not be saved.");
      throw error;
    }
  };

  const electionState = pendingState(election, { rows: 3, loaded: electionLoaded });

  return (
    <div className="grid gap-4">
      {lastResult?.full_year_recomputed && (
        <Alert variant="success">
          <CheckCircle2 />
          <AlertTitle>The whole financial year was recomputed</AlertTitle>
          <AlertDescription>
            Switching to the {REGIME_LABEL[lastResult.regime].toLowerCase()} recomputed TDS for
            all of FY {lastResult.financial_year}, not only the months ahead —{" "}
            {lastResult.months_recomputed}{" "}
            {lastResult.months_recomputed === 1 ? "month" : "months"} recomputed.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card tier="tier1">
          <CardHeader>
            <CardTitle>Your election</CardTitle>
            <CardDescription>The regime payroll uses for TDS in FY {financialYear}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {electionState ??
              (current === null ? (
                <p className="text-muted-foreground">
                  You have not elected a regime for FY {financialYear}.
                </p>
              ) : (
                <>
                  <p className="text-xl font-semibold text-foreground">
                    {REGIME_LABEL[current.regime]}
                  </p>
                  <dl className="space-y-1 text-muted-foreground">
                    <div>
                      <dt className="inline">Elected </dt>
                      <dd className="inline">{formatDate(current.elected_at)}</dd>
                    </div>
                    {current.previous_regime && (
                      <div>
                        <dt className="inline">Previously </dt>
                        <dd className="inline">{REGIME_LABEL[current.previous_regime]}</dd>
                      </div>
                    )}
                    <div className="tabular-nums">
                      Switched {current.switch_count}{" "}
                      {current.switch_count === 1 ? "time" : "times"}
                    </div>
                  </dl>
                  {current.locked_at && (
                    <p className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-muted-foreground">
                      <Lock className="mt-0.5 size-4 shrink-0" />
                      Locked on {formatDate(current.locked_at)}. It can no longer be changed.
                    </p>
                  )}
                </>
              ))}
          </CardContent>
          {!electionState && !current?.locked_at && (
            <CardFooter className="flex-wrap gap-2">
              {REGIMES.filter((regime) => regime !== current?.regime).map((regime) => (
                <Button
                  key={regime}
                  variant={current ? "outline" : "default"}
                  onClick={() => setTarget(regime)}
                >
                  {current ? `Switch to ${REGIME_LABEL[regime].toLowerCase()}` : `Elect ${REGIME_LABEL[regime].toLowerCase()}`}
                </Button>
              ))}
            </CardFooter>
          )}
        </Card>

        <Card tier="tier1" className="gap-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="size-4 text-muted-foreground" /> Both regimes on your numbers
            </CardTitle>
            <CardDescription>
              A projection of the year under each regime, using what you have declared.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {comparison.error?.status === 422 ? (
              <EmptyState
                icon={Calculator}
                title="Nothing can be projected"
                description={comparison.error.detail}
                className="py-8"
              />
            ) : (
              (pendingState(comparison, { rows: 5, loaded: comparison.data !== null }) ??
                (comparison.data && (
                  <ComparisonView comparison={comparison.data} currentRegime={current?.regime ?? null} />
                )))
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title={
          target
            ? current
              ? `Switch to the ${REGIME_LABEL[target].toLowerCase()}?`
              : `Elect the ${REGIME_LABEL[target].toLowerCase()}?`
            : ""
        }
        description={
          target
            ? current
              ? `You are switching from the ${REGIME_LABEL[current.regime].toLowerCase()} for FY ${financialYear}. A switch recomputes TDS for the whole financial year, not only the months ahead, so deductions in the remaining months can change.`
              : `Payroll will use the ${REGIME_LABEL[target].toLowerCase()} for your TDS in FY ${financialYear}.`
            : undefined
        }
        confirmLabel={current ? "Switch regime" : "Elect regime"}
        onConfirm={elect}
      />
    </div>
  );
}

function ComparisonView({
  comparison,
  currentRegime,
}: {
  comparison: RegimeComparison;
  currentRegime: TaxRegime | null;
}) {
  const entries = Object.entries(comparison.regimes);
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">The server returned no regimes to compare.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {entries.map(([key, working]) => {
          const lower = key === comparison.lower_liability_regime;
          return (
            <div
              key={key}
              className={cn(
                "rounded-lg border border-border p-4",
                lower && "border-primary ring-1 ring-primary/30",
              )}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="font-semibold text-foreground">{regimeLabel(key)}</p>
                {lower && <Badge variant="default">Lower liability</Badge>}
                {currentRegime === key && <Badge variant="muted">Your election</Badge>}
              </div>
              <WorkingFigures working={working} />
            </div>
          );
        })}
      </div>
      <p className="text-sm text-foreground">
        The {regimeLabel(comparison.lower_liability_regime).toLowerCase()} projects{" "}
        <Money value={comparison.saving} className="font-semibold" /> less tax for the year.
      </p>
      <Alert>
        <Info />
        <AlertTitle>Before you choose</AlertTitle>
        <AlertDescription>
          <p>{comparison.note}</p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
