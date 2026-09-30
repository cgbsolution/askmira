"use client";

import { Loader2, Save } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { PersonCell } from "@/components/common/PersonCell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { patch, post } from "@/lib/api";
import type {
  AgentOption,
  TicketDetail,
  TicketPriority,
  TicketStatus,
} from "@/lib/types/helpdesk";
import { formatDateTime, humanizeRole } from "@/lib/utils";

import {
  ConfidentialBadge,
  InlineError,
  PRIORITIES,
  PRIORITY_LABEL,
  PriorityBadge,
  STATUS_LABEL,
  SlaBadge,
  TicketStatusBadge,
  errorDetail,
  relativeTime,
} from "./shared";
import { ReplyBox, TicketThread } from "./TicketThread";

const UNASSIGNED = "__unassigned";

/**
 * Where an agent may move a ticket from each status. Mirrors the server's
 * rule so the menu offers only what will be accepted; the server still checks.
 */
const MOVES: Record<TicketStatus, TicketStatus[]> = {
  open: ["in_progress", "waiting_on_employee", "resolved", "closed"],
  in_progress: ["open", "waiting_on_employee", "resolved", "closed"],
  waiting_on_employee: ["open", "in_progress", "resolved", "closed"],
  resolved: ["in_progress", "closed"],
  closed: [],
  cancelled: [],
};

