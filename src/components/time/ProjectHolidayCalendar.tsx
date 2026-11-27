"use client";

import { Copy, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ApiError, post, put } from "@/lib/api";
import type { HolidayCalendar, HolidayCopyResult } from "@/lib/types";
import { formatDay, toISODate } from "@/lib/utils";

/** The holiday table's calendar filter: every calendar, the company's, or a project id. */
export const ALL_CALENDARS = "__all_calendars";
export const COMPANY_CALENDAR = "__company_calendar";

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.detail : fallback;
}

function people(count: number | null): string {
  return `${count ?? 0} ${count === 1 ? "person" : "people"}`;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** "2 already there · 1 already passed", or "" when nothing was skipped. */
function skippedText(result: HolidayCopyResult): string {
  return [
    result.already_there > 0 && `${result.already_there} already on its calendar`,
    result.past > 0 && `${result.past} already passed`,
    result.other_company > 0 && `${result.other_company} for another company`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * A project's holiday calendar: who it covers, and whether it follows the
 * company's or keeps its own.
 *
 * Its own calendar runs from a date: from then the company's holidays stop
 * applying to the project's people, before it they still do — a month already
 * worked out keeps the holidays it was paid for. Turning it on can start the
 * calendar with the company's holidays, so HR only changes what the client
 * does differently.
 */
export function ProjectCalendarCard({
  calendar,
  year,
  onChanged,
}: {
  calendar: HolidayCalendar;
  year: number;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<"start" | "date" | null>(null);
  const [leaving, setLeaving] = useState(false);
  const today = toISODate(new Date());
  const own = calendar.own_holidays_from;

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>{calendar.name} holiday calendar</CardTitle>
        <CardDescription>
          {people(calendar.headcount)} on this project · {plural(calendar.holiday_count, "holiday")}{" "}
          in {year}, {calendar.own_count} of them its own
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Label htmlFor="own-calendar" className="text-sm font-normal text-muted-foreground">
            Own calendar
          </Label>
          <Switch
            id="own-calendar"
            checked={own !== null}
            onCheckedChange={(next) => (next ? setEditing("start") : setLeaving(true))}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        {own ? (
          <p>
            Keeps its own calendar from{" "}
            <span className="font-medium text-foreground">{formatDay(own, true)}</span>. From that
            day the company&apos;s holidays no longer apply to its people — only the ones on this
            calendar. Days before it keep the company&apos;s holidays.
          </p>
        ) : (
          <p>
            Follows the company calendar: its people get the company&apos;s holidays plus any added
            here for {calendar.name}. Turn on its own calendar when the client keeps a different
            list.
          </p>
        )}
        {own && own > today && (
          <Button variant="outline" size="sm" onClick={() => setEditing("date")}>
            Change date
          </Button>
        )}
      </CardContent>

      <OwnCalendarDialog
        calendar={calendar}
        mode={editing}
        year={year}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          onChanged();
        }}
      />
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title="Follow the company calendar again?"
        description={`The company's holidays apply to the ${people(calendar.headcount)} on ${calendar.name} again. Its own ${plural(calendar.own_count, "holiday")} stay on its calendar too — remove any that repeat the company's.`}
        confirmLabel="Follow the company calendar"
        onConfirm={async () => {
          try {
            await put(`/leave/holiday-calendars/${calendar.project_id}?year=${year}`, {
              own_holidays_from: null,
            });
            toast.success(`${calendar.name} follows the company calendar`);
            setLeaving(false);
            onChanged();
          } catch (error) {
            toast.error(errorText(error, "Could not change the calendar."));
            throw error;
          }
        }}
      />
    </Card>
  );
}

function OwnCalendarDialog({
  calendar,
  mode,
  year,
  onClose,
  onSaved,
}: {
  calendar: HolidayCalendar;
  mode: "start" | "date" | null;
  year: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = toISODate(new Date());
  const [from, setFrom] = useState(today);
  const [seed, setSeed] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!mode) return;
    setFrom(calendar.own_holidays_from && calendar.own_holidays_from >= today ? calendar.own_holidays_from : today);
    setSeed(mode === "start");
  }, [mode, calendar.own_holidays_from, today]);

  const save = async () => {
    setIsSaving(true);
    try {
      const saved = await put<HolidayCalendar>(
        `/leave/holiday-calendars/${calendar.project_id}?year=${year}`,
        { own_holidays_from: from, copy_company_holidays: seed },
      );
      const copied = saved.copied;
      toast.success(
        mode === "start"
          ? `${calendar.name} keeps its own holiday calendar`
          : `${calendar.name}'s own calendar starts ${formatDay(from, true)}`,
        {
          description: copied
            ? copied.copied > 0
              ? `${plural(copied.copied, "company holiday")} copied — remove the ones the client does not give.`
              : "No company holidays to copy from that date."
            : undefined,
        },
      );
      onSaved();
    } catch (error) {
      toast.error(errorText(error, "Could not change the calendar."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={mode !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "start" ? `Give ${calendar.name} its own calendar` : "Change the start date"}
          </DialogTitle>
          <DialogDescription>
            From this date the company&apos;s holidays stop applying to the{" "}
            {people(calendar.headcount)} on {calendar.name}; only the holidays on its own calendar
            do. Days before it keep the company&apos;s holidays.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="own-calendar-from" label="From">
            <DatePicker id="own-calendar-from" value={from} min={today} required onChange={setFrom} />
          </FormField>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="own-calendar-seed">Start with the company&apos;s holidays</Label>
              <p className="text-xs text-muted-foreground">
                Copies the company&apos;s holidays from that date onto this calendar, so you only
                change what the client does differently.
              </p>
            </div>
            <Switch id="own-calendar-seed" checked={seed} onCheckedChange={setSeed} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!from || from < today || isSaving} onClick={() => void save()}>
            {isSaving && <Loader2 className="animate-spin" />}
            {mode === "start" ? "Use its own calendar" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Copy a year's holidays onto a project's calendar from the company calendar
 * or another project's — what the source's people get. Days already passed,
 * and days the project already has for the same place, are skipped.
 */
export function CopyHolidaysDialog({
  target,
  calendars,
  year,
  onClose,
  onCopied,
}: {
  target: HolidayCalendar | null;
  calendars: HolidayCalendar[];
  year: number;
  onClose: () => void;
  onCopied: () => void;
}) {
  const [source, setSource] = useState(COMPANY_CALENDAR);
  const [isCopying, setIsCopying] = useState(false);

  useEffect(() => {
    if (target) setSource(COMPANY_CALENDAR);
  }, [target]);

  const others = calendars.filter(
    (calendar) => calendar.project_id && calendar.project_id !== target?.project_id,
  );
  const pointless = source === COMPANY_CALENDAR && target?.own_holidays_from === null;

  const copy = async () => {
    if (!target) return;
    setIsCopying(true);
    try {
      const result = await post<HolidayCopyResult>("/leave/holidays/copy", {
        year,
        to_project_id: target.project_id,
        from_project_id: source === COMPANY_CALENDAR ? null : source,
      });
      const skipped = skippedText(result);
      if (result.copied > 0) {
        toast.success(`${plural(result.copied, "holiday")} copied to ${target.name}`, {
          description: skipped ? `Skipped: ${skipped}.` : undefined,
        });
      } else {
        toast.info("Nothing new to copy", { description: skipped ? `Skipped: ${skipped}.` : undefined });
      }
      onCopied();
    } catch (error) {
      toast.error(errorText(error, "Could not copy the holidays."));
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy holidays to {target?.name}</DialogTitle>
          <DialogDescription>
            Adds {year}&apos;s holidays from another calendar to {target?.name}&apos;s. Days already
            passed, and days its calendar already has for the same place, are skipped.
          </DialogDescription>
        </DialogHeader>
        <FormField
          htmlFor="copy-from"
          label="Copy from"
          hint={
            pointless
              ? `${target?.name} follows the company calendar, so its people already get these. Copying them helps once it keeps its own calendar.`
              : undefined
          }
        >
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger id="copy-from" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={COMPANY_CALENDAR}>Company calendar</SelectItem>
              {others.map((calendar) => (
                <SelectItem key={calendar.project_id} value={calendar.project_id!}>
                  {calendar.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isCopying} onClick={() => void copy()}>
            {isCopying ? <Loader2 className="animate-spin" /> : <Copy />}
            Copy holidays
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
