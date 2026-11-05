"use client";

import { AlarmClock, Loader2, PencilLine } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { put } from "@/lib/api";
import type { AttendanceSettings } from "@/lib/types/attendance";

import { errorDetail, LoadError } from "./shared";

/** "Off" in a Select: Radix needs a non-empty value for every item. */
const OFF = "off";
const LATE_CHOICES = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const LIMIT_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15];

function ordinal(n: number): string {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${tail}`;
}

function monthName(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [year, month] = iso.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

/**
 * The admin's attendance rules: late marks that cost a half day, and how many
 * corrections a person may ask for in a month.
 *
 * Both decide pay, so only an admin changes them; a sub-admin sees them.
 */
export function AttendanceRulesCard() {
  const { data, error, isLoading, reload } = useApiQuery<AttendanceSettings>("/attendance/settings");
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [late, setLate] = useState(OFF);
  const [limit, setLimit] = useState(OFF);
  const [isSaving, setIsSaving] = useState(false);

  const savedLate = data?.late_marks_per_half_day ? String(data.late_marks_per_half_day) : OFF;
  const savedLimit = data?.monthly_correction_limit ? String(data.monthly_correction_limit) : OFF;

  useEffect(() => {
    if (!data) return;
    setLate(savedLate);
    setLimit(savedLimit);
  }, [data, savedLate, savedLimit]);

  const unchanged = late === savedLate && limit === savedLimit;
  const every = late === OFF ? null : Number(late);

  const save = async () => {
    setIsSaving(true);
    try {
      const saved = await put<AttendanceSettings>("/attendance/settings", {
        late_marks_per_half_day: every,
        monthly_correction_limit: limit === OFF ? null : Number(limit),
      });
      toast.success(
        saved.late_marks_per_half_day
          ? `Saved. Every ${ordinal(saved.late_marks_per_half_day)} late mark in a month is now a half day, from ${monthName(saved.late_marks_rule_from) ?? "this month"}.`
          : "Saved. Late marks no longer cost a half day.",
      );
      reload();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not save the attendance rules."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlarmClock className="size-4 text-primary" /> Late marks and corrections
        </CardTitle>
        <CardDescription>
          Rules that decide half days and how often people may ask to correct their attendance.
          Only an admin changes them.
        </CardDescription>
        {isAdmin && (
          <CardAction>
            <Button onClick={() => void save()} disabled={isSaving || unchanged || !data}>
              {isSaving && <Loader2 className="animate-spin" />} Save
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="grid gap-5">
        {isLoading ? (
          <Skeleton className="h-11 w-full max-w-xl" />
        ) : error ? (
          <LoadError error={error} onRetry={reload} />
        ) : (
          <>
            <div className="grid gap-5 md:grid-cols-2">
              <FormField
                htmlFor="late-marks-rule"
                label="A late mark becomes a half day"
                hint={
                  every
                    ? `In each month the ${ordinal(every)}, ${ordinal(every * 2)}, ${ordinal(every * 3)}… late mark is marked a half day automatically, never the 1st. The count starts again on the 1st.`
                    : "Late marks are counted and shown, but never cost a half day."
                }
              >
                <Select value={late} onValueChange={setLate} disabled={!isAdmin}>
                  <SelectTrigger id="late-marks-rule" className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OFF}>Never (off)</SelectItem>
                    {LATE_CHOICES.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        Every {ordinal(n)} late mark in a month
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                htmlFor="correction-limit"
                label={
                  <span className="flex items-center gap-1.5">
                    <PencilLine className="size-3.5" /> Correction requests per month
                  </span>
                }
                hint={
                  limit === OFF
                    ? "People may ask to correct as many days as they need."
                    : `Each person may ask for ${limit} correction${limit === "1" ? "" : "s"} (missed punch or attendance correction) for days in a month. A withdrawn request does not count; HR's own corrections, on-duty and work-from-home are not limited.`
                }
              >
                <Select value={limit} onValueChange={setLimit} disabled={!isAdmin}>
                  <SelectTrigger id="correction-limit" className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OFF}>No limit</SelectItem>
                    {LIMIT_CHOICES.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} per month
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            {data?.late_marks_per_half_day && (
              <Alert>
                <AlertDescription>
                  In force since {monthName(data.late_marks_rule_from) ?? "this month"}. A day is judged once it is
                  over, so the half day appears the day after the late mark. A correction to an earlier day moves
                  the half day to the next qualifying late mark; locked (paid) days are never changed.
                </AlertDescription>
              </Alert>
            )}
            {late !== savedLate && every && (
              <Alert variant="warning">
                <AlertDescription>
                  Saving applies this to every day of this month at once. Earlier months stay as they are.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
