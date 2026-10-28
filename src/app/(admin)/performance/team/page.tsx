"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { BellRing, Loader2, TrendingUp, UserCheck, Users } from "lucide-react";
import React, { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { RequireRole } from "@/components/common/RequireRole";
import { ReviewView } from "@/components/performance/ReviewView";
import { humanize, PercentBar, PersonSelect, StatusBadge, useAction, usePeople } from "@/components/performance/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { HR } from "@/lib/access";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { CycleProgress, CycleSummary, Delegation, TeamReviewRow } from "@/lib/types/performance";
import { formatDay, toISODate } from "@/lib/utils";
import { DatePicker } from "@/components/common/DatePicker";

const ALL = "__all__";

type DepartmentProgress = CycleProgress["by_department"][number];
type ManagerProgress = CycleProgress["by_manager"][number];

const DEPARTMENT_COLUMNS: ColumnDef<DepartmentProgress>[] = [
  { accessorKey: "department", header: "Department" },
  {
    accessorKey: "completion_percent",
    header: "Completion",
    meta: { text: (b) => `${b.completion_percent}%` },
    cell: ({ row }) => (
      <PercentBar value={String(row.original.completion_percent)} label={`${row.original.department} completion`} />
    ),
  },
  { accessorKey: "pending", header: "Pending", meta: { className: "text-right tabular-nums" } },
  { accessorKey: "overdue", header: "Overdue", meta: { className: "text-right tabular-nums" } },
];

const MANAGER_COLUMNS: ColumnDef<ManagerProgress>[] = [
  { accessorKey: "manager_name", header: "Manager" },
  {
    accessorKey: "completion_percent",
    header: "Completion",
    meta: { text: (b) => `${b.completion_percent}%` },
    cell: ({ row }) => (
      <PercentBar value={String(row.original.completion_percent)} label={`${row.original.manager_name} completion`} />
    ),
  },
  { accessorKey: "pending", header: "Pending", meta: { className: "text-right tabular-nums" } },
  { accessorKey: "overdue", header: "Overdue", meta: { className: "text-right tabular-nums" } },
];

export default function TeamPage() {
  const cycles = useApiQuery<CycleSummary[]>("/appraisal/cycles");
  const running = (cycles.data ?? []).filter((c) => c.status !== "draft");
  const [cycleId, setCycleId] = useState<string>(ALL);
  const team = useApiQuery<TeamReviewRow[]>(
    `/appraisal/team${cycleId === ALL ? "" : `?cycle_id=${cycleId}`}`,
  );
  const [open, setOpen] = useState<TeamReviewRow | null>(null);
  const progressCycle = cycleId !== ALL ? cycleId : running.find((c) => c.status !== "closed")?.id ?? null;

  const rows = team.data ?? [];
  const waiting = rows.filter((r) => r.awaiting_me).length;

  const columns: ColumnDef<TeamReviewRow>[] = [
    {
      accessorKey: "employee_name",
      header: "Employee",
      meta: {
        text: (row) =>
          [row.employee_name, row.employee_code, row.department, row.manager_name && `reports to ${row.manager_name}`]
            .filter(Boolean)
            .join(" · "),
      },
      cell: ({ row }) => (
        <PersonCell
          name={row.original.employee_name}
          subtitle={[row.original.department, row.original.manager_name && `reports to ${row.original.manager_name}`]
            .filter(Boolean)
            .join(" · ")}
          size="sm"
        />
      ),
    },
    { accessorKey: "cycle_name", header: "Cycle" },
    {
      accessorKey: "stage_label",
      header: "Step",
      meta: { text: (row) => `${row.stage_label ?? "—"}${row.awaiting_me ? " · Yours" : ""}` },
      cell: ({ row }) => (
        <>
          {row.original.stage_label ?? "—"}
          {row.original.awaiting_me && <Badge variant="accent" className="ml-2">Yours</Badge>}
        </>
      ),
    },
    {
      accessorKey: "due_date",
      header: "Due",
      meta: {
        text: (row) =>
          [
            row.due_date ? formatDay(row.due_date, true) : "—",
            row.days_overdue > 0 ? `${row.days_overdue}d late` : null,
            row.escalated ? "Escalated" : null,
          ]
            .filter(Boolean)
            .join(" · "),
      },
      cell: ({ row }) => (
        <>
          {row.original.due_date ? formatDay(row.original.due_date, true) : "—"}
          {row.original.days_overdue > 0 && (
            <Badge variant={row.original.escalation_due ? "destructive" : "warning"} className="ml-2">
              {row.original.days_overdue}d late
            </Badge>
          )}
          {row.original.escalated && <Badge variant="warning" className="ml-2">Escalated</Badge>}
        </>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: { text: (row) => humanize(row.status) },
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "final_rating",
      header: "Rating",
      meta: {
        cellClassName: "tabular-nums",
        text: (row) => `${row.final_rating ?? "—"}${row.final_score ? ` · ${row.final_score}` : ""}`,
      },
      cell: ({ row }) => (
        <>
          {row.original.final_rating ?? "—"}
          {row.original.final_score && <span className="text-muted-foreground"> · {row.original.final_score}</span>}
        </>
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <Button size="sm" variant={row.original.awaiting_me ? "default" : "ghost"} onClick={() => setOpen(row.original)}>
          {row.original.awaiting_me ? "Review" : "Open"}
        </Button>
      ),
    },
  ];

  return (
    <PageShell title="My team" description="Reviews in your reporting line, who is holding each, and what is late.">
      <div className="flex flex-wrap items-end gap-3">
        <FormField htmlFor="team-cycle" label="Cycle" className="w-72">
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger id="team-cycle" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All running cycles</SelectItem>
              {running.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        {progressCycle && (
          <RequireRole roles={HR}>
            <CycleOperations cycleId={progressCycle} onDone={team.reload} />
          </RequireRole>
        )}
      </div>

      <Tabs defaultValue="reviews">
        <TabsList>
          <TabsTrigger value="reviews">
            Reviews
            {waiting > 0 && <Badge variant="accent" className="ml-1.5">{waiting}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="progress">Completion</TabsTrigger>
          <TabsTrigger value="delegation">Delegation</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="mt-4">
          <DataTable
            title="Reviews"
            description="Waiting on you first, then the most overdue."
            columns={columns}
            data={rows}
            getRowId={(row) => row.appraisal_id}
            noun="reviews"
            exportName="team-reviews"
            searchPlaceholder="Search reviews"
            isLoading={team.isLoading && !team.data}
            error={team.error?.detail}
            onRetry={team.reload}
            empty={{
              icon: Users,
              title: "No reviews to show",
              description: "Reviews for people in your reporting line appear here once a cycle is launched.",
            }}
          />
        </TabsContent>

        <TabsContent value="progress" className="mt-4">
          {progressCycle ? (
            <ProgressDashboard cycleId={progressCycle} />
          ) : (
            <DataPanel isEmpty empty={{ icon: TrendingUp, title: "No running cycle", description: "Completion appears once a cycle is launched." }} />
          )}
        </TabsContent>

        <TabsContent value="delegation" className="mt-4">
          <Delegations cycles={running.filter((c) => c.status !== "closed")} />
        </TabsContent>
      </Tabs>

      <Sheet open={open !== null} onOpenChange={(value) => !value && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>{open?.employee_name}</SheetTitle>
            <SheetDescription>{open?.cycle_name}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {open && <ReviewView appraisalId={open.appraisal_id} onChanged={team.reload} />}
          </div>
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}

function ProgressDashboard({ cycleId }: { cycleId: string }) {
  const { data, error, isLoading, reload } = useApiQuery<CycleProgress>(`/appraisal/cycles/${cycleId}/progress`);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DataTable
        title={data ? `${data.cycle}: ${data.completion_percent}% complete` : "Completion"}
        description={data ? `${data.completed} of ${data.total} reviews complete` : undefined}
        columns={DEPARTMENT_COLUMNS}
        data={data?.by_department ?? []}
        getRowId={(b) => b.department_id ?? "none"}
        noun="departments"
        exportName="review-completion-by-department"
        searchPlaceholder="Search departments"
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        empty={{ icon: TrendingUp, title: "Nobody in this cycle is in your line" }}
      />
      <DataTable
        title="By manager"
        columns={MANAGER_COLUMNS}
        data={data?.by_manager ?? []}
        getRowId={(b) => b.manager_id ?? "none"}
        noun="managers"
        exportName="review-completion-by-manager"
        searchPlaceholder="Search managers"
        isLoading={isLoading && !data}
        empty={{ icon: Users, title: "No managers to show" }}
      />
      {data && Object.keys(data.pending_by_stage).length > 0 && (
        <DataPanel title="Pending by step" className="lg:col-span-2">
          <ul className="flex flex-wrap gap-4 p-5 text-sm">
            {Object.entries(data.pending_by_stage).map(([label, count]) => (
              <li key={label}>
                <span className="font-medium">{label}</span>: <span className="tabular-nums">{count}</span>
                {data.overdue_by_stage[label] ? (
                  <Badge variant="warning" className="ml-2">
                    {data.overdue_by_stage[label]} overdue
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        </DataPanel>
      )}
    </div>
  );
}

function CycleOperations({ cycleId, onDone }: { cycleId: string; onDone: () => void }) {
  const { run } = useAction();
  const [confirm, setConfirm] = useState<"remind" | "escalate" | null>(null);
  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => setConfirm("remind")}>
        <BellRing /> Remind pending
      </Button>
      <Button variant="outline" onClick={() => setConfirm("escalate")}>
        Escalate overdue
      </Button>
      <ConfirmDialog
        open={confirm === "remind"}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Send reminders?"
        description="Everybody holding a pending step in this cycle gets one message per step, with their count."
        confirmLabel="Send reminders"
        onConfirm={async () => {
          const r = await run<{ recipients: number }>("remind", () =>
            post(`/appraisal/cycles/${cycleId}/reminders`, {}),
          );
          if (!r) throw new Error("failed");
          onDone();
        }}
      />
      <ConfirmDialog
        open={confirm === "escalate"}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Escalate overdue steps?"
        description="Steps overdue beyond the cycle's escalation window go one level up (or to HR). Each review escalates once."
        confirmLabel="Escalate"
        onConfirm={async () => {
          const r = await run<{ escalated: number }>(
            "escalate",
            () => post(`/appraisal/cycles/${cycleId}/escalate-overdue`),
            "Overdue steps escalated.",
          );
          if (!r) throw new Error("failed");
          onDone();
        }}
      />
    </div>
  );
}

function Delegations({ cycles }: { cycles: CycleSummary[] }) {
  const { data, error, isLoading, reload } = useApiQuery<Delegation[]>("/appraisal/delegations");
  const people = usePeople();
  const [creating, setCreating] = useState(false);
  const { busy, run } = useAction();
  const cycleNames = useMemo(() => Object.fromEntries(cycles.map((c) => [c.id, c.name])), [cycles]);

  const columns: ColumnDef<Delegation>[] = [
    { id: "cycle", header: "Cycle", accessorFn: (d) => cycleNames[d.cycle_id] ?? "—" },
    { accessorKey: "from_name", header: "From" },
    { accessorKey: "to_name", header: "To" },
    {
      id: "period",
      header: "Period",
      accessorFn: (d) => d.effective_from,
      meta: { text: (d) => `${formatDay(d.effective_from, true)} – ${formatDay(d.effective_to, true)}` },
      cell: ({ row }) => (
        <>
          {formatDay(row.original.effective_from, true)} – {formatDay(row.original.effective_to, true)}
        </>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (d) => (d.in_effect ? "In effect" : d.active ? "Scheduled or past" : "Ended"),
      cell: ({ row }) => (
        <Badge variant={row.original.in_effect ? "success" : "muted"}>
          {row.original.in_effect ? "In effect" : row.original.active ? "Scheduled or past" : "Ended"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => {
        const d = row.original;
        return (
          d.active && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy !== null}
              onClick={async () => {
                await run(d.id, () => post(`/appraisal/delegations/${d.id}/revoke`), "Delegation ended.");
                reload();
              }}
            >
              End
            </Button>
          )
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        title="Delegations"
        description="Hand your review steps to somebody while you are away. The entries they write name you as the owner."
        actions={
          <Button size="sm" onClick={() => setCreating(true)} disabled={cycles.length === 0}>
            <UserCheck /> Delegate my steps
          </Button>
        }
        columns={columns}
        data={data ?? []}
        noun="delegations"
        exportName="review-delegations"
        searchPlaceholder="Search delegations"
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        empty={{ icon: UserCheck, title: "No delegations", description: "Delegations to or from you appear here." }}
      />
      {creating && (
        <DelegateDialog
          cycles={cycles}
          people={people.data ?? []}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </>
  );
}

function DelegateDialog({
  cycles,
  people,
  onClose,
  onDone,
}: {
  cycles: CycleSummary[];
  people: import("@/lib/types/performance").Person[];
  onClose: () => void;
  onDone: () => void;
}) {
  const today = toISODate(new Date());
  const [cycleId, setCycleId] = useState(cycles[0]?.id ?? "");
  const [to, setTo] = useState("");
  const [from, setFrom] = useState(today);
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const { busy, run } = useAction();
  const valid = cycleId && to && from && until && until >= from;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delegate my review steps</DialogTitle>
          <DialogDescription>Time-boxed. The delegate can act on the steps you would have held.</DialogDescription>
        </DialogHeader>
        <FormField htmlFor="dg-cycle" label="Cycle">
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger id="dg-cycle" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField htmlFor="dg-to" label="Delegate to" hint="Only people with a login are listed.">
          <PersonSelect id="dg-to" people={people} value={to} onChange={setTo} withLoginOnly valueKey="user_id" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField htmlFor="dg-from" label="From">
            <DatePicker id="dg-from" value={from} onChange={setFrom} />
          </FormField>
          <FormField htmlFor="dg-until" label="Until">
            <DatePicker id="dg-until" min={from} value={until} onChange={setUntil} />
          </FormField>
        </div>
        <FormField htmlFor="dg-reason" label="Reason" optional>
          <Textarea id="dg-reason" rows={2} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || busy !== null}
            onClick={async () => {
              const r = await run(
                "save",
                () =>
                  post("/appraisal/delegations", {
                    cycle_id: cycleId,
                    to_user_id: to,
                    effective_from: from,
                    effective_to: until,
                    reason: reason.trim() || null,
                  }),
                "Delegation saved.",
              );
              if (r !== undefined) onDone();
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Delegate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
