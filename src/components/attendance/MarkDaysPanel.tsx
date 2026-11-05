"use client";

import { CalendarCheck, Clock, Loader2, UserX, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type { AttendanceStatus, Regularisation } from "@/lib/types/attendance";
import { formatDay } from "@/lib/utils";

import { errorDetail } from "./shared";

const CHOICES: { status: AttendanceStatus; label: string; icon: React.ElementType }[] = [
  { status: "present", label: "Full day", icon: CalendarCheck },
  { status: "half_day", label: "Half day", icon: Clock },
  { status: "absent", label: "Absent", icon: UserX },
];

/**
 * HR has picked several days on the calendar: mark them all Full day, Half
 * day or Absent in one go. Applied at once, like a single day; week offs,
 * holidays, approved leave and days already marked that way are skipped.
 */
export function MarkDaysPanel({
  employeeId,
  picked,
  isLocked,
  onClear,
  onMarked,
}: {
  employeeId?: string;
  /** The picked days, YYYY-MM-DD. */
  picked: string[];
  isLocked: boolean;
  onClear: () => void;
  onMarked: () => void;
}) {
  const [choice, setChoice] = useState<(typeof CHOICES)[number] | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const days = [...picked].sort();

  useEffect(() => {
    if (choice) setReason(`Marked ${choice.label.toLowerCase()} manually by HR`);
  }, [choice]);

  const reasonOk = reason.trim().length >= 3;

  const mark = async () => {
    if (!choice || !reasonOk) return;
    setBusy(true);
    try {
      const created = await post<Regularisation[]>("/attendance/regularisations/range", {
        employee_id: employeeId ?? null,
        kind: "status_change",
        dates: days,
        requested_status: choice.status,
        reason: reason.trim(),
      });
      const skipped = days.length - created.length;
      toast.success(
        `Marked ${created.length} day${created.length === 1 ? "" : "s"} as ${choice.label.toLowerCase()}` +
          (skipped > 0
            ? `; ${skipped} skipped (week off, holiday, leave or already ${choice.label.toLowerCase()}).`
            : "."),
      );
      setChoice(null);
      onMarked();
    } catch (caught) {
      toast.error(errorDetail(caught, "The days could not be marked."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {days.length} {days.length === 1 ? "day" : "days"} selected
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Click days on the calendar to add or remove them. Week offs, holidays, approved leave and days
          already marked that way are skipped.
        </p>
      </div>

      {days.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {days.map((iso) => (
            <Badge key={iso} variant="outline" className="tabular-nums">
              {formatDay(iso)}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No days picked yet.</p>
      )}

      {isLocked && (
        <Alert variant="warning">
          <AlertDescription>
            This month is locked for payroll. Unlock it under Periods &amp; payroll lock before marking days.
          </AlertDescription>
        </Alert>
      )}

      <Separator />
      <div>
        <p className="mb-2 text-sm font-medium">Mark them as</p>
        <div className="grid grid-cols-3 gap-2">
          {CHOICES.map((entry) => {
            const Icon = entry.icon;
            return (
              <Button
                key={entry.status}
                variant="outline"
                size="sm"
                className="px-2"
                disabled={days.length === 0}
                onClick={() => setChoice(entry)}
              >
                <Icon /> {entry.label}
              </Button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Applied at once, and each day shows as marked manually.
        </p>
      </div>
      <Button variant="ghost" size="sm" className="justify-start" onClick={onClear} disabled={days.length === 0}>
        <X /> Clear selection
      </Button>

      <Dialog open={choice !== null} onOpenChange={(open) => !busy && !open && setChoice(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Mark {days.length} {days.length === 1 ? "day" : "days"} as {choice?.label.toLowerCase()}
            </DialogTitle>
            <DialogDescription>
              {days.map((iso) => formatDay(iso)).join(", ")}. Applied at once; the employee sees each day as
              marked manually, with this reason.
            </DialogDescription>
          </DialogHeader>
          <FormField
            htmlFor="mark-days-reason"
            label="Reason"
            error={reasonOk ? undefined : "Give a reason of at least 3 characters."}
          >
            <Textarea
              id="mark-days-reason"
              value={reason}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
              aria-invalid={!reasonOk || undefined}
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChoice(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void mark()} disabled={busy || !reasonOk}>
              {busy && <Loader2 className="animate-spin" />}
              Mark {days.length} {days.length === 1 ? "day" : "days"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
