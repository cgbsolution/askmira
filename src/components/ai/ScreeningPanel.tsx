"use client";

import { FileSearch, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import { formatDate } from "@/lib/utils";

import { aiAvailable, useAiStatus } from "./aiStatus";

interface Requirement {
  requirement: string;
  assessment: "met" | "partial" | "not_evident";
  evidence: string;
  note: string | null;
}

interface Screening {
  id: string;
  requirements: Requirement[];
  requirements_total: number;
  requirements_met: number;
  summary: string;
  confidence: number;
  confidence_band: string;
  model: string;
  redactions: string[];
  generated_at: string;
  note: string;
}

const ASSESSMENT: Record<Requirement["assessment"], { label: string; variant: "secondary" | "outline" }> = {
  met: { label: "Met", variant: "secondary" },
  partial: { label: "Partly", variant: "outline" },
  not_evident: { label: "Not evident", variant: "outline" },
};

/**
 * The resume read against the role (ATS-11). Advisory, for the hiring team.
 *
 * Each requirement shows the resume's own words, or says none were found —
 * quoted evidence that is not in the resume is discarded. "Met" is counted
 * from those rows; the AI's confidence sits beside it. Nothing here moves the
 * candidate.
 */
export function ScreeningPanel({ candidateId }: { candidateId: string }) {
  const status = useAiStatus();
  const enabled = aiAvailable(status.data, "hiring_drafts");
  const { data, error, isLoading, reload } = useApiQuery<Screening[]>(
    enabled ? `/hiring/candidates/${candidateId}/screenings` : null,
  );
  const [busy, setBusy] = useState(false);

  if (!enabled) return null;

  const run = async () => {
    setBusy(true);
    try {
      await post(`/hiring/candidates/${candidateId}/screenings`);
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not read the resume.");
    } finally {
      setBusy(false);
    }
  };

  const latest = data?.[0];
  return (
    <DataPanel
      title="Resume against the role"
      description={
        latest
          ? `${latest.requirements_met} of ${latest.requirements_total} requirements met · confidence ${latest.confidence_band} · read ${formatDate(latest.generated_at)}`
          : "An AI reading of the resume against the role's skills and experience. Advisory only."
      }
      isLoading={isLoading}
      error={error?.detail}
      onRetry={reload}
      isEmpty={!latest}
      empty={{
        icon: FileSearch,
        title: "Not read yet",
        description: "The candidate's name, email, phone and links are removed before the resume is sent.",
      }}
      actions={
        <Button variant="outline" size="sm" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <FileSearch className="size-4" />}
          {latest ? "Read again" : "Read resume"}
        </Button>
      }
    >
      {latest ? (
        <div className="grid gap-3">
          <p className="text-sm">{latest.summary}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requirement</TableHead>
                <TableHead>Reading</TableHead>
                <TableHead>From the resume</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {latest.requirements.map((row) => (
                <TableRow key={row.requirement}>
                  <TableCell className="font-medium">{row.requirement}</TableCell>
                  <TableCell>
                    <Badge variant={ASSESSMENT[row.assessment].variant}>{ASSESSMENT[row.assessment].label}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-normal text-sm text-muted-foreground">
                    {row.evidence ? `“${row.evidence}”` : row.note ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            {latest.note}
            {latest.redactions.length ? ` Removed before sending: ${latest.redactions.join(", ")}.` : ""}
          </p>
        </div>
      ) : null}
    </DataPanel>
  );
}
