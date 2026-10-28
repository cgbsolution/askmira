"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
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
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type { AssignmentType, Position } from "@/lib/types/people";
import { toISODate } from "@/lib/utils";

import { EmployeePicker, type PickedEmployee } from "../EmployeePicker";
import { apiMessage } from "../labels";
import { DatePicker } from "@/components/common/DatePicker";

export type StatusAction = "freeze" | "unfreeze" | "abolish";

const STATUS_COPY: Record<StatusAction, { title: string; body: string; confirm: string; needsReason: boolean }> = {
  freeze: {
    title: "Freeze",
    body: "A frozen seat cannot be filled or recruited against until it is unfrozen. It still counts against the budget.",
    confirm: "Freeze position",
    needsReason: true,
  },
  unfreeze: {
    title: "Unfreeze",
    body: "The seat returns to vacant if it was emptied, or approved if it was never filled.",
    confirm: "Unfreeze position",
    needsReason: false,
  },
  abolish: {
    title: "Abolish",
    body: "The seat stops existing from the date you choose. It stays in history, so past headcount still adds up, but it cannot be reopened.",
    confirm: "Abolish position",
    needsReason: true,
  },
};

/** Freeze, unfreeze or abolish — each with a reason, because each changes the budget story. */
export function StatusDialog({
  target,
  onOpenChange,
  onDone,
}: {
  target: { position: Position; action: StatusAction } | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [on, setOn] = useState(toISODate(new Date()));
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (target) {
      setReason("");
      setOn(toISODate(new Date()));
    }
  }, [target]);

  const copy = target ? STATUS_COPY[target.action] : null;

  const submit = async () => {
    if (!target) return;
    setIsBusy(true);
    try {
      await post(`/positions/${target.position.id}/status`, {
        action: target.action,
        reason: reason.trim(),
        on,
      });
      toast.success(`${target.position.title}: ${target.action} recorded.`);
      onDone();
      onOpenChange(false);
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not change the position."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {copy?.title} {target?.position.title}
          </DialogTitle>
          <DialogDescription>{copy?.body}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="position-status-on" label="With effect from">
            <DatePicker id="position-status-on" value={on} onChange={setOn} />
          </FormField>
          <FormField htmlFor="position-status-reason" label="Reason" optional={!copy?.needsReason}>
            <Textarea
              id="position-status-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Hiring pause agreed in the Q3 budget review."
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            variant={target?.action === "abolish" ? "destructive" : "default"}
            onClick={submit}
            disabled={isBusy || (copy?.needsReason === true && reason.trim().length < 3)}
          >
            {isBusy && <Loader2 className="animate-spin" />} {copy?.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ASSIGNMENT_TYPES: { value: AssignmentType; label: string; hint: string }[] = [
  { value: "primary", label: "Primary", hint: "Their substantive seat. Counts toward headcount." },
  {
    value: "acting",
    label: "Acting",
    hint: "Covering the seat while it is vacant. Does not fill it for headcount.",
  },
  {
    value: "additional_charge",
    label: "Additional charge",
    hint: "Holding this seat on top of their own. Does not fill it for headcount.",
  },
];

/** Put somebody in a seat. */
export function AssignDialog({
  position,
  onOpenChange,
  onDone,
}: {
  position: Position | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [person, setPerson] = useState<PickedEmployee | null>(null);
  const [fromDate, setFromDate] = useState(toISODate(new Date()));
  const [kind, setKind] = useState<AssignmentType>("primary");
  const [note, setNote] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (position) {
      setPerson(null);
      setFromDate(toISODate(new Date()));
      setKind(position.status === "filled" ? "acting" : "primary");
      setNote("");
    }
  }, [position]);

  const submit = async () => {
    if (!position || !person) return;
    setIsBusy(true);
    try {
      await post(`/positions/${position.id}/assign`, {
        employee_id: person.id,
        from_date: fromDate,
        assignment_type: kind,
        note: note.trim() || null,
      });
      toast.success(`${person.label} assigned to ${position.title}.`);
      onDone();
      onOpenChange(false);
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not assign."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={position !== null} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign to {position?.title}</DialogTitle>
          <DialogDescription>
            An assignment is effective-dated, so the seat&apos;s history shows who held it when.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="assign-person" label="Person">
            <EmployeePicker id="assign-person" value={person} onChange={setPerson} />
          </FormField>
          <FormField
            htmlFor="assign-type"
            label="Assignment"
            hint={ASSIGNMENT_TYPES.find((option) => option.value === kind)?.hint}
          >
            <Select value={kind} onValueChange={(next) => setKind(next as AssignmentType)}>
              <SelectTrigger id="assign-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNMENT_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="assign-from" label="From">
            <DatePicker id="assign-from" value={fromDate} onChange={setFromDate} />
          </FormField>
          <FormField htmlFor="assign-note" label="Note" optional>
            <Textarea id="assign-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || !person}>
            {isBusy && <Loader2 className="animate-spin" />} Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Empty a seat. The person keeps their employment; only the seat changes. */
export function VacateDialog({
  position,
  onOpenChange,
  onDone,
}: {
  position: Position | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [on, setOn] = useState(toISODate(new Date()));
  const [reason, setReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (position) {
      setOn(toISODate(new Date()));
      setReason("");
    }
  }, [position]);

  const submit = async () => {
    if (!position) return;
    setIsBusy(true);
    try {
      await post(`/positions/${position.id}/vacate`, { on, reason: reason.trim() });
      toast.success(`${position.title} is now vacant.`);
      onDone();
      onOpenChange(false);
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not vacate the position."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={position !== null} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vacate {position?.title}</DialogTitle>
          <DialogDescription>
            The seat becomes vacant from this date and starts ageing on the vacancies report. The
            person&apos;s employment is not affected.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="vacate-on" label="Vacant from">
            <DatePicker id="vacate-on" value={on} onChange={setOn} />
          </FormField>
          <FormField htmlFor="vacate-reason" label="Reason" optional>
            <Textarea id="vacate-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy}>
            {isBusy && <Loader2 className="animate-spin" />} Vacate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
