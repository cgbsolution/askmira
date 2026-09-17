"use client";

import { EyeOff, MessageSquare, ShieldCheck } from "lucide-react";
import React from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { formatDateTime, humanize, RECOMMENDATION, StatusBadge } from "@/components/hiring/labels";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { VisibleFeedback } from "@/lib/types/hiring";

/**
 * The feedback this viewer may see for one interview. Peers' feedback stays
 * hidden until the viewer has submitted their own (anchoring protection); the
 * API says how many entries are withheld and why.
 */
export function FeedbackView({ interviewId }: { interviewId: string }) {
  const { data, error, isLoading, reload } = useApiQuery<VisibleFeedback>(
    `/interviews/${interviewId}/feedback`,
  );

  if (isLoading && !data) return <Skeleton className="h-32 w-full" />;
  if (error) return <ErrorState message={error.detail} onRetry={reload} className="py-6" />;
  if (!data) return null;

  return (
    <div className="space-y-3">
      {data.anchoring_protection && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Anchoring protection is on: peers&apos; feedback
          appears only after you submit your own.
        </p>
      )}
      {data.withheld_count > 0 && (
        <Alert variant="warning">
          <EyeOff />
          <AlertDescription>
            {data.withheld_count} withheld. {data.withheld_note}
          </AlertDescription>
        </Alert>
      )}

      {data.feedback.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No feedback you can see yet"
          description="Feedback appears here once panellists submit it and it is visible to you."
          className="py-8"
        />
      ) : (
        <ul className="space-y-3">
          {data.feedback.map((entry, index) => (
            <li key={`${entry.panelist}-${index}`} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">
                  {entry.panelist}
                  {entry.is_mine && (
                    <Badge variant="muted" className="ml-2">
                      You
                    </Badge>
                  )}
                </p>
                <StatusBadge map={RECOMMENDATION} value={entry.recommendation} />
              </div>
              {Object.keys(entry.ratings).length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {Object.entries(entry.ratings).map(([competency, value]) => (
                    <li key={competency}>
                      <Badge variant="outline" className="tabular-nums">
                        {humanize(competency)}: {value}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              {entry.strengths && (
                <p className="text-sm">
                  <span className="font-medium">Strengths: </span>
                  {entry.strengths}
                </p>
              )}
              {entry.concerns && (
                <p className="text-sm">
                  <span className="font-medium">Concerns: </span>
                  {entry.concerns}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Submitted {formatDateTime(entry.submitted_at)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {data.outstanding.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Still to submit: {data.outstanding.join(", ")}
        </p>
      )}
    </div>
  );
}
