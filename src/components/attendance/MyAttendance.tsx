"use client";

import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Fingerprint,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  UserX,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import {
  REGULARISABLE_STATUSES,
  type AttendanceDay,
  type AttendanceStatus,
  type MyAttendancePeriod,
  type Punch,
  type PunchInput,
  type Regularisation,
  type RegularisationInput,
} from "@/lib/types/attendance";
import { cn, formatDate, formatDay, formatDays, toISODate } from "@/lib/utils";

import {
  errorDetail,
  formatClock,
  formatMinutes,
  LoadError,
  localDateTimeToISO,
  monthBounds,
  RegularisationStatusBadge,
  STATUS_LABELS,
  StatusBadge,
  TableSkeleton,
} from "./shared";

/**
 * The signed-in person's own attendance: punch, see the month, fix a day.
 *
 * Tier 1 throughout — every day here becomes payable days or loss of pay.
 */
export function MyAttendance() {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((current) => current + 1), []);

  if (!user?.employee_id) {
    return (
      <Card tier="tier1">
        <EmptyState
          icon={UserX}
          title="Your login isn't linked to an employee record"
          description="Attendance is recorded against an employee. Ask your HR admin to link this login to your employee profile, then punches and attendance days will appear here."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PunchCard onPunched={refresh} />
      <MonthView version={version} onChanged={refresh} />
      <MyRegularisations version={version} onChanged={refresh} />
    </div>
  );
}

// ── Punch ───────────────────────────────────────────────────────────────────

type PositionResult =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: string };

/** Asked only when the person clicks, and only if they chose to share. */
function requestPosition(): Promise<PositionResult> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ok: false, reason: "This browser cannot share a location." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          ok: true,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      (error) =>
        resolve({
          ok: false,
          reason:
            error.code === error.PERMISSION_DENIED
              ? "Location permission was denied."
              : error.code === error.TIMEOUT
                ? "Your location took too long to find."
                : "Your location was not available.",
        }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}

interface PunchOutcome {
  punch: Punch;
  locationSent: boolean;
  locationProblem: string | null;
}