/** One ticket as the person working it sees it: the thread, notes, and the controls. */
export function AgentTicketSheet({
  ticketId,
  onOpenChange,
  onChanged,
}: {
  ticketId: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const query = useApiQuery<TicketDetail>(ticketId ? `/helpdesk/tickets/${ticketId}` : null);
  const ticket = query.data && query.data.id === ticketId ? query.data : null;
  const active =
    ticket !== null && ["open", "in_progress", "waiting_on_employee"].includes(ticket.status);

  const update = (next: TicketDetail) => {
    query.setData(next);
    onChanged();
  };

  return (
    <Sheet open={ticketId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        {query.error && !ticket ? (
          <>
            <SheetHeader>
              <SheetTitle>Ticket</SheetTitle>
            </SheetHeader>
            <ErrorState message={query.error.detail} onRetry={query.reload} />
          </>
        ) : !ticket ? (
          <>
            <SheetHeader>
              <SheetTitle>Loading ticket…</SheetTitle>
            </SheetHeader>
            <div className="space-y-3 px-4">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-32 w-full" />
            </div>
          </>
        ) : (
          <>
            <SheetHeader className="pr-10">
              <p className="text-xs font-medium text-muted-foreground tabular-nums">
                {ticket.ticket_number} · {ticket.category_name}
              </p>
              <SheetTitle>{ticket.subject}</SheetTitle>
              <SheetDescription>
                Raised {formatDateTime(ticket.created_at)}
                {ticket.raised_on_behalf && " by HR on the employee's behalf"}
                {ticket.reopened_count > 0 &&
                  ` · reopened ${ticket.reopened_count} time${ticket.reopened_count === 1 ? "" : "s"}`}
              </SheetDescription>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <TicketStatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                <SlaBadge state={ticket.sla_state} />
                {ticket.is_confidential && <ConfidentialBadge />}
              </div>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <PersonCell
                  name={ticket.employee_name}
                  subtitle={ticket.employee_code || undefined}
                />
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <Fact
                    label="Due"
                    value={formatDateTime(ticket.due_at)}
                    hint={active ? relativeTime(ticket.due_at) : undefined}
                  />
                  <Fact label="SLA" value={`${ticket.sla_hours} h`} />
                  <Fact label="First response" value={formatDateTime(ticket.first_response_at)} />
                  <Fact label="Resolved" value={formatDateTime(ticket.resolved_at)} />
                  {ticket.satisfaction_rating !== null && (
                    <Fact
                      label="Rating"
                      value={`${ticket.satisfaction_rating} / 5`}
                      hint={ticket.satisfaction_comment ?? undefined}
                    />
                  )}
                </dl>
              </div>

              {ticket.can_manage && <ManagePanel ticket={ticket} onUpdated={update} />}

              <TicketThread ticket={ticket} />

              {ticket.can_reply && <ReplyBox ticket={ticket} onPosted={update} />}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-foreground tabular-nums">{value}</dd>
      {hint && <dd className="truncate text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

function ManagePanel({
  ticket,
  onUpdated,
}: {
  ticket: TicketDetail;
  onUpdated: (ticket: TicketDetail) => void;
}) {
  const assignees = useApiQuery<AgentOption[]>(`/helpdesk/tickets/${ticket.id}/assignees`);
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    setStatus(ticket.status);
    setPriority(ticket.priority);
    setNote("");
    setError(null);
  }, [ticket.id, ticket.status, ticket.priority]);

  const changed = status !== ticket.status || priority !== ticket.priority;
  const closingUnresolved = status === "closed" && ticket.status !== "resolved";
  const noteLabel =
    status === "resolved" && ticket.status !== "resolved"
      ? "Resolution note"
      : closingUnresolved
        ? "Why is it being closed?"
        : "Note to the employee";

  const save = async () => {
    if (closingUnresolved && !note.trim()) {
      setError("Say why you are closing a ticket that was not resolved.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const updated = await patch<TicketDetail>(`/helpdesk/tickets/${ticket.id}`, {
        status: status !== ticket.status ? status : null,
        priority: priority !== ticket.priority ? priority : null,
        note: note.trim() || null,
      });
      toast.success(`${ticket.ticket_number} updated`);
      onUpdated(updated);
    } catch (caught) {
      setError(errorDetail(caught, "Could not update the ticket."));
    } finally {
      setIsSaving(false);
    }
  };

  const assign = async (value: string) => {
    setIsAssigning(true);
    try {
      const updated = await post<TicketDetail>(`/helpdesk/tickets/${ticket.id}/assign`, {
        assignee_user_id: value === UNASSIGNED ? null : value,
      });
      toast.success(
        updated.assignee_name ? `Assigned to ${updated.assignee_name}` : "Ticket unassigned",
      );
      onUpdated(updated);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not assign the ticket."));
    } finally {
      setIsAssigning(false);
    }
  };

  const options = assignees.data ?? [];
  const currentMissing =
    ticket.assignee_user_id !== null &&
    !options.some((option) => option.user_id === ticket.assignee_user_id);

  return (
    <Card tier="tier1" className="gap-4 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-base">Work this ticket</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 px-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField htmlFor="agent-assignee" label="Assignee">
            <Select
              value={ticket.assignee_user_id ?? UNASSIGNED}
              onValueChange={(value) => void assign(value)}
              disabled={isAssigning || assignees.isLoading}
            >
              <SelectTrigger id="agent-assignee" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {currentMissing && ticket.assignee_user_id && (
                  <SelectItem value={ticket.assignee_user_id}>{ticket.assignee_name}</SelectItem>
                )}
                {options.map((option) => (
                  <SelectItem key={option.user_id} value={option.user_id}>
                    {option.full_name} ·{" "}
                    {option.is_category_owner ? "category owner" : humanizeRole(option.role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="agent-status" label="Status">
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as TicketStatus)}
              disabled={isSaving}
            >
              <SelectTrigger id="agent-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ticket.status}>{STATUS_LABEL[ticket.status]}</SelectItem>
                {MOVES[ticket.status].map((value) => (
                  <SelectItem key={value} value={value}>
                    {STATUS_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="agent-priority" label="Priority">
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as TicketPriority)}
              disabled={isSaving}
            >
              <SelectTrigger id="agent-priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {PRIORITY_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        {changed && (
          <FormField
            htmlFor="agent-note"
            label={noteLabel}
            optional={!closingUnresolved}
            required={closingUnresolved}
            hint="Posted to the employee as a reply."
          >
            <Textarea
              id="agent-note"
              rows={2}
              maxLength={10_000}
              value={note}
              disabled={isSaving}
              onChange={(event) => setNote(event.target.value)}
            />
          </FormField>
        )}
        {error && <InlineError>{error}</InlineError>}
        {changed && (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={isSaving}
              onClick={() => {
                setStatus(ticket.status);
                setPriority(ticket.priority);
                setNote("");
                setError(null);
              }}
            >
              Discard
            </Button>
            <Button disabled={isSaving} onClick={() => void save()}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
              Save changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
