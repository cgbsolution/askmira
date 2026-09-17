"use client";

import { Info, MessageSquareText } from "lucide-react";
import React, { useMemo } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { InterviewerReport } from "@/lib/types/hiring";

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

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
          {rows.length === 0 ? (
            <div className="flex items-center gap-2 px-5 pb-3 text-sm text-muted-foreground">
              <MessageSquareText className="size-4" /> No interviewer feedback to read yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Interviewer</TableHead>
                    <TableHead className="text-right">Interviews</TableHead>
                    <TableHead>Rating compared with peers</TableHead>
                    <TableHead>Feedback turnaround</TableHead>
                    <TableHead>Feedback quality</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.interviewer_id} className="align-top">
                      <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.severity.interviews}
                      </TableCell>
                      <TableCell className="max-w-72 whitespace-normal">
                        {row.severity.deviation != null ? (
                          <p className="tabular-nums">
                            {row.severity.deviation > 0 ? "+" : ""}
                            {row.severity.deviation} rating points against peers
                          </p>
                        ) : null}
                        {row.severity.reading && <Muted>{row.severity.reading}</Muted>}
                        {row.severity.note && <Muted>{row.severity.note}</Muted>}
                      </TableCell>
                      <TableCell className="max-w-72 whitespace-normal">
                        {row.turnaround.median_days != null && (
                          <p className="tabular-nums">
                            Median {row.turnaround.median_days} days
                            {row.turnaround.slowest_days != null &&
                              `, slowest ${row.turnaround.slowest_days}`}
                          </p>
                        )}
                        {row.turnaround.reading && <Muted>{row.turnaround.reading}</Muted>}
                        {row.turnaround.note && <Muted>{row.turnaround.note}</Muted>}
                      </TableCell>
                      <TableCell className="max-w-80 whitespace-normal">
                        {row.feedback_quality.incoherent_count != null && (
                          <p className="tabular-nums">
                            {row.feedback_quality.incoherent_count} incoherent form
                            {row.feedback_quality.incoherent_count === 1 ? "" : "s"}
                          </p>
                        )}
                        {row.feedback_quality.reading && (
                          <Muted>{row.feedback_quality.reading}</Muted>
                        )}
                        {row.feedback_quality.note && <Muted>{row.feedback_quality.note}</Muted>}
                        {row.feedback_quality.proxy_caveat && (
                          <p className="mt-1 text-xs italic text-muted-foreground">
                            {row.feedback_quality.proxy_caveat}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </DataPanel>
  );
}
