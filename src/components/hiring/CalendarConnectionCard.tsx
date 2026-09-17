"use client";

import { CalendarCheck, Link2, Loader2, Unlink } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { formatDateTime, humanize } from "@/components/hiring/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import type { CalendarStatus } from "@/lib/types/hiring";

type ProviderRow = CalendarStatus["providers"][number];

/**
 * The signed-in person's own calendar connections.
 *
 * Also finishes the OAuth round trip: when the provider sends the browser back
 * here with `?code=&state=&provider=`, the code is exchanged once and the URL is
 * cleaned. A calendar is only ever shown as connected when the API says so.
 * Must render inside a Suspense boundary (it reads the search params).
 */
export function CalendarConnectionCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = useApiQuery<CalendarStatus>("/interviews/calendar/status");
  const reloadStatus = status.reload;
  const handled = useRef(false);
  const [finishing, setFinishing] = useState(false);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState<Record<string, string>>({});
  const [disconnecting, setDisconnecting] = useState<ProviderRow | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const provider = searchParams.get("provider");
    if (handled.current || (!code && !state)) return;
    handled.current = true;
    if (!code || !state || !provider) {
      toast.error("The calendar sign-in came back incomplete, so nothing was connected. Try connecting again.");
      router.replace("/hiring/interviews");
      return;
    }
    setFinishing(true);
    post(`/interviews/calendar/${encodeURIComponent(provider)}/callback`, { code, state })
      .then(() => toast.success(`${humanize(provider)} calendar connection saved`))
      .catch((error) =>
        toast.error(error instanceof ApiError ? error.detail : "The calendar could not be connected."),
      )
      .finally(() => {
        setFinishing(false);
        router.replace("/hiring/interviews");
        reloadStatus();
      });
  }, [searchParams, router, reloadStatus]);

  const connect = async (provider: string) => {
    setBusyProvider(provider);
    try {
      const result = await post<{ authorization_url: string }>(
        `/interviews/calendar/${encodeURIComponent(provider)}/authorize`,
      );
      if (typeof result?.authorization_url === "string" && result.authorization_url.startsWith("https://")) {
        window.location.assign(result.authorization_url);
        return;
      }
      toast.error("The sign-in address from the server is not a secure https address, so it was not opened.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setNotConfigured((current) => ({ ...current, [provider]: error.detail }));
      } else {
        toast.error(error instanceof ApiError ? error.detail : "Could not start the calendar sign-in.");
      }
    } finally {
      setBusyProvider(null);
    }
  };

  const disconnect = async (provider: string) => {
    try {
      await post(`/interviews/calendar/${encodeURIComponent(provider)}/disconnect`);
      toast.success(`${humanize(provider)} calendar disconnected`);
      reloadStatus();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not disconnect the calendar.");
      throw error;
    }
  };

  let body: React.ReactNode;
  if (status.isLoading && !status.data) {
    body = <Skeleton className="h-16 w-full" />;
  } else if (status.error) {
    body = <ErrorState message={status.error.detail} onRetry={status.reload} className="py-6" />;
  } else if (!status.data || status.data.providers.length === 0) {
    body = <p className="text-sm text-muted-foreground">No calendar providers are available in this workspace.</p>;
  } else {
    body = (
      <ul className="divide-y divide-border">
        {status.data.providers.map((row) => (
          <li key={row.provider} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{humanize(row.provider)}</span>
                {row.connected ? (
                  <Badge variant="success">Connected</Badge>
                ) : (
                  <Badge variant="outline">Not connected</Badge>
                )}
                {!row.configured && <Badge variant="muted">Not configured</Badge>}
                {row.token_expired && <Badge variant="warning">Sign-in expired</Badge>}
              </div>
              {row.account_email && (
                <p className="text-xs text-muted-foreground">Account: {row.account_email}</p>
              )}
              {row.expires_at && (
                <p className="text-xs text-muted-foreground">
                  Access expires {formatDateTime(row.expires_at)}
                </p>
              )}
              <p className="text-sm text-muted-foreground">{row.message}</p>
              {row.last_error && (
                <p className="text-sm text-destructive">Last error: {row.last_error}</p>
              )}
              {notConfigured[row.provider] && (
                <p className="text-sm text-destructive">
                  Not configured: {notConfigured[row.provider]}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {row.connected ? (
                <Button variant="outline" size="sm" onClick={() => setDisconnecting(row)}>
                  <Unlink /> Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={busyProvider !== null || finishing}
                  onClick={() => void connect(row.provider)}
                >
                  {busyProvider === row.provider ? <Loader2 className="animate-spin" /> : <Link2 />}
                  {row.token_expired ? "Reconnect" : "Connect"}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card tier="tier1" className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="size-4" /> Your calendar
        </CardTitle>
        <CardDescription>
          {finishing ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" /> Finishing the calendar sign-in…
            </span>
          ) : (
            (status.data?.note ??
            "Connecting your calendar lets scheduling check when you are free.")
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
      <ConfirmDialog
        open={disconnecting !== null}
        onOpenChange={(next) => !next && setDisconnecting(null)}
        title={`Disconnect ${humanize(disconnecting?.provider)}?`}
        description="Scheduling will no longer be able to read your free and busy times from this calendar."
        confirmLabel="Disconnect"
        destructive
        onConfirm={() => (disconnecting ? disconnect(disconnecting.provider) : undefined)}
      />
    </Card>
  );
}