function PunchCard({ onPunched }: { onPunched: () => void }) {
  const today = toISODate(new Date());
  const { data, error, isLoading, reload } = useApiQuery<Punch[]>(
    `/attendance/punches?from=${today}&to=${today}`,
  );
  const [shareLocation, setShareLocation] = useState(false);
  const [isPunching, setIsPunching] = useState(false);
  const [outcome, setOutcome] = useState<PunchOutcome | null>(null);

  const punches = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.punched_at.localeCompare(b.punched_at)),
    [data],
  );
  const last = punches.at(-1);
  const nextDirection = last?.direction === "in" ? "out" : "in";

  const punch = async () => {
    setIsPunching(true);
    const direction = nextDirection;
    let locationProblem: string | null = null;
    // Coordinates live only in this call: sent once, never kept in state or storage.
    const body: PunchInput = { direction };
    if (shareLocation) {
      const position = await requestPosition();
      if (position.ok) {
        body.latitude = position.latitude;
        body.longitude = position.longitude;
      } else {
        locationProblem = position.reason;
      }
    }
    const locationSent = body.latitude !== undefined;
    try {
      const created = await post<Punch>("/attendance/punch", body);
      setOutcome({ punch: created, locationSent, locationProblem });
      toast.success(
        `Punched ${created.direction} at ${formatClock(created.punched_at)}`,
        locationProblem
          ? { description: `${locationProblem} The punch was recorded without a location.` }
          : undefined,
      );
      reload();
      onPunched();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not record the punch."));
    } finally {
      setIsPunching(false);
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle>Today</CardTitle>
        <CardDescription>{formatDay(today, true)}</CardDescription>
        <CardAction>
          <Button
            onClick={() => void punch()}
            disabled={isPunching || isLoading || error !== null}
            variant={nextDirection === "in" ? "default" : "outline"}
          >
            {isPunching ? (
              <Loader2 className="animate-spin" />
            ) : nextDirection === "in" ? (
              <LogIn />
            ) : (
              <LogOut />
            )}
            {nextDirection === "in" ? "Punch in" : "Punch out"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2.5">
          <div>
            <Label htmlFor="share-location" className="flex items-center gap-1.5">
              <MapPin className="size-4" /> Share my location with this punch
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your browser asks when you punch. If you decline, the punch is still recorded,
              without a location.
            </p>
          </div>
          <Switch
            id="share-location"
            checked={shareLocation}
            onCheckedChange={setShareLocation}
            disabled={isPunching}
          />
        </div>

        {outcome && <PunchOutcomeNote outcome={outcome} />}

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : error ? (
          <LoadError error={error} onRetry={reload} />
        ) : (
          <>
            <p className="text-sm text-foreground">
              {!last
                ? "You have not punched today."
                : last.direction === "in"
                  ? `Punched in since ${formatClock(last.punched_at)}.`
                  : `Punched out at ${formatClock(last.punched_at)}.`}
            </p>
            {punches.length === 0 ? (
              <EmptyState
                icon={Fingerprint}
                className="py-6"
                title="No punches today"
                description="Punches from this screen, the mobile app and biometric devices appear here once recorded."
              />
            ) : (
              <ul className="flex flex-wrap gap-2">
                {punches.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
                  >
                    <Badge variant={row.direction === "in" ? "success" : "secondary"}>
                      {row.direction === "in" ? "In" : "Out"}
                    </Badge>
                    <span className="font-medium tabular-nums">{formatClock(row.punched_at)}</span>
                    <span className="text-xs text-muted-foreground">{row.source.replace("_", " ")}</span>
                    {row.outside_geofence && <Badge variant="warning">Outside geofence</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PunchOutcomeNote({ outcome }: { outcome: PunchOutcome }) {
  const { punch, locationSent, locationProblem } = outcome;
  if (punch.outside_geofence) {
    return (
      <Alert variant="warning">
        <MapPin />
        <AlertTitle>Recorded and flagged for HR, not rejected</AlertTitle>
        <AlertDescription>
          Your {punch.direction} punch at {formatClock(punch.punched_at)} was outside every work
          location&apos;s radius
          {punch.nearest_location_metres !== null && (
            <>
              {" "}
              (nearest is{" "}
              <span className="tabular-nums">
                {punch.nearest_location_metres.toLocaleString("en-IN")} m
              </span>{" "}
              away)
            </>
          )}
          . HR can see the flag.
        </AlertDescription>
      </Alert>
    );
  }
  if (locationSent) {
    return (
      <Alert variant="success">
        <MapPin />
        <AlertTitle>Recorded with your location</AlertTitle>
        <AlertDescription>
          Your {punch.direction} punch at {formatClock(punch.punched_at)} was not flagged as
          outside a work location.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert>
      <MapPin />
      <AlertTitle>Recorded without a location</AlertTitle>
      <AlertDescription>
        {locationProblem
          ? `${locationProblem} Your ${punch.direction} punch at ${formatClock(punch.punched_at)} was still recorded.`
          : `Your ${punch.direction} punch at ${formatClock(punch.punched_at)} was recorded. You chose not to share a location.`}
      </AlertDescription>
    </Alert>
  );
}

// ── Month view ──────────────────────────────────────────────────────────────

const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });

function MonthView({ version, onChanged }: { version: number; onChanged: () => void }) {
  const now = new Date();
  const [month, setMonth] = useState({ year: now.getFullYear(), index: now.getMonth() });
  const [regularising, setRegularising] = useState<AttendanceDay | null>(null);
  const { from, to } = monthBounds(month.year, month.index);
  const { data, error, isLoading, reload } = useApiQuery<MyAttendancePeriod>(
    `/attendance/period?from=${from}&to=${to}`,
  );

  useEffect(() => {
    if (version > 0) reload();
  }, [version, reload]);

  const today = toISODate(now);
  const isCurrentMonth = month.year === now.getFullYear() && month.index === now.getMonth();
  const shift = (delta: number) =>
    setMonth((current) => {
      const date = new Date(current.year, current.index + delta, 1);
      return { year: date.getFullYear(), index: date.getMonth() };
    });

  const days = useMemo(
    () => [...(data?.days ?? [])].sort((a, b) => a.attendance_date.localeCompare(b.attendance_date)),
    [data],
  );

  return (
    <Card tier="tier1" className="pb-0">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          My month
          {data?.is_locked && (
            <Badge variant="outline">
              <Lock /> Locked for payroll
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {data?.is_locked
            ? "You can still raise a regularisation, but it can only be approved once HR unlocks this period."
            : "Days are computed from your punches, shift and leave."}
        </CardDescription>
        <CardAction className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium">
            {monthLabel.format(new Date(month.year, month.index, 1))}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next month"
            disabled={isCurrentMonth}
            onClick={() => shift(1)}
          >
            <ChevronRight />
          </Button>
        </CardAction>
      </CardHeader>

      {isLoading ? (
        <div className="space-y-4 pb-5">
          <div className="grid grid-cols-2 gap-3 px-5 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-16" />
            ))}
          </div>
          <TableSkeleton rows={6} />
        </div>
      ) : error ? (
        <LoadError error={error} onRetry={reload} />
      ) : data ? (
        <>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Figure label="Payable days" value={formatDays(data.summary.payable_days)} />
            <Figure label="LOP days" value={formatDays(data.summary.lop_days)} />
            <Figure label="Late" value={String(data.summary.late_count)} />
            <Figure
              label="Needs regularisation"
              value={String(data.summary.needs_regularisation)}
              emphasis={data.summary.needs_regularisation > 0}
            />
          </CardContent>

          {days.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No attendance days computed for this month"
              description="Days appear once they have been computed from punches, shifts and leave."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>First in</TableHead>
                  <TableHead>Last out</TableHead>
                  <TableHead>Worked</TableHead>
                  <TableHead>Late by</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="pr-5 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.map((day) => {
                  const isFuture = day.attendance_date > today;
                  return (
                    <TableRow key={day.id}>
                      <TableCell className="pl-5 whitespace-nowrap">
                        {formatDay(day.attendance_date)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <StatusBadge status={day.status} />
                          {day.is_regularised && <Badge variant="outline">Regularised</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">{formatClock(day.first_in)}</TableCell>
                      <TableCell className="tabular-nums">{formatClock(day.last_out)}</TableCell>
                      <TableCell className="tabular-nums">{formatMinutes(day.worked_minutes)}</TableCell>
                      <TableCell className="tabular-nums">
                        {day.late_by_minutes > 0 ? formatMinutes(day.late_by_minutes) : "—"}
                      </TableCell>
                      <TableCell className="max-w-64 whitespace-normal text-muted-foreground">
                        {day.computation_note ?? "—"}
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isFuture}
                          title={isFuture ? "A future day cannot be regularised." : undefined}
                          onClick={() => setRegularising(day)}
                        >
                          Regularise
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </>
      ) : null}

      <RegulariseDialog
        day={regularising}
        isLocked={Boolean(data?.is_locked)}
        onClose={() => setRegularising(null)}
        onCreated={() => {
          setRegularising(null);
          onChanged();
        }}
      />
    </Card>
  );
}

function Figure({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-md border border-border px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-xl font-semibold tabular-nums",
          emphasis ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

// ── Regularise ──────────────────────────────────────────────────────────────

function RegulariseDialog({
  day,
  isLocked,
  onClose,
  onCreated,
}: {
  day: AttendanceDay | null;
  isLocked: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [status, setStatus] = useState<AttendanceStatus | "">("");
  const [firstIn, setFirstIn] = useState("");
  const [lastOut, setLastOut] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!day) return;
    setStatus("");
    setFirstIn("");
    setLastOut("");
    setReason("");
    setSubmitted(false);
    setServerError(null);
  }, [day]);

  const reasonOk = reason.trim().length >= 3;
  const statusOk = status !== "";
  const overnight = Boolean(firstIn && lastOut && lastOut < firstIn);

  const submit = async () => {
    setSubmitted(true);
    if (!day || !statusOk || !reasonOk) return;
    const body: RegularisationInput = {
      attendance_date: day.attendance_date,
      requested_status: status,
      reason: reason.trim(),
      requested_first_in: firstIn ? localDateTimeToISO(day.attendance_date, firstIn) : null,
      requested_last_out: lastOut
        ? localDateTimeToISO(day.attendance_date, lastOut, overnight ? 1 : 0)
        : null,
    };
    setIsSubmitting(true);
    setServerError(null);
    try {
      await post<Regularisation>("/attendance/regularisation", body);
      toast.success(`Regularisation raised for ${formatDay(day.attendance_date, true)}`);
      onCreated();
    } catch (caught) {
      setServerError(errorDetail(caught, "Could not raise the regularisation."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={day !== null} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Regularise {day ? formatDay(day.attendance_date, true) : ""}</DialogTitle>
          <DialogDescription>
            {day &&
              `Recorded as ${STATUS_LABELS[day.status]} · in ${formatClock(day.first_in)}, out ${formatClock(day.last_out)}. Your approver sees your reason.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {isLocked && (
            <Alert variant="warning">
              <Lock />
              <AlertDescription>
                This period is locked for payroll. You can raise the request now; it can only be
                approved after HR unlocks the period.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="reg-status">Requested status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as AttendanceStatus)}>
              <SelectTrigger
                id="reg-status"
                className="w-full"
                aria-invalid={submitted && !statusOk}
              >
                <SelectValue placeholder="Choose a status" />
              </SelectTrigger>
              <SelectContent>
                {REGULARISABLE_STATUSES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {STATUS_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {submitted && !statusOk && (
              <p className="text-xs text-destructive">Choose the status you are asking for.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Leave is requested as time off, not as a regularisation.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="reg-in">
                Corrected in <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input id="reg-in" type="time" value={firstIn} onChange={(e) => setFirstIn(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="reg-out">
                Corrected out <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input id="reg-out" type="time" value={lastOut} onChange={(e) => setLastOut(e.target.value)} />
            </div>
          </div>
          {overnight && (
            <p className="-mt-2 text-xs text-muted-foreground">
              The out time is earlier than the in time, so it is taken as the next morning.
            </p>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="reg-reason">Reason</Label>
            <Textarea
              id="reg-reason"
              rows={3}
              maxLength={1000}
              value={reason}
              aria-invalid={submitted && !reasonOk}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Forgot to punch out after the client call"
            />
            {submitted && !reasonOk && (
              <p className="text-xs text-destructive">Give a reason of at least 3 characters.</p>
            )}
          </div>

          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isSubmitting} onClick={() => void submit()}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Raise regularisation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── My regularisations ──────────────────────────────────────────────────────

function MyRegularisations({ version, onChanged }: { version: number; onChanged: () => void }) {
  const { data, error, isLoading, reload } = useApiQuery<Regularisation[]>(
    "/attendance/regularisations",
  );
  const [cancelling, setCancelling] = useState<Regularisation | null>(null);

  useEffect(() => {
    if (version > 0) reload();
  }, [version, reload]);

  const rows = useMemo(
    () =>
      [...(data ?? [])].sort(
        (a, b) =>
          (b.created_at ?? "").localeCompare(a.created_at ?? "") ||
          b.attendance_date.localeCompare(a.attendance_date),
      ),
    [data],
  );

  const cancel = async () => {
    if (!cancelling) return;
    try {
      await post<Regularisation>(`/attendance/regularisations/${cancelling.id}/cancel`);
      toast.success(`Cancelled the regularisation for ${formatDay(cancelling.attendance_date, true)}`);
      onChanged();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not cancel the regularisation."));
      throw caught;
    }
  };

  return (
    <Card tier="tier1" className="pb-0">
      <CardHeader>
        <CardTitle>My regularisations</CardTitle>
        <CardDescription>Corrections you have asked for, and what was decided.</CardDescription>
      </CardHeader>

      {isLoading ? (
        <div className="pb-5">
          <TableSkeleton rows={3} />
        </div>
      ) : error ? (
        <LoadError error={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No regularisations yet"
          description="When a day is recorded wrongly, use Regularise on that day above. Your requests and their decisions appear here."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Date</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Corrected times</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Decision note</TableHead>
              <TableHead>Raised</TableHead>
              <TableHead className="pr-5 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="pl-5 whitespace-nowrap">
                  {formatDay(row.attendance_date, true)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.requested_status} />
                </TableCell>
                <TableCell className="tabular-nums">
                  {row.requested_first_in || row.requested_last_out
                    ? `${formatClock(row.requested_first_in)} – ${formatClock(row.requested_last_out)}`
                    : "—"}
                </TableCell>
                <TableCell className="max-w-64 whitespace-normal">{row.reason}</TableCell>
                <TableCell>
                  <RegularisationStatusBadge status={row.status} />
                </TableCell>
                <TableCell className="max-w-64 whitespace-normal text-muted-foreground">
                  {row.decision_note ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(row.created_at)}
                </TableCell>
                <TableCell className="pr-5 text-right">
                  {row.status === "pending" && (
                    <Button variant="outline" size="sm" onClick={() => setCancelling(row)}>
                      Cancel
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title="Cancel this regularisation?"
        description={
          cancelling
            ? `Your request for ${formatDay(cancelling.attendance_date, true)} will be withdrawn. The day stays as it was recorded.`
            : undefined
        }
        confirmLabel="Cancel request"
        cancelLabel="Keep it"
        destructive
        onConfirm={cancel}
      />
    </Card>
  );
}
