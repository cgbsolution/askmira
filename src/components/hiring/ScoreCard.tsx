import { EyeOff, ShieldAlert, Sparkles } from "lucide-react";
import React from "react";

import { humanize } from "@/components/hiring/labels";
import { Badge } from "@/components/ui/badge";
import type { FitScoreView, PresentedScore } from "@/lib/types/hiring";

/**
 * One round's score (FS-ANL-02).
 *
 * An AI score is never shown bare: it appears with its contributing signals and
 * a confidence, or not at all — in which case the reason it is withheld is shown
 * in its place. Proctoring appears as the recorded statements, not a verdict.
 */
export function ScoreCard({ score }: { score: PresentedScore }) {
  const missingEvidence =
    score.is_ai_generated && (!score.confidence || score.signals.length === 0);
  const hidden = score.withheld || missingEvidence;

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-foreground">
          {humanize(score.round_type)} · round {score.round_number}
        </p>
        {score.is_ai_generated && (
          <Badge variant="secondary">
            <Sparkles /> AI-assessed
          </Badge>
        )}
      </div>

      {hidden ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <EyeOff className="mt-0.5 size-4 shrink-0" />
          <span>
            Score not shown.{" "}
            {score.withheld_reason ??
              "It arrived without its contributing signals and a confidence value."}
          </span>
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-foreground">
            <span className="text-2xl font-semibold tabular-nums">{score.score ?? "—"}</span>
            {score.max_score && (
              <span className="text-muted-foreground tabular-nums"> / {score.max_score}</span>
            )}
            {score.confidence && (
              <span className="ml-3 text-xs text-muted-foreground tabular-nums">
                Confidence {score.confidence}
              </span>
            )}
          </p>
          {score.signals.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Contributing signals</p>
              <ul className="mt-1 grid gap-1 text-sm sm:grid-cols-2">
                {score.signals.map((signal) => (
                  <li key={signal.name} className="flex justify-between gap-2 rounded bg-muted px-2 py-1">
                    <span>{humanize(signal.name)}</span>
                    <span className="tabular-nums">{signal.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {score.summary && <p className="text-sm text-muted-foreground">{score.summary}</p>}

      <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          <ShieldAlert className="size-4" /> {score.proctoring.label}
        </p>
        {score.proctoring.statements.length > 0 && (
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
            {score.proctoring.statements.map((statement) => (
              <li key={statement}>{statement}</li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{score.proctoring.note}</p>
      </div>
    </div>
  );
}

/** The overall fit score, shown only as its status allows — with its components, never bare. */
export function ScoreFitCard({ fit }: { fit: FitScoreView }) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <p className="font-medium text-foreground">Fit score</p>
      {fit.status === "shown_with_components" && fit.value ? (
        <>
          <p className="text-sm">
            <span className="text-2xl font-semibold tabular-nums">{fit.value}</span>
            {fit.confidence && (
              <span className="ml-3 text-xs text-muted-foreground tabular-nums">
                Confidence {fit.confidence}
              </span>
            )}
          </p>
          <ul className="space-y-1 text-sm">
            {fit.components.map((component) => (
              <li
                key={`${component.round_type}-${component.round_number}`}
                className="flex flex-wrap justify-between gap-2"
              >
                <span>
                  {humanize(component.round_type)} · round {component.round_number}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {component.score ?? "—"}
                  {component.confidence ? ` (confidence ${component.confidence})` : ""}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {fit.status === "withheld" ? "Withheld." : "Not computed."}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{fit.note}</p>
    </div>
  );
}
