"use client";

import { ReceiptText, UserX } from "lucide-react";
import React, { useCallback, useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageShell } from "@/components/common/PageShell";
import { SectionNav } from "@/components/common/SectionNav";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Claim, ExpenseMeta, ExpenseReport, TravelRequest } from "@/lib/types/expenses";

import { ClaimCaptureDialog } from "./ClaimCaptureDialog";
import { ClaimDetailSheet } from "./ClaimDetailSheet";
import { ClaimsTable } from "./ClaimsTable";
import { ReportsPanel } from "./ReportsPanel";

/**
 * My claims (FS expenses).
 *
 * Tier 1: every figure here is money someone is owed. The policy verdict is
 * the server's, shown at capture, so a claim is never refused by surprise.
 */
export function ClaimsScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const hasEmployee = Boolean(user?.employee_id);

  const meta = useApiQuery<ExpenseMeta>(hasEmployee ? "/expenses/meta" : null);
  const claims = useApiQuery<Claim[]>(hasEmployee ? "/expenses/claims" : null);
  const reports = useApiQuery<ExpenseReport[]>(hasEmployee ? "/expenses/reports" : null);
  const trips = useApiQuery<TravelRequest[]>(hasEmployee ? "/expenses/travel-requests" : null);

  const [selected, setSelected] = useState<Claim | null>(null);

  const { reload: reloadClaims } = claims;
  const { reload: reloadReports } = reports;
  const refresh = useCallback(() => {
    reloadClaims();
    reloadReports();
  }, [reloadClaims, reloadReports]);

  // Keep the open sheet in step with the latest list after an action.
  const current =
    selected &&
    ((claims.data ?? []).find((claim) => claim.id === selected.id) ??
      (reports.data ?? []).flatMap((report) => report.lines).find((line) => line.id === selected.id) ??
      selected);

  const currency = meta.data?.reporting_currency ?? "";

  const body = () => {
    if (authLoading) return <LoadingCard />;
    if (!hasEmployee) {
      return (
        <Card tier="tier1">
          <EmptyState
            icon={UserX}
            title="Your sign-in is not linked to an employee record"
            description="Expense claims belong to an employee. Ask HR to link your account to your employee record."
          />
        </Card>
      );
    }
    if (meta.error) {
      return (
        <Card tier="tier1">
          <ErrorState message={meta.error.detail} onRetry={meta.reload} />
        </Card>
      );
    }
    if (!meta.data) return <LoadingCard />;

    return (
      <Tabs defaultValue="claims">
        <TabsList>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="claims" className="mt-4">
          {claims.error && !claims.data ? (
            <Card tier="tier1">
              <ErrorState message={claims.error.detail} onRetry={reloadClaims} />
            </Card>
          ) : !claims.data ? (
            <LoadingCard />
          ) : claims.data.length === 0 ? (
            <Card tier="tier1">
              <EmptyState
                icon={ReceiptText}
                title="No claims yet"
                description="Use New claim to record an expense. The policy is checked when you save it."
              />
            </Card>
          ) : (
            <ClaimsTable claims={claims.data} currency={currency} onSelect={setSelected} />
          )}
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          {reports.error && !reports.data ? (
            <Card tier="tier1">
              <ErrorState message={reports.error.detail} onRetry={reloadReports} />
            </Card>
          ) : !reports.data ? (
            <LoadingCard />
          ) : (
            <ReportsPanel
              reports={reports.data}
              trips={trips.data ?? []}
              currency={currency}
              onChanged={refresh}
              onSelectClaim={setSelected}
            />
          )}
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <PageShell
      title="My claims"
      description="Record expenses, see what the policy says about each one, and submit them for approval."
      actions={
        meta.data ? (
          <ClaimCaptureDialog
            meta={meta.data}
            trips={trips.data ?? []}
            reports={reports.data ?? []}
            onChanged={refresh}
          />
        ) : undefined
      }
    >
      <SectionNav section="expenses" />
      {body()}
      <ClaimDetailSheet
        claim={current}
        currency={currency}
        trips={trips.data ?? []}
        reports={reports.data ?? []}
        onOpenChange={(open) => !open && setSelected(null)}
        onChanged={refresh}
      />
    </PageShell>
  );
}

function LoadingCard() {
  return (
    <Card tier="tier1">
      <CardContent className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}
