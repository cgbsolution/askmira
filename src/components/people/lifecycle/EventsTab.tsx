"use client";

import { CalendarClock, GitCommitHorizontal, Loader2, MoreHorizontal, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { get, post } from "@/lib/api";
import type {
  EmployeeRecord,
  LifecycleEvent,
  LifecycleEventType,
  LifecycleStatus,
} from "@/lib/types/people";
import { formatDate, parseISODate } from "@/lib/utils";

import { useFieldValue } from "../LifecycleTimeline";
import { EventStatusBadge } from "../StatusBadges";
import type { PickedEmployee } from "../EmployeePicker";
import { EVENT_STATUS, EVENT_TYPE, FIELD_LABEL, apiMessage, personName } from "../labels";
import { RaiseEventDialog } from "./RaiseEventDialog";

const ANY = "__any__";

type Decision = { event: LifecycleEvent; kind: "approve" | "reject" | "cancel" };

/**
 * Lifecycle events across the workspace.
 *
 * Approving and effecting are separate on purpose: an approved promotion dated
 * next month waits until next month. "Apply due events" runs the same sweep
 * the scheduler runs nightly, for an admin who cannot wait for it.
 */
export function EventsTab() {
  const { hasRole } = useAuth();
  const canRaise = hasRole("admin", "sub_admin");
  const canDecide = hasRole("admin");

  const [statusFilter, setStatusFilter] = useState<string>("pending_approval");
  const [typeFilter, setTypeFilter] = useState<string>(ANY);
  const params = new URLSearchParams();
  if (statusFilter !== ANY) params.set("event_status", statusFilter);
  if (typeFilter !== ANY) params.set("event_type", typeFilter);
  const query = params.toString();
  const { data, error, isLoading, reload } = useApiQuery<LifecycleEvent[]>(
    `/lifecycle/events${query ? `?${query}` : ""}`,
  );

  const [raising, setRaising] = useState(false);
  const [preselected, setPreselected] = useState<PickedEmployee | null>(null);

  // Arriving from a profile's "Raise event" (`?employee=<id>`): open the
  // dialog with that person already chosen.
  const searchParams = useSearchParams();
  const requested = searchParams.get("employee");
  useEffect(() => {
    if (!requested || !canRaise) return;
    let cancelled = false;
    get<EmployeeRecord>(`/employees/${requested}`)
      .then((person) => {
        if (cancelled) return;
        setPreselected({ id: person.id, label: `${personName(person)} (${person.employee_code})` });
        setRaising(true);
      })
      .catch(() => {
        if (!cancelled) toast.error("That employee could not be found. Choose them in the form instead.");
      });
    return () => {
      cancelled = true;
    };
  }, [requested, canRaise]);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [effecting, setEffecting] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const fieldValue = useFieldValue();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const effect = async (event: LifecycleEvent) => {
    setEffecting(event.id);
    try {
      await post(`/lifecycle/events/${event.id}/effect`);
      toast.success(`${EVENT_TYPE[event.event_type]} applied to ${event.employee_name}.`);
    } catch (caught) {
      toast.error(apiMessage(caught, "The event could not be applied; it is marked failed with the reason."));
    } finally {
      setEffecting(null);
      reload();
    }
  };

  const sweep = async () => {
    setSweeping(true);
    try {
      const result = await post<{ due: number; effected: number; failed: unknown[] }>("/lifecycle/effect-due");
      const failed = Array.isArray(result.failed) ? result.failed.length : 0;
      toast.success(
        `${result.effected} of ${result.due} due event${result.due === 1 ? "" : "s"} applied${failed ? `, ${failed} failed` : ""}.`,
      );
      reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "The sweep did not run."));
    } finally {
      setSweeping(false);
    }
  };

  const rows = data ?? [];

  return (
    <>
      <DataPanel
        title="Events"
        actions={
          <>
            {canDecide && (
              <Button size="sm" variant="outline" onClick={sweep} disabled={sweeping}>
                {sweeping ? <Loader2 className="animate-spin" /> : <CalendarClock />} Apply due events
              </Button>
            )}
            {canRaise && (
              <Button size="sm" onClick={() => setRaising(true)}>
                <Plus /> Raise event
              </Button>
            )}
          </>
        }
        toolbar={
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Every status</SelectItem>
                {(Object.keys(EVENT_STATUS) as LifecycleStatus[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {EVENT_STATUS[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-52" aria-label="Filter by event type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Every event type</SelectItem>
                {(Object.keys(EVENT_TYPE) as LifecycleEventType[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {EVENT_TYPE[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: GitCommitHorizontal,
          title: statusFilter === "pending_approval" ? "Nothing waiting for approval" : "No events match",
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Effective</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const due = parseISODate(row.effective_from) <= today;
              const changes = Object.entries(row.new_values);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{row.employee_name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{row.employee_code}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {EVENT_TYPE[row.event_type]}
                    <div className="max-w-56 truncate text-xs text-muted-foreground" title={row.reason}>
                      {row.reason}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {changes.map(([field, value]) => (
                      <div key={field}>
                        <span className="text-muted-foreground">{FIELD_LABEL[field] ?? field}: </span>
                        {fieldValue(field, value)}
                      </div>
                    ))}
                    {row.new_ctc_annual && (
                      <div>
                        <span className="text-muted-foreground">CTC: </span>
                        <Money value={row.new_ctc_annual} />
                      </div>
                    )}
                    {changes.length === 0 && !row.new_ctc_annual && "—"}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(row.effective_from)}</TableCell>
                  <TableCell>
                    <EventStatusBadge status={row.status} />
                    {row.failure_reason && (
                      <div className="mt-1 max-w-48 text-xs text-destructive">{row.failure_reason}</div>
                    )}
                    {row.cancelled_reason && (
                      <div className="mt-1 max-w-48 text-xs text-muted-foreground">{row.cancelled_reason}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {canDecide && ["pending_approval", "approved", "failed", "draft"].includes(row.status) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${row.employee_name}`}
                            disabled={effecting === row.id}
                          >
                            {effecting === row.id ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {row.status === "pending_approval" && (
                            <>
                              <DropdownMenuItem onSelect={() => setDecision({ event: row, kind: "approve" })}>
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setDecision({ event: row, kind: "reject" })}>
                                Reject
                              </DropdownMenuItem>
                            </>
                          )}
                          {(row.status === "approved" || row.status === "failed") && (
                            <DropdownMenuItem disabled={!due} onSelect={() => effect(row)}>
                              {due ? "Apply now" : `Applies on ${formatDate(row.effective_from)}`}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onSelect={() => setDecision({ event: row, kind: "cancel" })}
                          >
                            Cancel event
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DataPanel>

      <RaiseEventDialog
        open={raising}
        onOpenChange={(open) => {
          setRaising(open);
          if (!open) setPreselected(null);
        }}
        onRaised={reload}
        initialEmployee={preselected}
      />
      <DecisionDialog
        decision={decision}
        onOpenChange={(open) => !open && setDecision(null)}
        onDone={reload}
      />
    </>
  );
}

const DECISION_COPY = {
  approve: {
    title: "Approve",
    body: "It takes effect on its effective date — or now, if that date has passed and you apply it.",
    confirm: "Approve",
    noteLabel: "Note",
    needsNote: false,
  },
  reject: {
    title: "Reject",
    body: "The event stops here and nothing on the record changes.",
    confirm: "Reject",
    noteLabel: "Why it is rejected",
    needsNote: true,
  },
  cancel: {
    title: "Cancel",
    body: "The event is withdrawn. It stays in the history, marked cancelled with your reason.",
    confirm: "Cancel event",
    noteLabel: "Reason",
    needsNote: true,
  },
};

function DecisionDialog({
  decision,
  onOpenChange,
  onDone,
}: {
  decision: Decision | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const copy = decision ? DECISION_COPY[decision.kind] : null;

  const submit = async () => {
    if (!decision) return;
    setIsBusy(true);
    try {
      if (decision.kind === "cancel") {
        await post(`/lifecycle/events/${decision.event.id}/cancel`, { reason: note.trim() });
      } else {
        await post(`/lifecycle/events/${decision.event.id}/decide`, {
          approve: decision.kind === "approve",
          note: note.trim(),
        });
      }
      toast.success(`${copy?.title} recorded.`);
      setNote("");
      onDone();
      onOpenChange(false);
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not record the decision."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog
      open={decision !== null}
      onOpenChange={(next) => {
        if (isBusy) return;
        if (!next) setNote("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {copy?.title} {decision ? EVENT_TYPE[decision.event.event_type].toLowerCase() : ""} for{" "}
            {decision?.event.employee_name}
          </DialogTitle>
          <DialogDescription>{copy?.body}</DialogDescription>
        </DialogHeader>
        <FormField htmlFor="decision-note" label={copy?.noteLabel ?? "Note"} optional={!copy?.needsNote}>
          <Textarea id="decision-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Back
          </Button>
          <Button
            variant={decision?.kind === "approve" ? "default" : "destructive"}
            onClick={submit}
            disabled={isBusy || (copy?.needsNote === true && note.trim().length < 1)}
          >
            {isBusy && <Loader2 className="animate-spin" />} {copy?.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
