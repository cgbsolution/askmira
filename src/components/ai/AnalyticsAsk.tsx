"use client";

import { Loader2, Sparkles } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { ReportChart } from "@/components/reports/ReportChart";
import { ReportResultTable } from "@/components/reports/ReportResultTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, post } from "@/lib/api";
import type { ReportResult } from "@/lib/types/reports";

import { aiAvailable, useAiStatus } from "./aiStatus";

interface AnalyticsAnswer {
  question: string;
  interpretation: string;
  confidence: number;
  confidence_band: string;
  chart: "number" | "bar" | "line" | "table";
  answered: boolean;
  result: ReportResult | null;
  problem: string | null;
}

/**
 * Reports → Ask (AI-01).
 *
 * The question becomes a report definition; the report runs as you, through
 * the same compiler as the builder. What the question was read as is shown
 * above the numbers, so a misreading is visible rather than quietly answered.
 */
export function AnalyticsAsk() {
  const status = useAiStatus();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<AnalyticsAnswer | null>(null);

  if (status.isLoading) return null;
  if (!aiAvailable(status.data, "analytics_questions")) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Questions in plain words are not turned on"
        description="An admin can turn them on in Settings → Company → AI. The builder works without them."
      />
    );
  }
  if (!status.data?.my_consent) {
    return (
      <Alert>
        <Sparkles />
        <AlertTitle>You have not agreed to the AI assistant</AlertTitle>
        <AlertDescription>
          Your question and the list of report fields are sent to an AI provider outside India; no
          report data is. Agree under My privacy to use this.
        </AlertDescription>
      </Alert>
    );
  }

  const ask = async () => {
    const text = question.trim();
    if (text.length < 3) return;
    setBusy(true);
    try {
      setAnswer(await post<AnalyticsAnswer>("/analytics/ask", { question: text }));
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The question could not be answered.");
    } finally {
      setBusy(false);
    }
  };

  const single =
    answer?.result && answer.result.rows.length === 1 && answer.result.columns.length === 1
      ? answer.result.rows[0][0]
      : null;

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="grid gap-3 pt-6">
          <Label htmlFor="analytics-question">Ask a question about your data</Label>
          <div className="flex gap-2">
            <Input
              id="analytics-question"
              value={question}
              maxLength={1000}
              placeholder="How many people joined in each department this financial year?"
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void ask();
              }}
            />
            <Button onClick={ask} disabled={busy || question.trim().length < 3}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Ask
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Only your question and the names of report fields leave AskMira. The report runs here, as
            you, and shows only what your role may see.
          </p>
        </CardContent>
      </Card>

      {answer ? (
        <Card>
          <CardHeader>
            <CardDescription>Read as</CardDescription>
            <CardTitle className="text-base">{answer.interpretation}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Confidence: {answer.confidence_band}</Badge>
              {!answer.answered ? <Badge variant="outline">Not answered</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {answer.problem ? (
              <Alert>
                <AlertTitle>The report could not run</AlertTitle>
                <AlertDescription>{answer.problem}</AlertDescription>
              </Alert>
            ) : null}
            {answer.result ? (
              single !== null ? (
                <p className="text-4xl font-semibold tabular-nums">{String(single)}</p>
              ) : (
                <>
                  {answer.chart === "bar" || answer.chart === "line" ? (
                    <ReportChart result={answer.result} chartType={answer.chart} className="h-72" />
                  ) : null}
                  <ReportResultTable result={answer.result} />
                </>
              )
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
