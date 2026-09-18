"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { PersonCell } from "@/components/common/PersonCell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { AwardCycle, JuryView, Nomination } from "@/lib/types/culture";

import { apiDetail } from "../cultureShared";

/**
 * Jury scoring for one cycle.
 *
 * A juror scores each nomination 1–10 per criterion. A draft can be saved and
 * revised; submitting makes it final, and only then are the other jurors'
 * scores shown — reopening a score after reading the panel is anchoring
 * arriving by a different door.
 */
export function JuryDialog({
  cycle,
  onOpenChange,
}: {
  cycle: AwardCycle | null;
  onOpenChange: (open: boolean) => void;
}) {
  const nominations = useApiQuery<Nomination[]>(cycle ? `/culture/award-cycles/${cycle.id}/nominations` : null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [cycle]);

  const rows = (nominations.data ?? []).filter((row) => row.status !== "withdrawn");
  const current = rows.find((row) => row.id === selected) ?? rows[0] ?? null;

  return (
    <Dialog open={cycle !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Score {cycle?.programme_name} — {cycle?.label}
          </DialogTitle>
          <DialogDescription>
            You do not see who nominated anyone, or other jurors&apos; scores until yours is submitted.
          </DialogDescription>
        </DialogHeader>

        {nominations.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : nominations.error ? (
          <ErrorState message={nominations.error.detail} onRetry={nominations.reload} />
        ) : rows.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No nominations to score" />
        ) : (
          <div className="grid gap-4 md:grid-cols-[240px_1fr]">
            <ul className="grid content-start gap-1">
              {rows.map((row) => (
                <li key={row.id}>
                  <Button
                    variant={current?.id === row.id ? "secondary" : "ghost"}
                    className="h-auto w-full justify-between px-3 py-2 text-left"
                    onClick={() => setSelected(row.id)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{row.nominee.name}</span>
                      <span className="block truncate text-xs font-normal text-muted-foreground">
                        {row.category_name ?? row.category_key}
                      </span>
                    </span>
                    {row.my_score === "submitted" ? (
                      <Badge variant="success">Scored</Badge>
                    ) : row.my_score === "draft" ? (
                      <Badge variant="outline">Draft</Badge>
                    ) : null}
                  </Button>
                </li>
              ))}
            </ul>
            {current && cycle && (
              <ScorePanel
                key={current.id}
                nomination={current}
                criteria={cycle.criteria}
                onSaved={nominations.reload}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ScorePanel({
  nomination,
  criteria,
  onSaved,
}: {
  nomination: Nomination;
  criteria: AwardCycle["criteria"];
  onSaved: () => void;
}) {
  const view = useApiQuery<JuryView>(`/culture/nominations/${nomination.id}/jury`);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);

  useEffect(() => {
    const draft = view.data?.your_draft;
    if (draft) {
      setScores(Object.fromEntries(Object.entries(draft.scores).map(([key, value]) => [key, String(value)])));
      setComments(draft.comments ?? "");
    }
  }, [view.data]);

  const submitted = view.data?.you_have_submitted ?? nomination.my_score === "submitted";
  const valid = criteria.every((criterion) => {
    const value = Number(scores[criterion.key]);
    return Number.isInteger(value) && value >= 1 && value <= 10;
  });

  const save = async (final: boolean) => {
    setBusy(final ? "submit" : "draft");
    try {
      await post(`/culture/nominations/${nomination.id}/score`, {
        scores: Object.fromEntries(criteria.map((criterion) => [criterion.key, Number(scores[criterion.key])])),
        comments: comments.trim() || null,
        submit: final,
      });
      toast.success(final ? "Score submitted. It is final." : "Draft saved.");
      view.reload();
      onSaved();
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not save the score."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid content-start gap-4">
      <div>
        <PersonCell
          name={nomination.nominee.name}
          photoUrl={nomination.nominee.photo_url}
          subtitle={nomination.nominee.designation}
        />
        <p className="mt-3 rounded-lg border border-border p-3 text-sm whitespace-pre-line text-foreground">
          {nomination.citation}
        </p>
      </div>

      {submitted ? (
        <>
          <Alert variant="success">
            <CheckCircle2 />
            <AlertTitle>Your score is submitted</AlertTitle>
            <AlertDescription>{view.data?.note}</AlertDescription>
          </Alert>
          {(view.data?.scores ?? []).length > 0 && (
            <ul className="grid gap-2 text-sm">
              {(view.data?.scores ?? []).map((row) => (
                <li key={row.juror_id} className="flex justify-between gap-3 rounded-md border border-border px-3 py-2">
                  <span>{row.juror_name ?? "A juror"}</span>
                  <span className="tabular-nums">
                    mean {row.mean.toFixed(1)} {!row.is_submitted && "(draft)"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {criteria.map((criterion) => (
              <FormField
                key={criterion.key}
                htmlFor={`score-${criterion.key}`}
                label={`${criterion.name}${criterion.weight && criterion.weight > 1 ? ` (weight ${criterion.weight})` : ""}`}
                hint="1 to 10"
              >
                <Input
                  id={`score-${criterion.key}`}
                  inputMode="numeric"
                  value={scores[criterion.key] ?? ""}
                  onChange={(event) =>
                    setScores({ ...scores, [criterion.key]: event.target.value.replace(/\D/g, "").slice(0, 2) })
                  }
                />
              </FormField>
            ))}
          </div>
          <FormField htmlFor="score-comments" label="Comments" optional>
            <Textarea id="score-comments" value={comments} onChange={(event) => setComments(event.target.value)} rows={3} />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => save(false)} disabled={busy !== null || !valid}>
              {busy === "draft" && <Loader2 className="animate-spin" />} Save draft
            </Button>
            <Button onClick={() => save(true)} disabled={busy !== null || !valid}>
              {busy === "submit" && <Loader2 className="animate-spin" />} Submit — final
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
