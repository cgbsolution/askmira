"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageShell } from "@/components/common/PageShell";
import { ApprovalsInbox } from "@/components/time/ApprovalsInbox";
import { BalanceCards } from "@/components/time/BalanceCards";
import { HolidayList } from "@/components/time/HolidayList";
import { LeaveSetup } from "@/components/time/LeaveSetup";
import { RequestsTable } from "@/components/time/RequestsTable";
import { RequestTimeOffDialog } from "@/components/time/RequestTimeOffDialog";
import { WhoIsOutCalendar } from "@/components/time/WhoIsOutCalendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/context/AuthContext";
import { ApiError, get } from "@/lib/api";
import type { LeaveBalance, LeaveType } from "@/lib/types";

/**
 * Time off (FRD 5.1).
 *
 * Tier 1 throughout: a balance feeds loss-of-pay and encashment, so a wrong
 * number here costs money. Every figure on the screen is the API's.
 */
export default function TimePage() {
  const { user, hasRole } = useAuth();
  const [version, setVersion] = useState(0);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [approvalCount, setApprovalCount] = useState(0);

  const isHr = hasRole("tenant_admin", "hr_admin", "hr_ops");
  const canApprove = isHr || hasRole("manager");
  const refresh = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    get<LeaveType[]>("/leave/types")
      .then(setLeaveTypes)
      .catch((error) =>
        toast.error(error instanceof ApiError ? error.detail : "Could not load leave types."),
      );
  }, [version]);

  useEffect(() => {
    if (!user?.employee_id) {
      setBalancesLoading(false);
      return;
    }
    setBalancesLoading(true);
    get<LeaveBalance[]>("/leave/balances")
      .then(setBalances)
      .catch((error) =>
        toast.error(error instanceof ApiError ? error.detail : "Could not load your balances."),
      )
      .finally(() => setBalancesLoading(false));
  }, [user?.employee_id, version]);

  // The approvals count for the tab label, kept current without opening the tab.
  useEffect(() => {
    if (!canApprove) return;
    get<unknown[]>("/leave/approvals")
      .then((rows) => setApprovalCount(rows.length))
      .catch(() => undefined);
  }, [canApprove, version]);

  return (
    <TooltipProvider delayDuration={200}>
      <PageShell
        title="Time off"
        description="Balances, requests and approvals — and who is out when."
        actions={
          user?.employee_id ? (
            <RequestTimeOffDialog leaveTypes={leaveTypes} onCreated={refresh} />
          ) : undefined
        }
      >
        {user?.employee_id && <BalanceCards balances={balances} isLoading={balancesLoading} />}

        <Tabs defaultValue={canApprove && approvalCount > 0 ? "approvals" : "requests"}>
          <TabsList>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            {canApprove && (
              <TabsTrigger value="approvals">
                Approvals
                {approvalCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground">
                    {approvalCount}
                  </span>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="calendar">Who&apos;s out</TabsTrigger>
            <TabsTrigger value="holidays">Holidays</TabsTrigger>
            {isHr && <TabsTrigger value="setup">Setup</TabsTrigger>}
          </TabsList>

          <TabsContent value="requests" className="mt-4">
            <RequestsTable
              employeeId={user?.employee_id ?? null}
              canSeeOthers={canApprove}
              version={version}
              onChanged={refresh}
            />
          </TabsContent>
          {canApprove && (
            <TabsContent value="approvals" className="mt-4">
              <ApprovalsInbox version={version} onChanged={refresh} onCount={setApprovalCount} />
            </TabsContent>
          )}
          <TabsContent value="calendar" className="mt-4">
            <WhoIsOutCalendar version={version} />
          </TabsContent>
          <TabsContent value="holidays" className="mt-4">
            <HolidayList version={version} />
          </TabsContent>
          {isHr && (
            <TabsContent value="setup" className="mt-4">
              <LeaveSetup leaveTypes={leaveTypes} onChanged={refresh} />
            </TabsContent>
          )}
        </Tabs>
      </PageShell>
    </TooltipProvider>
  );
}
