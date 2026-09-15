"use client";

import { CalendarPlus, Loader2, Plus, RefreshCw } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, get, post } from "@/lib/api";
import type { AccrualFrequency, AccrualRun, LeavePolicy, LeaveType } from "@/lib/types";
import { formatDay, formatDays, toISODate } from "@/lib/utils";

interface LocationOption {
  id: string;
  name: string;
  state_code: string;
}

const FREQUENCY_LABEL: Record<AccrualFrequency, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Yearly, up front",
  on_joining: "Whole quota on eligibility",
};

const EVERYWHERE = "__everywhere__";

/**
 * HR's leave configuration: types, policies, holidays and the accrual run.
 *
 * Policies are versioned rather than edited: a new policy for the same
 * population closes the old one the day before it starts, which the server
 * does, so last year's balance keeps reading last year's quota.
 */
export function LeaveSetup({
  leaveTypes,
  onChanged,
}: {
  leaveTypes: LeaveType[];
  onChanged: () => void;
}) {
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialog, setDialog] = useState<"type" | "policy" | "holiday" | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [policyRows, locationRows] = await Promise.all([
        get<LeavePolicy[]>("/leave/policies"),
        get<LocationOption[]>("/org/locations"),
      ]);
      setPolicies(policyRows);
      setLocations(locationRows);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not load leave setup.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const typeName = (id: string) => leaveTypes.find((type) => type.id === id)?.name ?? "—";
  const locationName = (id: string | null) =>
    id ? (locations.find((location) => location.id === id)?.name ?? "—") : "Everywhere";

  const changed = () => {
    setDialog(null);
    void load();
    onChanged();
  };

  const runAccruals = async () => {
    setIsRunning(true);
    try {
      const result = await post<AccrualRun>("/leave/accruals/run");
      toast.success(`Accruals posted for ${result.year}`, {
        description: `${result.balances_updated} balances brought up to ${formatDay(result.as_of, true)}.`,
      });
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not post accruals.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="grid gap-6">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Leave types</CardTitle>
          <CardDescription>The kinds of leave people can request.</CardDescription>
          <CardAction className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialog("holiday")}>
              <CalendarPlus /> Add holiday
            </Button>
            <Button size="sm" onClick={() => setDialog("type")}>
              <Plus /> Add type
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Rules</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaveTypes.map((type) => (
                <TableRow key={type.id}>
                  <TableCell className="pl-5 font-medium text-foreground">{type.name}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{type.code}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={type.is_paid ? "success" : "muted"}>
                        {type.is_paid ? "Paid" : "Unpaid"}
                      </Badge>
                      {type.allows_half_day && <Badge variant="outline">Half days</Badge>}
                      {type.requires_document && <Badge variant="outline">Document needed</Badge>}
                      {type.is_statutory && <Badge variant="secondary">Statutory</Badge>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Policies</CardTitle>
          <CardDescription>
            Quota and rules per leave type. The most specific policy for a person&apos;s
            location and grade applies.
          </CardDescription>
          <CardAction className="flex gap-2">
            <Button variant="outline" size="sm" disabled={isRunning} onClick={() => void runAccruals()}>
              {isRunning ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Post accruals
            </Button>
            <Button size="sm" disabled={leaveTypes.length === 0} onClick={() => setDialog("policy")}>
              <Plus /> Add policy
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : policies.length === 0 ? (
            <p className="px-5 pb-2 text-sm text-muted-foreground">
              No policies yet. Nobody has a balance until one exists.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Policy</TableHead>
                  <TableHead>Applies to</TableHead>
                  <TableHead className="text-right">Days / year</TableHead>
                  <TableHead>Accrual</TableHead>
                  <TableHead className="text-right">Carry forward</TableHead>
                  <TableHead className="text-right">Notice</TableHead>
                  <TableHead>In force</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="pl-5">
                      <p className="font-medium text-foreground">{policy.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {typeName(policy.leave_type_id)}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {locationName(policy.location_id)}
                      {policy.grade && ` · grade ${policy.grade}`}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatDays(policy.annual_quota_days)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {FREQUENCY_LABEL[policy.accrual_frequency]}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatDays(policy.max_carry_forward_days)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {policy.min_notice_days}d
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDay(policy.effective_from, true)}
                      {policy.effective_to ? ` – ${formatDay(policy.effective_to, true)}` : " onwards"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LeaveTypeDialog open={dialog === "type"} onClose={() => setDialog(null)} onSaved={changed} />
      <PolicyDialog
        open={dialog === "policy"}
        leaveTypes={leaveTypes}
        locations={locations}
        onClose={() => setDialog(null)}
        onSaved={changed}
      />
      <HolidayDialog open={dialog === "holiday"} onClose={() => setDialog(null)} onSaved={changed} />
    </div>
  );
}

function useSubmit(onSaved: () => void) {
  const [isSaving, setIsSaving] = useState(false);
  const submit = async (path: string, body: unknown, success: string) => {
    setIsSaving(true);
    try {
      await post(path, body);
      toast.success(success);
      onSaved();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not save.");
    } finally {
      setIsSaving(false);
    }
  };
  return { isSaving, submit };
}

function LeaveTypeDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isPaid, setIsPaid] = useState(true);
  const [halfDay, setHalfDay] = useState(true);
  const [document, setDocument] = useState(false);
  const { isSaving, submit } = useSubmit(onSaved);

  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setIsPaid(true);
      setHalfDay(true);
      setDocument(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a leave type</DialogTitle>
          <DialogDescription>People can request it once a policy gives them a quota.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="type-name">Name</Label>
              <Input id="type-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Comp Off" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="type-code">Code</Label>
              <Input
                id="type-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                placeholder="CO"
                className="font-mono"
              />
            </div>
          </div>
          {(
            [
              ["type-paid", "Paid leave", "Unpaid leave counts as loss of pay.", isPaid, setIsPaid],
              ["type-half", "Allow half days", "Half a day can be requested on a single date.", halfDay, setHalfDay],
              ["type-doc", "Needs a document", "A medical certificate or similar is required.", document, setDocument],
            ] as const
          ).map(([id, label, hint, value, setter]) => (
            <div key={id} className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor={id}>{label}</Label>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
              <Switch id={id} checked={value} onCheckedChange={setter} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || !code || isSaving}
            onClick={() =>
              void submit(
                "/leave/types",
                {
                  name: name.trim(),
                  code,
                  is_paid: isPaid,
                  allows_half_day: halfDay,
                  requires_document: document,
                },
                `${name.trim()} added`,
              )
            }
          >
            {isSaving && <Loader2 className="animate-spin" />}
            Add type
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PolicyDialog({
  open,
  leaveTypes,
  locations,
  onClose,
  onSaved,
}: {
  open: boolean;
  leaveTypes: LeaveType[];
  locations: LocationOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState(EVERYWHERE);
  const [grade, setGrade] = useState("");
  const [quota, setQuota] = useState("");
  const [frequency, setFrequency] = useState<AccrualFrequency>("monthly");
  const [carry, setCarry] = useState("0");
  const [notice, setNotice] = useState("0");
  const [maxConsecutive, setMaxConsecutive] = useState("");
  const [negative, setNegative] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(toISODate(new Date()));
  const { isSaving, submit } = useSubmit(onSaved);

  useEffect(() => {
    if (open) {
      setLeaveTypeId(leaveTypes[0]?.id ?? "");
      setName("");
      setLocationId(EVERYWHERE);
      setGrade("");
      setQuota("");
      setFrequency("monthly");
      setCarry("0");
      setNotice("0");
      setMaxConsecutive("");
      setNegative(false);
      setEffectiveFrom(toISODate(new Date()));
    }
  }, [open, leaveTypes]);

  const decimal = /^\d{1,3}(\.\d{1,2})?$/;
  const valid =
    leaveTypeId && name.trim() && decimal.test(quota) && decimal.test(carry) && /^\d+$/.test(notice);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a leave policy</DialogTitle>
          <DialogDescription>
            A policy for the same leave type and population replaces the current one from its start date.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Leave type</Label>
              <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="policy-name">Policy name</Label>
              <Input id="policy-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Earned leave — Bengaluru" />
            </div>
            <div className="grid gap-1.5">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EVERYWHERE}>Everywhere</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} ({location.state_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="policy-grade">
                Grade <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input id="policy-grade" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="All grades" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="policy-quota">Days per year</Label>
              <Input id="policy-quota" inputMode="decimal" value={quota} onChange={(e) => setQuota(e.target.value)} className="font-mono" placeholder="18" />
            </div>
            <div className="grid gap-1.5">
              <Label>Accrual</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as AccrualFrequency)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQUENCY_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="policy-carry">Max carry forward</Label>
              <Input id="policy-carry" inputMode="decimal" value={carry} onChange={(e) => setCarry(e.target.value)} className="font-mono" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="policy-notice">Notice (days)</Label>
              <Input id="policy-notice" inputMode="numeric" value={notice} onChange={(e) => setNotice(e.target.value)} className="font-mono" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="policy-max">
                Max in one go <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input id="policy-max" inputMode="numeric" value={maxConsecutive} onChange={(e) => setMaxConsecutive(e.target.value)} className="font-mono" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="policy-from">In force from</Label>
              <Input id="policy-from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="policy-negative">Allow a negative balance</Label>
              <p className="text-xs text-muted-foreground">Requests beyond the balance warn instead of being refused.</p>
            </div>
            <Switch id="policy-negative" checked={negative} onCheckedChange={setNegative} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || isSaving}
            onClick={() =>
              void submit(
                "/leave/policies",
                {
                  leave_type_id: leaveTypeId,
                  name: name.trim(),
                  location_id: locationId === EVERYWHERE ? null : locationId,
                  grade: grade.trim() || null,
                  // Sent as strings; the API parses them as Decimal.
                  annual_quota_days: quota,
                  accrual_frequency: frequency,
                  max_carry_forward_days: carry,
                  min_notice_days: Number(notice),
                  max_consecutive_days: maxConsecutive ? Number(maxConsecutive) : null,
                  allows_negative_balance: negative,
                  effective_from: effectiveFrom,
                },
                `${name.trim()} saved`,
              )
            }
          >
            {isSaving && <Loader2 className="animate-spin" />}
            Save policy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HolidayDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [optional, setOptional] = useState(false);
  const { isSaving, submit } = useSubmit(onSaved);

  useEffect(() => {
    if (open) {
      setName("");
      setDate("");
      setStateCode("");
      setOptional(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a holiday</DialogTitle>
          <DialogDescription>
            Leave the state blank for a national holiday. Take dates from the state gazette notification.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="holiday-name">Name</Label>
            <Input id="holiday-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ugadi" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="holiday-date">Date</Label>
              <Input id="holiday-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="holiday-state">
                State code <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="holiday-state"
                value={stateCode}
                maxLength={4}
                onChange={(e) => setStateCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
                placeholder="KA"
                className="font-mono"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="holiday-optional">Optional holiday</Label>
              <p className="text-xs text-muted-foreground">Employees choose it; it is not skipped automatically.</p>
            </div>
            <Switch id="holiday-optional" checked={optional} onCheckedChange={setOptional} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || !date || (stateCode.length > 0 && stateCode.length < 2) || isSaving}
            onClick={() =>
              void submit(
                "/leave/holidays",
                {
                  name: name.trim(),
                  holiday_date: date,
                  state_code: stateCode || null,
                  is_optional: optional,
                },
                `${name.trim()} added`,
              )
            }
          >
            {isSaving && <Loader2 className="animate-spin" />}
            Add holiday
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
