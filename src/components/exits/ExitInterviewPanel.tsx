"use client";

import { Loader2, MessageSquareQuote, UserCheck } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post, put } from "@/lib/api";
import { FieldLegend, FieldSet } from "@/components/ui/field";

export const EXIT_REASONS: Record<string, string> = {
  compensation: "Pay",
  career_growth: "Career growth",
  manager: "Manager",
  role_or_work: "The role or the work",
  work_life_balance: "Work-life balance",
  culture: "Culture",
  relocation: "Moving away",
  higher_studies: "Higher studies",
  health_or_family: "Health or family",
  better_opportunity: "A better opportunity",
  other: "Something else",
};

const RATINGS: Record<string, string> = {
  manager: "Their manager",
  growth: "Growth",
  compensation: "Pay",
  culture: "Culture",
  work_life: "Work-life balance",
};

const ANSWERS = [
  { value: "unanswered", label: "Not answered" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

interface Interview {
  id: string;
  mode: "conversation" | "self";
  primary_reason: string;
  other_reasons: string[];
  ratings: Record<string, number>;
  would_recommend: boolean | null;
  would_return: boolean | null;
  comments: string | null;
  conducted_on: string;
}

function toAnswer(value: boolean | null | undefined): string {
  return value === true ? "yes" : value === false ? "no" : "unanswered";
}

function fromAnswer(value: string): boolean | null {
  return value === "yes" ? true : value === "no" ? false : null;
}

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/**
 * The exit interview: the leaver fills it in, or HR records the conversation.
 * Never shown to the leaver's manager — the API refuses them too — because
 * what someone says about their manager is only honest when that manager
 * cannot read it.
 */
export function ExitInterviewPanel({
  exitId,
  viewer,
  rehire,
}: {
  exitId: string;
  viewer: "leaver" | "hr";
  /** HR only: the current rehire decision. */
  rehire?: { eligible: boolean | null; note: string | null; onChanged: () => void };
}) {
  const { data, isLoading, reload } = useApiQuery<Interview | null>(`/exits/${exitId}/interview`);
  const [editing, setEditing] = useState(false);

  const answered = data !== null && data !== undefined;
  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareQuote className="size-4 text-primary" /> Exit interview
          {answered && <Badge variant="secondary">{data.mode === "self" ? "Filled in by them" : "Recorded by HR"}</Badge>}
        </CardTitle>
        <CardDescription>
          {viewer === "leaver"
            ? "Why you are leaving, in your words. HR reads it; your manager does not."
            : "Read by HR and the leaver only — never their manager."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {isLoading ? null : answered && !editing ? (
          <div className="grid gap-2 text-sm">
            <p>
              <span className="text-muted-foreground">Main reason: </span>
              {EXIT_REASONS[data.primary_reason] ?? data.primary_reason}
              {data.other_reasons.length > 0 &&
                ` (also ${data.other_reasons.map((r) => EXIT_REASONS[r] ?? r).join(", ").toLowerCase()})`}
            </p>
            {Object.keys(data.ratings).length > 0 && (
              <p className="text-muted-foreground">
                {Object.entries(data.ratings)
                  .map(([key, value]) => `${RATINGS[key] ?? key} ${value}/5`)
                  .join(" · ")}
              </p>
            )}
            <p className="text-muted-foreground">
              Would recommend: {toAnswer(data.would_recommend).replace("unanswered", "—")} · Would return:{" "}
              {toAnswer(data.would_return).replace("unanswered", "—")}
            </p>
            {data.comments && <p className="whitespace-pre-line">{data.comments}</p>}
            {viewer === "hr" && (
              <div>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  Add to it
                </Button>
              </div>
            )}
          </div>
        ) : (
          <InterviewForm
            exitId={exitId}
            initial={data ?? null}
            onSaved={() => {
              setEditing(false);
              reload();
            }}
          />
        )}
        {viewer === "hr" && rehire && <RehireControl exitId={exitId} {...rehire} />}
      </CardContent>
    </Card>
  );
}

function InterviewForm({
  exitId,
  initial,
  onSaved,
}: {
  exitId: string;
  initial: Interview | null;
  onSaved: () => void;
}) {
  const [primary, setPrimary] = useState(initial?.primary_reason ?? "");
  const [others, setOthers] = useState<Set<string>>(new Set(initial?.other_reasons ?? []));
  const [ratings, setRatings] = useState<Record<string, number>>(initial?.ratings ?? {});
  const [recommend, setRecommend] = useState(toAnswer(initial?.would_recommend));
  const [returning, setReturning] = useState(toAnswer(initial?.would_return));
  const [comments, setComments] = useState(initial?.comments ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await put(`/exits/${exitId}/interview`, {
        primary_reason: primary,
        other_reasons: [...others].filter((r) => r !== primary),
        ratings,
        would_recommend: fromAnswer(recommend),
        would_return: fromAnswer(returning),
        comments: comments.trim() || null,
      });
      toast.success("Exit interview saved.");
      onSaved();
    } catch (caught) {
      toast.error(failure(caught, "It could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <FormField htmlFor={`exit-reason-${exitId}`} label="Main reason for leaving">
        <Select value={primary} onValueChange={setPrimary}>
          <SelectTrigger id={`exit-reason-${exitId}`} className="w-full">
            <SelectValue placeholder="Choose one" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(EXIT_REASONS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FieldSet className="grid gap-1.5">
        <FieldLegend className="mb-1 text-sm font-medium">Anything else that played a part</FieldLegend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {Object.entries(EXIT_REASONS)
            .filter(([key]) => key !== primary)
            .map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <Checkbox
                  id={`exit-other-${exitId}-${key}`}
                  checked={others.has(key)}
                  onCheckedChange={(on) =>
                    setOthers((current) => {
                      const next = new Set(current);
                      if (on) next.add(key);
                      else next.delete(key);
                      return next;
                    })
                  }
                />
                <Label htmlFor={`exit-other-${exitId}-${key}`} className="text-sm font-normal">
                  {label}
                </Label>
              </div>
            ))}
        </div>
      </FieldSet>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(RATINGS).map(([key, label]) => (
          <FormField key={key} htmlFor={`exit-rating-${exitId}-${key}`} label={label} optional>
            <Select
              value={ratings[key] ? String(ratings[key]) : "none"}
              onValueChange={(value) =>
                setRatings((current) => {
                  const next = { ...current };
                  if (value === "none") delete next[key];
                  else next[key] = Number(value);
                  return next;
                })
              }
            >
              <SelectTrigger id={`exit-rating-${exitId}-${key}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not rated</SelectItem>
                {[5, 4, 3, 2, 1].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} — {["", "Very poor", "Poor", "All right", "Good", "Very good"][n]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField htmlFor={`exit-recommend-${exitId}`} label="Would recommend working here">
          <Select value={recommend} onValueChange={setRecommend}>
            <SelectTrigger id={`exit-recommend-${exitId}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANSWERS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField htmlFor={`exit-return-${exitId}`} label="Would come back">
          <Select value={returning} onValueChange={setReturning}>
            <SelectTrigger id={`exit-return-${exitId}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANSWERS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField htmlFor={`exit-comments-${exitId}`} label="In your words" optional>
        <Textarea id={`exit-comments-${exitId}`} rows={4} maxLength={5000} value={comments} onChange={(e) => setComments(e.target.value)} />
      </FormField>
      <div>
        <Button disabled={busy || !primary} onClick={() => void save()}>
          {busy && <Loader2 className="animate-spin" />} Save
        </Button>
      </div>
    </div>
  );
}

function RehireControl({
  exitId,
  eligible,
  note,
  onChanged,
}: {
  exitId: string;
  eligible: boolean | null;
  note: string | null;
  onChanged: () => void;
}) {
  const [choice, setChoice] = useState(toAnswer(eligible));
  const [reason, setReason] = useState(note ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setChoice(toAnswer(eligible));
    setReason(note ?? "");
  }, [eligible, note]);

  const save = async () => {
    setBusy(true);
    try {
      await post(`/exits/${exitId}/rehire`, { eligible: choice === "yes", note: reason.trim() || null });
      toast.success("Rehire eligibility saved.");
      onChanged();
    } catch (caught) {
      toast.error(failure(caught, "It could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3 border-t border-border pt-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <UserCheck className="size-4 text-muted-foreground" /> Could they be hired again?
      </p>
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <Select value={choice} onValueChange={setChoice}>
          <SelectTrigger aria-label="Rehire eligibility" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unanswered">Not decided</SelectItem>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
        <Textarea
          aria-label="Why"
          rows={2}
          maxLength={2000}
          placeholder={choice === "no" ? "Why not — required, and HR sees it if they apply again" : "Note (optional)"}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || choice === "unanswered" || (choice === "no" && !reason.trim())}
          onClick={() => void save()}
        >
          {busy && <Loader2 className="animate-spin" />} Save decision
        </Button>
      </div>
    </div>
  );
}
