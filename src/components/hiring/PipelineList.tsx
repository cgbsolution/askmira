"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import React from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { CandidateMoveMenu } from "@/components/hiring/CandidateMoveMenu";
import { CANDIDATE_STAGE, formatDateTime, StatusBadge } from "@/components/hiring/labels";
import {
  experienceLabel,
  noticeLabel,
  PipelineDuplicateBadge,
  sourceLabel,
} from "@/components/hiring/PipelineBoard";
import type { CandidateSummary } from "@/lib/types/hiring";

/** The same pipeline as a table, for scanning and searching. */
export function PipelineList({
  candidates,
  onMoved,
}: {
  candidates: CandidateSummary[];
  onMoved: () => void;
}) {
  const columns: ColumnDef<CandidateSummary>[] = [
    {
      accessorKey: "full_name",
      header: "Candidate",
      meta: { text: (row) => `${row.full_name} ${row.email}` },
      cell: ({ row }) => (
        <>
          <Link
            href={`/hiring/candidates/${row.original.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {row.original.full_name}
          </Link>
          <p className="text-xs text-muted-foreground">{row.original.email}</p>
          {row.original.possible_duplicate && (
            <div className="mt-1">
              <PipelineDuplicateBadge />
            </div>
          )}
        </>
      ),
    },
    {
      accessorKey: "requisition_code",
      header: "Requisition",
      meta: { cellClassName: "font-mono text-xs" },
      cell: ({ row }) => row.original.requisition_code ?? "—",
    },
    {
      accessorKey: "stage",
      header: "Stage",
      meta: { text: (row) => CANDIDATE_STAGE[row.stage]?.[0] ?? row.stage },
      cell: ({ row }) => <StatusBadge map={CANDIDATE_STAGE} value={row.original.stage} />,
    },
    {
      id: "source",
      header: "Source",
      accessorFn: (row) => sourceLabel(row.source),
    },
    {
      accessorKey: "total_experience_years",
      header: "Experience",
      // Years arrive as decimal strings: compare them as numbers, not as text.
      sortingFn: "alphanumeric",
      meta: { cellClassName: "tabular-nums", text: (row) => experienceLabel(row.total_experience_years) },
      cell: ({ row }) => experienceLabel(row.original.total_experience_years),
    },
    {
      accessorKey: "notice_period_days",
      header: "Notice",
      meta: { cellClassName: "tabular-nums", text: (row) => noticeLabel(row.notice_period_days) },
      cell: ({ row }) => noticeLabel(row.original.notice_period_days),
    },
    {
      accessorKey: "created_at",
      header: "Added",
      meta: { cellClassName: "text-muted-foreground", text: (row) => formatDateTime(row.created_at) },
      cell: ({ row }) => formatDateTime(row.original.created_at),
    },
    {
      id: "actions",
      header: "Move",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <CandidateMoveMenu
          candidate={row.original}
          allowedMoves={row.original.allowed_moves}
          onMoved={onMoved}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={candidates}
      noun="candidates"
      exportName="candidates"
      // The panel round this list searches the API (names, emails, employers, resume text).
      searchPlaceholder={false}
      bordered={false}
    />
  );
}
