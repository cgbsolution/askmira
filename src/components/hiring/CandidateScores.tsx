import { Bot, EyeOff, Info } from "lucide-react";
import React from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { humanize } from "@/components/hiring/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FitScoreView, PresentedScore, ProctoringStatement } from "@/lib/types/hiring";

function ProctoringBlock({ proctoring }: { proctoring: ProctoringStatement }) {
  return (
    <div className="space-y-1.5 rounded-md bg-muted/60 px-3 py-2.5">
      <p className="text-sm font-medium text-foreground">{proctoring.label}</p>
      {proctoring.statements.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-foreground">
          {proctoring.statements.map((statement, index) => (
            <li key={index}>{statement}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{proctoring.note}</p>
    </div>
  );
}

/**
 * One round's score. An AI score is never shown without its signals and
 * confidence: if the API withheld it, only the reason is shown, not a number.
 */
export function CandidateScoreCard({ score }: { score: PresentedScore }) {
  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {humanize(score.round_type)} · round <span className="tabular-nums">{score.round_number}</span>
          {score.is_ai_generated && (
            <Badge variant="secondary">
              <Bot /> AI
            </Badge>
          )}
        </CardTitle>
        {score.summary && <CardDescription>{score.summary}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        {score.withheld ? (
          <Alert variant="warning">
            <EyeOff />
            <AlertTitle>Score withheld</AlertTitle>
            <AlertDescription>
              {score.withheld_reason ?? "This score cannot be shown without its supporting signals."}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {score.score ?? "—"}
                {score.max_score && (
                  <span className="text-base font-normal text-muted-foreground"> / {score.max_score}</span>
                )}
              </p>
              {score.confidence !== null && (
                <p className="text-sm text-muted-foreground">
                  Confidence <span className="tabular-nums text-foreground">{score.confidence}</span>
                </p>
              )}
            </div>
            {score.signals.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Contributing signals</p>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {score.signals.map((signal) => (
                    <li key={signal.name} className="flex justify-between gap-3 px-3 py-1.5 text-sm">
                      <span className="text-foreground">{humanize(signal.name)}</span>
                      <span className="tabular-nums text-muted-foreground">{signal.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        <ProctoringBlock proctoring={score.proctoring} />
      </CardContent>
    </Card>
  );
}

/** The Fit Score, shown as a number only together with its components and confidence. */
export function CandidateFitScore({ fit }: { fit: FitScoreView }) {
  const shown = fit.status === "shown_with_components" && fit.value !== null;
  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Fit Score</CardTitle>
        <CardDescription>{fit.note}</CardDescription>
      </CardHeader>
      {shown && (
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{fit.value}</p>
            {fit.confidence !== null && (
              <p className="text-sm text-muted-foreground">
                Confidence <span className="tabular-nums text-foreground">{fit.confidence}</span>
              </p>
            )}
          </div>
          {fit.components.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Built from</p>
              <ul className="divide-y divide-border rounded-md border border-border">
                {fit.components.map((component) => (
                  <li
                    key={`${component.round_type}-${component.round_number}`}
                    className="flex justify-between gap-3 px-3 py-1.5 text-sm"
                  >
                    <span className="text-foreground">
                      {humanize(component.round_type)} · round {component.round_number}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {component.score ?? "—"}
                      {component.confidence !== null && ` · confidence ${component.confidence}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/** Every round score for a candidate, then the Fit Score. */
export function CandidateScores({ scores, fit }: { scores: PresentedScore[]; fit: FitScoreView }) {
  return (
    <div className="space-y-4">
      {scores.length === 0 ? (
        <EmptyState
          icon={Info}
          title="No round scores recorded"
          description="Scores appear here after an assessed round is completed."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {scores.map((score) => (
            <CandidateScoreCard key={score.id} score={score} />
          ))}
        </div>
      )}
      <CandidateFitScore fit={fit} />
    </div>
  );
}
