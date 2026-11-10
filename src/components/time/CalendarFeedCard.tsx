"use client";

import {
  CalendarPlus,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Unlink,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, post } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

interface FeedStatus {
  active: boolean;
  include_team: boolean;
  created_at: string | null;
  last_used_at: string | null;
  has_team: boolean;
}

/**
 * Leave → Holidays → Add to my calendar: a private .ics link with the person's
 * holidays and approved leave (and, for a manager, who in the team is away).
 * The link is shown once — it is the credential — and a new one stops the old.
 */
export function CalendarFeedCard() {
  const status = useApiQuery<FeedStatus>("/me/calendar-feed");
  const [includeTeam, setIncludeTeam] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  const make = async () => {
    setBusy(true);
    try {
      const made = await post<FeedStatus & { path: string }>(
        "/me/calendar-feed",
        {
          include_team: includeTeam,
        },
      );
      setLink(`${window.location.origin}${made.path}`);
      setCopied(false);
      toast.success(
        status.data?.active
          ? "New link made. The old one has stopped working."
          : "Calendar link made",
      );
      status.reload();
    } catch (caught) {
      toast.error(
        caught instanceof ApiError ? caught.detail : "Could not make the link.",
      );
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    try {
      await del("/me/calendar-feed");
      setLink(null);
      toast.success("Calendar link turned off");
      status.reload();
    } catch (caught) {
      toast.error(
        caught instanceof ApiError
          ? caught.detail
          : "Could not turn the link off.",
      );
      throw caught;
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      toast.error("Could not copy. Select the link and copy it by hand.");
    }
  };

  let body: React.ReactNode;
  if (status.isLoading && !status.data) {
    body = <Skeleton className="h-20 w-full" />;
  } else if (status.error) {
    body = (
      <ErrorState
        message={status.error.detail}
        onRetry={status.reload}
        className="py-6"
      />
    );
  } else {
    const data = status.data;
    body = (
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {data?.active ? (
            <Badge variant="success">On</Badge>
          ) : (
            <Badge variant="outline">Off</Badge>
          )}
          {data?.active && (
            <span className="text-muted-foreground">
              Made {formatDateTime(data.created_at)}
              {data.include_team ? " · includes your team" : ""}
              {data.last_used_at
                ? ` · last read by your calendar ${formatDateTime(data.last_used_at)}`
                : ""}
            </span>
          )}
        </div>

        {link && (
          <div className="grid gap-2">
            <Label htmlFor="calendar-feed-link">
              Your link (shown only now)
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="calendar-feed-link"
                readOnly
                value={link}
                className="font-mono text-xs"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button variant="outline" onClick={() => void copy()}>
                {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>
                Google Calendar: Other calendars → + → From URL → paste the
                link.
              </li>
              <li>
                Outlook: Add calendar → Subscribe from web → paste the link.
              </li>
              <li>
                iPhone / Mac: Calendar → File → New calendar subscription →
                paste the link.
              </li>
            </ul>
            <p className="text-xs text-muted-foreground">
              Anyone with this link can see these dates, so keep it to yourself.
              Calendar apps refresh it every few hours.
            </p>
          </div>
        )}

        {data?.has_team && (
          <div className="flex items-center justify-between gap-4">
            <div className="grid gap-0.5">
              <Label htmlFor="calendar-feed-team">Include my team</Label>
              <p className="text-sm text-muted-foreground">
                Your direct reports&apos; approved leave, shown as &ldquo;on
                leave&rdquo; without the type.
              </p>
            </div>
            <Switch
              id="calendar-feed-team"
              checked={includeTeam}
              onCheckedChange={setIncludeTeam}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void make()} disabled={busy}>
            {busy ? (
              <Loader2 className="animate-spin" />
            ) : data?.active ? (
              <RefreshCw />
            ) : (
              <CalendarPlus />
            )}
            {data?.active ? "Make a new link" : "Make my calendar link"}
          </Button>
          {data?.active && (
            <Button
              variant="outline"
              onClick={() => setConfirmOff(true)}
              disabled={busy}
            >
              <Unlink /> Turn off
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarPlus className="size-4" /> Add to my calendar
        </CardTitle>
        <CardDescription>
          Your holidays and approved leave in Google Calendar, Outlook or Apple
          Calendar, kept up to date.
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title="Turn off your calendar link?"
        description="Calendars subscribed to it stop getting updates. You can make a new link at any time."
        confirmLabel="Turn off"
        onConfirm={turnOff}
      />
    </Card>
  );
}
