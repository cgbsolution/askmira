"use client";

import Link from "next/link";
import React from "react";

import { CandidateMoveMenu } from "@/components/hiring/CandidateMoveMenu";
import { CANDIDATE_STAGE, formatDateTime, StatusBadge } from "@/components/hiring/labels";
import {
  experienceLabel,
  noticeLabel,
  PipelineDuplicateBadge,
  sourceLabel,
} from "@/components/hiring/PipelineBoard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CandidateSummary } from "@/lib/types/hiring";

/** The same pipeline as a table, for scanning and searching. */
export function PipelineList({
  candidates,
  onMoved,
}: {
  candidates: CandidateSummary[];
  onMoved: () => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Candidate</TableHead>
            <TableHead>Requisition</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Experience</TableHead>
            <TableHead>Notice</TableHead>
            <TableHead>Added</TableHead>
            <TableHead className="text-right">Move</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => (
            <TableRow key={candidate.id}>
              <TableCell>
                <Link
                  href={`/hiring/candidates/${candidate.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {candidate.full_name}
                </Link>
                <p className="text-xs text-muted-foreground">{candidate.email}</p>
                {candidate.possible_duplicate && (
                  <div className="mt-1">
                    <PipelineDuplicateBadge />
                  </div>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs">{candidate.requisition_code ?? "—"}</TableCell>
              <TableCell>
                <StatusBadge map={CANDIDATE_STAGE} value={candidate.stage} />
              </TableCell>
              <TableCell>{sourceLabel(candidate.source)}</TableCell>
              <TableCell className="tabular-nums">
                {experienceLabel(candidate.total_experience_years)}
              </TableCell>
              <TableCell className="tabular-nums">{noticeLabel(candidate.notice_period_days)}</TableCell>
              <TableCell className="text-muted-foreground">{formatDateTime(candidate.created_at)}</TableCell>
              <TableCell className="text-right">
                <CandidateMoveMenu
                  candidate={candidate}
                  allowedMoves={candidate.allowed_moves}
                  onMoved={onMoved}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
