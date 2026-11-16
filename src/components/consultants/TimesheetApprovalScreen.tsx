"use client";

import { Building2, CheckCircle2 } from "lucide-react";
import React, { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, get, post } from "@/lib/api";
import { formatDate } from "@/lib/utils";

type Described = {
  state: "waiting" | "decided" | "changed" | "expired";
  company: string;
  consultant_name: string;
  week_start: string;
  days: { date: string; project: string | null; task: string | null; hours: string }[];
  total_hours: string;
};

type Choice = "approve" | "reject";

const NEUTRAL = "This link can no longer be used.";

const CLOSED: Record<string, string> = {
  decided: "This timesheet has already been answered. Thank you.",
  changed: "This timesheet was changed after the link was sent, so this link no longer applies.",
  expired: "This link has expired.",
};

/**
 * The page a timesheet email's Approve / Reject button opens. No sign-in: the
 * link names one week for one consultant. Hours only, never a rate or amount.
 * `preselected` only highlights a choice; nothing is sent until Confirm.
 */
export function TimesheetApprovalScreen({
  token,
  preselected,
}: {
  token: string;
  preselected: Choice | null;
}) {
  const base = `/public/timesheets/${encodeURIComponent(token)}`;
  const [described, setDescribed] = useState<Described | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [choice, setChoice] = useState<Choice | null>(preselected);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Choice | null>(null);
  const [gone, setGone] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<Described>(base, { skipAuthRedirect: true })
      .then((data) => {
        if (!cancelled) setDescribed(data);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setProblem(
          caught instanceof ApiError && caught.status === 404
            ? "This link isn't valid."
            : "This link could not be opened. Check your connection and try again.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  const confirm = async () => {
    if (busy || !choice) return;
    const text = reason.trim();
    if (choice === "reject" && !text) {
      setError("Please say why you are rejecting this timesheet.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await post(
        `${base}/decision`,
        { approve: choice === "approve", reason: choice === "reject" ? text : null },
        { skipAuthRedirect: true },
      );
      setDone(choice);
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 409 || caught.status === 410)) {
        try {
          const fresh = await get<Described>(base, { skipAuthRedirect: true });
          if (fresh.state === "waiting") setGone(NEUTRAL);
          else setDescribed(fresh);
        } catch {
          setGone(NEUTRAL);
        }
      } else if (caught instanceof ApiError && caught.status === 404) {
        setGone("This link isn't valid.");
      } else {
        setError(
          caught instanceof ApiError && caught.status === 422
            ? caught.detail
            : "That did not go through. Check your connection and try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const closed = described ? CLOSED[described.state] : undefined;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex justify-center">
        <span className="flex items-center gap-2 font-display text-lg font-semibold text-primary">
          <Building2 className="size-5" />
          {described?.company || "AskMiraa"}
        </span>
      </div>

      <Card tier="tier2">
        {!described && !problem ? (
          <CardContent className="space-y-3 py-6">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        ) : !described ? (
          <CardContent className="py-6 text-sm text-foreground">{problem}</CardContent>
        ) : gone ? (
          <CardContent className="py-6 text-sm text-foreground">{gone}</CardContent>
        ) : done ? (
          <CardContent className="flex items-center gap-2 py-6 text-sm text-foreground">
            <CheckCircle2 className="size-5 shrink-0 text-primary" />
            {done === "approve"
              ? "Thank you. You approved this timesheet."
              : "Thank you. You rejected this timesheet and your reason has been sent."}
          </CardContent>
        ) : closed ? (
          <CardContent className="py-6 text-sm text-foreground">{closed}</CardContent>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="font-display text-xl">
                Timesheet for {described.consultant_name}
              </CardTitle>
              <CardDescription>Week of {formatDate(described.week_start)}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Day</th>
                      <th className="px-3 py-2 font-medium">Project</th>
                      <th className="px-3 py-2 text-right font-medium">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {described.days.map((day, index) => (
                      <tr key={index} className="border-t border-border">
                        <td className="whitespace-nowrap px-3 py-2">{formatDate(day.date)}</td>
                        <td className="px-3 py-2">
                          {day.project ?? "No project"}
                          {day.task ? ` · ${day.task}` : ""}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{day.hours}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border font-medium">
                      <td className="px-3 py-2" colSpan={2}>
                        Total hours
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{described.total_hours}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={choice === "approve" ? "default" : "outline"}
                  aria-pressed={choice === "approve"}
                  onClick={() => {
                    setChoice("approve");
                    setError(null);
                  }}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  variant={choice === "reject" ? "destructive" : "outline"}
                  aria-pressed={choice === "reject"}
                  onClick={() => {
                    setChoice("reject");
                    setError(null);
                  }}
                >
                  Reject
                </Button>
              </div>

              {choice === "reject" ? (
                <div className="grid gap-1.5">
                  <label htmlFor="timesheet-reason" className="text-sm font-medium">
                    Reason for rejecting
                  </label>
                  <Textarea
                    id="timesheet-reason"
                    value={reason}
                    maxLength={2000}
                    rows={3}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </div>
              ) : null}

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="button" disabled={!choice || busy} onClick={() => void confirm()}>
                {busy ? "Sending..." : "Confirm"}
              </Button>
            </CardContent>
          </>
        )}
      </Card>
      <p className="text-center text-xs text-muted-foreground">Powered by AskMiraa</p>
    </div>
  );
}
