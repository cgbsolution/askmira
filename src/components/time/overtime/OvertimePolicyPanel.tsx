"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, Plus, Scale } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { apiMessage } from "@/components/payroll/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useApiQuery } from "@/hooks/useApiQuery";
import { patch, post } from "@/lib/api";
import type { SalaryComponent } from "@/lib/types/payroll";
import type { OvertimePolicy, OvertimePolicyInput } from "@/lib/types/payroll-inputs";
import type { Location } from "@/lib/types/people";
import { formatDate } from "@/lib/utils";

import { minutesLabel } from "./OvertimeScreen";
import { DatePicker } from "@/components/common/DatePicker";
import { FieldLegend, FieldSet } from "@/components/ui/field";

const ALL = "__all__";
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function optionalInt(value: string): number | null {
  const trimmed = value.trim();
  return trimmed ? Number.parseInt(trimmed, 10) : null;
}

/** "Needs approval · rest days count": who approves a policy's days, and whether rest days count. */
function policyTerms(policy: OvertimePolicy): string {
  return (
    (policy.requires_approval ? "Needs approval" : "Approved by policy") +
    (policy.count_rest_days ? " · rest days count" : " · rest days do not count")
  );
}

/** The minimum, the rounding, the caps and the weekly limit a policy counts overtime by. */
function countingText(policy: OvertimePolicy): string {
  return (
    `min ${minutesLabel(policy.minimum_minutes)}` +
    (policy.rounding_minutes ? ` · blocks of ${policy.rounding_minutes} min` : "") +
    (policy.daily_cap_minutes ? ` · ≤ ${minutesLabel(policy.daily_cap_minutes)}/day` : "") +
    (policy.quarterly_cap_minutes ? ` · ≤ ${minutesLabel(policy.quarterly_cap_minutes)}/quarter` : "") +
    (policy.weekly_threshold_minutes
      ? ` · past ${minutesLabel(policy.weekly_threshold_minutes)}/week (from ${WEEKDAYS[policy.week_starts_on]})`
      : "")
  );
}

/** How overtime is counted and priced, per location. Every number is the tenant's. */
export function OvertimePolicyPanel() {
  const query = useApiQuery<OvertimePolicy[]>("/attendance/overtime/policies");
  const rows = query.data ?? [];
  const [busy, setBusy] = useState<string | null>(null);

  const retire = async (policy: OvertimePolicy) => {
    setBusy(policy.id);
    try {
      await patch(`/attendance/overtime/policies/${policy.id}`, { is_active: false });
      toast.success("Policy retired. Overtime on later days is no longer counted by it.");
      query.reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not retire the policy."));
    } finally {
      setBusy(null);
    }
  };

  const columns: ColumnDef<OvertimePolicy>[] = [
    {
      accessorKey: "name",
      header: "Policy",
      meta: {
        text: (policy) => `${policy.name}${policy.is_active ? "" : " (Retired)"} · ${policyTerms(policy)}`,
      },
      cell: ({ row }) => (
        <>
          <span className="font-medium text-foreground">{row.original.name}</span>
          {!row.original.is_active && (
            <Badge variant="muted" className="ml-2">
              Retired
            </Badge>
          )}
          <span className="block text-xs text-muted-foreground">{policyTerms(row.original)}</span>
        </>
      ),
    },
    {
      id: "location",
      header: "Applies to",
      accessorFn: (policy) => policy.location_name ?? "All locations",
    },
    {
      id: "rate",
      header: "Rate",
      accessorFn: (policy) =>
        `${policy.rate_multiplier}× (${policy.wage_component_codes.join(" + ")}) ÷ ${policy.days_divisor} days ÷ ${policy.hours_per_day} h`,
      meta: { cellClassName: "text-sm" },
    },
    {
      id: "counting",
      header: "Counting",
      accessorFn: countingText,
      meta: { cellClassName: "text-sm text-muted-foreground" },
    },
    {
      accessorKey: "effective_from",
      header: "From",
      meta: {
        cellClassName: "whitespace-nowrap",
        text: (policy) =>
          `${formatDate(policy.effective_from)}${policy.effective_to ? ` to ${formatDate(policy.effective_to)}` : ""}`,
      },
      cell: ({ row }) => (
        <>
          {formatDate(row.original.effective_from)}
          {row.original.effective_to && (
            <span className="block text-xs text-muted-foreground">to {formatDate(row.original.effective_to)}</span>
          )}
        </>
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      meta: { className: "text-right", headClassName: "w-24", text: false },
      cell: ({ row }) =>
        row.original.is_active ? (
          <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => void retire(row.original)}>
            {busy === row.original.id && <Loader2 className="animate-spin" />}
            Retire
          </Button>
        ) : null,
    },
  ];

  return (
    <DataTable
      title="Overtime policy"
      description="The multiplier, the components that make the ordinary rate, the divisors and the caps. A location's own policy wins over the company default."
      actions={<NewPolicyDialog onCreated={query.reload} />}
      columns={columns}
      data={rows}
      noun="policies"
      exportName="overtime-policies"
      searchPlaceholder="Search policies"
      isLoading={query.isLoading && !query.data}
      error={query.error?.detail}
      onRetry={query.reload}
      empty={{
        icon: Scale,
        title: "No overtime policy yet",
        description: "Without one, overtime is recorded in attendance but never counted or paid.",
      }}
    />
  );
}

function NewPolicyDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const locations = useApiQuery<Location[]>(open ? "/org/locations" : null);
  const components = useApiQuery<SalaryComponent[]>(open ? "/salary-components" : null);
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState(ALL);
  const [multiplier, setMultiplier] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [days, setDays] = useState("");
  const [hours, setHours] = useState("");
  const [minimum, setMinimum] = useState("0");
  const [rounding, setRounding] = useState("0");
  const [dailyCap, setDailyCap] = useState("");
  const [quarterlyCap, setQuarterlyCap] = useState("");
  const [weeklyHours, setWeeklyHours] = useState("");
  const [weekStart, setWeekStart] = useState("6");
  const [restDays, setRestDays] = useState(true);
  const [approval, setApproval] = useState(true);
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const earnings = (components.data ?? []).filter((c) => c.component_type === "earning");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError("Name the policy.");
    if (!/^\d+(\.\d{1,2})?$/.test(multiplier) || Number(multiplier) <= 0) {
      return setError("Enter the overtime multiplier, like 2 for double the ordinary rate.");
    }
    if (!codes.length) return setError("Choose the components that make up the ordinary rate.");
    if (!/^\d+$/.test(days) || Number(days) < 1) return setError("Enter the days divisor.");
    if (!/^\d+(\.\d{1,2})?$/.test(hours) || Number(hours) <= 0) {
      return setError("Enter the working hours in a day.");
    }
    if (weeklyHours.trim() && (!/^\d+(\.\d{1,2})?$/.test(weeklyHours) || Number(weeklyHours) <= 0 || Number(weeklyHours) > 168)) {
      return setError("Enter the weekly hours limit, like 48, or leave it empty.");
    }
    setError(null);
    setIsSaving(true);
    try {
      const body: OvertimePolicyInput = {
        name: name.trim(),
        location_id: locationId === ALL ? null : locationId,
        rate_multiplier: multiplier,
        wage_component_codes: codes,
        days_divisor: Number.parseInt(days, 10),
        hours_per_day: hours,
        minimum_minutes: optionalInt(minimum) ?? 0,
        rounding_minutes: optionalInt(rounding) ?? 0,
        daily_cap_minutes: optionalInt(dailyCap),
        quarterly_cap_minutes: optionalInt(quarterlyCap),
        weekly_threshold_minutes: weeklyHours.trim() ? Math.round(Number(weeklyHours) * 60) : null,
        week_starts_on: Number.parseInt(weekStart, 10),
        count_rest_days: restDays,
        requires_approval: approval,
        effective_from: from,
      };
      await post<OvertimePolicy>("/attendance/overtime/policies", body);
      toast.success("Overtime policy saved. It replaces any earlier one for the same place.");
      setOpen(false);
      onCreated();
    } catch (caught) {
      setError(apiMessage(caught, "Could not save the policy."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && setOpen(next)}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New policy
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New overtime policy</DialogTitle>
            <DialogDescription>
              Enter the figures your state&apos;s law and your standing orders set — for a factory,
              the Factories Act&apos;s rate and its quarterly limit. Nothing here is assumed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField htmlFor="otp-name" label="Name" required>
              <Input id="otp-name" maxLength={128} value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField htmlFor="otp-location" label="Applies to">
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger id="otp-location" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All locations (default)</SelectItem>
                  {(locations.data ?? []).map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} ({location.state_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FieldSet className="grid gap-2">
            <FieldLegend className="mb-1 text-sm font-medium text-foreground">
              Ordinary rate is made of
            </FieldLegend>
            {earnings.length === 0 && (
              <p className="text-sm text-muted-foreground">No earning components defined yet.</p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {earnings.map((component) => (
                <div key={component.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`otp-code-${component.code}`}
                    checked={codes.includes(component.code)}
                    onCheckedChange={(checked) =>
                      setCodes((current) =>
                        checked === true
                          ? [...current, component.code]
                          : current.filter((code) => code !== component.code),
                      )
                    }
                  />
                  <Label htmlFor={`otp-code-${component.code}`} className="font-normal">
                    {component.name} ({component.code})
                  </Label>
                </div>
              ))}
            </div>
          </FieldSet>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField htmlFor="otp-multiplier" label="Multiplier" required hint="2 = double">
              <Input id="otp-multiplier" inputMode="decimal" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} />
            </FormField>
            <FormField htmlFor="otp-days" label="Days divisor" required>
              <Input id="otp-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
            </FormField>
            <FormField htmlFor="otp-hours" label="Hours a day" required>
              <Input id="otp-hours" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
            </FormField>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField htmlFor="otp-minimum" label="Minimum per day (min)">
              <Input id="otp-minimum" inputMode="numeric" value={minimum} onChange={(e) => setMinimum(e.target.value)} />
            </FormField>
            <FormField htmlFor="otp-rounding" label="Count in blocks of (min)" hint="0 = exact">
              <Input id="otp-rounding" inputMode="numeric" value={rounding} onChange={(e) => setRounding(e.target.value)} />
            </FormField>
            <FormField htmlFor="otp-daily" label="Daily limit (min)" optional>
              <Input id="otp-daily" inputMode="numeric" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} />
            </FormField>
            <FormField htmlFor="otp-quarterly" label="Quarterly limit (min)" optional>
              <Input id="otp-quarterly" inputMode="numeric" value={quarterlyCap} onChange={(e) => setQuarterlyCap(e.target.value)} />
            </FormField>
            <FormField
              htmlFor="otp-weekly"
              label="Overtime past this many hours a week"
              optional
              hint="The Factories Act's weekly limit is 48. Hours past it that no single day counted become weekly overtime."
            >
              <Input id="otp-weekly" inputMode="decimal" value={weeklyHours} onChange={(e) => setWeeklyHours(e.target.value)} />
            </FormField>
            <FormField htmlFor="otp-week-start" label="Week begins on">
              <Select value={weekStart} onValueChange={setWeekStart}>
                <SelectTrigger id="otp-week-start" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((day, index) => (
                    <SelectItem key={day} value={String(index)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
            <Label htmlFor="otp-rest" className="font-normal">
              Work on weekly offs and holidays counts as overtime
            </Label>
            <Switch id="otp-rest" checked={restDays} onCheckedChange={setRestDays} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
            <Label htmlFor="otp-approval" className="font-normal">
              A manager or HR approves each day
            </Label>
            <Switch id="otp-approval" checked={approval} onCheckedChange={setApproval} />
          </div>
          <FormField htmlFor="otp-from" label="In force from" required>
            <DatePicker id="otp-from" value={from} onChange={setFrom} />
          </FormField>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              Save policy
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
