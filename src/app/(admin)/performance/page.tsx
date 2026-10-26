"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardCheck, History } from "lucide-react";
import React, { useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageShell } from "@/components/common/PageShell";
import { PipPanel } from "@/components/performance/PipPanel";
import { ReviewView } from "@/components/performance/ReviewView";
import { humanize, StatusBadge } from "@/components/performance/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

  const columns: ColumnDef<MyReview>[] = [
    { accessorKey: "cycle_name", header: "Cycle", meta: { cellClassName: "font-medium" } },
    {
      id: "period",
      header: "Period",
      accessorFn: (row) => row.period_start,
      meta: { text: (row) => formatDateRange(row.period_start, row.period_end) },
      cell: ({ row }) => formatDateRange(row.original.period_start, row.original.period_end),
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: { text: (row) => `${humanize(row.status)}${row.waiting_on_me ? " · Waiting on you" : ""}` },
      cell: ({ row }) => (
        <>
          <StatusBadge status={row.original.status} />
          {row.original.waiting_on_me && <span className="ml-2 text-xs text-accent-foreground">Waiting on you</span>}
        </>
      ),
    },
    {
      accessorKey: "final_rating",
      header: "Rating",
      cell: ({ row }) => row.original.final_rating ?? "—",
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={() => setSelected(row.original.appraisal_id)}>
          Open
        </Button>
      ),
    },
  ];

  return (
    <PageShell title="My reviews" description="Your review, the score your goals contribute, and your history.">
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
        <DataTable
          title="All my reviews"
          description="Select one to open it."
          actions={<History className="size-4 text-muted-foreground" />}
          columns={columns}
          data={rows}
          getRowId={(row) => row.appraisal_id}
          noun="reviews"
          exportName="my-reviews"
          searchPlaceholder="Search reviews"
          rowClassName={(row) => (row.appraisal_id === shown ? "bg-blush-50" : undefined)}
        />
      )}
    </PageShell>
  );
}
