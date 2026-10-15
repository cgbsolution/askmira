"use client";

import { ChevronLeft, ChevronRight, ClipboardList, Loader2, Plus, Send, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageShell } from "@/components/common/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post, put } from "@/lib/api";
import { toISODate } from "@/lib/utils";

export interface ProjectTask {
  id: string;
  project_id: string;
  name: string;
  active: boolean;
}

export interface ProjectRow {
  id: string;
  code: string;
  name: string;
  client: string | null;
  billable: boolean;
  active: boolean;
  tasks: ProjectTask[];
}

interface Entry {
  id?: string;
  work_date: string;
  project_id: string | null;
  task_id: string | null;
  task?: string | null;
  hours: string;
  description: string | null;
}

interface Week {
  id: string | null;
  week_start: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  decision_note: string | null;
  total_hours: string;
  entries: Entry[];
}

const NO_PROJECT = "__none";
const NO_TASK = "__none_task";
const dayName = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });

function mondayOf(day: Date): Date {
  const copy = new Date(day);
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function failure(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/** Your hours for a week, against projects; saved as a draft, then submitted for approval. */
export function TimesheetScreen() {
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const weekOf = toISODate(monday);
  const { data, error, isLoading, reload } = useApiQuery<Week>(`/timesheets/me?week_of=${weekOf}`);
  const projects = useApiQuery<ProjectRow[]>("/timesheets/projects");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setEntries(data.entries);
  }, [data]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => toISODate(new Date(monday.getTime() + i * 86_400_000))),
    [monday],
  );
  const editable = !data || data.status === "draft" || data.status === "rejected";
  const total = entries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);

  const move = (weeks: number) => setMonday((m) => new Date(m.getTime() + weeks * 7 * 86_400_000));
  const setEntry = (index: number, patch: Partial<Entry>) => setEntries((c) => c.map((e, i) => (i === index ? { ...e, ...patch } : e)));

  const save = async (andSubmit: boolean) => {
    setBusy(true);
    try {
      await put(`/timesheets/me?week_of=${weekOf}`, {
        entries: entries
          .filter((e) => Number(e.hours) > 0)
          .map((e) => ({
            work_date: e.work_date,
            project_id: e.project_id,
            task_id: e.project_id ? e.task_id : null,
            hours: e.hours,
            description: e.description?.trim() || null,
          })),
      });
      if (andSubmit) {
        await post(`/timesheets/me/submit?week_of=${weekOf}`);
        toast.success("Week submitted for approval.");
      } else {
        toast.success("Draft saved.");
      }
      reload();
    } catch (caught) {
      toast.error(failure(caught, "The week could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title="Timesheet" description="Hours against projects, a week at a time. Your manager approves the week.">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" /> Week of {dayName.format(monday)}
            {data && (
              <Badge variant={data.status === "approved" ? "success" : data.status === "submitted" ? "warning" : data.status === "rejected" ? "muted" : "outline"}>
                {data.status}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>{total.toFixed(2)} hours this week.</CardDescription>
          <CardAction className="flex gap-1">
            <Button size="icon" variant="ghost" aria-label="Previous week" onClick={() => move(-1)}>
              <ChevronLeft />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Next week" onClick={() => move(1)}>
              <ChevronRight />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error.detail}</AlertDescription>
            </Alert>
          )}
          {data?.status === "rejected" && data.decision_note && (
            <Alert variant="warning">
              <AlertDescription>Sent back: {data.decision_note}</AlertDescription>
            </Alert>
          )}
          {isLoading && !data ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Day</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead className="w-24">Hours</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Select value={entry.work_date} onValueChange={(v) => setEntry(index, { work_date: v })} disabled={!editable}>
                        <SelectTrigger aria-label="Day" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {days.map((d) => (
                            <SelectItem key={d} value={d}>
                              {dayName.format(new Date(`${d}T00:00:00`))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={entry.project_id ?? NO_PROJECT}
                        onValueChange={(v) => setEntry(index, { project_id: v === NO_PROJECT ? null : v, task_id: null })}
                        disabled={!editable}
                      >
                        <SelectTrigger aria-label="Project" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_PROJECT}>No project</SelectItem>
                          {(projects.data ?? []).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.code} · {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <TaskSelect
                        project={(projects.data ?? []).find((p) => p.id === entry.project_id)}
                        value={entry.task_id}
                        label={entry.task}
                        disabled={!editable}
                        onChange={(task_id) => setEntry(index, { task_id })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label="Hours"
                        inputMode="decimal"
                        className="tabular-nums"
                        value={entry.hours}
                        disabled={!editable}
                        onChange={(e) => setEntry(index, { hours: e.target.value.replace(/[^\d.]/g, "") })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label="What"
                        maxLength={500}
                        value={entry.description ?? ""}
                        disabled={!editable}
                        onChange={(e) => setEntry(index, { description: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      {editable && (
                        <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setEntries((c) => c.filter((_, i) => i !== index))}>
                          <Trash2 />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {editable && (
            <div className="flex flex-wrap justify-between gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setEntries((c) => [...c, { work_date: days[0], project_id: null, task_id: null, hours: "", description: null }])
                }
              >
                <Plus /> Add a line
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" disabled={busy} onClick={() => void save(false)}>
                  Save draft
                </Button>
                <Button disabled={busy || total <= 0} onClick={() => void save(true)}>
                  {busy ? <Loader2 className="animate-spin" /> : <Send />} Submit week
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

/** The project's open tasks; nothing to choose for a project without any. */
function TaskSelect({
  project,
  value,
  label,
  disabled,
  onChange,
}: {
  project: ProjectRow | undefined;
  value: string | null;
  label?: string | null;
  disabled: boolean;
  onChange: (taskId: string | null) => void;
}) {
  const tasks = project?.tasks ?? [];
  if (!project || tasks.length === 0) {
    return <span className="text-sm text-muted-foreground">{label ?? "—"}</span>;
  }
  return (
    <Select value={value ?? NO_TASK} onValueChange={(v) => onChange(v === NO_TASK ? null : v)} disabled={disabled}>
      <SelectTrigger aria-label="Task" className="w-full">
        <SelectValue placeholder="Choose a task" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_TASK}>Choose a task</SelectItem>
        {tasks.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
