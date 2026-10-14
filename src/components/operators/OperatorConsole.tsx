"use client";

import { Building2, Loader2, LogIn } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageShell } from "@/components/common/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface ClientWork {
  grant_id: string;
  client: string;
  client_workspace: string;
  scopes: string[];
  expires_at: string;
  work: {
    period: string;
    runs_this_month: { id: string; status: string; employees: number }[];
    no_run_yet: boolean;
    open_runs: number;
    pending_adjustments: number;
  };
}

/**
 * Client workspaces — the payroll bureau's queue (PAY-09).
 *
 * Every client that granted you access, and what its payroll is waiting on this
 * month. Entering one switches this browser into that workspace for payroll
 * work; the banner at the top takes you back.
 */
export function OperatorConsole() {
  const { data, error, isLoading, reload } = useApiQuery<ClientWork[]>("/operator/clients");
  const [busy, setBusy] = useState<string | null>(null);

  const enter = async (row: ClientWork) => {
    setBusy(row.grant_id);
    try {
      await post(`/operator/clients/${row.grant_id}/enter`);
      window.location.assign("/payroll");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not open that workspace.");
      setBusy(null);
    }
  };

  return (
    <PageShell
      title="Client workspaces"
      description="Clients who granted you access to run their payroll, and what each is waiting on this month."
      icon={Building2}
    >
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : error ? (
        <ErrorState message={error.detail} onRetry={reload} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No client has granted you access"
          description="A client's admin grants it in their AskMira settings, naming your workspace and email."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(data ?? []).map((row) => (
            <Card key={row.grant_id}>
              <CardHeader>
                <CardTitle>{row.client}</CardTitle>
                <CardDescription>
                  {row.client_workspace} · access until {formatDate(row.expires_at)}
                </CardDescription>
                <CardAction>
                  <Button size="sm" onClick={() => void enter(row)} disabled={busy !== null}>
                    {busy === row.grant_id ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                    Open
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {row.work.no_run_yet ? (
                  <Badge variant="destructive">No payroll run for {row.work.period}</Badge>
                ) : (
                  row.work.runs_this_month.map((run) => (
                    <Badge key={run.id} variant={run.status === "paid" ? "secondary" : "outline"}>
                      {row.work.period}: {run.status.replaceAll("_", " ")} · {run.employees} people
                    </Badge>
                  ))
                )}
                {row.work.pending_adjustments > 0 ? (
                  <Badge variant="outline">{row.work.pending_adjustments} adjustments to approve</Badge>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
