"use client";

import { CalendarClock, Loader2, UserSearch } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import type {
  Assignment,
  Roster,
  RosterAssignmentInput,
  Shift,
  ShiftAssignmentInput,
} from "@/lib/types/attendance";
import { formatDay, toISODate } from "@/lib/utils";

import {
  EmployeePicker,
  employeeName,
  errorDetail,
  LoadError,
  shortTime,
  TableSkeleton,
} from "./shared";
import { Field } from "./ShiftsTab";

export function AssignmentsTab() {
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [assigning, setAssigning] = useState<"shift" | "roster" | null>(null);
  const [ending, setEnding] = useState<Assignment | null>(null);
  const { data, error, isLoading, reload } = useApiQuery<Assignment[]>(
    employee ? `/attendance/assignments?employee_id=${encodeURIComponent(employee.id)}` : null,
  );

  const rows = employee
    ? [...(data ?? [])].sort((a, b) => b.effective_from.localeCompare(a.effective_from))
    : [];

  return (
    <Card tier="tier1" className="pb-0">
      <CardHeader>
        <CardTitle>Assignments</CardTitle>
        <CardDescription>
          Which shift or roster a person works, and from when. A new assignment closes the previous
          open one on the day before it starts.
        </CardDescription>
        {employee && (
          <CardAction className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setAssigning("roster")}>
              Assign roster
            </Button>
            <Button size="sm" onClick={() => setAssigning("shift")}>
              Assign shift
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent>
        <EmployeePicker value={employee} onChange={setEmployee} />
      </CardContent>

      <div className="mt-5">
        {!employee ? (
          <EmptyState
            icon={UserSearch}
            title="Choose an employee"
            description="Their shift and roster assignments appear here."
          />
        ) : isLoading ? (
          <div className="pb-5">
            <TableSkeleton rows={3} />
          </div>
        ) : error ? (
          <LoadError error={error} onRetry={reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={`${employeeName(employee)} has no assignments`}
            description="Without a shift or roster, their attendance cannot be computed against working hours. Assign one above."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Kind</TableHead>
                <TableHead>Shift / roster</TableHead>
                <TableHead>Cycle start</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="pr-5 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.kind}-${row.id}`}>
                  <TableCell className="pl-5">
                    <Badge variant={row.kind === "shift" ? "secondary" : "outline"} className="capitalize">
                      {row.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{row.target_name}</TableCell>
                  <TableCell>{row.cycle_start_date ? formatDay(row.cycle_start_date, true) : "—"}</TableCell>
                  <TableCell>{formatDay(row.effective_from, true)}</TableCell>
                  <TableCell>
                    {row.effective_to ? formatDay(row.effective_to, true) : <Badge variant="success">Open</Badge>}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    {row.effective_to === null && (
                      <Button variant="outline" size="sm" onClick={() => setEnding(row)}>
                        End
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AssignDialog
        kind={assigning}
        employee={employee}
        onClose={() => setAssigning(null)}
        onSaved={() => {
          setAssigning(null);
          reload();
        }}
      />
      <EndAssignmentDialog
        assignment={ending}
        onClose={() => setEnding(null)}
        onSaved={() => {
          setEnding(null);
          reload();
        }}
      />
    </Card>
  );
}

function AssignDialog({
  kind,
  employee,
  onClose,
  onSaved,
}: {
  kind: "shift" | "roster" | null;
  employee: EmployeeSummary | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const shifts = useApiQuery<Shift[]>(kind === "shift" ? "/attendance/shifts" : null);
  const rosters = useApiQuery<Roster[]>(kind === "roster" ? "/attendance/rosters" : null);
  const [targetId, setTargetId] = useState("");
  const [cycleStart, setCycleStart] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (kind === null) return;
    const today = toISODate(new Date());
    setTargetId("");
    setCycleStart(today);
    setFrom(today);
    setTo("");
    setSubmitted(false);
    setServerError(null);
  }, [kind]);

  const options =
    kind === "shift"
      ? (shifts.data ?? [])
          .filter((shift) => shift.active)
          .map((shift) => ({
            id: shift.id,
            label: `${shift.code} · ${shift.name} (${shortTime(shift.start_time)}–${shortTime(shift.end_time)})`,
          }))
      : (rosters.data ?? [])
          .filter((roster) => roster.active)
          .map((roster) => ({
            id: roster.id,
            label: `${roster.name} (${roster.cycle_days}-day cycle)`,
          }));
  const optionsLoading = kind === "shift" ? shifts.isLoading : rosters.isLoading;
  const optionsError = kind === "shift" ? shifts.error : rosters.error;

  const errors: Record<string, string> = {};
  if (!targetId) errors.target = `Choose a ${kind ?? "shift"}.`;
  if (!from) errors.from = "A start date is required.";
  if (to && from && to < from) errors.to = "Cannot be before the start date.";
  if (kind === "roster" && !cycleStart) errors.cycle = "A cycle start date is required.";
  const shown = submitted ? errors : {};

  const save = async () => {
    setSubmitted(true);
    if (!kind || !employee || Object.keys(errors).length > 0) return;
    setIsSaving(true);
    setServerError(null);
    try {
      if (kind === "shift") {
        const body: ShiftAssignmentInput = {
          employee_id: employee.id,
          shift_id: targetId,
          effective_from: from,
          effective_to: to || null,
        };
        await post<Assignment>("/attendance/shift-assignments", body);
      } else {
        const body: RosterAssignmentInput = {
          employee_id: employee.id,
          roster_id: targetId,
          cycle_start_date: cycleStart,
          effective_from: from,
          effective_to: to || null,
        };
        await post<Assignment>("/attendance/roster-assignments", body);
      }
      toast.success(`${kind === "shift" ? "Shift" : "Roster"} assigned to ${employeeName(employee)}`);
      onSaved();
    } catch (caught) {
      setServerError(errorDetail(caught, "Could not save the assignment."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign {kind === "roster" ? "a roster" : "a shift"}</DialogTitle>
          <DialogDescription>
            {employee && `To ${employeeName(employee)} (${employee.employee_code}). `}
            Any open assignment ends the day before this one starts.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field id="assign-target" label={kind === "roster" ? "Roster" : "Shift"} error={shown.target}>
            <Select value={targetId} onValueChange={setTargetId} disabled={optionsLoading}>
              <SelectTrigger id="assign-target" className="w-full" aria-invalid={Boolean(shown.target)}>
                <SelectValue
                  placeholder={
                    optionsLoading
                      ? "Loading…"
                      : options.length === 0
                        ? `No active ${kind === "roster" ? "rosters" : "shifts"}`
                        : `Choose a ${kind ?? "shift"}`
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {optionsError && (
            <Alert variant="destructive">
              <AlertDescription>{optionsError.detail}</AlertDescription>
            </Alert>
          )}

          {kind === "roster" && (
            <Field
              id="assign-cycle"
              label="Cycle start date"
              error={shown.cycle}
              hint="The date that counts as day 1 of the roster."
            >
              <Input
                id="assign-cycle"
                type="date"
                value={cycleStart}
                aria-invalid={Boolean(shown.cycle)}
                onChange={(event) => setCycleStart(event.target.value)}
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field id="assign-from" label="Effective from" error={shown.from}>
              <Input
                id="assign-from"
                type="date"
                value={from}
                aria-invalid={Boolean(shown.from)}
                onChange={(event) => setFrom(event.target.value)}
              />
            </Field>
            <Field
              id="assign-to"
              label={<>Effective to <span className="text-muted-foreground">(optional)</span></>}
              error={shown.to}
            >
              <Input
                id="assign-to"
                type="date"
                min={from}
                value={to}
                aria-invalid={Boolean(shown.to)}
                onChange={(event) => setTo(event.target.value)}
              />
            </Field>
          </div>

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
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EndAssignmentDialog({
  assignment,
  onClose,
  onSaved,
}: {
  assignment: Assignment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [endDate, setEndDate] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!assignment) return;
    const today = toISODate(new Date());
    setEndDate(today < assignment.effective_from ? assignment.effective_from : today);
    setSubmitted(false);
    setServerError(null);
  }, [assignment]);

  const error = !endDate
    ? "An end date is required."
    : assignment && endDate < assignment.effective_from
      ? "Cannot be before the assignment starts."
      : null;

  const save = async () => {
    setSubmitted(true);
    if (!assignment || error) return;
    setIsSaving(true);
    setServerError(null);
    try {
      await post<Assignment>(`/attendance/assignments/${assignment.kind}/${assignment.id}/end`, {
        effective_to: endDate,
      });
      toast.success(`${assignment.target_name} ends on ${formatDay(endDate, true)}`);
      onSaved();
    } catch (caught) {
      setServerError(errorDetail(caught, "Could not end the assignment."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={assignment !== null} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>End assignment</DialogTitle>
          <DialogDescription>
            {assignment &&
              `${assignment.employee_name}'s ${assignment.kind} ${assignment.target_name}, from ${formatDay(assignment.effective_from, true)}. The end date is the last day it applies.`}
          </DialogDescription>
        </DialogHeader>
        <Field id="end-date" label="Last day" error={submitted ? (error ?? undefined) : undefined}>
          <Input
            id="end-date"
            type="date"
            min={assignment?.effective_from}
            value={endDate}
            aria-invalid={submitted && Boolean(error)}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </Field>
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isSaving} onClick={() => void save()}>
            {isSaving && <Loader2 className="animate-spin" />}
            End assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
