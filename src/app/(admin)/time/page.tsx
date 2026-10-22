"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageShell } from "@/components/common/PageShell";
import { ApprovalsInbox } from "@/components/time/ApprovalsInbox";
import { BalanceCards } from "@/components/time/BalanceCards";
import { BalancesPanel } from "@/components/time/BalancesPanel";
import { CompOffPanel } from "@/components/time/CompOffPanel";
import { HolidayList } from "@/components/time/HolidayList";
import { LeaveSetup } from "@/components/time/LeaveSetup";
import { RequestsTable } from "@/components/time/RequestsTable";
import { RequestTimeOffDialog } from "@/components/time/RequestTimeOffDialog";
import { TeamBalancesTable } from "@/components/time/TeamBalancesTable";
import { WhoIsOutCalendar } from "@/components/time/WhoIsOutCalendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/context/AuthContext";
import { ApiError, get } from "@/lib/api";
import type { CompOffClaim, LeaveBalance, LeaveRequest, LeaveType } from "@/lib/types";

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
  const [leaveApprovals, setLeaveApprovals] = useState(0);
  const [compOffApprovals, setCompOffApprovals] = useState(0);
  const [tab, setTab] = useState("requests");
  // Once somebody picks a tab themselves, a count arriving late must not move them.
  const tabChosen = useRef(false);

  const isHr = hasRole("admin", "sub_admin");
  const isManager = hasRole("manager");
  const hasEmployee = Boolean(user?.employee_id);
  const approvalCount = leaveApprovals + compOffApprovals;
  // Anybody named as an approver sees the tab, whatever their login role.
  const showApprovals = isHr || isManager || approvalCount > 0;
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

  // The approvals counts for the tab, kept current without opening it. Asked
  // of everybody: a line manager may still sign in with the employee role.
  useEffect(() => {
    if (!user) return;
    get<LeaveRequest[]>("/leave/approvals")
      .then((rows) => setLeaveApprovals(rows.length))
      .catch(() => setLeaveApprovals(0));
    get<CompOffClaim[]>("/leave/comp-off/approvals")
      .then((rows) => setCompOffApprovals(rows.length))
      .catch(() => setCompOffApprovals(0));
  }, [user, version]);

  useEffect(() => {
    if (!tabChosen.current && approvalCount > 0) setTab("approvals");
  }, [approvalCount]);

  // The last item decided by somebody who approves only occasionally: the tab
  // goes away, so do not leave them looking at nothing.
  useEffect(() => {
    if (!showApprovals && tab === "approvals") setTab("requests");
  }, [showApprovals, tab]);

  const chooseTab = (next: string) => {
    tabChosen.current = true;
    setTab(next);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <PageShell
        title="Leave"
        description="Balances, requests and approvals — and who is out when."
        actions={
          hasEmployee || isHr ? (
            <RequestTimeOffDialog
              leaveTypes={leaveTypes}
              canActForOthers={isHr}
              ownEmployeeId={user?.employee_id ?? null}
              onCreated={refresh}
            />
          ) : undefined
        }
      >
        {hasEmployee && <BalanceCards balances={balances} isLoading={balancesLoading} />}

        <Tabs value={tab} onValueChange={chooseTab}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="requests">Requests</TabsTrigger>
            {showApprovals && (
              <TabsTrigger value="approvals">
                Approvals
                {approvalCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground">
                    {approvalCount}
                  </span>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="comp-off">Comp-off</TabsTrigger>
            <TabsTrigger value="calendar">Who&apos;s out</TabsTrigger>
            <TabsTrigger value="holidays">Holidays</TabsTrigger>
            {(hasEmployee || isHr) && <TabsTrigger value="balances">Balances</TabsTrigger>}
            {(isHr || isManager) && (
              <TabsTrigger value="team-balances">
                {isHr ? "All balances" : "Team balances"}
              </TabsTrigger>
            )}
            {isHr && <TabsTrigger value="setup">Setup</TabsTrigger>}
          </TabsList>

          <TabsContent value="requests" className="mt-4">
            <RequestsTable
              employeeId={user?.employee_id ?? null}
              canSeeOthers={isHr || isManager}
              version={version}
              onChanged={refresh}
            />
          </TabsContent>
          {showApprovals && (
            <TabsContent value="approvals" className="mt-4">
              <ApprovalsInbox
                version={version}
                onChanged={refresh}
                onCounts={(leave, compOff) => {
                  setLeaveApprovals(leave);
                  setCompOffApprovals(compOff);
                }}
              />
            </TabsContent>
          )}
          <TabsContent value="comp-off" className="mt-4">
            <CompOffPanel
              hasEmployee={hasEmployee}
              canSeeOthers={isHr || isManager}
              isHr={isHr}
              version={version}
              onChanged={refresh}
            />
          </TabsContent>
          <TabsContent value="calendar" className="mt-4">
            <WhoIsOutCalendar version={version} isHr={isHr} />
          </TabsContent>
          <TabsContent value="holidays" className="mt-4">
            <HolidayList version={version} isHr={isHr} hasEmployee={hasEmployee} />
          </TabsContent>
          {(hasEmployee || isHr) && (
            <TabsContent value="balances" className="mt-4">
              <BalancesPanel
                isHr={isHr}
                ownEmployeeId={user?.employee_id ?? null}
                version={version}
                onChanged={refresh}
              />
            </TabsContent>
          )}
          {(isHr || isManager) && (
            <TabsContent value="team-balances" className="mt-4">
              <TeamBalancesTable
                isHr={isHr}
                ownEmployeeId={user?.employee_id ?? null}
                version={version}
                onChanged={refresh}
              />
            </TabsContent>
          )}
          {isHr && (
            <TabsContent value="setup" className="mt-4">
              <LeaveSetup onChanged={refresh} version={version} />
            </TabsContent>
          )}
        </Tabs>
      </PageShell>
    </TooltipProvider>
  );
}
