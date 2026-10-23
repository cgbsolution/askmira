"use client";

import type { ColumnDef } from "@tanstack/react-table";
import React from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import {
  formatDateTime,
  humanize,
  INTERVIEW_MODE,
  INTERVIEW_STATUS,
  PANEL_RESPONSE,
  StatusBadge,
} from "@/components/hiring/labels";
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

/** A status as its badge reads, for the search and the CSV. */
function statusLabel<K extends string>(map: Record<K, [string, unknown]>, value: K): string {
  return map[value]?.[0] ?? humanize(value);
}

/** "3 on panel · 2 accepted · 1 feedback in", or "No panel". */
function panelSummary(row: InterviewListItem): string {
  const accepted = row.panel.filter((member) => member.response === "accepted").length;
  const submitted = row.panel.filter((member) => member.feedback_submitted).length;
  return row.panel.length === 0
    ? "No panel"
    : `${row.panel.length} on panel · ${accepted} accepted · ${submitted} feedback in`;
}

const COLUMNS: ColumnDef<InterviewListItem>[] = [
  { accessorKey: "candidate_name", header: "Candidate", meta: { cellClassName: "font-medium text-foreground" } },
  { accessorKey: "stage_name", header: "Round" },
  {
    accessorKey: "requisition_code",
    header: "Requisition",
    meta: { text: (row) => `${row.requisition_code} ${row.requisition_title}` },
    cell: ({ row }) => (
      <>
        <span className="font-mono text-xs">{row.original.requisition_code}</span>
        <p className="text-xs text-muted-foreground">{row.original.requisition_title}</p>
      </>
    ),
  },
  {
    accessorKey: "scheduled_start",
    header: "When",
    meta: { text: (row) => formatDateTime(row.scheduled_start) },
    cell: ({ row }) => (
      <InterviewWhen start={row.original.scheduled_start} candidateTimezone={row.original.candidate_timezone} />
    ),
  },
  {
    accessorKey: "mode",
    header: "Mode",
    meta: { text: (row) => INTERVIEW_MODE[row.mode] ?? row.mode },
    cell: ({ row }) => INTERVIEW_MODE[row.original.mode] ?? row.original.mode,
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: { text: (row) => statusLabel(INTERVIEW_STATUS, row.status) },
    cell: ({ row }) => <StatusBadge map={INTERVIEW_STATUS} value={row.original.status} />,
  },
  {
    accessorKey: "my_response",
    header: "My response",
    meta: {
      text: (row) => (row.my_response ? statusLabel(PANEL_RESPONSE, row.my_response) : "Not on panel"),
    },
    cell: ({ row }) =>
      row.original.my_response ? (
        <StatusBadge map={PANEL_RESPONSE} value={row.original.my_response} />
      ) : (
        <span className="text-xs text-muted-foreground">Not on panel</span>
      ),
  },
  {
    id: "panel",
    header: "Panel",
    // Sorted by panel size; searched and exported as the summary.
    accessorFn: (row) => row.panel.length,
    meta: { cellClassName: "text-xs text-muted-foreground tabular-nums", text: panelSummary },
    cell: ({ row }) => panelSummary(row.original),
  },
];

/** Interview rows. Clicking a row opens it. */
export function InterviewTable({
  rows,
  onOpen,
}: {
  rows: InterviewListItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <DataTable
      columns={COLUMNS}
      data={rows}
      noun="interviews"
      exportName="interviews"
      bordered={false}
      searchPlaceholder="Search candidate, round or requisition"
      onRowClick={(row) => onOpen(row.id)}
    />
  );
}
