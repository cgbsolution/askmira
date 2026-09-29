"use client";

import { BellRing, CalendarDays, Loader2 } from "lucide-react";
import React, { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { CalendarConnectionCard } from "@/components/hiring/CalendarConnectionCard";
import { InterviewRoundsPanel } from "@/components/hiring/InterviewRoundsPanel";
import { InterviewSheet } from "@/components/hiring/InterviewSheet";
import { InterviewTable } from "@/components/hiring/InterviewTable";
import { INTERVIEW_STATUS } from "@/components/hiring/labels";
import { ScheduleForm } from "@/components/hiring/ScheduleForm";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import { HR } from "@/lib/access";
import type { InterviewListItem, InterviewStatus } from "@/lib/types/hiring";

/** Interviews (hiring): my panels, everything I oversee, and HR's scheduling tools. */
export default function InterviewsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <InterviewsView />
    </Suspense>
  );
}

function InterviewsView() {
  const { hasRole } = useAuth();
  const isHr = hasRole(...HR);
  const [openId, setOpenId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  return (
    <PageShell
      title="Interviews"
      description="Panels, times, replies and feedback. Scores appear only with the evidence behind them."
      actions={isHr ? <RunRemindersButton /> : undefined}
    >
      <CalendarConnectionCard />
      <Tabs defaultValue="mine">
        <TabsList className="flex-wrap">
          <TabsTrigger value="mine">My panels</TabsTrigger>
          <TabsTrigger value="all">All interviews</TabsTrigger>
          {isHr && <TabsTrigger value="schedule">Schedule</TabsTrigger>}
          {isHr && <TabsTrigger value="rounds">Rounds</TabsTrigger>}
        </TabsList>
        <TabsContent value="mine">
          <MyPanels version={version} onOpen={setOpenId} />
        </TabsContent>
        <TabsContent value="all">
          <AllInterviews version={version} onOpen={setOpenId} isHr={isHr} />
        </TabsContent>
        {isHr && (
          <TabsContent value="schedule">
            <ScheduleForm onScheduled={refresh} />
          </TabsContent>
        )}
        {isHr && (
          <TabsContent value="rounds">
            <InterviewRoundsPanel />
          </TabsContent>
        )}
      </Tabs>
      <InterviewSheet interviewId={openId} onClose={() => setOpenId(null)} onChanged={refresh} />
    </PageShell>
  );
}

/** Reload a list when something elsewhere on the page changed it (not on first render). */
function useReloadOn(version: number, reload: () => void) {
  useEffect(() => {
    if (version > 0) reload();
  }, [version, reload]);
}

function UpcomingSwitch({ id, value, onChange }: { id: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={value} onCheckedChange={onChange} />
      <Label htmlFor={id}>Upcoming only</Label>
    </div>
  );
}

/** Interviews the signed-in person sits on. */
function MyPanels({ version, onOpen }: { version: number; onOpen: (id: string) => void }) {
  const [upcoming, setUpcoming] = useState(true);
  const { data, error, isLoading, reload } = useApiQuery<InterviewListItem[]>(
    `/interviews/mine?upcoming=${upcoming}`,
  );
  useReloadOn(version, reload);
  const rows = data ?? [];
  return (
    <DataPanel
      title="My panels"
      toolbar={<UpcomingSwitch id="mine-upcoming" value={upcoming} onChange={setUpcoming} />}
      isLoading={isLoading && !data}
      error={error?.detail}
      onRetry={reload}
      isEmpty={rows.length === 0}
      empty={{
        icon: CalendarDays,
        title: upcoming ? "No upcoming interviews on your panels" : "You have not been on any interview panel",
        description: "Interviews appear here when HR adds you to a panel.",
      }}
    >
      <InterviewTable rows={rows} onOpen={onOpen} />
    </DataPanel>
  );
}

/** Every interview the person may see: all of them for HR, their requisitions' for a manager. */
function AllInterviews({
  version,
  onOpen,
  isHr,
}: {
  version: number;
  onOpen: (id: string) => void;
  isHr: boolean;
}) {
  const [upcoming, setUpcoming] = useState(false);
  const [status, setStatus] = useState<InterviewStatus | "all">("all");
  const query = `/interviews?scope=all&upcoming=${upcoming}${status === "all" ? "" : `&status=${status}`}`;
  const { data, error, isLoading, reload } = useApiQuery<InterviewListItem[]>(query);
  useReloadOn(version, reload);
  const rows = data ?? [];
  return (
    <DataPanel
      title="All interviews"
      description={
        isHr ? "Every interview in the workspace." : "Interviews for the requisitions you hire for."
      }
      toolbar={
        <>
          <Select value={status} onValueChange={(next) => setStatus(next as InterviewStatus | "all")}>
            <SelectTrigger className="w-56" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(INTERVIEW_STATUS) as InterviewStatus[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {INTERVIEW_STATUS[key][0]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <UpcomingSwitch id="all-upcoming" value={upcoming} onChange={setUpcoming} />
        </>
      }
      isLoading={isLoading && !data}
      error={error?.detail}
      onRetry={reload}
      isEmpty={rows.length === 0}
      empty={{
        icon: CalendarDays,
        title: status === "all" && !upcoming ? "No interviews yet" : "No interviews match these filters",
        description: isHr
          ? "Schedule one from the Schedule tab once a requisition has rounds."
          : "Interviews for your requisitions appear here once HR schedules them.",
      }}
    >
      <InterviewTable rows={rows} onOpen={onOpen} />
    </DataPanel>
  );
}

/** HR: raise the due interview reminders now instead of waiting for the scheduler. */
function RunRemindersButton() {
  const [isRunning, setIsRunning] = useState(false);
  const run = async () => {
    setIsRunning(true);
    try {
      const result = await post<{
        interviews_reminded: number;
        notifications_raised: number;
        candidate_reminders: string;
      }>("/interviews/reminders/run");
      toast.success(
        `Reminders raised for ${result.interviews_reminded} interview(s), ${result.notifications_raised} panellist notification(s)`,
        { description: `Candidates: ${result.candidate_reminders}` },
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Reminders could not be run.");
    } finally {
      setIsRunning(false);
    }
  };
  return (
    <Button variant="outline" disabled={isRunning} onClick={() => void run()}>
      {isRunning ? <Loader2 className="animate-spin" /> : <BellRing />}
      Run reminders now
    </Button>
  );
}
