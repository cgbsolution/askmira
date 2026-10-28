"use client";

import { Building2, CheckCircle2, Loader2, XCircle } from "lucide-react";
import React, { useEffect, useState } from "react";

import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, get, post } from "@/lib/api";
import { cn } from "@/lib/utils";

type Described = {
  state: "waiting" | "not_waiting";
  company_name: string;
  logo_url: string | null;
  approver_name: string;
  queue_label: string;
  title: string | null;
  subject_name: string | null;
  detail: string | null;
  submitted_at: string | null;
  open_url: string;
};

type Decided = { decision: "approved" | "rejected"; title: string | null; subject_name: string | null };

const OPEN_FALLBACK = "/approvals";

/**
 * The page an approval email's Approve / Reject button opens. No sign-in: the
 * link names one approver and one request. Opening it changes nothing; the
 * decision is made only when the approver presses the button here.
 */
export function EmailActionScreen({ token, chosen }: { token: string; chosen: "approve" | "reject" }) {
  const [described, setDescribed] = useState<Described | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [decided, setDecided] = useState<Decided | null>(null);

  useEffect(() => {
    get<Described>(`/public/email-actions/${encodeURIComponent(token)}`, { skipAuthRedirect: true })
      .then(setDescribed)
      .catch((caught) =>
        setProblem(caught instanceof ApiError ? caught.detail : "This link could not be opened."),
      );
  }, [token]);

  const decide = async (action: "approve" | "reject") => {
    setBusy(action);
    setProblem(null);
    try {
      const result = await post<Decided>(
        `/public/email-actions/${encodeURIComponent(token)}`,
        { action, comment: comment.trim() || null },
        { skipAuthRedirect: true },
      );
      setDecided(result);
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.detail : "That did not go through. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const openUrl = described?.open_url || OPEN_FALLBACK;

  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <div className="flex justify-center">
        {described?.logo_url ? (
          // A company's own uploaded logo; its size is not known in advance.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={described.logo_url} alt={described.company_name} className="max-h-12 max-w-[200px] object-contain" />
        ) : (
          <span className="flex items-center gap-2 font-display text-lg font-semibold text-primary">
            <Building2 className="size-5" />
            {described?.company_name ?? "AskMira"}
          </span>
        )}
      </div>

      <Card tier="tier2">
        {!described && !problem ? (
          <CardContent className="space-y-3 py-6">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        ) : decided ? (
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            {decided.decision === "approved" ? (
              <CheckCircle2 className="size-10 text-success" />
            ) : (
              <XCircle className="size-10 text-destructive" />
            )}
            <p className="font-display text-xl font-semibold">
              {decided.decision === "approved" ? "Approved" : "Rejected"}
            </p>
            <p className="text-sm text-muted-foreground">
              {decided.subject_name ? `${decided.subject_name}'s ` : ""}
              {decided.title ?? "request"} was {decided.decision}. They have been told, and your
              comment is on the record.
            </p>
            <Button asChild variant="outline">
              <a href={openUrl}>Open AskMira</a>
            </Button>
          </CardContent>
        ) : !described ? (
          <CardContent className="space-y-4 py-6">
            <Alert variant="destructive">
              <AlertTitle>This link cannot be used</AlertTitle>
              <AlertDescription>{problem}</AlertDescription>
            </Alert>
            <Button asChild variant="outline">
              <a href={OPEN_FALLBACK}>Open Approvals in AskMira</a>
            </Button>
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <Badge variant="secondary" className="w-fit">
                {described.queue_label}
              </Badge>
              <CardTitle className="font-display text-xl">
                {described.title ?? "A request for your decision"}
              </CardTitle>
              <CardDescription>
                {described.subject_name ? `From ${described.subject_name}` : null}
                {described.submitted_at
                  ? ` · ${new Date(described.submitted_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
                  : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {described.state === "not_waiting" ? (
                <Alert>
                  <AlertTitle>Nothing to decide</AlertTitle>
                  <AlertDescription>
                    This request is no longer waiting on you: it was decided, withdrawn or passed
                    to someone else.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {described.detail ? <p className="text-sm">{described.detail}</p> : null}
                  <p className="text-sm text-muted-foreground">
                    Deciding as <span className="font-medium text-foreground">{described.approver_name}</span>.
                  </p>
                  <FormField
                    htmlFor="email-action-comment"
                    label="Comment"
                    optional
                    hint={
                      chosen === "reject"
                        ? "Say why, so they know what to change."
                        : "Shown to the person with your decision."
                    }
                  >
                    <Textarea
                      id="email-action-comment"
                      value={comment}
                      autoFocus={chosen === "reject"}
                      maxLength={1000}
                      rows={3}
                      onChange={(event) => setComment(event.target.value)}
                    />
                  </FormField>
                  {problem ? (
                    <Alert variant="destructive">
                      <AlertDescription>{problem}</AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className={cn(chosen === "approve" && "ring-2 ring-ring ring-offset-2")}
                      disabled={busy !== null}
                      onClick={() => void decide("approve")}
                    >
                      {busy === "approve" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className={cn(
                        "text-destructive",
                        chosen === "reject" && "ring-2 ring-destructive ring-offset-2",
                      )}
                      disabled={busy !== null}
                      onClick={() => void decide("reject")}
                    >
                      {busy === "reject" ? <Loader2 className="animate-spin" /> : <XCircle />}
                      Reject
                    </Button>
                  </div>
                </>
              )}
              <p className="text-xs text-muted-foreground">
                Prefer the full view?{" "}
                <Button asChild variant="link" className="h-auto p-0 text-xs">
                  <a href={openUrl}>Open it in AskMira</a>
                </Button>
                .
              </p>
            </CardContent>
          </>
        )}
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        Sent by {described?.company_name ?? "your company"} · Powered by AskMira
      </p>
    </div>
  );
}
