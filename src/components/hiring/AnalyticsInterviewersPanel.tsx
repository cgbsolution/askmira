"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Info, MessageSquareText } from "lucide-react";
import React, { useMemo } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { DataPanel } from "@/components/common/DataPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { InterviewerReport, InterviewerSignal } from "@/lib/types/hiring";

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function deviationText({ deviation }: InterviewerSignal["severity"]): string | null {
  if (deviation == null) return null;
  return `${deviation > 0 ? "+" : ""}${deviation} rating points against peers`;
}

function turnaroundText({ median_days, slowest_days }: InterviewerSignal["turnaround"]): string | null {
  if (median_days == null) return null;
  return `Median ${median_days} days${slowest_days != null ? `, slowest ${slowest_days}` : ""}`;
}

function qualityText({ incoherent_count }: InterviewerSignal["feedback_quality"]): string | null {
  if (incoherent_count == null) return null;
  return `${incoherent_count} incoherent form${incoherent_count === 1 ? "" : "s"}`;
}

/** A cell's lines as one piece of text, for the search and the CSV. */
function lines(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(" · ");
}

/** No column sorts: ordering interviewers by these figures would rank them. */
const COLUMNS: ColumnDef<InterviewerSignal>[] = [
  {
    accessorKey: "name",
    header: "Interviewer",
    enableSorting: false,
    meta: { cellClassName: "font-medium text-foreground" },
  },
  {
    id: "interviews",
    header: "Interviews",
    accessorFn: (row) => row.severity.interviews,
    enableSorting: false,
    meta: { className: "text-right", cellClassName: "tabular-nums" },
  },
  {
    id: "severity",
    header: "Rating compared with peers",
    enableSorting: false,
    meta: {
      cellClassName: "max-w-72 whitespace-normal",
      text: ({ severity }) => lines(deviationText(severity), severity.reading, severity.note),
    },
    cell: ({ row }) => {
      const { severity } = row.original;
      const figure = deviationText(severity);
      return (
        <>
          {figure != null ? <p className="tabular-nums">{figure}</p> : null}
          {severity.reading && <Muted>{severity.reading}</Muted>}
          {severity.note && <Muted>{severity.note}</Muted>}
        </>
      );
    },
  },
  {
    id: "turnaround",
    header: "Feedback turnaround",
    enableSorting: false,
    meta: {
      cellClassName: "max-w-72 whitespace-normal",
      text: ({ turnaround }) => lines(turnaroundText(turnaround), turnaround.reading, turnaround.note),
    },
    cell: ({ row }) => {
      const { turnaround } = row.original;
      const figure = turnaroundText(turnaround);
      return (
        <>
          {figure != null && <p className="tabular-nums">{figure}</p>}
          {turnaround.reading && <Muted>{turnaround.reading}</Muted>}
          {turnaround.note && <Muted>{turnaround.note}</Muted>}
        </>
      );
    },
  },
  {
    id: "feedback_quality",
    header: "Feedback quality",
    enableSorting: false,
    meta: {
      cellClassName: "max-w-80 whitespace-normal",
      text: ({ feedback_quality: quality }) =>
        lines(qualityText(quality), quality.reading, quality.note, quality.proxy_caveat),
    },
    cell: ({ row }) => {
      const quality = row.original.feedback_quality;
      const figure = qualityText(quality);
      return (
        <>
          {figure != null && <p className="tabular-nums">{figure}</p>}
          {quality.reading && <Muted>{quality.reading}</Muted>}
          {quality.note && <Muted>{quality.note}</Muted>}
          {quality.proxy_caveat && (
            <p className="mt-1 text-xs italic text-muted-foreground">{quality.proxy_caveat}</p>
          )}
        </>
      );
    },
  },
];

/**
 * Interviewer coaching signals. Framed as coaching, listed alphabetically,
 * never ranked or sortable: a league table of interviewers is exactly the use
 * these numbers are not fit for.
 */
export function AnalyticsInterviewersPanel() {
  const { data, error, isLoading, reload } = useApiQuery<InterviewerReport>(
    "/recruiting/analytics/interviewers",
  );
  const rows = useMemo(
    () => [...(data?.interviewers ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [data],
  );

  return (
    <DataPanel
      title="Interviewer coaching signals"
      description={
        data ? (
          <span className="tabular-nums">
            {data.feedback_count} feedback forms read. A signal needs at least{" "}
            {data.minimum_interviews} interviews.
          </span>
        ) : undefined
      }
      isLoading={isLoading && !data}
      error={error?.detail}
      onRetry={reload}
    >
      {data && (
        <div className="grid gap-3 pb-2">
          <div className="px-5 pt-4">
            <Alert>
              <Info />
              <AlertDescription>
                <p className="text-foreground">{data.framing}</p>
              </AlertDescription>
            </Alert>
          </div>
          <DataTable
            columns={COLUMNS}
            data={rows}
            getRowId={(row) => row.interviewer_id}
            noun="interviewers"
            exportName="interviewer-coaching-signals"
            searchPlaceholder="Search interviewers"
            bordered={false}
            className="border-t border-border"
            rowClassName={() => "align-top"}
            empty={{ icon: MessageSquareText, title: "No interviewer feedback to read yet" }}
          />
        </div>
      )}
    </DataPanel>
  );
}
