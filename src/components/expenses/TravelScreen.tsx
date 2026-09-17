"use client";

import { CheckCircle2, Plane, TriangleAlert, UserX, Wallet } from "lucide-react";
import React, { useCallback } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Advance, BlockStatus, ExpenseMeta, TravelRequest } from "@/lib/types/expenses";

import { TravelAdvancesTable } from "./TravelAdvancesTable";
import { TravelRequestDialog } from "./TravelRequestDialog";
import { TravelTripsTable } from "./TravelTripsTable";
import { formatMoney } from "./shared";

/**
 * Travel & advances.
 *
 * Tier 1: advances are company money in the person's hands. The block status
 * comes first because an old unsettled advance is what stops the next one.
 */
export function TravelScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const hasEmployee = Boolean(user?.employee_id);

  const block = useApiQuery<BlockStatus>(hasEmployee ? "/expenses/advances/block-status" : null);
  const trips = useApiQuery<TravelRequest[]>(hasEmployee ? "/expenses/travel-requests" : null);
  const advances = useApiQuery<Advance[]>(hasEmployee ? "/expenses/advances" : null);
  const meta = useApiQuery<ExpenseMeta>(hasEmployee ? "/expenses/meta" : null);

  const { reload: reloadTrips } = trips;
  const { reload: reloadBlock } = block;
  const refresh = useCallback(() => {
    reloadTrips();
    reloadBlock();
  }, [reloadTrips, reloadBlock]);

  const currency = meta.data?.reporting_currency ?? "";
  const metaSettled = Boolean(meta.data) || Boolean(meta.error);

  const body = () => {
    if (authLoading) return <LoadingCard />;
    if (!hasEmployee) {
      return (
        <Card tier="tier1">
          <EmptyState
            icon={UserX}
            title="Your sign-in is not linked to an employee record"
            description="Travel requests and advances belong to an employee. Ask HR to link your account to your employee record."
          />
        </Card>
      );
    }
    if (!metaSettled) return <LoadingCard />;

    return (
      <>
        {block.data ? (
          block.data.permitted ? (
            <Alert variant="success">
              <CheckCircle2 />
              <AlertTitle>No advance is holding you back</AlertTitle>
              <AlertDescription>{block.data.message}</AlertDescription>
            </Alert>
          ) : (
            <Alert variant="warning">
              <TriangleAlert />
              <AlertTitle>New advances are blocked</AlertTitle>
              <AlertDescription>
                <p>{block.data.message}</p>
                <p className="tabular-nums">
                  {block.data.blocking_count} {block.data.blocking_count === 1 ? "advance" : "advances"}{" "}
                  unsettled for more than {block.data.block_after_days} days · Outstanding{" "}
                  {formatMoney(block.data.total_outstanding, currency || undefined)}
                </p>
              </AlertDescription>
            </Alert>
          )
        ) : block.error ? (
          <Alert>
            <TriangleAlert />
            <AlertTitle>Advance status could not be loaded</AlertTitle>
            <AlertDescription>{block.error.detail}</AlertDescription>
          </Alert>
        ) : (
          <Skeleton className="h-16 w-full" />
        )}

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Trips</h2>
          {trips.error && !trips.data ? (
            <Card tier="tier1">
              <ErrorState message={trips.error.detail} onRetry={reloadTrips} />
            </Card>
          ) : !trips.data ? (
            <LoadingCard />
          ) : trips.data.length === 0 ? (
            <Card tier="tier1">
              <EmptyState
                icon={Plane}
                title="No travel requests"
                description="Use New travel request before a work trip. An approved trip can carry an advance and the claims that need pre-approval."
              />
            </Card>
          ) : (
            <TravelTripsTable
              trips={trips.data}
              currency={currency || "INR"}
              onChanged={refresh}
            />
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Advances</h2>
          {advances.error && !advances.data ? (
            <Card tier="tier1">
              <ErrorState message={advances.error.detail} onRetry={advances.reload} />
            </Card>
          ) : !advances.data ? (
            <LoadingCard />
          ) : advances.data.length === 0 ? (
            <Card tier="tier1">
              <EmptyState
                icon={Wallet}
                title="No advances"
                description="Finance issues an advance against an approved trip that asked for one. It will appear here with what is still outstanding."
              />
            </Card>
          ) : (
            <TravelAdvancesTable
              advances={advances.data}
              trips={trips.data ?? []}
              currency={currency || "INR"}
            />
          )}
        </section>
      </>
    );
  };

  return (
    <PageShell
      title="Travel & advances"
      description="Ask for a trip to be approved, see advances you hold, and what is left to account for."
      actions={
        hasEmployee && metaSettled ? (
          <TravelRequestDialog
            tiers={meta.data?.city_tiers ?? []}
            currency={currency || "INR"}
            block={block.data}
            onCreated={refresh}
          />
        ) : undefined
      }
    >
      <SectionNav section="expenses" />
      {body()}
    </PageShell>
  );
}

function LoadingCard() {
  return (
    <Card tier="tier1">
      <CardContent className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}
