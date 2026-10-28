"use client";

import { ArrowRight, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type { EventPreview, LifecycleEventType } from "@/lib/types/people";
import { formatDate, toISODate } from "@/lib/utils";

import { EmployeePicker, type PickedEmployee } from "../EmployeePicker";
import { useFieldValue } from "../LifecycleTimeline";
import { EVENT_TYPE, FIELD_LABEL, apiMessage } from "../labels";
import { EventFields, type FieldValues, toNewValues } from "./EventFields";
import { DatePicker } from "@/components/common/DatePicker";

/** Event types that may carry a salary revision. */
const CARRIES_SALARY = new Set<LifecycleEventType>(["promotion", "demotion", "grade_change", "confirmation"]);

const AMOUNT = /^\d+(\.\d{1,2})?$/;

/**
 * Raise one lifecycle event, previewing it first.
 *
 * The preview is not optional: it is where a promotion shows that it will
 * revise salary, generate a letter, and land in a payroll period that is
 * already locked. Raising is only offered once a preview exists for exactly
 * the values on screen, so what was previewed is what was raised.
 */
export function RaiseEventDialog({
  open,
  onOpenChange,
  onRaised,
  initialEmployee = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRaised: () => void;
  /** Preselected, e.g. when arriving from a profile's "Raise event". */
  initialEmployee?: PickedEmployee | null;
}) {
  const [person, setPerson] = useState<PickedEmployee | null>(null);
  const [eventType, setEventType] = useState<LifecycleEventType>("promotion");
  const [effectiveFrom, setEffectiveFrom] = useState(toISODate(new Date()));
  const [fields, setFields] = useState<FieldValues>({});
  const [ctc, setCtc] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<EventPreview | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const fieldValue = useFieldValue();

  useEffect(() => {
    if (!open) return;
    setPerson(initialEmployee);
    setEventType("promotion");
    setEffectiveFrom(toISODate(new Date()));
    setFields({});
    setCtc("");
    setReason("");
    setPreview(null);
  }, [open, initialEmployee]);

  // Any edit invalidates the preview: what is raised must be what was previewed.
  useEffect(() => {
    setPreview(null);
  }, [person, eventType, effectiveFrom, fields, ctc, reason]);

  const body = () => ({
    employee_id: person?.id,
    event_type: eventType,
    effective_from: effectiveFrom,
    new_values: toNewValues(fields),
    reason: reason.trim(),
    new_ctc_annual: CARRIES_SALARY.has(eventType) && ctc ? ctc : null,
  });

  const invalid = !person || reason.trim().length < 1 || (ctc !== "" && !AMOUNT.test(ctc));

  const runPreview = async () => {
    setIsBusy(true);
    try {
      setPreview(await post<EventPreview>("/lifecycle/preview", body()));
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not preview the event."));
    } finally {
      setIsBusy(false);
    }
  };

  const raise = async () => {
    setIsBusy(true);
    try {
      await post("/lifecycle/events", body());
      toast.success(`${EVENT_TYPE[eventType]} raised for ${person?.label}. It waits for approval.`);
      onRaised();
      onOpenChange(false);
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not raise the event."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Raise a lifecycle event</DialogTitle>
          <DialogDescription>
            Preview first. An event changes the record, and sometimes pay and letters, on its
            effective date — not when it is raised.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="event-person" label="Person" className="sm:col-span-2">
              <EmployeePicker id="event-person" value={person} onChange={setPerson} />
            </FormField>
            <FormField htmlFor="event-type" label="Event">
              <Select
                value={eventType}
                onValueChange={(next) => {
                  setEventType(next as LifecycleEventType);
                  setFields({});
                  setCtc("");
                }}
              >
                <SelectTrigger id="event-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(EVENT_TYPE) as LifecycleEventType[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {EVENT_TYPE[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="event-effective" label="Effective from">
              <DatePicker
                id="event-effective"
                value={effectiveFrom}
                onChange={setEffectiveFrom}
              />
            </FormField>
          </div>

          <EventFields
            key={eventType}
            eventType={eventType}
            values={fields}
            onChange={setFields}
            idPrefix="event"
          />

          {CARRIES_SALARY.has(eventType) && (
            <FormField
              htmlFor="event-ctc"
              label="New annual CTC"
              optional
              hint="Leave blank for no pay change. A figure here revises the salary on the effective date."
              error={ctc && !AMOUNT.test(ctc) ? "An amount in rupees, up to two decimals." : undefined}
            >
              <Input
                id="event-ctc"
                value={ctc}
                onChange={(event) => setCtc(event.target.value.trim())}
                inputMode="decimal"
              />
            </FormField>
          )}

          <FormField htmlFor="event-reason" label="Reason" hint="Shown to the approver and kept on the record.">
            <Textarea
              id="event-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
            />
          </FormField>

          {preview && (
            <div className="grid gap-3 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-foreground">Preview</span>
                {preview.is_retrospective && <Badge variant="warning">Retrospective</Badge>}
                {preview.is_future_dated && <Badge variant="outline">Future-dated</Badge>}
                {preview.needs_a_letter && (
                  <Badge variant="secondary">
                    Letter: {preview.letter_template?.name ?? "no template configured"}
                  </Badge>
                )}
              </div>

              {preview.changes.length > 0 ? (
                <ul className="grid gap-1 text-sm">
                  {preview.changes.map((change) => (
                    <li key={change.field} className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">{FIELD_LABEL[change.field] ?? change.field}:</span>
                      <span>{fieldValue(change.field, change.from)}</span>
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                      <span className="font-medium text-foreground">{fieldValue(change.field, change.to)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No field changes.</p>
              )}

              {preview.salary_revision && (
                <p className="text-sm">
                  Salary revised to <Money value={preview.salary_revision} /> from{" "}
                  {formatDate(preview.effective_from)}.
                </p>
              )}

              {preview.consequences.map((consequence) => (
                <Alert key={consequence.message}>
                  <TriangleAlert />
                  <AlertTitle>{consequence.message}</AlertTitle>
                  {consequence.action_required && (
                    <AlertDescription>{consequence.action_required}</AlertDescription>
                  )}
                </Alert>
              ))}

              {preview.problems.length > 0 && (
                <Alert variant="destructive">
                  <TriangleAlert />
                  <AlertTitle>This event cannot be raised as it stands</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-5">
                      {preview.problems.map((problem) => (
                        <li key={problem}>{problem}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          {preview && preview.problems.length === 0 ? (
            <Button onClick={raise} disabled={isBusy}>
              {isBusy && <Loader2 className="animate-spin" />} Raise event
            </Button>
          ) : (
            <Button onClick={runPreview} disabled={isBusy || invalid}>
              {isBusy && <Loader2 className="animate-spin" />} Preview
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
