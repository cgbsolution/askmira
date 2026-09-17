"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import React from "react";

import { CandidateMoveMenu } from "@/components/hiring/CandidateMoveMenu";
import { CANDIDATE_STAGE, humanize, PIPELINE_COLUMNS, SOURCE_LABEL } from "@/components/hiring/labels";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CandidateSummary } from "@/lib/types/hiring";

export function sourceLabel(source: string | null): string {
  if (!source) return "—";
  return SOURCE_LABEL[source] ?? humanize(source);
}

export function experienceLabel(years: string | null): string {
  return years === null ? "—" : `${years} yrs`;
}

export function noticeLabel(days: number | null): string {
  return days === null ? "—" : `${days} days notice`;
}

/** The "possible duplicate" marker, identical on the board and in the list. */
export function PipelineDuplicateBadge() {
  return (
    <Badge variant="warning">
      <AlertTriangle /> Possible duplicate
    </Badge>
  );
}

/**
 * The pipeline as columns, one per stage. Moving a candidate goes through the
 * Move menu, which offers only what the API allows from their stage.
 */
export function PipelineBoard({
  candidates,
  onMoved,
}: {
  candidates: CandidateSummary[];
  onMoved: () => void;
}) {
  return (
    <div className="overflow-x-auto p-4">
      <div className="flex min-w-max gap-3">
        {PIPELINE_COLUMNS.map((stage) => {
          const column = candidates.filter((candidate) => candidate.stage === stage);
          return (
            <section
              key={stage}
              aria-label={CANDIDATE_STAGE[stage][0]}
              className="flex w-64 shrink-0 flex-col gap-2 rounded-lg bg-muted/50 p-2"
            >
              <header className="flex items-center justify-between px-1 py-1">
                <h3 className="text-sm font-semibold text-foreground">{CANDIDATE_STAGE[stage][0]}</h3>
                <Badge variant="muted" className="tabular-nums">
                  {column.length}
                </Badge>
              </header>
              {column.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">No one here</p>
              ) : (
                column.map((candidate) => (
                  <Card key={candidate.id} tier="tier1" className="gap-2 px-3 py-3">
                    <Link
                      href={`/hiring/candidates/${candidate.id}`}
                      className="truncate font-medium text-foreground hover:underline"
                    >
                      {candidate.full_name}
                    </Link>
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      <p>{sourceLabel(candidate.source)}</p>
                      <p className="tabular-nums">
                        {experienceLabel(candidate.total_experience_years)} ·{" "}
                        {noticeLabel(candidate.notice_period_days)}
                      </p>
                    </div>
                    {candidate.possible_duplicate && <PipelineDuplicateBadge />}
                    <div className="flex justify-end">
                      <CandidateMoveMenu
                        candidate={candidate}
                        allowedMoves={candidate.allowed_moves}
                        onMoved={onMoved}
                      />
                    </div>
                  </Card>
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
