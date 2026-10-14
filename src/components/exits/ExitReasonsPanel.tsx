"use client";

import { MessageSquareQuote } from "lucide-react";
import React from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { EXIT_REASONS } from "@/components/exits/ExitInterviewPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";

interface Summary {
  from: string;
  to: string;
  interviews: number;
  withheld: boolean;
  note?: string;
  primary_reasons?: Array<{ reason: string; count: number }>;
  ratings?: Record<string, { average: number; answers: number } | null>;
  would_recommend_percent?: string | null;
  would_return_percent?: string | null;
}

const RATING_LABEL: Record<string, string> = {
  manager: "Manager",
  growth: "Growth",
  compensation: "Pay",
  culture: "Culture",
  work_life: "Work-life balance",
};

function isoDaysAgo(days: number): string {
  const day = new Date(Date.now() - days * 86_400_000);
  return day.toISOString().slice(0, 10);
}

/** Why people left in the last twelve months, from their exit interviews. HR only. */
export function ExitReasonsPanel() {
  const { data, error, isLoading, reload } = useApiQuery<Summary>(
    `/exits/interviews/summary?start=${isoDaysAgo(365)}&end=${isoDaysAgo(0)}`,
  );

  return (
    <DataPanel
      tier="tier1"
      title="Why people leave"
      description={data ? `${data.interviews} exit interview(s) in the last twelve months.` : undefined}
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
      isEmpty={data !== null && data !== undefined && data.interviews === 0}
      empty={{ icon: MessageSquareQuote, title: "No exit interviews yet", description: "They appear here once leavers or HR record them." }}
    >
      {data?.withheld ? (
        <div className="p-5">
          <Alert>
            <AlertDescription>{data.note}</AlertDescription>
          </Alert>
        </div>
      ) : data ? (
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Main reason</TableHead>
                <TableHead className="text-right">Leavers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.primary_reasons ?? []).map((row) => (
                <TableRow key={row.reason}>
                  <TableCell>{EXIT_REASONS[row.reason] ?? row.reason}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="grid content-start gap-2 text-sm">
            {Object.entries(data.ratings ?? {}).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{RATING_LABEL[key] ?? key}</span>
                <span className="tabular-nums">
                  {value ? `${value.average} / 5 (${value.answers})` : "No ratings"}
                </span>
              </div>
            ))}
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Would recommend</span>
              <span className="tabular-nums">{data.would_recommend_percent ? `${data.would_recommend_percent}%` : "—"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Would come back</span>
              <span className="tabular-nums">{data.would_return_percent ? `${data.would_return_percent}%` : "—"}</span>
            </div>
          </div>
        </div>
      ) : null}
    </DataPanel>
  );
}
