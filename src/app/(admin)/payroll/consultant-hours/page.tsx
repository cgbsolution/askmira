"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Clock, Plus } from "lucide-react";
import React, { useMemo, useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { MonthPicker } from "@/components/common/MonthPicker";
import { PageShell } from "@/components/common/PageShell";
import { HoursDetail } from "@/components/payroll/consultant-hours/HoursDetail";
import { HoursForm } from "@/components/payroll/consultant-hours/HoursForm";
import { HoursStatusBadge } from "@/components/payroll/consultant-hours/HoursStatusBadge";
import { HOURS_STATUS, periodText } from "@/components/payroll/consultant-hours/labels";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { HoursEntry, HoursStatus } from "@/lib/types/consultant-hours";

const ANY = "__any";

const columns = (open: (entry: HoursEntry) => void): ColumnDef<HoursEntry>[] => [
  {
    id: "consultant",
    header: "Consultant",
    accessorFn: (entry) => entry.employee_name,
    cell: ({ row }) => (
      <button
        type="button"
        onClick={() => open(row.original)}
        className="text-left font-medium text-foreground hover:underline"
      >
        {row.original.employee_name}
        {row.original.employee_code && (
          <span className="font-normal text-muted-foreground"> · {row.original.employee_code}</span>
        )}
      </button>
    ),
  },
  {
    id: "period",
    header: "Period",
    accessorFn: (entry) => entry.period_start,
    meta: { text: (entry) => periodText(entry.period_start, entry.period_end) },
    cell: ({ row }) => periodText(row.original.period_start, row.original.period_end),
  },
  {
    id: "hours",
    header: "Billable hours",
    accessorFn: (entry) => Number(entry.total_billable_hours),
    meta: { className: "text-right tabular-nums", text: (entry) => entry.total_billable_hours },
    cell: ({ row }) => row.original.total_billable_hours,
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (entry) => HOURS_STATUS[entry.status]?.label ?? entry.status,
    cell: ({ row }) => <HoursStatusBadge status={row.original.status} />,
  },
  {
    id: "files",
    header: "Files",
    accessorFn: (entry) => entry.attachments.length,
    meta: { className: "text-right tabular-nums" },
  },
];

/** Consultant hours: finance enters them from the customer's timesheet, a second person approves. */
export default function ConsultantHoursPage() {
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState<string>(ANY);
  const [waiting, setWaiting] = useState(false);
  const [viewing, setViewing] = useState<HoursEntry | null>(null);
  const [editing, setEditing] = useState<HoursEntry | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  // Bumped each time the form opens, so it starts fresh.
  const [formKey, setFormKey] = useState(0);

  const query = new URLSearchParams();
  if (month) query.set("month", month);
  if (status !== ANY) query.set("status", status);
  if (waiting) query.set("waiting_for_me", "true");
  const qs = query.toString();
  const entries = useApiQuery<HoursEntry[]>(`/consultant-hours${qs ? `?${qs}` : ""}`);

  const openForm = (entry: HoursEntry | null) => {
    setEditing(entry);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };
  const cols = useMemo(() => columns(setViewing), []);
  const filtered = month !== "" || status !== ANY || waiting;

  return (
    <PageShell
      title="Consultant hours"
      description="Enter the billable hours each consultant worked, from the customer's timesheet. A second person approves them before they are paid."
      actions={
        <Button onClick={() => openForm(null)}>
          <Plus /> Enter hours
        </Button>
      }
    >
      <DataTable
        title="Hours"
        columns={cols}
        data={entries.data ?? []}
        noun="entries"
        exportName="consultant-hours"
        isLoading={entries.isLoading && !entries.data}
        error={entries.error?.detail}
        onRetry={entries.reload}
        filtered={filtered}
        filters={
          <>
            <MonthPicker id="hours-month" value={month} onChange={setMonth} placeholder="Any month" clearable />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="Status" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any status</SelectItem>
                {(Object.keys(HOURS_STATUS) as HoursStatus[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {HOURS_STATUS[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={waiting} onCheckedChange={setWaiting} />
              Waiting for my approval
            </label>
          </>
        }
        empty={{
          icon: Clock,
          title: "No hours entered yet",
          description:
            "Press Enter hours, pick a consultant and the period, and attach the customer's timesheet.",
        }}
      />
      {viewing && (
        <HoursDetail
          key={`${viewing.id}-${viewing.status}`}
          entry={viewing}
          open
          onOpenChange={(open) => !open && setViewing(null)}
          onChanged={(next) => {
            setViewing(next);
            entries.reload();
          }}
          onEdit={(entry) => {
            setViewing(null);
            openForm(entry);
          }}
        />
      )}
      {formOpen && (
        <HoursForm
          key={formKey}
          entry={editing}
          open
          onOpenChange={setFormOpen}
          onSaved={() => entries.reload()}
        />
      )}
    </PageShell>
  );
}
