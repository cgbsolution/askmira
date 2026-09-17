"use client";

import { AlertTriangle, CheckCircle2, OctagonX } from "lucide-react";
import React from "react";

import { ErrorState } from "@/components/common/ErrorState";
import { humanize, RECOMMENDATION } from "@/components/hiring/labels";
import { ScoreCard, ScoreFitCard } from "@/components/hiring/ScoreCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { AdvanceCheck, ConsolidatedView, Recommendation } from "@/lib/types/hiring";

/**
 * The panel's combined view for the people who oversee the hire: the headline,
 * recommendation counts, dissent, the spread per competency, and the AI rounds
 * (each with its evidence, or the reason its score is withheld).
 */
export function InterviewConsolidated({ interviewId }: { interviewId: string }) {
  const { data, error, isLoading, reload } = useApiQuery<ConsolidatedView>(
    `/interviews/${interviewId}/consolidated`,
  );

  if (isLoading && !data) return <Skeleton className="h-40 w-full" />;
  if (error) return <ErrorState message={error.detail} onRetry={reload} className="py-6" />;
  if (!data) return null;

  const competencies = Object.entries(data.per_competency);

  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium text-foreground">{data.headline}</p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {data.submitted} of {data.total_required} required feedback submitted
          {data.unanimous ? " · unanimous" : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(Object.keys(RECOMMENDATION) as Recommendation[]).map((key) => (
            <Badge key={key} variant={RECOMMENDATION[key][1]} className="tabular-nums">
              {RECOMMENDATION[key][0]}: {data.counts[key] ?? 0}
            </Badge>
          ))}
        </div>
      </div>

      {data.strong_dissent && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Strong dissent on this panel</AlertTitle>
          <AlertDescription>
            At least one panellist strongly disagrees with the others. Read their concerns before deciding.
          </AlertDescription>
        </Alert>
      )}
      {data.outstanding.length > 0 && (
        <p className="text-sm text-muted-foreground">Still to submit: {data.outstanding.join(", ")}</p>
      )}

      {competencies.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competency</TableHead>
                <TableHead className="text-right">Raters</TableHead>
                <TableHead className="text-right">Lowest</TableHead>
                <TableHead className="text-right">Highest</TableHead>
                <TableHead className="text-right">Spread</TableHead>
                <TableHead>Scores</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {competencies.map(([name, row]) => (
                <TableRow key={name}>
                  <TableCell>{humanize(name)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.raters}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.lowest}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.highest}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.spread}</TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {Object.entries(row.scores)
                      .map(([rater, score]) => `${rater}: ${score}`)
                      .join(" · ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Earlier AI rounds</p>
        {data.ai_rounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No AI-assessed rounds for this candidate.</p>
        ) : (
          data.ai_rounds.map((score) => <ScoreCard key={score.id} score={score} />)
        )}
        <ScoreFitCard fit={data.fit_score} />
      </div>
    </div>
  );
}

/** Whether the candidate can move past this round, and what stands in the way. */
export function InterviewAdvanceCheck({ interviewId }: { interviewId: string }) {
  const { data, error, isLoading, reload } = useApiQuery<AdvanceCheck>(
    `/interviews/${interviewId}/advance-check`,
  );
  if (isLoading && !data) return <Skeleton className="h-16 w-full" />;
  if (error) return <ErrorState message={error.detail} onRetry={reload} className="py-6" />;
  if (!data) return null;
  if (data.can_advance) {
    return (
      <Alert variant="success">
        <CheckCircle2 />
        <AlertTitle>Can advance</AlertTitle>
        <AlertDescription>Nothing blocks moving this candidate to the next stage.</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="warning">
      <OctagonX />
      <AlertTitle>Cannot advance yet</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {data.blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
