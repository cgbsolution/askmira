"use client";

import { ClipboardCheck, History } from "lucide-react";
import React, { useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { PipPanel } from "@/components/performance/PipPanel";
import { ReviewView } from "@/components/performance/ReviewView";
import { StatusBadge } from "@/components/performance/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { MyReview, PipSummary } from "@/lib/types/performance";
import { formatDateRange } from "@/lib/utils";

/** My reviews: the current review and its form, past reviews, and my own improvement plan. */
export default function MyReviewsPage() {
  const { user } = useAuth();
  const hasEmployee = Boolean(user?.employee_id);
  const reviews = useApiQuery<MyReview[]>(hasEmployee ? "/appraisal/my" : null);
  const pips = useApiQuery<PipSummary[]>(hasEmployee ? "/performance/pips" : null);
  const [selected, setSelected] = useState<string | null>(null);

  const rows = reviews.data ?? [];
  const current = rows.find((r) => r.cycle_status !== "closed" && r.status !== "acknowledged") ?? rows[0];
  const shown = selected ?? current?.appraisal_id ?? null;
  const myPip = (pips.data ?? []).find((p) => p.is_mine && ["active", "extended", "draft"].includes(p.status));

  return (
    <PageShell title="My reviews" description="Your review, the score your goals contribute, and your history.">
      <SectionNav section="performance" />

      {!hasEmployee ? (
        <Card tier="tier1">
          <EmptyState
            icon={ClipboardCheck}
            title="Your login is not linked to an employee record"
            description="Reviews belong to employees. Ask HR to link your account."
          />
        </Card>
      ) : reviews.isLoading && !reviews.data ? (
        <Skeleton className="h-64 w-full" />
      ) : reviews.error ? (
        <Card tier="tier1">
          <ErrorState message={reviews.error.detail} onRetry={reviews.reload} />
        </Card>
      ) : rows.length === 0 ? (
        <Card tier="tier1">
          <EmptyState
            icon={ClipboardCheck}
            title="No reviews yet"
            description="When HR launches a review cycle that includes you, it appears here."
          />
        </Card>
      ) : (
        shown && <ReviewView key={shown} appraisalId={shown} onChanged={reviews.reload} />
      )}

      {myPip && <PipPanel pipId={myPip.pip_id} onChanged={pips.reload} />}

      {rows.length > 1 && (
        <DataPanel title="All my reviews" description="Select one to open it." actions={<History className="size-4 text-muted-foreground" />}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cycle</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.appraisal_id} data-state={row.appraisal_id === shown ? "selected" : undefined}>
                  <TableCell className="font-medium">{row.cycle_name}</TableCell>
                  <TableCell>{formatDateRange(row.period_start, row.period_end)}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                    {row.waiting_on_me && <span className="ml-2 text-xs text-accent-foreground">Waiting on you</span>}
                  </TableCell>
                  <TableCell>{row.final_rating ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(row.appraisal_id)}>
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>
      )}
    </PageShell>
  );
}
