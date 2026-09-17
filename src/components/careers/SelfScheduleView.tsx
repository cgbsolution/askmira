"use client";

import { CalendarCheck2, CalendarX2, ExternalLink, Loader2, SearchX } from "lucide-react";
import React, { useState } from "react";

import { PublicMessage } from "@/components/careers/PublicMessage";
import { usePublicQuery } from "@/components/careers/usePublicQuery";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { INTERVIEW_MODE, formatLocalWallClock, safeHref } from "@/components/hiring/labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, post } from "@/lib/api";
import type { BookingResult, InterviewMode, SelfScheduleView as View } from "@/lib/types/hiring";
import { formatDate } from "@/lib/utils";

/** Time part only ("3:30 pm") of a wall-clock ISO string, for the end of a slot. */
function wallClockTime(value: string | null): string | null {
  if (!value) return null;
  const match = /T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(2000, 0, 1, Number(match[1]), Number(match[2]));
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(date);
}

/** The confirmed booking: when, where, and the join link when there is a safe one. */
function Confirmation({
  organisation,
  stageName,
  startLocal,
  timezone,
  mode,
  joinUrl,
}: {
  organisation: string;
  stageName: string;
  startLocal: string;
  timezone: string;
  mode: InterviewMode | null;
  joinUrl: string | null;
}) {
  const link = safeHref(joinUrl);
  return (
    <Card tier="tier2" className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck2 className="size-5 text-mint-700" /> Your interview is booked
        </CardTitle>
        <CardDescription>
          {stageName} with {organisation}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-base font-medium text-foreground tabular-nums">
          {formatLocalWallClock(startLocal)}{" "}
          <span className="text-sm font-normal text-muted-foreground">({timezone})</span>
        </p>
        {mode && <p className="text-sm text-muted-foreground">{INTERVIEW_MODE[mode]}</p>}
        {link && (
          <Button asChild size="sm">
            <a href={link} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Join link
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Candidate self-scheduling: pick one of the offered slots, then confirm. */
export function SelfScheduleView({ token }: { token: string }) {
  const path = `/public/interviews/self-schedule/${encodeURIComponent(token)}`;
  const { data, error, isLoading, reload } = usePublicQuery<View>(path);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingResult | null>(null);

  if (isLoading && !data) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error && !data) {
    if (error.status === 404 || error.status === 410) {
      return (
        <PublicMessage
          icon={error.status === 410 ? CalendarX2 : SearchX}
          title={error.status === 410 ? "This scheduling link has expired" : "This link is not valid"}
          detail={error.detail}
        />
      );
    }
    return <ErrorState message={error.detail} onRetry={reload} />;
  }

  if (!data) return null;

  if (booking) {
    return (
      <Confirmation
        organisation={data.organisation}
        stageName={data.stage_name}
        startLocal={booking.start_local}
        timezone={booking.timezone}
        mode={data.mode}
        joinUrl={booking.join_url}
      />
    );
  }

  if (data.booked) {
    return (
      <Confirmation
        organisation={data.organisation}
        stageName={data.stage_name}
        startLocal={data.booked.start_local}
        timezone={data.booked.timezone}
        mode={data.booked.mode}
        joinUrl={data.booked.join_url}
      />
    );
  }

  if (data.expired) {
    return (
      <PublicMessage
        icon={CalendarX2}
        title="This scheduling link has expired"
        detail={`The link expired on ${formatDate(data.expires_at)}. Please contact the ${data.organisation} recruiting team for a new one.`}
      />
    );
  }

  async function confirm() {
    if (!selected) return;
    setServerError(null);
    setPending(true);
    try {
      const result = await post<BookingResult>(path, { slot_start: selected }, { skipAuthRedirect: true });
      setBooking(result);
    } catch (caught) {
      setServerError(
        caught instanceof ApiError ? caught.detail : "The slot could not be booked. Please try again.",
      );
      if (caught instanceof ApiError && (caught.status === 409 || caught.status === 410)) {
        setSelected(null);
        reload();
      }
    } finally {
      setPending(false);
    }
  }

  const available = data.slots.filter((slot) => !slot.in_past);

  return (
    <Card tier="tier2" className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="text-xl">Choose a time for your interview</CardTitle>
        <CardDescription>
          {data.stage_name} with {data.organisation}
          {data.duration_minutes ? ` · ${data.duration_minutes} minutes` : ""}
          {data.mode ? ` · ${INTERVIEW_MODE[data.mode]}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Times are shown in {data.timezone}. Choose a slot before {formatDate(data.expires_at)}.
        </p>
        {data.preparation_notes && (
          <div className="rounded-md bg-muted/50 p-3 text-sm text-foreground">
            <p className="mb-1 text-xs font-medium text-muted-foreground">How to prepare</p>
            <p className="whitespace-pre-line">{data.preparation_notes}</p>
          </div>
        )}

        {available.length === 0 ? (
          <EmptyState
            tier="tier2"
            icon={CalendarX2}
            title="No open slots remain"
            description={`Every offered time has passed. Please contact the ${data.organisation} recruiting team.`}
            className="py-6"
          />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Available slots">
            {data.slots.map((slot) => {
              const end = wallClockTime(slot.end_local);
              const isSelected = selected === slot.start;
              return (
                <li key={slot.start}>
                  <Button
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    disabled={slot.in_past || pending}
                    aria-pressed={isSelected}
                    onClick={() => setSelected(slot.start)}
                    className="h-auto w-full justify-start py-2.5 text-left tabular-nums"
                  >
                    {formatLocalWallClock(slot.start_local)}
                    {end ? ` – ${end}` : ""}
                    {slot.in_past ? " (passed)" : ""}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {serverError && (
          <Alert variant="destructive">
            <AlertTitle>Not booked</AlertTitle>
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        {available.length > 0 && (
          <Button variant="accent" disabled={!selected || pending} onClick={confirm}>
            {pending && <Loader2 className="animate-spin" />}
            Confirm this time
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
