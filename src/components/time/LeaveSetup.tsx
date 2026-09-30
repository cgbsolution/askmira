"use client";

import {
  CalendarPlus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { holidayScopeLabel } from "@/components/time/HolidayList";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ApiError, del, get, patch, post, put } from "@/lib/api";
import type {
  AccrualFrequency,
  AccrualRun,
  Holiday,
  HolidayScope,
  LeavePolicy,
  LeaveSettings,
  LeaveType,
  YearEndRun,
} from "@/lib/types";
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
const EVERYONE = "__everyone__";

const GENDER_LABEL: Record<"female" | "male", string> = { female: "Women", male: "Men" };

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.detail : fallback;
}

/**
 * HR's leave configuration: types, policies, holidays, settings and the
 * year-end close.
 *
 * Policies are versioned: a change from a date is a new version, and the
 * server closes the old one the day before, so last year's balance keeps
 * reading last year's quota. A correction edits the version in place, for the
 * whole period it covers — which is what a typo fix means.
 */
export function LeaveSetup({ onChanged, version }: { onChanged: () => void; version: number }) {
  const thisYear = new Date().getFullYear();
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [settings, setSettings] = useState<LeaveSettings | null>(null);
  const [holidayYear, setHolidayYear] = useState(thisYear);
  const [isLoading, setIsLoading] = useState(true);
  const [editingType, setEditingType] = useState<LeaveType | "new" | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<LeavePolicy | "new" | null>(null);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | "new" | null>(null);
  const [removingHoliday, setRemovingHoliday] = useState<Holiday | null>(null);
  const [withdrawingPolicy, setWithdrawingPolicy] = useState<LeavePolicy | null>(null);
  const [closingYear, setClosingYear] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [typeRows, policyRows, locationRows, holidayRows, settingsRow] = await Promise.all([
        get<LeaveType[]>("/leave/types?include_inactive=true"),
        get<LeavePolicy[]>("/leave/policies"),
        get<LocationOption[]>("/org/locations"),
        get<Holiday[]>(`/leave/holidays?year=${holidayYear}&scope=all`),
        get<LeaveSettings>("/leave/settings"),
      ]);
      setTypes(typeRows);
      setPolicies(policyRows);
      setLocations(locationRows);
      setHolidays(holidayRows);
      setSettings(settingsRow);
    } catch (error) {
      toast.error(errorText(error, "Could not load leave setup."));
    } finally {
      setIsLoading(false);
    }
  }, [holidayYear]);

  useEffect(() => {
    void load();
  }, [load, version]);

  const activeTypes = useMemo(
    () => types.filter((type) => type.is_active),
    [types],
  );
  const typeName = (id: string) => types.find((type) => type.id === id)?.name ?? "—";
  const locationName = (id: string | null) =>
    id ? (locations.find((location) => location.id === id)?.name ?? "—") : "Everywhere";

  const changed = () => {
    setEditingType(null);
    setEditingPolicy(null);
    setEditingHoliday(null);
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
      toast.error(errorText(error, "Could not post accruals."));
    } finally {
      setIsRunning(false);
    }
  };

  const setTypeActive = async (type: LeaveType, active: boolean) => {
    try {
      await post(`/leave/types/${type.id}/${active ? "activate" : "deactivate"}`);
      toast.success(`${type.name} ${active ? "offered again" : "withdrawn"}`);
      changed();
    } catch (error) {
      toast.error(errorText(error, "Could not change the leave type."));
    }
  };

  const today = toISODate(new Date());

  return (
    <div className="grid gap-6">
      <SettingsCard
        settings={settings}
        onSaved={changed}
        onCloseYear={() => setClosingYear(true)}
        lastYear={thisYear - 1}
      />

      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Leave types</CardTitle>
          <CardDescription>The kinds of leave people can request.</CardDescription>
          <CardAction>
            <Button size="sm" onClick={() => setEditingType("new")}>
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
                <TableHead className="w-12 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((type) => (
                <TableRow key={type.id}>
                  <TableCell className="pl-5 font-medium text-foreground">
                    {type.name}
                    {!type.is_active && (
                      <Badge variant="muted" className="ml-2">
                        Withdrawn
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">{type.code}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={type.is_paid ? "success" : "muted"}>
                        {type.is_paid ? "Paid" : "Unpaid (loss of pay)"}
                      </Badge>
                      {type.allows_half_day && <Badge variant="outline">Half days</Badge>}
                      {type.requires_document && <Badge variant="outline">Document needed</Badge>}
                      {type.is_statutory && <Badge variant="secondary">Statutory</Badge>}
                      {type.is_comp_off && <Badge variant="accent">Comp-off</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${type.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditingType(type)}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        {type.is_active ? (
                          !type.is_statutory && (
                            <DropdownMenuItem onSelect={() => void setTypeActive(type, false)}>
                              <Trash2 /> Withdraw
                            </DropdownMenuItem>
                          )
                        ) : (
                          <DropdownMenuItem onSelect={() => void setTypeActive(type, true)}>
                            <RefreshCw /> Offer again
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
            <Button size="sm" disabled={activeTypes.length === 0} onClick={() => setEditingPolicy("new")}>
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
                  <TableHead className="w-12 pr-5" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="pl-5">
                      <p className="font-medium text-foreground">{policy.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {typeName(policy.leave_type_id)}
                        {policy.applies_to_gender && ` · ${GENDER_LABEL[policy.applies_to_gender].toLowerCase()} only`}
                        {policy.sandwich_weekends_holidays && " · sandwich rule"}
                        {policy.allows_negative_balance && " · negative allowed"}
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
                    <TableCell className="pr-5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${policy.name}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditingPolicy(policy)}>
                            <Pencil /> Edit or new version
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setWithdrawingPolicy(policy)}>
                            <Trash2 /> Withdraw
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Holidays</CardTitle>
          <CardDescription>
            National, state or single-office holidays. Past ones stay as they are: attendance
            and payroll may already reflect them.
          </CardDescription>
          <CardAction className="flex gap-2">
            <Select value={String(holidayYear)} onValueChange={(value) => setHolidayYear(Number(value))}>
              <SelectTrigger size="sm" className="w-24" aria-label="Year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[thisYear - 1, thisYear, thisYear + 1].map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setEditingHoliday("new")}>
              <CalendarPlus /> Add holiday
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {holidays.length === 0 ? (
            <p className="px-5 pb-2 text-sm text-muted-foreground">
              No holidays for {holidayYear} yet. Add them from the state gazette notification.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Date</TableHead>
                  <TableHead>Holiday</TableHead>
                  <TableHead>Applies to</TableHead>
                  <TableHead className="w-12 pr-5" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell className="pl-5 whitespace-nowrap tabular-nums">
                      {formatDay(holiday.holiday_date, true)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-foreground">{holiday.name}</span>
                      {holiday.is_optional && (
                        <Badge variant="outline" className="ml-2">
                          Optional
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {holiday.scope === "location"
                        ? `${holidayScopeLabel(holiday)} (office)`
                        : holiday.scope === "state"
                          ? `${holidayScopeLabel(holiday)} (state)`
                          : "National"}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      {holiday.holiday_date >= today && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${holiday.name}`}>
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setEditingHoliday(holiday)}>
                              <Pencil /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setRemovingHoliday(holiday)}>
                              <Trash2 /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LeaveTypeDialog
        editing={editingType}
        onClose={() => setEditingType(null)}
        onSaved={changed}
      />
      <PolicyDialog
        editing={editingPolicy}
        leaveTypes={activeTypes}
        locations={locations}
        onClose={() => setEditingPolicy(null)}
        onSaved={changed}
      />
      <HolidayDialog
        editing={editingHoliday}
        locations={locations}
        onClose={() => setEditingHoliday(null)}
        onSaved={changed}
      />
      <ConfirmDialog
        open={removingHoliday !== null}
        onOpenChange={(open) => !open && setRemovingHoliday(null)}
        title={`Remove ${removingHoliday?.name ?? "this holiday"}?`}
        description="Anyone who chose it as an optional holiday loses the choice. The removal is audited."
        confirmLabel="Remove holiday"
        destructive
        onConfirm={async () => {
          if (!removingHoliday) return;
          try {
            await del(`/leave/holidays/${removingHoliday.id}`);
            toast.success(`${removingHoliday.name} removed`);
            setRemovingHoliday(null);
            changed();
          } catch (error) {
            toast.error(errorText(error, "Could not remove the holiday."));
            throw error;
          }
        }}
      />
      <ConfirmDialog
        open={withdrawingPolicy !== null}
        onOpenChange={(open) => !open && setWithdrawingPolicy(null)}
        title={`Withdraw ${withdrawingPolicy?.name ?? "this policy"}?`}
        description="People it covers stop accruing under it. To change the rules from a date instead, add a new version."
        confirmLabel="Withdraw policy"
        destructive
        onConfirm={async () => {
          if (!withdrawingPolicy) return;
          try {
            await post(`/leave/policies/${withdrawingPolicy.id}/deactivate`);
            toast.success(`${withdrawingPolicy.name} withdrawn`);
            setWithdrawingPolicy(null);
            changed();
          } catch (error) {
            toast.error(errorText(error, "Could not withdraw the policy."));
            throw error;
          }
        }}
      />
      <ConfirmDialog
        open={closingYear}
        onOpenChange={setClosingYear}
        title={`Close the ${thisYear - 1} leave year?`}
        description={`Each balance carries into ${thisYear} up to its policy's carry-forward limit; the rest lapses. The scheduler does this on 1 January; balances already closed are left alone.`}
        confirmLabel={`Close ${thisYear - 1}`}
        onConfirm={async () => {
          try {
            const result = await post<YearEndRun>(`/leave/year-end/${thisYear - 1}`);
            toast.success(`${result.year} closed`, {
              description: `${result.balances_closed} balance(s): ${formatDays(result.days_carried)} days carried, ${formatDays(result.days_lapsed)} lapsed${result.already_closed ? `; ${result.already_closed} were already closed` : ""}.`,
            });
            onChanged();
          } catch (error) {
            toast.error(errorText(error, "Could not close the year."));
            throw error;
          }
        }}
      />
    </div>
  );
}

function SettingsCard({
  settings,
  lastYear,
  onSaved,
  onCloseYear,
}: {
  settings: LeaveSettings | null;
  lastYear: number;
  onSaved: () => void;
  onCloseYear: () => void;
}) {
  const [quota, setQuota] = useState("");
  const [expiry, setExpiry] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setQuota(String(settings.optional_holiday_quota));
      setExpiry(String(settings.comp_off_expiry_days));
    }
  }, [settings]);

  const valid = /^\d{1,2}$/.test(quota) && /^\d{1,3}$/.test(expiry) && Number(expiry) >= 1;
  const dirty =
    settings !== null &&
    (quota !== String(settings.optional_holiday_quota) ||
      expiry !== String(settings.comp_off_expiry_days));

  const save = async () => {
    setIsSaving(true);
    try {
      await put<LeaveSettings>("/leave/settings", {
        optional_holiday_quota: Number(quota),
        comp_off_expiry_days: Number(expiry),
      });
      toast.success("Leave settings saved");
      onSaved();
    } catch (error) {
      toast.error(errorText(error, "Could not save the settings."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Leave settings</CardTitle>
        <CardDescription>
          Workspace-wide rules. Comp-off credits go to{" "}
          {settings?.comp_off_leave_type_name
            ? `${settings.comp_off_leave_type_name}`
            : "the type marked as comp-off (none yet — edit a leave type to mark one)"}
          .
        </CardDescription>
        <CardAction className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCloseYear}>
            Close {lastYear}
          </Button>
          <Button size="sm" disabled={!valid || !dirty || isSaving} onClick={() => void save()}>
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
            Save
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="setting-quota"
          label="Optional holidays per year"
          hint="How many optional (restricted) holidays each person may choose."
        >
          <Input
            id="setting-quota"
            inputMode="numeric"
            className="font-mono"
            value={quota}
            onChange={(event) => setQuota(event.target.value)}
          />
        </FormField>
        <FormField
          htmlFor="setting-expiry"
          label="Comp-off lapses after (days)"
          hint="Counted from the day the credit is approved."
        >
          <Input
            id="setting-expiry"
            inputMode="numeric"
            className="font-mono"
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
          />
        </FormField>
      </CardContent>
    </Card>
  );
}

function LeaveTypeDialog({
  editing,
  onClose,
  onSaved,
}: {
  editing: LeaveType | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = editing === "new";
  const existing = editing && editing !== "new" ? editing : null;
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isPaid, setIsPaid] = useState(true);
  const [halfDay, setHalfDay] = useState(true);
  const [document, setDocument] = useState(false);
  const [statutory, setStatutory] = useState(false);
  const [compOff, setCompOff] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const source = editing === "new" ? null : editing;
    setName(source?.name ?? "");
    setCode(source?.code ?? "");
    setIsPaid(source?.is_paid ?? true);
    setHalfDay(source?.allows_half_day ?? true);
    setDocument(source?.requires_document ?? false);
    setStatutory(source?.is_statutory ?? false);
    setCompOff(source?.is_comp_off ?? false);
  }, [editing]);

  const save = async () => {
    setIsSaving(true);
    try {
      if (isNew) {
        await post("/leave/types", {
          name: name.trim(),
          code,
          is_paid: isPaid,
          allows_half_day: halfDay,
          requires_document: document,
          is_statutory: statutory,
          is_comp_off: compOff,
        });
        toast.success(`${name.trim()} added`);
      } else if (existing) {
        await patch(`/leave/types/${existing.id}`, {
          name: name.trim(),
          is_paid: isPaid,
          allows_half_day: halfDay,
          requires_document: document,
          is_comp_off: compOff,
        });
        toast.success(`${name.trim()} saved`);
      }
      onSaved();
    } catch (error) {
      toast.error(errorText(error, "Could not save the leave type."));
    } finally {
      setIsSaving(false);
    }
  };

  const toggles: [string, string, string, boolean, (value: boolean) => void, boolean][] = [
    ["type-paid", "Paid leave", "Unpaid leave counts as loss of pay and has no balance.", isPaid, setIsPaid, false],
    ["type-half", "Allow half days", "First or second half of a single date.", halfDay, setHalfDay, false],
    ["type-doc", "Needs a document", "A medical certificate or similar must be attached.", document, setDocument, false],
    ["type-comp", "Comp-off type", "Approved comp-off claims are credited here. Only one type can be.", compOff, setCompOff, false],
    ["type-statutory", "Statutory entitlement", "Maternity leave and similar. Cannot be withdrawn later.", statutory, setStatutory, !isNew],
  ];

  return (
    <Dialog open={editing !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add a leave type" : `Edit ${existing?.name}`}</DialogTitle>
          <DialogDescription>
            {isNew
              ? "People can request it once a policy gives them a quota (comp-off and unpaid types need none)."
              : "The code stays fixed: balances and encashment policies are keyed on it."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <FormField htmlFor="type-name" label="Name">
              <Input id="type-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Comp Off" />
            </FormField>
            <FormField htmlFor="type-code" label="Code">
              <Input
                id="type-code"
                value={code}
                disabled={!isNew}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                placeholder="CO"
                className="font-mono"
              />
            </FormField>
          </div>
          {toggles.map(([id, label, hint, value, setter, disabled]) => (
            <div key={id} className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor={id}>{label}</Label>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
              <Switch id={id} checked={value} disabled={disabled} onCheckedChange={setter} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || !code || isSaving} onClick={() => void save()}>
            {isSaving && <Loader2 className="animate-spin" />}
            {isNew ? "Add type" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PolicyDialog({
  editing,
  leaveTypes,
  locations,
  onClose,
  onSaved,
}: {
  editing: LeavePolicy | "new" | null;
  leaveTypes: LeaveType[];
  locations: LocationOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = editing && editing !== "new" ? editing : null;
  const [mode, setMode] = useState<"correct" | "version">("version");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState(EVERYWHERE);
  const [grade, setGrade] = useState("");
  const [gender, setGender] = useState<string>(EVERYONE);
  const [quota, setQuota] = useState("");
  const [frequency, setFrequency] = useState<AccrualFrequency>("monthly");
  const [carry, setCarry] = useState("0");
  const [notice, setNotice] = useState("0");
  const [maxConsecutive, setMaxConsecutive] = useState("");
  const [negative, setNegative] = useState(false);
  const [sandwich, setSandwich] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(toISODate(new Date()));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const source = editing === "new" ? null : editing;
    setMode(source ? "correct" : "version");
    setLeaveTypeId(source?.leave_type_id ?? leaveTypes[0]?.id ?? "");
    setName(source?.name ?? "");
    setLocationId(source?.location_id ?? EVERYWHERE);
    setGrade(source?.grade ?? "");
    setGender(source?.applies_to_gender ?? EVERYONE);
    setQuota(source ? source.annual_quota_days.replace(/\.00$/, "") : "");
    setFrequency(source?.accrual_frequency ?? "monthly");
    setCarry(source ? source.max_carry_forward_days.replace(/\.00$/, "") : "0");
    setNotice(String(source?.min_notice_days ?? 0));
    setMaxConsecutive(source?.max_consecutive_days ? String(source.max_consecutive_days) : "");
    setNegative(source?.allows_negative_balance ?? false);
    setSandwich(source?.sandwich_weekends_holidays ?? false);
    setEffectiveFrom(toISODate(new Date()));
  }, [editing, leaveTypes]);

  const decimal = /^\d{1,3}(\.\d{1,2})?$/;
  const valid =
    leaveTypeId &&
    name.trim() &&
    decimal.test(quota) &&
    decimal.test(carry) &&
    /^\d+$/.test(notice) &&
    (!maxConsecutive || /^\d+$/.test(maxConsecutive));
  const population = Boolean(existing); // the leave type, location and grade are fixed on an edit

  const save = async () => {
    setIsSaving(true);
    const rules = {
      name: name.trim(),
      // Sent as strings; the API parses them as Decimal.
      annual_quota_days: quota,
      accrual_frequency: frequency,
      max_carry_forward_days: carry,
      min_notice_days: Number(notice),
      max_consecutive_days: maxConsecutive ? Number(maxConsecutive) : null,
      allows_negative_balance: negative,
      sandwich_weekends_holidays: sandwich,
    };
    try {
      if (existing && mode === "correct") {
        await patch(`/leave/policies/${existing.id}`, {
          ...rules,
          applies_to_gender: gender === EVERYONE ? null : gender,
        });
        toast.success(`${name.trim()} corrected`);
      } else {
        await post("/leave/policies", {
          ...rules,
          leave_type_id: leaveTypeId,
          location_id: locationId === EVERYWHERE ? null : locationId,
          grade: grade.trim() || null,
          applies_to_gender: gender === EVERYONE ? null : gender,
          effective_from: effectiveFrom,
        });
        toast.success(
          existing
            ? `New version of ${name.trim()} from ${formatDay(effectiveFrom, true)}`
            : `${name.trim()} saved`,
        );
      }
      onSaved();
    } catch (error) {
      toast.error(errorText(error, "Could not save the policy."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={editing !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? `Edit ${existing.name}` : "Add a leave policy"}</DialogTitle>
          <DialogDescription>
            {existing
              ? "Correct this version for the whole period it covers, or start a new version from a date so earlier balances keep the old rules."
              : "A policy for the same leave type and population replaces the current one from its start date."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {existing && (
            <FormField htmlFor="policy-mode" label="Apply the change as">
              <Select value={mode} onValueChange={(value) => setMode(value as "correct" | "version")}>
                <SelectTrigger id="policy-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="correct">A correction to this version</SelectItem>
                  <SelectItem value="version">A new version from a date</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField htmlFor="policy-type" label="Leave type">
              <Select value={leaveTypeId} onValueChange={setLeaveTypeId} disabled={population}>
                <SelectTrigger id="policy-type" className="w-full">
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
            </FormField>
            <FormField htmlFor="policy-name" label="Policy name">
              <Input id="policy-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Earned leave — Bengaluru" />
            </FormField>
            <FormField htmlFor="policy-location" label="Location">
              <Select value={locationId} onValueChange={setLocationId} disabled={population}>
                <SelectTrigger id="policy-location" className="w-full">
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
            </FormField>
            <FormField htmlFor="policy-grade" label="Grade" optional>
              <Input id="policy-grade" value={grade} disabled={population} onChange={(e) => setGrade(e.target.value)} placeholder="All grades" />
            </FormField>
            <FormField
              htmlFor="policy-gender"
              label="Who"
              hint="Only a recorded opposite gender excludes; undisclosed never does."
            >
              <Select
                value={gender}
                onValueChange={setGender}
                disabled={population && mode === "version"}
              >
                <SelectTrigger id="policy-gender" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EVERYONE}>Everyone</SelectItem>
                  <SelectItem value="female">Women (e.g. maternity)</SelectItem>
                  <SelectItem value="male">Men (e.g. paternity)</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="policy-quota" label="Days per year">
              <Input id="policy-quota" inputMode="decimal" value={quota} onChange={(e) => setQuota(e.target.value)} className="font-mono" placeholder="18" />
            </FormField>
            <FormField htmlFor="policy-frequency" label="Accrual">
              <Select value={frequency} onValueChange={(v) => setFrequency(v as AccrualFrequency)}>
                <SelectTrigger id="policy-frequency" className="w-full">
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
            </FormField>
            <FormField htmlFor="policy-carry" label="Max carry forward">
              <Input id="policy-carry" inputMode="decimal" value={carry} onChange={(e) => setCarry(e.target.value)} className="font-mono" />
            </FormField>
            <FormField htmlFor="policy-notice" label="Notice (days)">
              <Input id="policy-notice" inputMode="numeric" value={notice} onChange={(e) => setNotice(e.target.value)} className="font-mono" />
            </FormField>
            <FormField htmlFor="policy-max" label="Max in one go" optional>
              <Input id="policy-max" inputMode="numeric" value={maxConsecutive} onChange={(e) => setMaxConsecutive(e.target.value)} className="font-mono" />
            </FormField>
            {(!existing || mode === "version") && (
              <FormField htmlFor="policy-from" label="In force from">
                <DatePicker id="policy-from" value={effectiveFrom} onChange={setEffectiveFrom} />
              </FormField>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="policy-negative">Allow a negative balance</Label>
              <p className="text-xs text-muted-foreground">Requests beyond the balance warn instead of being refused.</p>
            </div>
            <Switch id="policy-negative" checked={negative} onCheckedChange={setNegative} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="policy-sandwich">Sandwich rule</Label>
              <p className="text-xs text-muted-foreground">
                Weekly offs and holidays between two leave days count as leave (Friday to Monday is four days).
              </p>
            </div>
            <Switch id="policy-sandwich" checked={sandwich} onCheckedChange={setSandwich} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || isSaving} onClick={() => void save()}>
            {isSaving && <Loader2 className="animate-spin" />}
            {existing && mode === "correct" ? "Save correction" : "Save policy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HolidayDialog({
  editing,
  locations,
  onClose,
  onSaved,
}: {
  editing: Holiday | "new" | null;
  locations: LocationOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = editing && editing !== "new" ? editing : null;
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [scope, setScope] = useState<HolidayScope>("national");
  const [stateCode, setStateCode] = useState("");
  const [locationId, setLocationId] = useState("");
  const [optional, setOptional] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const states = useMemo(
    () => Array.from(new Set(locations.map((location) => location.state_code))).sort(),
    [locations],
  );

  useEffect(() => {
    if (!editing) return;
    const source = editing === "new" ? null : editing;
    setName(source?.name ?? "");
    setDate(source?.holiday_date ?? "");
    setScope(source?.scope ?? "national");
    setStateCode(source?.scope === "state" ? (source.state_code ?? "") : "");
    setLocationId(source?.location_id ?? "");
    setOptional(source?.is_optional ?? false);
  }, [editing]);

  const valid =
    name.trim() &&
    date &&
    (scope !== "state" || stateCode.length >= 2) &&
    (scope !== "location" || locationId);

  const save = async () => {
    setIsSaving(true);
    try {
      if (existing) {
        await patch(`/leave/holidays/${existing.id}`, {
          name: name.trim(),
          holiday_date: date,
          scope,
          state_code: scope === "state" ? stateCode : null,
          location_id: scope === "location" ? locationId : null,
          is_optional: optional,
        });
        toast.success(`${name.trim()} saved`);
      } else {
        await post("/leave/holidays", {
          name: name.trim(),
          holiday_date: date,
          state_code: scope === "state" ? stateCode : null,
          location_id: scope === "location" ? locationId : null,
          is_optional: optional,
        });
        toast.success(`${name.trim()} added`);
      }
      onSaved();
    } catch (error) {
      toast.error(errorText(error, "Could not save the holiday."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={editing !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? `Edit ${existing.name}` : "Add a holiday"}</DialogTitle>
          <DialogDescription>
            Take dates from the state gazette notification. A state holiday applies to every
            office in that state; an office holiday to that office only.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="holiday-name" label="Name">
            <Input id="holiday-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ugadi" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField htmlFor="holiday-date" label="Date">
              <DatePicker id="holiday-date" value={date} min={toISODate(new Date())} onChange={setDate} />
            </FormField>
            <FormField htmlFor="holiday-scope" label="Applies to">
              <Select value={scope} onValueChange={(value) => setScope(value as HolidayScope)}>
                <SelectTrigger id="holiday-scope" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="national">Everyone (national)</SelectItem>
                  <SelectItem value="state">One state</SelectItem>
                  <SelectItem value="location">One office</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          {scope === "state" && (
            <FormField htmlFor="holiday-state" label="State" hint="States of your offices are listed; type another if needed.">
              <div className="flex gap-2">
                <Select value={states.includes(stateCode) ? stateCode : ""} onValueChange={setStateCode}>
                  <SelectTrigger className="w-full" aria-label="State of an office">
                    <SelectValue placeholder="Choose a state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="holiday-state"
                  value={stateCode}
                  maxLength={4}
                  onChange={(e) => setStateCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
                  placeholder="KA"
                  className="w-20 font-mono"
                />
              </div>
            </FormField>
          )}
          {scope === "location" && (
            <FormField htmlFor="holiday-location" label="Office">
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger id="holiday-location" className="w-full">
                  <SelectValue placeholder="Choose an office" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} ({location.state_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="holiday-optional">Optional holiday</Label>
              <p className="text-xs text-muted-foreground">
                People choose it, within the yearly quota; it is a holiday only for them.
              </p>
            </div>
            <Switch id="holiday-optional" checked={optional} onCheckedChange={setOptional} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || isSaving} onClick={() => void save()}>
            {isSaving && <Loader2 className="animate-spin" />}
            {existing ? "Save" : "Add holiday"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
