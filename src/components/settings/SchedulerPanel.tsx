"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AlarmClock, CircleAlert, CirclePlay, Info, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { SchedulerJob, SchedulerJobs } from "@/lib/types/admin";

import { errorDetail, formatDateTime } from "./settingsShared";

/**
 * The background jobs.
 *
 * "The nightly attendance recompute runs" is a claim, and a claim about work
 * nobody watches is the one that quietly stops being true. So this screen
 * names the function each job calls, when it last ran, when it last *succeeded*
 * — which is a different date once something starts failing — and whether the
 * runner is switched on in this deployment at all.
 */
export function SchedulerPanel() {
  const { hasRole } = useAuth();
  const canRunNow = hasRole("admin");
  const { data, error, isLoading, reload } = useApiQuery<SchedulerJobs>("/admin/scheduler/jobs");
  const [running, setRunning] = useState<string | null>(null);

  const runNow = async (job: SchedulerJob) => {
    setRunning(job.key);
    try {
      await post(`/admin/scheduler/jobs/${job.key}/run`);
      toast.success(`${job.name} ran for this workspace.`);
      reload();
    } catch (caught) {
      toast.error(errorDetail(caught, "The job did not run."));
    } finally {
      setRunning(null);
    }
  };

  const jobs = data?.jobs ?? [];
  const runner = data?.runner;
  const failing = jobs.filter((job) => job.failures_last_7_days > 0);

  const runColumn: ColumnDef<SchedulerJob> = {
    id: "actions",
    header: "Run now",
    enableHiding: false,
    meta: { className: "text-right", text: false },
    cell: ({ row: { original: job } }) => (
      <Button
        variant="outline"
        size="sm"
        disabled={!job.can_run_now || !job.applies || running !== null}
        onClick={() => runNow(job)}
      >
        {running === job.key ? (
          <Loader2 className="animate-spin" />
        ) : (
          <CirclePlay />
        )}
        Run
      </Button>
    ),
  };

  const columns: ColumnDef<SchedulerJob>[] = [
    {
      accessorKey: "name",
      header: "Job",
      meta: { cellClassName: "min-w-72 whitespace-normal" },
      cell: ({ row: { original: job } }) => (
        <>
          <div className="font-medium text-foreground">{job.name}</div>
          <div className="text-xs text-muted-foreground">{job.description}</div>
          <Tooltip>
            <TooltipTrigger asChild>
              <code className="mt-1 inline-block font-mono text-[11px] text-muted-foreground">
                {job.source}
              </code>
            </TooltipTrigger>
            <TooltipContent>
              The function this job actually calls, so the claim is checkable.
            </TooltipContent>
          </Tooltip>
          {!job.applies && (
            <Badge variant="outline" className="mt-1">
              {job.module} is switched off
            </Badge>
          )}
        </>
      ),
    },
    {
      accessorKey: "cadence",
      header: "Runs",
      meta: { cellClassName: "text-sm text-muted-foreground" },
    },
    {
      id: "last_run",
      header: "Last run",
      accessorFn: (job) => job.last_run?.started_at ?? "",
      meta: {
        cellClassName: "w-64 whitespace-normal",
        text: (job) =>
          job.last_run ? `${job.last_run.status} ${formatDateTime(job.last_run.started_at)}` : "Never",
      },
      cell: ({ row: { original: job } }) => (
        <>
          <RunCell run={job.last_run} />
          {job.failures_last_7_days > 0 && (
            <Badge variant="outline" className="mt-1">
              {job.failures_last_7_days} failure
              {job.failures_last_7_days === 1 ? "" : "s"} this week
            </Badge>
          )}
        </>
      ),
    },
    {
      id: "last_success",
      header: "Last success",
      accessorFn: (job) => job.last_success?.started_at ?? "",
      meta: {
        cellClassName: "text-xs text-muted-foreground",
        text: (job) => (job.last_success ? formatDateTime(job.last_success.started_at) : "Never"),
      },
      cell: ({ row: { original: job } }) =>
        job.last_success ? formatDateTime(job.last_success.started_at) : "Never",
    },
    ...(canRunNow ? [runColumn] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      {runner && !runner.enabled && (
        <Alert>
          <CircleAlert />
          <AlertTitle>The scheduler is switched off in this deployment</AlertTitle>
          <AlertDescription>
            Nothing below runs on its own. Accruals, recomputes, reminders and digests happen only
            when somebody runs them by hand from this screen.
          </AlertDescription>
        </Alert>
      )}

      {failing.length > 0 && (
        <Alert>
          <CircleAlert />
          <AlertTitle>
            {failing.length} job{failing.length === 1 ? " has" : "s have"} failed in the last seven
            days
          </AlertTitle>
          <AlertDescription>
            {failing.map((job) => job.name).join(", ")}. A job that fails silently is worse than
            one that was never scheduled — the last failure is shown against each row.
          </AlertDescription>
        </Alert>
      )}

      <DataTable
        title="Background jobs"
        description={data?.note}
        actions={
          runner ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={runner.enabled ? "secondary" : "outline"}>
                {runner.enabled ? "Scheduler on" : "Scheduler off"}
              </Badge>
              {runner.this_instance_is_leader && <Badge variant="outline">This instance leads</Badge>}
              {runner.last_tick_at && <span>Last tick {formatDateTime(runner.last_tick_at)}</span>}
            </div>
          ) : undefined
        }
        columns={columns}
        data={jobs}
        getRowId={(job) => job.key}
        noun="jobs"
        exportName="background-jobs"
        searchPlaceholder="Search jobs"
        rowClassName={(job) => (job.applies ? undefined : "opacity-60")}
        isLoading={isLoading && !data}
        error={error?.detail ?? null}
        onRetry={reload}
        empty={{ icon: AlarmClock, title: "No jobs registered" }}
      />

      {data && data.not_yet_registered.length > 0 && (
        <Alert>
          <Info />
          <AlertTitle>Scheduled work that has no job yet</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {data.not_yet_registered.map((item) => (
                <li key={item.requirement}>
                  <span className="font-medium text-foreground">{item.requirement}</span> —{" "}
                  {item.reason}
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Named here rather than left out, so nobody assumes it is running.
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/**
 * A run's result as one line: `{date: "2026-09-29", days_written: 3}` reads
 * "Date 2026-09-29 · Days written 3". Null when the job returned nothing.
 */
function describeDetail(detail: Record<string, unknown> | null | undefined): string | null {
  const parts = Object.entries(detail ?? {}).map(([key, value]) => {
    const label = key.replaceAll("_", " ");
    const shown = value !== null && typeof value === "object" ? JSON.stringify(value) : String(value);
    return `${label.charAt(0).toUpperCase()}${label.slice(1)} ${shown}`;
  });
  return parts.length > 0 ? parts.join(" · ") : null;
}

function RunCell({ run }: { run: SchedulerJob["last_run"] }) {
  if (!run) return <span className="text-xs text-muted-foreground">Never</span>;
  const detail = describeDetail(run.detail);
  return (
    <div>
      <Badge variant={run.status === "succeeded" ? "secondary" : "outline"}>{run.status}</Badge>
      <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(run.started_at)}</div>
      {run.error && <div className="mt-1 text-xs text-destructive">{run.error}</div>}
      {!run.error && detail && <div className="mt-1 text-xs text-muted-foreground">{detail}</div>}
    </div>
  );
}
