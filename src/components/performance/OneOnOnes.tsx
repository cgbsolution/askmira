"use client";

import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Loader2,
  Lock,
  MessagesSquare,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import React, { useState } from "react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { DatePicker } from "@/components/common/DatePicker";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { StatusBadge, useAction } from "@/components/performance/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { del, patch, post, put } from "@/lib/api";
import type {
  OneOnOne,
  OneOnOneDetail,
  OneOnOneItem,
  OneOnOnePartner,
  ReportOneOnOneSummary,
} from "@/lib/types/performance";
import { formatDate, formatDay, toISODate } from "@/lib/utils";

/** "10:30:00" → "10:30". */
function clock(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

function when(meeting: Pick<OneOnOne, "scheduled_on" | "start_time">): string {
  const time = clock(meeting.start_time);
  return `${formatDay(meeting.scheduled_on, true)}${time ? `, ${time}` : ""}`;
}

/**
 * 1:1s — the caller's own meetings from either side, and for a manager their
 * direct reports. Only the two people in a meeting can open it.
 */
export function OneOnOnesScreen() {
  const { user } = useAuth();
  const hasRecord = Boolean(user?.employee_id);
  const partners = useApiQuery<OneOnOnePartner[]>(hasRecord ? "/one-on-ones/partners" : null);
  const reports = useApiQuery<ReportOneOnOneSummary[]>(hasRecord ? "/one-on-ones/reports" : null);
  const meetings = useApiQuery<OneOnOne[]>(hasRecord ? "/one-on-ones" : null);
  const [open, setOpen] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<string | null>(null);
  const hasReports = (reports.data ?? []).length > 0;

  const reloadAll = () => {
    meetings.reload();
    reports.reload();
  };

  if (!hasRecord) {
    return (
      <PageShell title="1:1s" description="Regular conversations between you and your manager or your reports.">
        <Card tier="tier1">
          <EmptyState
            icon={Users}
            title="Your login is not linked to an employee record"
            description="1:1s are between employees. Ask HR to link your account."
          />
        </Card>
      </PageShell>
    );
  }

  const rows = meetings.data ?? [];
  const upcoming = rows
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on));
  const past = rows.filter((m) => m.status !== "scheduled");

  return (
    <PageShell
      title="1:1s"
      description="Your conversations with your manager and your reports. Only the two people in a 1:1 can see it."
      actions={
        <Button
          variant="accent"
          disabled={!partners.data?.length}
          onClick={() => setScheduling("")}
        >
          <CalendarPlus /> Schedule a 1:1
        </Button>
      }
    >
      {partners.data && partners.data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You have no manager or direct reports on your record, so there is nobody to schedule a 1:1 with yet.
        </p>
      )}
      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
          {hasReports && <TabsTrigger value="reports">My reports</TabsTrigger>}
        </TabsList>
        <TabsContent value="upcoming" className="mt-4">
          <MeetingTable
            title="Upcoming"
            rows={upcoming}
            isLoading={meetings.isLoading && !meetings.data}
            error={meetings.error?.detail}
            onRetry={meetings.reload}
            onOpen={setOpen}
            empty="No 1:1 is scheduled. Schedule one with your manager or one of your reports."
          />
        </TabsContent>
        <TabsContent value="past" className="mt-4">
          <MeetingTable
            title="Held and cancelled"
            rows={past}
            isLoading={meetings.isLoading && !meetings.data}
            error={meetings.error?.detail}
            onRetry={meetings.reload}
            onOpen={setOpen}
            empty="1:1s you have held or cancelled appear here."
          />
        </TabsContent>
        {hasReports && (
          <TabsContent value="reports" className="mt-4">
            <ReportsTable rows={reports.data ?? []} onOpen={setOpen} onSchedule={setScheduling} />
          </TabsContent>
        )}
      </Tabs>

      <Sheet open={open !== null} onOpenChange={(value) => !value && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>1:1</SheetTitle>
            <SheetDescription>Talking points and action items are shared; your notes are yours alone.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {open && <OneOnOnePanel meetingId={open} onChanged={reloadAll} />}
          </div>
        </SheetContent>
      </Sheet>

      {scheduling !== null && (
        <ScheduleDialog
          partners={partners.data ?? []}
          initialWith={scheduling}
          onClose={() => setScheduling(null)}
          onDone={(detail) => {
            setScheduling(null);
            reloadAll();
            setOpen(detail.id);
          }}
        />
      )}
    </PageShell>
  );
}

