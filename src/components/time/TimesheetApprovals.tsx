"use client";

import { BarChart3, ClipboardCheck, FolderKanban, Loader2, Plus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { RequireRole } from "@/components/common/RequireRole";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/useApiQuery";
import { chainSummary } from "@/components/common/ApprovalChain";
import { useAuth } from "@/context/AuthContext";
import { HR, MANAGERS, roleAllows } from "@/lib/access";
import { ApiError, patch, post } from "@/lib/api";
import type { ApprovalStep } from "@/lib/types";
import { formatDay, toISODate } from "@/lib/utils";

import type { ProjectRow } from "./TimesheetScreen";

interface PendingWeek {
  id: string;
  employee_name: string;
  employee_code: string;
  week_start: string;
  total_hours: string;
  entries: { work_date: string; project: string | null; task: string | null; hours: string; description: string | null }[];
  approval_chain: ApprovalStep[];
}

interface HoursReport {
  projects: {
    code: string | null;
    name: string;
    billable: boolean;
    hours: string;
    tasks: { name: string; hours: string }[];
    people: { employee_code: string; name: string; task: string | null; hours: string }[];
  }[];
}

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

export function TimesheetApprovals() {
  const { user } = useAuth();
  if (!roleAllows(user, MANAGERS)) {
    // Somebody an approval rule names, with no team of their own: their queue only.
    return (
      <PageShell title="Timesheet approvals" description="Weeks an approval rule has put in front of you.">
        <Pending />
      </PageShell>
    );
  }
  return (
    <PageShell title="Timesheet approvals" description="Weeks to approve, hours by project, and the projects people log against.">
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">To approve</TabsTrigger>
          <TabsTrigger value="report">Hours by project</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
          <Pending />
        </TabsContent>
        <TabsContent value="report" className="mt-4">
          <Report />
        </TabsContent>
        <TabsContent value="projects" className="mt-4">
          <Projects />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function Pending() {
  const { data, error, isLoading, reload } = useApiQuery<PendingWeek[]>("/timesheets/pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const decide = async (week: PendingWeek, approve: boolean) => {
    setBusy(week.id);
    try {
      const result = await post<{ pay: string | null }>(`/timesheets/${week.id}/decide`, { approve, note: notes[week.id]?.trim() || null });
      toast.success(approve ? (result.pay ? `Approved; ₹${result.pay} sent to payroll for approval.` : "Approved.") : "Sent back.");
      reload();
    } catch (caught) {
      toast.error(failure(caught, "The decision could not be saved."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <DataPanel
      tier="tier1"
      title="Submitted weeks"
      isLoading={isLoading && !data}
      error={error?.detail ?? null}
      onRetry={reload}
      isEmpty={(data ?? []).length === 0}
      empty={{ icon: ClipboardCheck, title: "Nothing to approve" }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>Week</TableHead>
            <TableHead>Hours</TableHead>
            <TableHead>Note</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).map((week) => (
            <TableRow key={week.id}>
              <TableCell>
                <p className="font-medium">{week.employee_name}</p>
                <p className="text-xs text-muted-foreground">{week.employee_code}</p>
                {chainSummary(week.approval_chain) && (
                  <p className="text-xs text-muted-foreground">{chainSummary(week.approval_chain)}</p>
                )}
              </TableCell>
              <TableCell>{formatDay(week.week_start, true)}</TableCell>
              <TableCell>
                <p className="tabular-nums">{week.total_hours}</p>
                <p className="text-xs text-muted-foreground">
                  {[...new Set(week.entries.map((e) => (e.project ? (e.task ? `${e.project} · ${e.task}` : e.project) : "No project")))].join(", ")}
                </p>
              </TableCell>
              <TableCell className="min-w-48">
                <Input aria-label="Note" placeholder="Needed to send back" value={notes[week.id] ?? ""} onChange={(e) => setNotes((c) => ({ ...c, [week.id]: e.target.value }))} />
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button size="sm" disabled={busy === week.id} onClick={() => void decide(week, true)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === week.id || !notes[week.id]?.trim()} onClick={() => void decide(week, false)}>
                    Send back
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataPanel>
  );
}

function Report() {
  const today = new Date();
  const [start, setStart] = useState(toISODate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [end, setEnd] = useState(toISODate(today));
  const { data, error, isLoading, reload } = useApiQuery<HoursReport>(`/timesheets/report?start=${start}&end=${end}`);
  return (
    <DataPanel
      tier="tier1"
      title="Approved hours by project"
      toolbar={
        <div className="flex flex-wrap gap-3">
          <FormField htmlFor="rep-start" label="From">
            <Input id="rep-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </FormField>
          <FormField htmlFor="rep-end" label="To">
            <Input id="rep-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </FormField>
        </div>
      }
      isLoading={isLoading && !data}
      error={error?.detail ?? null}
      onRetry={reload}
      isEmpty={(data?.projects ?? []).length === 0}
      empty={{ icon: BarChart3, title: "No approved hours in this range" }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead className="text-right">Hours</TableHead>
            <TableHead>Tasks</TableHead>
            <TableHead>People</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data?.projects ?? []).map((p) => (
            <TableRow key={p.code ?? "none"}>
              <TableCell>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.code ?? "—"} {p.billable && <Badge variant="outline">Billable</Badge>}
                </p>
              </TableCell>
              <TableCell className="text-right tabular-nums">{p.hours}</TableCell>
              <TableCell className="text-sm">{p.tasks.map((t) => `${t.name} ${t.hours}`).join(", ")}</TableCell>
              <TableCell className="text-sm">{p.people.map((x) => `${x.name} ${x.hours}`).join(", ")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataPanel>
  );
}

function Projects() {
  const { data, error, isLoading, reload } = useApiQuery<ProjectRow[]>("/timesheets/projects?include_inactive=true");
  const [creating, setCreating] = useState(false);
  const [addingTask, setAddingTask] = useState<ProjectRow | null>(null);

  const toggle = async (project: ProjectRow) => {
    try {
      await patch(`/timesheets/projects/${project.id}`, { active: !project.active });
      reload();
    } catch (caught) {
      toast.error(failure(caught, "The project could not be changed."));
    }
  };

  return (
    <>
      <DataPanel
        tier="tier2"
        title="Projects"
        actions={
          <RequireRole roles={HR}>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> New project
            </Button>
          </RequireRole>
        }
        isLoading={isLoading && !data}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={(data ?? []).length === 0}
        empty={{ icon: FolderKanban, title: "No projects yet" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Tasks</TableHead>
              <TableHead>Open for time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <p className="font-medium">{p.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{p.code}</p>
                </TableCell>
                <TableCell>{p.client ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    {p.tasks.length === 0 && <span className="text-sm text-muted-foreground">None</span>}
                    {p.tasks.map((t) => (
                      <Badge key={t.id} variant={t.active ? "outline" : "muted"}>
                        {t.name}
                      </Badge>
                    ))}
                    <RequireRole roles={HR}>
                      <Button size="sm" variant="ghost" onClick={() => setAddingTask(p)}>
                        <Plus /> Task
                      </Button>
                    </RequireRole>
                  </div>
                </TableCell>
                <TableCell>
                  <RequireRole roles={HR} fallback={p.active ? "Yes" : "No"}>
                    <Switch aria-label={`${p.name} open for time`} checked={p.active} onCheckedChange={() => void toggle(p)} />
                  </RequireRole>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
      {addingTask && (
        <NewTaskDialog
          project={addingTask}
          onClose={() => setAddingTask(null)}
          onCreated={() => {
            setAddingTask(null);
            reload();
          }}
        />
      )}
      {creating && (
        <NewProjectDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </>
  );
}

function NewProjectDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [billable, setBillable] = useState(true);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await post("/timesheets/projects", { code: code.trim(), name: name.trim(), client: client.trim() || null, billable });
      toast.success("Project added.");
      onCreated();
    } catch (caught) {
      toast.error(failure(caught, "The project could not be added."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>People can log hours against it once it is open.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="proj-code" label="Code">
            <Input id="proj-code" maxLength={32} value={code} onChange={(e) => setCode(e.target.value)} />
          </FormField>
          <FormField htmlFor="proj-name" label="Name">
            <Input id="proj-name" maxLength={160} value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField htmlFor="proj-client" label="Client" optional>
            <Input id="proj-client" maxLength={160} value={client} onChange={(e) => setClient(e.target.value)} />
          </FormField>
          <div className="flex items-center gap-2">
            <Switch id="proj-billable" checked={billable} onCheckedChange={setBillable} />
            <Label htmlFor="proj-billable" className="font-normal">
              Billable
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !/^[A-Za-z0-9_-]+$/.test(code.trim()) || name.trim().length < 2} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewTaskDialog({
  project,
  onClose,
  onCreated,
}: {
  project: ProjectRow;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await post(`/timesheets/projects/${project.id}/tasks`, { name: name.trim() });
      toast.success("Task added.");
      onCreated();
    } catch (caught) {
      toast.error(failure(caught, "The task could not be added."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New task on {project.code}</DialogTitle>
          <DialogDescription>
            Once a project has tasks, every hour logged on it names one, and reports split the project&apos;s hours by task.
          </DialogDescription>
        </DialogHeader>
        <FormField htmlFor="task-name" label="Task">
          <Input id="task-name" maxLength={160} value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || name.trim().length < 2} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
