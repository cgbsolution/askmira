"use client";

import { Loader2, MessageSquareText } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { RequireRole } from "@/components/common/RequireRole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/useApiQuery";
import { HR } from "@/lib/access";
import { ApiError, post } from "@/lib/api";
import { formatDate } from "@/lib/utils";

import { aiAvailable, useAiStatus } from "./aiStatus";

interface Theme {
  theme: string;
  summary: string;
  mentions: number;
  sentiment: "positive" | "mixed" | "negative";
}

interface ThemeSummary {
  id: string;
  comment_count: number;
  topics: Theme[];
  confidence: number;
  confidence_band: string;
  model: string;
  generated_at: string | null;
  note: string;
}

const SENTIMENT: Record<Theme["sentiment"], "secondary" | "outline" | "destructive"> = {
  positive: "secondary",
  mixed: "outline",
  negative: "destructive",
};

/**
 * Comment themes for one survey (EXP-04), for HR.
 *
 * Paraphrased and counted, never quoted; a theme raised by fewer people than
 * the survey's floor is folded into "Other themes". Only comments whose writers
 * ticked "AI may read this comment" are read, and that choice carries no name.
 */
export function SurveyThemesCard({ surveyId }: { surveyId: string }) {
  return (
    <RequireRole roles={HR}>
      <ThemesInner surveyId={surveyId} />
    </RequireRole>
  );
}

function ThemesInner({ surveyId }: { surveyId: string }) {
  const status = useAiStatus();
  const latest = useApiQuery<ThemeSummary | null>(
    aiAvailable(status.data, "survey_topics") ? `/culture/surveys/${surveyId}/topics` : null,
  );
  const [busy, setBusy] = useState(false);

  if (!aiAvailable(status.data, "survey_topics")) return null;

  const generate = async () => {
    setBusy(true);
    try {
      await post(`/culture/surveys/${surveyId}/topics`);
      latest.reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not read the comments.");
    } finally {
      setBusy(false);
    }
  };

  const summary = latest.data;
  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareText className="size-4" /> Comment themes
        </CardTitle>
        <CardDescription>
          {summary
            ? `${summary.comment_count} comments · read ${summary.generated_at ? formatDate(summary.generated_at) : ""} · confidence ${summary.confidence_band}`
            : "Themes in the comments their writers opened to AI, counted and paraphrased. No comment is shown."}
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={generate} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {summary ? "Read again" : "Find themes"}
          </Button>
        </CardAction>
      </CardHeader>
      {summary ? (
        <CardContent className="grid gap-3">
          {summary.topics.map((theme) => (
            <div key={theme.theme} className="grid gap-1 rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{theme.theme}</span>
                <Badge variant="outline">{theme.mentions} mentions</Badge>
                <Badge variant={SENTIMENT[theme.sentiment]}>{theme.sentiment}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{theme.summary}</p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{summary.note}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}
