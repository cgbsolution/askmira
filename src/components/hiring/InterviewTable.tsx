"use client";

import React from "react";

import {
  formatDateTime,
  INTERVIEW_MODE,
  INTERVIEW_STATUS,
  PANEL_RESPONSE,
  StatusBadge,
} from "@/components/hiring/labels";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InterviewListItem } from "@/lib/types/hiring";

/** A time in a named zone; an unknown zone name falls back to saying so rather than crashing. */
function inZone(value: string, timeZone: string): string {
  try {
    return formatDateTime(value, timeZone);
  } catch {
    return "unknown time zone";
  }
}

/**
 * When an interview happens: in the viewer's own zone, and in the candidate's
 * when that is a different zone.
 */
export function InterviewWhen({
  start,
  candidateTimezone,
}: {
  start: string;
  candidateTimezone: string;
}) {
  const viewerZone =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
  return (
    <div className="tabular-nums">
      <p className="text-foreground">{formatDateTime(start)}</p>
      {candidateTimezone && candidateTimezone !== viewerZone && (
        <p className="text-xs text-muted-foreground">
          Candidate: {inZone(start, candidateTimezone)} ({candidateTimezone})
        </p>
      )}
      {candidateTimezone && candidateTimezone === viewerZone && (
        <p className="text-xs text-muted-foreground">Candidate is also on {candidateTimezone}</p>
      )}
    </div>
  );
}

/** Interview rows. Clicking a row opens it. */
export function InterviewTable({
  rows,
  onOpen,
}: {
  rows: InterviewListItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Candidate</TableHead>
            <TableHead>Round</TableHead>
            <TableHead>Requisition</TableHead>
            <TableHead>When</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>My response</TableHead>
            <TableHead>Panel</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const accepted = row.panel.filter((member) => member.response === "accepted").length;
            const submitted = row.panel.filter((member) => member.feedback_submitted).length;
            return (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() => onOpen(row.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(row.id);
                  }
                }}
              >
                <TableCell className="font-medium text-foreground">{row.candidate_name}</TableCell>
                <TableCell>{row.stage_name}</TableCell>
                <TableCell>
                  <span className="font-mono text-xs">{row.requisition_code}</span>
                  <p className="text-xs text-muted-foreground">{row.requisition_title}</p>
                </TableCell>
                <TableCell>
                  <InterviewWhen start={row.scheduled_start} candidateTimezone={row.candidate_timezone} />
                </TableCell>
                <TableCell>{INTERVIEW_MODE[row.mode] ?? row.mode}</TableCell>
                <TableCell>
                  <StatusBadge map={INTERVIEW_STATUS} value={row.status} />
                </TableCell>
                <TableCell>
                  {row.my_response ? (
                    <StatusBadge map={PANEL_RESPONSE} value={row.my_response} />
                  ) : (
                    <span className="text-xs text-muted-foreground">Not on panel</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {row.panel.length === 0
                    ? "No panel"
                    : `${row.panel.length} on panel · ${accepted} accepted · ${submitted} feedback in`}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
