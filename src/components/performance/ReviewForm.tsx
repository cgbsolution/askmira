"use client";

import { AlertTriangle, Calculator, Loader2, Save, Send } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type {
  CompetencyRatingInput,
  ReviewDetail,
  ReviewRatings,
  ScorePreview,
  ValueRatingInput,
} from "@/lib/types/performance";

import { EvidenceList, errorText, useAction } from "./shared";

const NONE = "__none__";

/**
 * The form for the step the caller holds: competencies with their level
 * indicators, company values with recognition beside them, and the live score.
 *
 * The score is the server's. Goal progress is not rated here — it comes from
 * the key results — so the form shows it and never asks for it.
 */
export function ReviewForm({ detail, onDone }: { detail: ReviewDetail; onDone: () => void }) {
  const { appraisal, template, competencies, values, draft } = detail;
  const levels = template?.scale?.levels ?? [];
  const isSelf = appraisal.current_stage_role === "self";

  const [competencyRatings, setCompetencyRatings] = useState<Record<string, CompetencyRatingInput>>(() => {
    const initial: Record<string, CompetencyRatingInput> = {};
    for (const c of competencies) {
      const saved = draft?.ratings.competencies?.find((r) => r.competency_id === c.competency_id);
      initial[c.competency_id] = saved ?? { competency_id: c.competency_id, rating: null, is_applicable: true };
    }
    return initial;
  });
  const [valueRatings, setValueRatings] = useState<Record<string, ValueRatingInput>>(() => {
    const initial: Record<string, ValueRatingInput> = {};
    for (const v of values) {
      const saved = draft?.ratings.values?.find((r) => r.value_code === v.code);
      initial[v.code] = saved ?? { value_code: v.code, rating: null };
    }
    return initial;
  });
  const [comments, setComments] = useState(draft?.comments ?? "");
  const [preview, setPreview] = useState<ScorePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const { busy, run } = useAction();

  const usesValues = template !== null && template.values_weight !== "0.00" && template.values_weight !== "0";

  const ratings: ReviewRatings = useMemo(
    () => ({
      competencies: Object.values(competencyRatings).filter((r) => r.rating !== null || !r.is_applicable),
      values: usesValues ? Object.values(valueRatings).filter((r) => r.rating !== null) : [],
    }),
    [competencyRatings, valueRatings, usesValues],
  );
  const previewKey = JSON.stringify(ratings);

  useEffect(() => {
    if (!template) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      post<ScorePreview>(`/appraisal/appraisals/${appraisal.id}/score-preview`, { ratings })
        .then((result) => {
          if (!cancelled) {
            setPreview(result);
            setPreviewError(null);
          }
        })
        .catch((error) => {
          if (!cancelled) setPreviewError(errorText(error, "Could not compute the score."));
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, appraisal.id]);

  const unrated = competencies.filter((c) => {
    const r = competencyRatings[c.competency_id];
    return r.is_applicable && r.rating === null;
  });
  const missingReason = competencies.filter((c) => {
    const r = competencyRatings[c.competency_id];
    return !r.is_applicable && !(r.not_applicable_reason ?? "").trim();
  });
  const managerStep = appraisal.current_stage_role === "manager";
  const blocking = managerStep && (unrated.length > 0 || missingReason.length > 0);

  const setCompetency = (id: string, patch: Partial<CompetencyRatingInput>) =>
    setCompetencyRatings((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  const saveDraft = () =>
    run(
      "draft",
      () => post(`/appraisal/appraisals/${appraisal.id}/draft`, { ratings, comments: comments.trim() || null }),
      "Draft saved.",
    );

  const submit = async () => {
    const result = await run(
      "submit",
      () => post(`/appraisal/appraisals/${appraisal.id}/submit`, { ratings, comments: comments.trim() || null }),
      `${appraisal.current_stage_label} submitted.`,
    );
    if (result === undefined) throw new Error("not submitted");
    onDone();
  };

  return (
    <div className="space-y-5">
      {competencies.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Competencies</h3>
          {competencies.map((c) => {
            const rating = competencyRatings[c.competency_id];
            const indicator = c.indicators.find((i) => i.scale_value === rating.rating);
            const fieldId = `rating-${c.competency_id}`;
            return (
              <div key={c.competency_id} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Weight {c.weight}
                      {c.is_mandatory ? " · mandatory" : " · optional"}
                      {c.description ? ` · ${c.description}` : ""}
                    </p>
                  </div>
                  {!c.is_mandatory && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`na-${c.competency_id}`}
                        checked={!rating.is_applicable}
                        onCheckedChange={(checked) =>
                          setCompetency(c.competency_id, {
                            is_applicable: checked !== true,
                            rating: checked === true ? null : rating.rating,
                          })
                        }
                      />
                      <Label htmlFor={`na-${c.competency_id}`} className="text-xs">
                        Not applicable
                      </Label>
                    </div>
                  )}
                </div>
                {rating.is_applicable ? (
                  <FormField htmlFor={fieldId} label="Rating">
                    <Select
                      value={rating.rating ?? NONE}
                      onValueChange={(value) =>
                        setCompetency(c.competency_id, { rating: value === NONE ? null : value })
                      }
                    >
                      <SelectTrigger id={fieldId} className="w-full sm:w-72">
                        <SelectValue placeholder="Choose a level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not rated yet</SelectItem>
                        {levels.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {level.value} — {level.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                ) : (
                  <FormField htmlFor={`nar-${c.competency_id}`} label="Why it does not apply">
                    <Input
                      id={`nar-${c.competency_id}`}
                      value={rating.not_applicable_reason ?? ""}
                      maxLength={1000}
                      onChange={(e) => setCompetency(c.competency_id, { not_applicable_reason: e.target.value })}
                    />
                  </FormField>
                )}
                {indicator ? (
                  <p className="rounded-md bg-mint-50 px-3 py-2 text-xs text-foreground dark:bg-mint-900/30">
                    What a {indicator.scale_value} looks like here: {indicator.behaviour}
                  </p>
                ) : (
                  c.indicators.length > 0 && (
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                      {c.indicators.map((i) => (
                        <li key={i.scale_value}>
                          <span className="tabular-nums font-medium">{i.scale_value}</span> — {i.behaviour}
                        </li>
                      ))}
                    </ul>
                  )
                )}
                <EvidenceList evidence={c.evidence} />
              </div>
            );
          })}
        </section>
      )}

      {usesValues && values.length > 0 && (
        <section className="space-y-4">
          <Separator />
          <h3 className="text-sm font-semibold text-foreground">Company values</h3>
          {values.map((v) => {
            const fieldId = `value-${v.code}`;
            return (
              <div key={v.code} className="space-y-2 rounded-lg border border-border p-3">
                <p className="font-medium text-foreground">{v.name}</p>
                <p className="text-xs text-muted-foreground">{v.description}</p>
                <FormField htmlFor={fieldId} label="Rating">
                  <Select
                    value={valueRatings[v.code]?.rating ?? NONE}
                    onValueChange={(value) =>
                      setValueRatings((current) => ({
                        ...current,
                        [v.code]: { value_code: v.code, rating: value === NONE ? null : value },
                      }))
                    }
                  >
                    <SelectTrigger id={fieldId} className="w-full sm:w-72">
                      <SelectValue placeholder="Choose a level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not rated yet</SelectItem>
                      {levels.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.value} — {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <EvidenceList evidence={v.evidence} />
              </div>
            );
          })}
        </section>
      )}

      <FormField
        htmlFor="review-comments"
        label={isSelf ? "Your account of the period" : "Comments"}
        hint={isSelf ? "What you delivered, what got in the way, what you want next." : undefined}
      >
        <Textarea
          id="review-comments"
          rows={5}
          maxLength={8000}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />
      </FormField>

      {template && (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Calculator className="size-4" /> Score these ratings produce
          </p>
          {previewError && <p className="mt-1 text-sm text-destructive">{previewError}</p>}
          {preview?.score ? (
            <div className="mt-1 text-sm">
              <p className="tabular-nums">
                <span className="text-xl font-semibold text-foreground">{preview.score}</span>
                <span className="text-muted-foreground"> / 100</span>
                {preview.rating && <span className="ml-2 font-medium text-foreground">{preview.rating.label}</span>}
              </p>
              {preview.breakdown && (
                <p className="text-xs tabular-nums text-muted-foreground">
                  Goals {preview.breakdown.goal_score} × {template.goal_weight}% · Competencies{" "}
                  {preview.breakdown.competency_score} × {template.competency_weight}%
                  {usesValues ? ` · Values ${preview.breakdown.values_score} × ${template.values_weight}%` : ""} ·{" "}
                  {preview.breakdown.rounding}
                </p>
              )}
              {preview.breakdown?.notes.map((note) => (
                <p key={note} className="text-xs text-muted-foreground">
                  {note}
                </p>
              ))}
            </div>
          ) : (
            preview &&
            preview.problems.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {preview.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )
          )}
          {!preview && !previewError && <p className="mt-1 text-xs text-muted-foreground">Working it out…</p>}
        </div>
      )}

      {blocking && (
        <Alert>
          <AlertTriangle />
          <AlertDescription>
            {unrated.length > 0 && `Rate ${unrated.map((c) => c.name).join(", ")} before submitting. `}
            {missingReason.length > 0 && `Say why ${missingReason.map((c) => c.name).join(", ")} does not apply.`}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={busy !== null} onClick={() => void saveDraft()}>
          {busy === "draft" ? <Loader2 className="animate-spin" /> : <Save />} Save draft
        </Button>
        <Button variant="accent" disabled={busy !== null || blocking} onClick={() => setConfirming(true)}>
          <Send /> Submit {appraisal.current_stage_label?.toLowerCase()}
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Submit ${appraisal.current_stage_label}?`}
        description="Once submitted the review moves to the next step. It can come back to you only if somebody returns it with a reason."
        confirmLabel="Submit"
        onConfirm={submit}
      />
    </div>
  );
}
