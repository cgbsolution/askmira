"use client";

import { Ban, Loader2, RotateCcw, Star } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { post } from "@/lib/api";
import type { TicketDetail } from "@/lib/types/helpdesk";
import { cn, formatDateTime } from "@/lib/utils";

import {
  ConfidentialBadge,
  PriorityBadge,
  TicketStatusBadge,
  errorDetail,
  relativeTime,
} from "./shared";
import { ReplyBox, TicketThread } from "./TicketThread";

/**
 * One of the employee's own tickets: the conversation, a reply box while it is
 * open, and — once HR resolves it — reopen or rate. Which of those appear is
 * the server's `can_*` flags, not a guess from the status.
 */
export function MyTicketSheet({
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

  const update = (next: TicketDetail) => {
    query.setData(next);
    onChanged();
  };

  return (
    <Sheet open={ticketId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
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
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </>
        ) : (
          <TicketBody ticket={ticket} onUpdated={update} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function TicketBody({
  ticket,
  onUpdated,
}: {
  ticket: TicketDetail;
  onUpdated: (ticket: TicketDetail) => void;
}) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  useEffect(() => {
    setCancelReason("");
    setReopenReason("");
  }, [ticket.id]);

  const active = ["open", "in_progress", "waiting_on_employee"].includes(ticket.status);

  const cancel = async () => {
    try {
      const updated = await post<TicketDetail>(`/helpdesk/tickets/${ticket.id}/cancel`, {
        reason: cancelReason.trim() || null,
      });
      toast.success(`${ticket.ticket_number} cancelled`);
      onUpdated(updated);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not cancel the ticket."));
      throw caught;
    }
  };

  const reopen = async () => {
    if (!reopenReason.trim()) {
      toast.error("Say what is still wrong, so HR can pick it up.");
      throw new Error("reason required");
    }
    try {
      const updated = await post<TicketDetail>(`/helpdesk/tickets/${ticket.id}/reopen`, {
        reason: reopenReason.trim(),
      });
      toast.success(`${ticket.ticket_number} reopened`);
      onUpdated(updated);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not reopen the ticket."));
      throw caught;
    }
  };

  return (
    <>
      <SheetHeader className="pr-10">
        <p className="text-xs font-medium text-muted-foreground tabular-nums">
          {ticket.ticket_number} · {ticket.category_name}
        </p>
        <SheetTitle className="font-display text-xl">{ticket.subject}</SheetTitle>
        <SheetDescription>
          Raised {formatDateTime(ticket.created_at)}
          {ticket.assignee_name
            ? ` · handled by ${ticket.assignee_name}`
            : " · waiting for HR to pick it up"}
        </SheetDescription>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <TicketStatusBadge status={ticket.status} forRequester />
          <PriorityBadge priority={ticket.priority} />
          {ticket.is_confidential && <ConfidentialBadge />}
        </div>
        {active && (
          <p className="pt-1 text-xs text-muted-foreground">
            Expected by {formatDateTime(ticket.due_at)} ({relativeTime(ticket.due_at)})
          </p>
        )}
      </SheetHeader>

      <div className="space-y-5 px-4 pb-6">
        <TicketThread ticket={ticket} />

        {ticket.can_reply && <ReplyBox ticket={ticket} onPosted={onUpdated} />}

        {(ticket.can_rate || ticket.can_reopen) && (
          <section className="space-y-3 rounded-lg border border-border p-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Did this sort it out?</h3>
              <p className="text-sm text-muted-foreground">
                Rate how it was handled — rating closes the ticket.
                {ticket.reopen_until &&
                  ` If something is still wrong, reopen it by ${formatDateTime(ticket.reopen_until)}.`}
              </p>
            </div>
            {ticket.can_rate && <RateForm ticket={ticket} onRated={onUpdated} />}
            {ticket.can_reopen && (
              <Button variant="outline" onClick={() => setConfirmReopen(true)}>
                <RotateCcw /> Reopen
              </Button>
            )}
          </section>
        )}

        {ticket.satisfaction_rating !== null && (
          <section className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Your rating</h3>
            <Stars value={ticket.satisfaction_rating} />
            {ticket.satisfaction_comment && (
              <p className="text-sm text-foreground">{ticket.satisfaction_comment}</p>
            )}
          </section>
        )}

        {ticket.can_cancel && (
          <>
            <Separator />
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setConfirmCancel(true)}>
                <Ban /> Cancel ticket
              </Button>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={`Cancel ${ticket.ticket_number}?`}
        description="HR stops working on it. A cancelled ticket cannot be reopened; raise a new one if you need to."
        confirmLabel="Cancel ticket"
        cancelLabel="Keep it"
        destructive
        onConfirm={cancel}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="cancel-reason">
            Reason <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="cancel-reason"
            rows={2}
            maxLength={2000}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="e.g. Sorted it out with my manager."
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmReopen}
        onOpenChange={setConfirmReopen}
        title={`Reopen ${ticket.ticket_number}?`}
        description="It goes back to HR with your note, and a fresh deadline."
        confirmLabel="Reopen"
        onConfirm={reopen}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="reopen-reason">What is still wrong?</Label>
          <Textarea
            id="reopen-reason"
            rows={3}
            maxLength={5000}
            value={reopenReason}
            onChange={(event) => setReopenReason(event.target.value)}
          />
        </div>
      </ConfirmDialog>
    </>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn("size-4", n <= value ? "fill-accent text-accent" : "text-muted-foreground")}
        />
      ))}
    </span>
  );
}

function RateForm({
  ticket,
  onRated,
}: {
  ticket: TicketDetail;
  onRated: (ticket: TicketDetail) => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    setIsSaving(true);
    try {
      const updated = await post<TicketDetail>(`/helpdesk/tickets/${ticket.id}/rate`, {
        rating,
        comment: comment.trim() || null,
      });
      toast.success("Thanks for the rating");
      onRated(updated);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not save the rating."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-1" role="group" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <Button
            key={n}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`${n} out of 5`}
            aria-pressed={rating === n}
            disabled={isSaving}
            onClick={() => setRating(n)}
          >
            <Star
              className={cn(n <= rating ? "fill-accent text-accent" : "text-muted-foreground")}
            />
          </Button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <Textarea
            rows={2}
            maxLength={2000}
            value={comment}
            disabled={isSaving}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Anything HR should know? (optional)"
            aria-label="Rating comment"
          />
          <div>
            <Button disabled={isSaving} onClick={() => void submit()}>
              {isSaving && <Loader2 className="animate-spin" />}
              Submit rating
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
