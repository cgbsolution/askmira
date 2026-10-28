"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Layers, Loader2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { BulkResult, LifecycleBatch, LifecycleEventType } from "@/lib/types/people";
import { formatDate, formatDateTime, toISODate } from "@/lib/utils";

import { EmployeePicker, type PickedEmployee } from "../EmployeePicker";
import { EVENT_TYPE, apiMessage } from "../labels";
import { EventFields, type FieldValues, toNewValues } from "./EventFields";
import { DatePicker } from "@/components/common/DatePicker";

const BATCH_COLUMNS: ColumnDef<LifecycleBatch>[] = [
  {
    accessorKey: "name",
    header: "Batch",
    cell: ({ row }) => (
      <>
        <div className="font-medium text-foreground">{row.original.name}</div>
        <div className="text-xs text-muted-foreground">Raised {formatDateTime(row.original.created_at)}</div>
      </>
    ),
  },
  {
    id: "event",
    header: "Event",
    accessorFn: (row) => EVENT_TYPE[row.event_type],
    meta: { cellClassName: "text-sm" },
  },
  {
    accessorKey: "effective_from",
    header: "Effective",
    meta: { cellClassName: "text-sm", text: (row) => formatDate(row.effective_from) },
    cell: ({ row }) => formatDate(row.original.effective_from),
  },
  {
    accessorKey: "events",
    header: "People",
    meta: { className: "text-right", cellClassName: "tabular-nums" },
  },
  {
    id: "approval",
    header: "Approval",
    accessorFn: (row) => (row.approve_individually ? "Person by person" : "As one"),
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.approve_individually ? "Person by person" : "As one"}</Badge>
    ),
  },
];

/**
 * Bulk events: one decision applied to many people, raised as a batch.
 *
 * Each person still gets their own event and their own history entry, and
 * anyone the rules refuse is listed with the reason rather than dropped. Whether
 * the batch is approved as one or person by person is chosen per batch —
 * approving four hundred confirmations one at a time is theatre, approving a
 * mass demotion in one click is not.
 */
export function BatchesTab() {
  const { hasRole } = useAuth();
  const canRaise = hasRole("admin");
  const { data, error, isLoading, reload } = useApiQuery<LifecycleBatch[]>("/lifecycle/batches");
  const [open, setOpen] = useState(false);

  return (
    <>
      <DataTable
        title="Batches"
        columns={BATCH_COLUMNS}
        data={data ?? []}
        getRowId={(row) => row.batch_id}
        noun="batches"
        exportName="lifecycle-batches"
        searchPlaceholder="Search batches"
        actions={
          canRaise ? (
            <Button size="sm" className="h-9" onClick={() => setOpen(true)}>
              <Plus /> New batch
            </Button>
          ) : undefined
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        empty={{ icon: Layers, title: "No batches", description: "Annual confirmations or an org-wide redesignation are raised here." }}
      />
      <BulkDialog open={open} onOpenChange={setOpen} onRaised={reload} />
    </>
  );
}

function BulkDialog({
  open,
  onOpenChange,
  onRaised,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRaised: () => void;
}) {
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState<LifecycleEventType>("confirmation");
  const [effectiveFrom, setEffectiveFrom] = useState(toISODate(new Date()));
  const [reason, setReason] = useState("");
  const [fields, setFields] = useState<FieldValues>({});
  const [people, setPeople] = useState<PickedEmployee[]>([]);
  const [picker, setPicker] = useState<PickedEmployee | null>(null);
  const [individually, setIndividually] = useState(true);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setEventType("confirmation");
    setEffectiveFrom(toISODate(new Date()));
    setReason("");
    setFields({});
    setPeople([]);
    setPicker(null);
    setIndividually(true);
    setResult(null);
  }, [open]);

  const add = (person: PickedEmployee | null) => {
    if (person && !people.some((row) => row.id === person.id)) setPeople([...people, person]);
    setPicker(null);
  };

  const submit = async () => {
    setIsBusy(true);
    const newValues = toNewValues(fields);
    try {
      const outcome = await post<BulkResult>("/lifecycle/bulk", {
        name: name.trim(),
        event_type: eventType,
        effective_from: effectiveFrom,
        reason: reason.trim(),
        approve_individually: individually,
        rows: people.map((person) => ({ employee_id: person.id, new_values: newValues })),
      });
      setResult(outcome);
      onRaised();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not raise the batch."));
    } finally {
      setIsBusy(false);
    }
  };

  const nameOf = new Map(people.map((person) => [person.id, person.label]));

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>{result.name}</DialogTitle>
              <DialogDescription>
                {result.raised_count} raised, {result.rejected_count} refused.
              </DialogDescription>
            </DialogHeader>
            {result.rejected.length > 0 && (
              <Alert variant="warning">
                <AlertTitle>Refused, with the reason</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5">
                    {result.rejected.map((row) => (
                      <li key={row.employee_id}>
                        {nameOf.get(row.employee_id) ?? row.employee_id}: {row.reason}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New batch</DialogTitle>
              <DialogDescription>
                Everyone in the batch gets the same change, as their own event.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField htmlFor="bulk-name" label="Batch name" className="sm:col-span-2">
                  <Input id="bulk-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Q2 confirmations" />
                </FormField>
                <FormField htmlFor="bulk-type" label="Event">
                  <Select
                    value={eventType}
                    onValueChange={(next) => {
                      setEventType(next as LifecycleEventType);
                      setFields({});
                    }}
                  >
                    <SelectTrigger id="bulk-type" className="w-full">
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
                <FormField htmlFor="bulk-effective" label="Effective from">
                  <DatePicker id="bulk-effective" value={effectiveFrom} onChange={setEffectiveFrom} />
                </FormField>
              </div>

              <EventFields key={eventType} eventType={eventType} values={fields} onChange={setFields} idPrefix="bulk" />

              <FormField htmlFor="bulk-reason" label="Reason">
                <Textarea id="bulk-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
              </FormField>

              <FormField htmlFor="bulk-people" label={`People (${people.length})`}>
                <EmployeePicker id="bulk-people" value={picker} onChange={add} placeholder="Add a person" />
              </FormField>
              {people.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {people.map((person) => (
                    <Badge key={person.id} variant="secondary" className="gap-1 pr-1">
                      {person.label}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-4"
                        aria-label={`Remove ${person.label}`}
                        onClick={() => setPeople(people.filter((row) => row.id !== person.id))}
                      >
                        <X className="size-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                <Switch id="bulk-individually" checked={individually} onCheckedChange={setIndividually} />
                <Label htmlFor="bulk-individually" className="text-sm font-normal">
                  Approve each person individually. Switch off only for changes nobody would dispute.
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={isBusy || !name.trim() || !reason.trim() || people.length === 0}
              >
                {isBusy && <Loader2 className="animate-spin" />} Raise for {people.length}{" "}
                {people.length === 1 ? "person" : "people"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
