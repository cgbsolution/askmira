"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { LifeBuoy, Loader2, Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { PipPanel } from "@/components/performance/PipPanel";
import { humanize, PersonSelect, StatusBadge, useAction, usePeople } from "@/components/performance/shared";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { PipSummary } from "@/lib/types/performance";
import { formatDateRange, toISODate } from "@/lib/utils";
import { DatePicker } from "@/components/common/DatePicker";

/** Improvement plans for the caller's reporting line (all of them for HR). */
export default function PipsPage() {
  const { data, error, isLoading, reload } = useApiQuery<PipSummary[]>("/performance/pips");
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const rows = (data ?? []).filter((p) => !p.is_mine);

  const columns: ColumnDef<PipSummary>[] = [
    {
      accessorKey: "employee_name",
      header: "Employee",
      meta: { text: (row) => `${row.employee_name} ${row.employee_code}` },
      cell: ({ row }) => <PersonCell name={row.original.employee_name} subtitle={row.original.employee_code} size="sm" />,
    },
    {
      id: "period",
      header: "Period",
      accessorFn: (row) => row.start_date,
      meta: { text: (row) => formatDateRange(row.start_date, row.end_date) },
      cell: ({ row }) => formatDateRange(row.original.start_date, row.original.end_date),
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: { text: (row) => humanize(row.status) },
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    { accessorKey: "check_ins", header: "Check-ins", meta: { className: "text-right tabular-nums" } },
    {
      id: "milestones_assessed",
      header: "Milestones assessed",
      accessorFn: (row) => row.milestones_assessed,
      meta: {
        className: "text-right tabular-nums",
        text: (row) => `${row.milestones_assessed} / ${row.milestones}`,
      },
      cell: ({ row }) => (
        <>
          {row.original.milestones_assessed} / {row.original.milestones}
        </>
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={() => setOpen(row.original.pip_id)}>
          Open
        </Button>
      ),
    },
  ];

  return (
    <PageShell
      title="Improvement plans"
      description="Plans with written expectations, recorded support and check-ins that capture both sides."
      actions={
        <Button variant="accent" onClick={() => setCreating(true)}>
          <Plus /> Open a plan
        </Button>
      }
    >
      <DataTable
        title="Plans"
        columns={columns}
        data={rows}
        getRowId={(row) => row.pip_id}
        noun="plans"
        exportName="improvement-plans"
        searchPlaceholder="Search plans"
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        empty={{
          icon: LifeBuoy,
          title: "No improvement plans",
          description: "Plans you open, or that cover people in your reporting line, appear here.",
        }}
      />

      <Sheet open={open !== null} onOpenChange={(value) => !value && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Improvement plan</SheetTitle>
            <SheetDescription>The full trail, as it would be handed to an adviser.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">{open && <PipPanel pipId={open} onChanged={reload} />}</div>
        </SheetContent>
      </Sheet>

      {creating && (
        <OpenPipDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            reload();
            setOpen(id);
          }}
        />
      )}
    </PageShell>
  );
}

interface MilestoneDraft {
  description: string;
  target_date: string;
  measurable_criteria: string;
}

function OpenPipDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const people = usePeople();
  const today = toISODate(new Date());
  const [employee, setEmployee] = useState("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [expectations, setExpectations] = useState("");
  const [support, setSupport] = useState("");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    { description: "", target_date: "", measurable_criteria: "" },
  ]);
  const { busy, run } = useAction();

  const milestonesValid = milestones.every((m) => m.description.trim() && m.target_date && m.measurable_criteria.trim());
  const valid = employee && start && end && end >= start && reason.trim() && expectations.trim() && support.trim() && milestonesValid;

  const update = (index: number, patch: Partial<MilestoneDraft>) =>
    setMilestones((current) => current.map((m, i) => (i === index ? { ...m, ...patch } : m)));

  const submit = async () => {
    const result = await run<{ pip_id: string }>(
      "save",
      () =>
        post<{ pip_id: string }>("/performance/pips", {
          employee_id: employee,
          start_date: start,
          end_date: end,
          reason: reason.trim(),
          expectations: expectations.trim(),
          support_provided: support.trim(),
          milestones: milestones.map((m) => ({
            description: m.description.trim(),
            target_date: m.target_date,
            measurable_criteria: m.measurable_criteria.trim(),
          })),
        }),
      "Plan opened. The employee has been told and can add their own account.",
    );
    if (result) onCreated(result.pip_id);
  };

  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Open an improvement plan</DialogTitle>
          <DialogDescription>
            Written expectations, the support you will give, and at least one measurable milestone are required.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <FormField htmlFor="pip-employee" label="Employee" error={people.error?.detail}>
            <PersonSelect id="pip-employee" people={people.data ?? []} value={employee} onChange={setEmployee} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField htmlFor="pip-start" label="Starts">
              <DatePicker id="pip-start" value={start} onChange={setStart} />
            </FormField>
            <FormField htmlFor="pip-end" label="Ends" hint="At least 30 days is expected.">
              <DatePicker id="pip-end" min={start} value={end} onChange={setEnd} />
            </FormField>
          </div>
          <FormField htmlFor="pip-reason" label="Why this plan">
            <Textarea id="pip-reason" rows={2} maxLength={4000} value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
          <FormField htmlFor="pip-exp" label="What is expected">
            <Textarea id="pip-exp" rows={3} maxLength={8000} value={expectations} onChange={(e) => setExpectations(e.target.value)} />
          </FormField>
          <FormField htmlFor="pip-support" label="Support you will provide">
            <Textarea id="pip-support" rows={3} maxLength={8000} value={support} onChange={(e) => setSupport(e.target.value)} />
          </FormField>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Milestones</p>
            {milestones.map((m, index) => (
              <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_10rem_auto]">
                <FormField htmlFor={`m-desc-${index}`} label="Milestone">
                  <Input id={`m-desc-${index}`} maxLength={2000} value={m.description} onChange={(e) => update(index, { description: e.target.value })} />
                </FormField>
                <FormField htmlFor={`m-date-${index}`} label="By">
                  <DatePicker id={`m-date-${index}`} value={m.target_date} onChange={(picked) => update(index, { target_date: picked })} />
                </FormField>
                <Button
                  variant="ghost"
                  size="icon"
                  className="self-end"
                  aria-label="Remove milestone"
                  disabled={milestones.length === 1}
                  onClick={() => setMilestones((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </Button>
                <FormField htmlFor={`m-crit-${index}`} label="Measured by" className="sm:col-span-3">
                  <Input
                    id={`m-crit-${index}`}
                    maxLength={2000}
                    placeholder="e.g. 12 or more tickets closed each week for four weeks"
                    value={m.measurable_criteria}
                    onChange={(e) => update(index, { measurable_criteria: e.target.value })}
                  />
                </FormField>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMilestones((current) => [...current, { description: "", target_date: "", measurable_criteria: "" }])}
            >
              <Plus /> Add milestone
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || busy !== null} onClick={() => void submit()}>
            {busy && <Loader2 className="animate-spin" />} Open plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
