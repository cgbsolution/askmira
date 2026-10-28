"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CalendarRange, Loader2, Pencil, Plus } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { useApiQuery } from "@/hooks/useApiQuery";
import { post, put } from "@/lib/api";
import type { Roster, RosterDay, RosterInput, Shift } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";

import { errorDetail, parseWholeNumber, shortTime } from "./shared";
import { Field, loadErrorProps } from "./ShiftsTab";
import { FieldLegend, FieldSet } from "@/components/ui/field";

/** A UI bound so the day list stays usable; the API's own limit wins if lower. */
const MAX_CYCLE_DAYS = 62;
const WEEK_OFF = "__week_off__";

function cycleText(roster: Roster): string {
  return `${roster.cycle_days} ${roster.cycle_days === 1 ? "day" : "days"}`;
}

function daysInOrder(roster: Roster): RosterDay[] {
  return [...roster.days].sort((a, b) => a.day_index - b.day_index);
}

export function RostersTab() {
  const rosters = useApiQuery<Roster[]>("/attendance/rosters");
  const shifts = useApiQuery<Shift[]>("/attendance/shifts?include_inactive=true");
  const [editing, setEditing] = useState<Roster | "new" | null>(null);

  const shiftById = useMemo(
    () => new Map((shifts.data ?? []).map((shift) => [shift.id, shift])),
    [shifts.data],
  );
  const rows = [...(rosters.data ?? [])].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
  );

  const error = rosters.error ?? shifts.error;
  const reloadAll = () => {
    rosters.reload();
    shifts.reload();
  };
  // The pattern names each day's shift by its code, so the rows wait for both lists.
  const isLoading = (rosters.isLoading && !rosters.data) || (shifts.isLoading && !shifts.data);
  const dayLabel = (day: RosterDay) =>
    day.shift_id ? (shiftById.get(day.shift_id)?.code ?? "Unknown shift") : "Off";

  const columns: ColumnDef<Roster>[] = [
    {
      accessorKey: "name",
      header: "Name",
      meta: { text: (roster) => [roster.name, roster.description].filter(Boolean).join(" · ") },
      cell: ({ row: { original: roster } }) => (
        <>
          <p className="font-medium">{roster.name}</p>
          {roster.description && (
            <p className="max-w-64 truncate text-xs text-muted-foreground">{roster.description}</p>
          )}
        </>
      ),
    },
    {
      accessorKey: "cycle_days",
      header: "Cycle",
      meta: { cellClassName: "tabular-nums", text: cycleText },
      cell: ({ row }) => cycleText(row.original),
    },
    {
      id: "pattern",
      header: "Pattern",
      meta: {
        cellClassName: "max-w-96 whitespace-normal",
        text: (roster) =>
          daysInOrder(roster)
            .map((day) => `${day.day_index + 1}·${dayLabel(day)}`)
            .join(", "),
      },
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {daysInOrder(row.original).map((day) => (
            <Badge
              key={day.day_index}
              variant={day.shift_id ? "secondary" : "muted"}
              title={`Day ${day.day_index + 1}`}
            >
              <span className="tabular-nums">{day.day_index + 1}</span>·{dayLabel(day)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: "state",
      header: "State",
      accessorFn: (roster) => (roster.active ? "Active" : "Inactive"),
      cell: ({ row }) => (
        <Badge variant={row.original.active ? "success" : "muted"}>
          {row.original.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => setEditing(row.original)}>
          <Pencil /> Edit
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        tier="tier1"
        title="Rosters"
        description="Rotating patterns of shifts and week offs, repeated every cycle."
        actions={
          <Button size="sm" className="h-9" disabled={!shifts.data} onClick={() => setEditing("new")}>
            <Plus /> New roster
          </Button>
        }
        columns={columns}
        data={isLoading ? [] : rows}
        noun="rosters"
        searchPlaceholder="Search rosters"
        rowClassName={(roster) => cn(!roster.active && "text-muted-foreground")}
        isLoading={isLoading}
        loadingRows={4}
        {...loadErrorProps(error, reloadAll)}
        empty={{
          icon: CalendarRange,
          title: "No rosters defined",
          description: (shifts.data ?? []).some((shift) => shift.active)
            ? "Create a roster to rotate people through shifts."
            : "Create at least one active shift first, then build a roster from it.",
        }}
      />

      <RosterDialog
        target={editing}
        shifts={shifts.data ?? []}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          rosters.reload();
        }}
      />
    </>
  );
}

function RosterDialog({
  target,
  shifts,
  onClose,
  onSaved,
}: {
  target: Roster | "new" | null;
  shifts: Shift[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isCreate = target === "new";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cycleDays, setCycleDays] = useState("7");
  /** One entry per day index: a shift id, WEEK_OFF, or "" for not chosen yet. */
  const [pattern, setPattern] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (target === null) return;
    setSubmitted(false);
    setServerError(null);
    if (target === "new") {
      setName("");
      setDescription("");
      setCycleDays("7");
      setPattern(Array.from({ length: 7 }, () => ""));
      setActive(true);
      return;
    }
    setName(target.name);
    setDescription(target.description ?? "");
    setCycleDays(String(target.cycle_days));
    const next = Array.from({ length: target.cycle_days }, () => "");
    for (const day of target.days) {
      if (day.day_index >= 0 && day.day_index < target.cycle_days) {
        next[day.day_index] = day.shift_id ?? WEEK_OFF;
      }
    }
    setPattern(next);
    setActive(target.active);
  }, [target]);

  const cycle = parseWholeNumber(cycleDays);
  const cycleOk = cycle !== null && cycle >= 1 && cycle <= MAX_CYCLE_DAYS;

  // Resize the pattern with the cycle, keeping what was already chosen.
  useEffect(() => {
    if (!cycleOk || cycle === null) return;
    setPattern((current) =>
      current.length === cycle
        ? current
        : Array.from({ length: cycle }, (_, index) => current[index] ?? ""),
    );
  }, [cycle, cycleOk]);

  const referenced = new Set(pattern);
  const choosable = shifts
    .filter((shift) => shift.active || referenced.has(shift.id))
    .sort((a, b) => a.code.localeCompare(b.code));

  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = "A name is required.";
  if (!cycleOk) errors.cycle = `Enter a whole number from 1 to ${MAX_CYCLE_DAYS}.`;
  const unchosen = cycleOk ? pattern.filter((value) => value === "").length : 0;
  if (unchosen > 0) errors.pattern = `Choose a shift or week off for every day (${unchosen} left).`;
  const shown = submitted ? errors : {};

  const save = async () => {
    setSubmitted(true);
    if (target === null || Object.keys(errors).length > 0 || cycle === null) return;
    const body: RosterInput = {
      name: name.trim(),
      description: description.trim() || null,
      cycle_days: cycle,
      days: pattern.slice(0, cycle).map((value, index) => ({
        day_index: index,
        shift_id: value === WEEK_OFF ? null : value,
      })),
    };
    setIsSaving(true);
    setServerError(null);
    try {
      if (target === "new") {
        const created = await post<Roster>("/attendance/rosters", body);
        toast.success(`Roster ${created.name} created`);
      } else {
        const updated = await put<Roster>(`/attendance/rosters/${target.id}`, { ...body, active });
        toast.success(`Roster ${updated.name} saved`);
      }
      onSaved();
    } catch (caught) {
      setServerError(errorDetail(caught, "Could not save the roster."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isCreate ? "New roster" : "Edit roster"}</DialogTitle>
          <DialogDescription>
            Day 1 of the cycle falls on the cycle start date chosen when the roster is assigned.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field id="roster-name" label="Name" error={shown.name}>
            <Input
              id="roster-name"
              value={name}
              maxLength={100}
              aria-invalid={Boolean(shown.name)}
              onChange={(event) => setName(event.target.value)}
              placeholder="Plant rotation A"
            />
          </Field>
          <Field id="roster-description" label={<>Description <span className="text-muted-foreground">(optional)</span></>}>
            <Textarea
              id="roster-description"
              rows={2}
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <Field id="roster-cycle" label="Cycle length (days)" error={shown.cycle ?? (!cycleOk ? errors.cycle : undefined)}>
            <Input
              id="roster-cycle"
              type="number"
              min={1}
              max={MAX_CYCLE_DAYS}
              step={1}
              className="w-32 tabular-nums"
              value={cycleDays}
              aria-invalid={!cycleOk}
              onChange={(event) => setCycleDays(event.target.value)}
            />
          </Field>

          {cycleOk && (
            <FieldSet className="grid gap-2">
              <FieldLegend className="mb-1 text-sm font-medium">Pattern</FieldLegend>
              <div className="grid gap-2 sm:grid-cols-2">
                {pattern.map((value, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Label htmlFor={`roster-day-${index}`} className="w-14 shrink-0 tabular-nums">
                      Day {index + 1}
                    </Label>
                    <Select
                      value={value}
                      onValueChange={(next) =>
                        setPattern((current) => current.map((item, i) => (i === index ? next : item)))
                      }
                    >
                      <SelectTrigger
                        id={`roster-day-${index}`}
                        className="w-full"
                        aria-invalid={submitted && value === ""}
                      >
                        <SelectValue placeholder="Choose" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={WEEK_OFF}>Week off</SelectItem>
                        {choosable.map((shift) => (
                          <SelectItem key={shift.id} value={shift.id}>
                            {shift.code} · {shortTime(shift.start_time)}–{shortTime(shift.end_time)}
                            {!shift.active && " (inactive)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {shown.pattern && <p className="text-xs text-destructive">{shown.pattern}</p>}
            </FieldSet>
          )}

          {!isCreate && (
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="roster-active">Active</Label>
                <p className="text-xs text-muted-foreground">An inactive roster cannot be newly assigned.</p>
              </div>
              <Switch id="roster-active" checked={active} onCheckedChange={setActive} />
            </div>
          )}

          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isSaving} onClick={() => void save()}>
            {isSaving && <Loader2 className="animate-spin" />}
            {isCreate ? "Create roster" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
