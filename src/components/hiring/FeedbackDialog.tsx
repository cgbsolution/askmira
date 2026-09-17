"use client";

import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { humanize, RECOMMENDATION } from "@/components/hiring/labels";
import { ActionDialog } from "@/components/hiring/OfferActionDialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type { FeedbackInput, Recommendation } from "@/lib/types/hiring";

const RATING_PATTERN = /^(10|[1-9])$/;

/**
 * Submit my feedback for one interview: a recommendation, a 1–10 rating per
 * required competency, strengths and concerns. One submission only, so the
 * form says so; concerns are required when recommending against.
 */
export function FeedbackDialog({
  interviewId,
  competencies,
  open,
  onOpenChange,
  onSubmitted,
}: {
  interviewId: string;
  competencies: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}) {
  const [recommendation, setRecommendation] = useState<Recommendation | "">("");
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [strengths, setStrengths] = useState("");
  const [concerns, setConcerns] = useState("");
  const against = recommendation === "no" || recommendation === "strong_no";

  const reset = () => {
    setRecommendation("");
    setRatings({});
    setStrengths("");
    setConcerns("");
  };

  const validate = () => {
    if (!recommendation) return "Choose a recommendation.";
    for (const competency of competencies) {
      const value = (ratings[competency] ?? "").trim();
      if (!RATING_PATTERN.test(value)) {
        return `Rate ${humanize(competency)} with a whole number from 1 to 10.`;
      }
    }
    if (against && !concerns.trim()) return "Say what the concerns are when recommending against.";
    return null;
  };

  const submit = async () => {
    const body: FeedbackInput = {
      recommendation: recommendation as Recommendation,
      ratings: Object.fromEntries(competencies.map((c) => [c, (ratings[c] ?? "").trim()])),
      strengths: strengths.trim(),
      concerns: concerns.trim(),
    };
    await post(`/interviews/${interviewId}/feedback`, body);
    toast.success("Feedback submitted");
    reset();
    onSubmitted();
  };

  return (
    <ActionDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title="Give feedback"
      description="You can submit once. Other panellists' feedback stays hidden from you until yours is in."
      submitLabel="Submit feedback"
      validate={validate}
      onSubmit={submit}
      errorFallback="Your feedback could not be submitted."
    >
      <FormField htmlFor="feedback-recommendation" label="Recommendation">
        <Select value={recommendation} onValueChange={(value) => setRecommendation(value as Recommendation)}>
          <SelectTrigger id="feedback-recommendation" className="w-full">
            <SelectValue placeholder="Choose one" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(RECOMMENDATION) as Recommendation[]).map((key) => (
              <SelectItem key={key} value={key}>
                {RECOMMENDATION[key][0]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {competencies.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {competencies.map((competency, index) => (
            <FormField
              key={competency}
              htmlFor={`feedback-rating-${index}`}
              label={humanize(competency)}
              hint="1 (weak) to 10 (exceptional)"
            >
              <Input
                id={`feedback-rating-${index}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                step={1}
                value={ratings[competency] ?? ""}
                onChange={(event) =>
                  setRatings((current) => ({ ...current, [competency]: event.target.value }))
                }
              />
            </FormField>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">This round has no required competencies to rate.</p>
      )}

      <FormField htmlFor="feedback-strengths" label="Strengths" optional>
        <Textarea
          id="feedback-strengths"
          rows={3}
          maxLength={5000}
          value={strengths}
          onChange={(event) => setStrengths(event.target.value)}
        />
      </FormField>
      <FormField
        htmlFor="feedback-concerns"
        label="Concerns"
        optional={!against}
        hint={against ? "Required when recommending against." : undefined}
      >
        <Textarea
          id="feedback-concerns"
          rows={3}
          maxLength={5000}
          value={concerns}
          onChange={(event) => setConcerns(event.target.value)}
        />
      </FormField>
    </ActionDialog>
  );
}