function MeetingTable({
  title,
  rows,
  isLoading,
  error,
  onRetry,
  onOpen,
  empty,
}: {
  title: string;
  rows: OneOnOne[];
  isLoading: boolean;
  error?: string;
  onRetry: () => void;
  onOpen: (id: string) => void;
  empty: string;
}) {
  return (
    <DataPanel
      title={title}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={rows.length === 0}
      empty={{ icon: MessagesSquare, title: "Nothing here yet", description: empty }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>With</TableHead>
            <TableHead>When</TableHead>
            <TableHead className="text-right">Talking points</TableHead>
            <TableHead className="text-right">Open actions</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => (
            <TableRow key={m.id}>
              <TableCell>
                <PersonCell
                  name={m.with_name}
                  subtitle={m.my_side === "manager" ? "Reports to you" : "Your manager"}
                  size="sm"
                />
              </TableCell>
              <TableCell>{when(m)}</TableCell>
              <TableCell className="text-right tabular-nums">{m.talking_points}</TableCell>
              <TableCell className="text-right tabular-nums">{m.open_action_items}</TableCell>
              <TableCell>
                <StatusBadge status={m.status} />
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="ghost" onClick={() => onOpen(m.id)}>
                  Open
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataPanel>
  );
}

function ReportsTable({
  rows,
  onOpen,
  onSchedule,
}: {
  rows: ReportOneOnOneSummary[];
  onOpen: (id: string) => void;
  onSchedule: (employeeId: string) => void;
}) {
  return (
    <DataPanel title="My reports" description="Where each 1:1 stands, and the action items still open between you.">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>Last held</TableHead>
            <TableHead>Next</TableHead>
            <TableHead className="text-right">Held</TableHead>
            <TableHead className="text-right">Open actions</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.employee_id}>
              <TableCell>
                <PersonCell name={r.name} subtitle={r.designation ?? r.employee_code} size="sm" />
              </TableCell>
              <TableCell>{r.last_held_on ? formatDay(r.last_held_on, true) : "Never"}</TableCell>
              <TableCell>{r.next_scheduled_on ? formatDay(r.next_scheduled_on, true) : "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{r.held_count}</TableCell>
              <TableCell className="text-right tabular-nums">{r.open_action_items}</TableCell>
              <TableCell className="text-right">
                {r.next_one_on_one_id ? (
                  <Button size="sm" variant="ghost" onClick={() => onOpen(r.next_one_on_one_id as string)}>
                    Open next
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => onSchedule(r.employee_id)}>
                    Schedule
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataPanel>
  );
}

function ScheduleDialog({
  partners,
  initialWith,
  onClose,
  onDone,
}: {
  partners: OneOnOnePartner[];
  initialWith: string;
  onClose: () => void;
  onDone: (detail: OneOnOneDetail) => void;
}) {
  const [withId, setWithId] = useState(initialWith || (partners.length === 1 ? partners[0].employee_id : ""));
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("30");
  const [agenda, setAgenda] = useState("");
  const [repeat, setRepeat] = useState("none");
  const { busy, run } = useAction();
  const today = toISODate(new Date());
  const valid = withId && day && /^\d{1,3}$/.test(duration) && Number(duration) > 0 && Number(duration) <= 480;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule a 1:1</DialogTitle>
          <DialogDescription>
            With your manager or one of your reports. They are notified, and either of you can add talking points.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <FormField htmlFor="oo-with" label="With">
            <Select value={withId} onValueChange={setWithId}>
              <SelectTrigger id="oo-with" className="w-full">
                <SelectValue placeholder="Choose a person" />
              </SelectTrigger>
              <SelectContent>
                {partners.map((p) => (
                  <SelectItem key={p.employee_id} value={p.employee_id}>
                    {p.name}
                    <span className="text-muted-foreground">
                      {" "}
                      · {p.relation === "manager" ? "your manager" : "reports to you"}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField htmlFor="oo-day" label="Date" className="sm:col-span-1">
              <DatePicker id="oo-day" value={day} onChange={setDay} min={today} />
            </FormField>
            <FormField htmlFor="oo-time" label="Time" optional>
              <Input id="oo-time" type="time" className="h-11" value={time} onChange={(e) => setTime(e.target.value)} />
            </FormField>
            <FormField htmlFor="oo-duration" label="Minutes">
              <Input
                id="oo-duration"
                inputMode="numeric"
                className="h-11"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </FormField>
          </div>
          <FormField htmlFor="oo-repeat" label="Repeats" hint="The next one is booked when this one is held or cancelled.">
            <Select value={repeat} onValueChange={setRepeat}>
              <SelectTrigger id="oo-repeat" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Does not repeat</SelectItem>
                <SelectItem value="1">Every week</SelectItem>
                <SelectItem value="2">Every two weeks</SelectItem>
                <SelectItem value="4">Every four weeks</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="oo-agenda" label="Agenda" optional hint="One talking point per line.">
            <Textarea id="oo-agenda" rows={4} maxLength={4000} value={agenda} onChange={(e) => setAgenda(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || busy !== null}
            onClick={async () => {
              const r = await run(
                "schedule",
                () =>
                  post<OneOnOneDetail>("/one-on-ones", {
                    with_employee_id: withId,
                    scheduled_on: day,
                    start_time: time || null,
                    duration_minutes: Number(duration),
                    repeat_every_weeks: repeat === "none" ? null : Number(repeat),
                    agenda: agenda
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .slice(0, 20),
                  }),
                "1:1 scheduled.",
              );
              if (r) onDone(r);
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One meeting: its agenda, action items, the caller's private notes and its outcome. */
export function OneOnOnePanel({ meetingId, onChanged }: { meetingId: string; onChanged: () => void }) {
  const { data, error, isLoading, reload, setData } = useApiQuery<OneOnOneDetail>(`/one-on-ones/${meetingId}`);
  const { busy, run } = useAction();
  const [rescheduling, setRescheduling] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  if (isLoading && !data) return <Skeleton className="h-64 w-full" />;
  if (error) return <ErrorState message={error.detail} onRetry={reload} />;
  if (!data) return null;

  const scheduled = data.status === "scheduled";
  const apply = (next: OneOnOneDetail | undefined) => {
    if (next) {
      setData(next);
      onChanged();
    }
  };
  const talking = data.items.filter((i) => i.kind === "talking_point");
  const actions = data.items.filter((i) => i.kind === "action_item");
  const people = [
    { id: data.manager_employee_id, name: data.manager_name },
    { id: data.report_employee_id, name: data.report_name },
  ];

  const toggle = async (item: OneOnOneItem) =>
    apply(
      await run("toggle", () =>
        patch<OneOnOneDetail>(`/one-on-ones/${data.id}/items/${item.id}`, { done: !item.done_at }),
      ),
    );

  return (
    <div className="grid gap-4">
      <Card tier="tier1" className="gap-3">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {data.with_name} <StatusBadge status={data.status} />
          </CardTitle>
          <CardDescription>
            {when(data)} · {data.duration_minutes} min
            {data.repeat_every_weeks ? ` · every ${data.repeat_every_weeks === 1 ? "week" : `${data.repeat_every_weeks} weeks`}` : ""} ·{" "}
            {data.my_side === "manager" ? `${data.with_name} reports to you` : `${data.with_name} is your manager`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {scheduled ? (
            <>
              <Button size="sm" onClick={() => setCompleting(true)}>
                <CalendarCheck /> Mark as held
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRescheduling(true)}>
                <CalendarClock /> Reschedule
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setReason("");
                  setCancelling(true);
                }}
              >
                <X /> Cancel 1:1
              </Button>
            </>
          ) : data.status === "completed" ? (
            <p className="text-sm text-muted-foreground">Held · marked on {formatDate(data.completed_at)}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Cancelled {formatDate(data.cancelled_at)}
              {data.cancel_reason ? ` — ${data.cancel_reason}` : ""}
            </p>
          )}
        </CardContent>
        {data.summary && (
          <CardContent>
            <p className="text-xs font-medium text-muted-foreground">Summary</p>
            <p className="whitespace-pre-line text-sm text-foreground">{data.summary}</p>
          </CardContent>
        )}
      </Card>

      {data.carried_over.length > 0 && (
        <Card tier="tier1" className="gap-3">
          <CardHeader>
            <CardTitle>Still open from earlier 1:1s</CardTitle>
            <CardDescription>Action items you agreed before and have not ticked off.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionList items={data.carried_over} onToggle={toggle} disabled={busy !== null} />
          </CardContent>
        </Card>
      )}

      <Card tier="tier1" className="gap-3">
        <CardHeader>
          <CardTitle>Talking points</CardTitle>
          <CardDescription>Either of you can add to the agenda before you meet.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {talking.length === 0 ? (
            <p className="text-sm text-muted-foreground">No talking points yet.</p>
          ) : (
            <ul className="space-y-2">
              {talking.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{item.body}</p>
                    <p className="text-xs text-muted-foreground">{item.added_by_name ?? "Someone"}</p>
                  </div>
                  {item.is_mine && scheduled && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Remove talking point"
                      disabled={busy !== null}
                      onClick={async () => {
                        const r = await run(
                          "remove",
                          async () => {
                            await del(`/one-on-ones/${data.id}/items/${item.id}`);
                            return true;
                          },
                          "Removed.",
                        );
                        if (r !== undefined) {
                          reload();
                          onChanged();
                        }
                      }}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {scheduled && <AddTalkingPoint meetingId={data.id} onAdded={apply} />}
        </CardContent>
      </Card>

      <Card tier="tier1" className="gap-3">
        <CardHeader>
          <CardTitle>Action items</CardTitle>
          <CardDescription>Who does what, by when. They carry into your next 1:1 until ticked off.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No action items yet.</p>
          ) : (
            <ActionList items={actions} onToggle={toggle} disabled={busy !== null} />
          )}
          {scheduled && <AddActionItem meetingId={data.id} people={people} onAdded={apply} />}
        </CardContent>
      </Card>

      <PrivateNote meeting={data} onSaved={apply} />

      {rescheduling && (
        <RescheduleDialog meeting={data} onClose={() => setRescheduling(false)} onDone={(next) => {
          setRescheduling(false);
          apply(next);
        }} />
      )}
      {completing && (
        <CompleteDialog meeting={data} onClose={() => setCompleting(false)} onDone={(next) => {
          setCompleting(false);
          apply(next);
        }} />
      )}
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title="Cancel this 1:1?"
        description={`${data.with_name} is told it is off. Its talking points and action items stay on record.`}
        confirmLabel="Cancel 1:1"
        cancelLabel="Keep it"
        destructive
        onConfirm={async () => {
          const next = await run(
            "cancel",
            () => post<OneOnOneDetail>(`/one-on-ones/${data.id}/cancel`, { reason: reason.trim() || null }),
            "1:1 cancelled.",
          );
          if (next === undefined) throw new Error("not cancelled");
          apply(next);
        }}
      >
        <FormField htmlFor="oo-cancel-reason" label="Reason" optional>
          <Textarea id="oo-cancel-reason" rows={2} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </ConfirmDialog>
    </div>
  );
}

function ActionList({
  items,
  onToggle,
  disabled,
}: {
  items: OneOnOneItem[];
  onToggle: (item: OneOnOneItem) => void;
  disabled: boolean;
}) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3 rounded-md border border-border px-3 py-2">
          <Checkbox
            id={`action-${item.id}`}
            className="mt-0.5"
            checked={Boolean(item.done_at)}
            disabled={disabled}
            onCheckedChange={() => onToggle(item)}
            aria-label={item.done_at ? "Mark as not done" : "Mark as done"}
          />
          <div className="min-w-0">
            <p className={item.done_at ? "text-sm text-muted-foreground line-through" : "text-sm text-foreground"}>
              {item.body}
            </p>
            <p className="text-xs text-muted-foreground">
              {item.owner_name ?? "Unassigned"}
              {item.due_on ? ` · due ${formatDay(item.due_on, true)}` : ""}
              {item.from_meeting_on ? ` · from the 1:1 on ${formatDay(item.from_meeting_on, true)}` : ""}
              {item.done_at ? ` · done ${formatDate(item.done_at)}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function AddTalkingPoint({ meetingId, onAdded }: { meetingId: string; onAdded: (d: OneOnOneDetail | undefined) => void }) {
  const [body, setBody] = useState("");
  const { busy, run } = useAction();
  return (
    <div className="flex gap-2">
      <Input
        aria-label="New talking point"
        placeholder="Add a talking point"
        maxLength={2000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button
        variant="outline"
        disabled={!body.trim() || busy !== null}
        onClick={async () => {
          const r = await run("add", () =>
            post<OneOnOneDetail>(`/one-on-ones/${meetingId}/items`, { kind: "talking_point", body: body.trim() }),
          );
          if (r) {
            setBody("");
            onAdded(r);
          }
        }}
      >
        <Plus /> Add
      </Button>
    </div>
  );
}

function AddActionItem({
  meetingId,
  people,
  onAdded,
}: {
  meetingId: string;
  people: { id: string; name: string }[];
  onAdded: (d: OneOnOneDetail | undefined) => void;
}) {
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [owner, setOwner] = useState(user?.employee_id ?? people[0].id);
  const [due, setDue] = useState("");
  const { busy, run } = useAction();
  return (
    <div className="grid gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-6">
      <FormField htmlFor={`ai-body-${meetingId}`} label="Action" className="sm:col-span-6">
        <Input id={`ai-body-${meetingId}`} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
      </FormField>
      <FormField htmlFor={`ai-owner-${meetingId}`} label="Owner" className="sm:col-span-3">
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger id={`ai-owner-${meetingId}`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {people.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField htmlFor={`ai-due-${meetingId}`} label="Due" optional className="sm:col-span-3">
        <DatePicker id={`ai-due-${meetingId}`} value={due} onChange={setDue} />
      </FormField>
      <div className="sm:col-span-6">
        <Button
          size="sm"
          variant="outline"
          disabled={!body.trim() || busy !== null}
          onClick={async () => {
            const r = await run("action", () =>
              post<OneOnOneDetail>(`/one-on-ones/${meetingId}/items`, {
                kind: "action_item",
                body: body.trim(),
                owner_employee_id: owner,
                due_on: due || null,
              }),
            );
            if (r) {
              setBody("");
              setDue("");
              onAdded(r);
            }
          }}
        >
          <Plus /> Add action item
        </Button>
      </div>
    </div>
  );
}

function PrivateNote({ meeting, onSaved }: { meeting: OneOnOneDetail; onSaved: (d: OneOnOneDetail | undefined) => void }) {
  const [body, setBody] = useState(meeting.my_note ?? "");
  const { busy, run } = useAction();
  const dirty = body !== (meeting.my_note ?? "");
  return (
    <Card tier="tier1" className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-4 text-muted-foreground" /> My private notes
        </CardTitle>
        <CardDescription>
          Only you can read these — not {meeting.with_name}, and not HR.
          {meeting.my_note_updated_at ? ` Saved ${formatDate(meeting.my_note_updated_at)}.` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Textarea
          aria-label="My private notes"
          rows={5}
          maxLength={10000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div>
          <Button
            size="sm"
            variant="outline"
            disabled={!dirty || busy !== null}
            onClick={async () =>
              onSaved(
                await run(
                  "note",
                  () => put<OneOnOneDetail>(`/one-on-ones/${meeting.id}/my-note`, { body }),
                  "Notes saved.",
                ),
              )
            }
          >
            {busy && <Loader2 className="animate-spin" />} Save notes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RescheduleDialog({
  meeting,
  onClose,
  onDone,
}: {
  meeting: OneOnOneDetail;
  onClose: () => void;
  onDone: (d: OneOnOneDetail) => void;
}) {
  const [day, setDay] = useState(meeting.scheduled_on);
  const [time, setTime] = useState(clock(meeting.start_time) ?? "");
  const { busy, run } = useAction();
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule</DialogTitle>
          <DialogDescription>{meeting.with_name} is told about the new time.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField htmlFor="rs-day" label="Date">
            <DatePicker id="rs-day" value={day} onChange={setDay} />
          </FormField>
          <FormField htmlFor="rs-time" label="Time" optional>
            <Input id="rs-time" type="time" className="h-11" value={time} onChange={(e) => setTime(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!day || busy !== null}
            onClick={async () => {
              const r = await run(
                "reschedule",
                () =>
                  patch<OneOnOneDetail>(`/one-on-ones/${meeting.id}`, {
                    scheduled_on: day,
                    start_time: time || null,
                    clear_start_time: !time,
                  }),
                "1:1 moved.",
              );
              if (r) onDone(r);
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompleteDialog({
  meeting,
  onClose,
  onDone,
}: {
  meeting: OneOnOneDetail;
  onClose: () => void;
  onDone: (d: OneOnOneDetail) => void;
}) {
  const [summary, setSummary] = useState("");
  const { busy, run } = useAction();
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as held</DialogTitle>
          <DialogDescription>
            A short shared summary helps you both next time. Open action items carry into your next 1:1.
          </DialogDescription>
        </DialogHeader>
        <FormField htmlFor="oo-summary" label="Summary" optional hint={`${meeting.with_name} sees this too.`}>
          <Textarea id="oo-summary" rows={4} maxLength={10000} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy !== null}
            onClick={async () => {
              const r = await run(
                "complete",
                () => post<OneOnOneDetail>(`/one-on-ones/${meeting.id}/complete`, { summary: summary.trim() || null }),
                "1:1 marked as held.",
              );
              if (r) onDone(r);
            }}
          >
            {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Mark as held
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
