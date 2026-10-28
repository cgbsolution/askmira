"use client";

import { BellRing, CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormField } from "@/components/common/FormField";
import {
  apiErrorMessage,
  InlineProblem,
  NotLiveNotice,
  toastApiError,
} from "@/components/payroll-ops/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post, put } from "@/lib/api";
import type { DeclarationWindow, ReminderRun, WindowType, WindowUpsertInput } from "@/lib/types/tax";

import { pendingState } from "./common";
import { DatePicker } from "@/components/common/DatePicker";

const REMINDER_PATTERN = /^\d+(\s*,\s*\d+)*$/;

const WINDOW_TITLE: Record<WindowType, string> = {
  declaration: "Declaration window",
  proof: "Proof window",
};

/** Admin-only: set the two windows, close the proof window, run reminders. */
export function WindowsAdmin({ financialYear }: { financialYear: string }) {
  const query = useApiQuery<DeclarationWindow[]>(
    `/tax/windows?financial_year=${encodeURIComponent(financialYear)}`,
  );
  const [confirmClose, setConfirmClose] = useState(false);
  const [lockedCount, setLockedCount] = useState<number | null>(null);
  const [reminderRun, setReminderRun] = useState<ReminderRun | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const closeProofWindow = async () => {
    try {
      const result = await post<{ declarations_locked: number }>(
        `/tax/proof-window/close?financial_year=${encodeURIComponent(financialYear)}`,
      );
      setLockedCount(result.declarations_locked);
      toast.success(`Proof window closed for FY ${financialYear}`);
      query.reload();
    } catch (error) {
      toastApiError(error, "The proof window could not be closed.");
      throw error;
    }
  };

  const runReminders = async () => {
    setIsRunning(true);
    try {
      const result = await post<ReminderRun>("/tax/reminders/run");
      setReminderRun(result);
      toast.success("Reminder run finished");
    } catch (error) {
      toastApiError(error, "Reminders could not be run.");
    } finally {
      setIsRunning(false);
    }
  };

  const state = pendingState(query, { rows: 4, loaded: query.data !== null });
  const windows = query.data ?? [];

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Windows</CardTitle>
        <CardDescription>
          When employees can declare and prove for FY {financialYear}. Admins only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {state ?? (
          <div className="grid gap-4 lg:grid-cols-2">
            {(["declaration", "proof"] as const).map((type) => {
              const window = windows.find((row) => row.window_type === type) ?? null;
              return (
                <WindowForm
                  key={window?.id ?? `new-${type}`}
                  financialYear={financialYear}
                  type={type}
                  window={window}
                  onSaved={query.reload}
                />
              );
            })}
          </div>
        )}

        <Separator />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <LockKeyhole className="size-4 text-muted-foreground" /> Close the proof window
            </h3>
            <p className="text-sm text-muted-foreground">
              Locks every declaration for FY {financialYear}. Anything declared but not proved
              drops to its accepted amount, which usually raises TDS in March.
            </p>
            <Button variant="destructive" onClick={() => setConfirmClose(true)}>
              Close proof window
            </Button>
            {lockedCount !== null && (
              <Alert variant="success">
                <CheckCircle2 />
                <AlertTitle>Proof window closed</AlertTitle>
                <AlertDescription>
                  <p className="tabular-nums">
                    {lockedCount} {lockedCount === 1 ? "declaration" : "declarations"} locked.
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <BellRing className="size-4 text-muted-foreground" /> Deadline reminders
            </h3>
            <NotLiveNotice title="No scheduler yet">
              Reminders are not sent automatically. They go out only when someone runs them here.
            </NotLiveNotice>
            <Button variant="outline" disabled={isRunning} onClick={() => void runReminders()}>
              {isRunning ? <Loader2 className="animate-spin" /> : <BellRing />}
              Send reminders now
            </Button>
            {reminderRun && (
              <div className="rounded-md border border-border px-3 py-2.5 text-sm">
                <p className="tabular-nums text-foreground">
                  {reminderRun.windows_checked} {reminderRun.windows_checked === 1 ? "window" : "windows"} checked,{" "}
                  {reminderRun.notifications_raised}{" "}
                  {reminderRun.notifications_raised === 1 ? "notification" : "notifications"} raised.
                </p>
                {reminderRun.events.length > 0 && (
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                    {reminderRun.events.map((event, index) => (
                      <li key={index}>{event}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={`Close the proof window for FY ${financialYear}?`}
        description="Every declaration for the year is locked. Declarations without accepted proof drop to their accepted amounts — often nothing — which usually raises March TDS for those employees."
        confirmLabel="Close and lock declarations"
        destructive
        onConfirm={closeProofWindow}
      />
    </Card>
  );
}

function WindowForm({
  financialYear,
  type,
  window,
  onSaved,
}: {
  financialYear: string;
  type: WindowType;
  window: DeclarationWindow | null;
  onSaved: () => void;
}) {
  const [opensAt, setOpensAt] = useState(window?.opens_at.slice(0, 10) ?? "");
  const [closesAt, setClosesAt] = useState(window?.closes_at.slice(0, 10) ?? "");
  const [allowLate, setAllowLate] = useState(window?.allow_late_submission ?? false);
  const [reminders, setReminders] = useState(window?.reminder_days_before.join(", ") ?? "");
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const opensError = opensAt ? null : "Opening date is required.";
  const closesError = !closesAt
    ? "Closing date is required."
    : opensAt && closesAt < opensAt
      ? "It cannot close before it opens."
      : null;
  const remindersError =
    reminders.trim() && !REMINDER_PATTERN.test(reminders.trim())
      ? "Whole numbers of days, separated by commas — for example 7, 3, 1."
      : null;

  const save = async () => {
    setAttempted(true);
    if (opensError || closesError || remindersError) return;
    setIsSaving(true);
    setServerError(null);
    const body: WindowUpsertInput = {
      financial_year: financialYear,
      window_type: type,
      opens_at: opensAt,
      closes_at: closesAt,
      allow_late_submission: allowLate,
      reminder_days_before: reminders.trim()
        ? reminders.split(",").map((part) => Number.parseInt(part.trim(), 10))
        : [],
    };
    try {
      await put<DeclarationWindow>("/tax/windows", body);
      toast.success(`${WINDOW_TITLE[type]} saved for FY ${financialYear}`);
      onSaved();
    } catch (error) {
      setServerError(apiErrorMessage(error, "The window could not be saved."));
    } finally {
      setIsSaving(false);
    }
  };

  const id = `window-${type}`;

  return (
    <form
      noValidate
      className="space-y-4 rounded-lg border border-border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{WINDOW_TITLE[type]}</h3>
        {window ? (
          <Badge variant={window.is_open ? "success" : "muted"}>
            {window.is_open ? "Open" : "Closed"}
          </Badge>
        ) : (
          <Badge variant="warning">Not set</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField htmlFor={`${id}-opens`} label="Opens" error={attempted ? opensError : null}>
          <DatePicker
            id={`${id}-opens`}
            value={opensAt}
            aria-invalid={attempted && Boolean(opensError)}
            onChange={setOpensAt}
          />
        </FormField>
        <FormField htmlFor={`${id}-closes`} label="Closes" error={attempted ? closesError : null}>
          <DatePicker
            id={`${id}-closes`}
            min={opensAt || undefined}
            value={closesAt}
            aria-invalid={attempted && Boolean(closesError)}
            onChange={setClosesAt}
          />
        </FormField>
      </div>

      <FormField
        htmlFor={`${id}-reminders`}
        label="Reminder days before closing"
        optional
        hint="Whole numbers of days, separated by commas."
        error={remindersError}
      >
        <Input
          id={`${id}-reminders`}
          value={reminders}
          placeholder="7, 3, 1"
          autoComplete="off"
          className="tabular-nums"
          aria-invalid={Boolean(remindersError)}
          onChange={(event) => setReminders(event.target.value)}
        />
      </FormField>

      <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2.5">
        <div>
          <Label htmlFor={`${id}-late`}>Allow late submissions</Label>
          <p className="text-xs text-muted-foreground">Keeps accepting after the closing date.</p>
        </div>
        <Switch id={`${id}-late`} checked={allowLate} onCheckedChange={setAllowLate} />
      </div>

      {serverError && <InlineProblem>{serverError}</InlineProblem>}

      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="animate-spin" />}
          Save window
        </Button>
      </div>
    </form>
  );
}
