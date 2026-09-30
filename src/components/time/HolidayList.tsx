"use client";

import { Check, Loader2, PartyPopper } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, get, post } from "@/lib/api";
import type { Holiday, OptionalHolidays } from "@/lib/types";
import { cn, parseISODate, toISODate } from "@/lib/utils";

/** "mine", "all", or a state code. */
type Filter = string;

/** Who a holiday is for, in words: National, the state, or the office. */
export function holidayScopeLabel(holiday: Holiday): string {
  if (holiday.scope === "location") {
    return holiday.location_name ?? "One office";
  }
  if (holiday.scope === "state") return holiday.state_code ?? "State";
  return "National";
}

/**
 * The holiday calendar.
 *
 * By default your own: national holidays, your state's and your office's —
 * a Chennai employee has no use for Karnataka's list. HR can look at a state
 * or at everything. Optional holidays are opted in to here, within the
 * yearly quota; a chosen one then counts as a holiday for you everywhere.
 */
export function HolidayList({
  version,
  isHr,
  hasEmployee,
}: {
  version: number;
  isHr: boolean;
  hasEmployee: boolean;
}) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [filter, setFilter] = useState<Filter>(hasEmployee ? "mine" : "all");
  const [rows, setRows] = useState<Holiday[]>([]);
  const [allRows, setAllRows] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const optional = useApiQuery<OptionalHolidays>(
    hasEmployee ? `/leave/optional-holidays?year=${year}` : null,
  );
  const { reload: reloadOptional } = optional;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const params = new URLSearchParams({ year: String(year) });
    if (filter === "all") params.set("scope", "all");
    else if (filter !== "mine") params.set("state_code", filter);
    Promise.all([
      get<Holiday[]>(`/leave/holidays?${params}`),
      isHr ? get<Holiday[]>(`/leave/holidays?year=${year}&scope=all`) : Promise.resolve([]),
    ])
      .then(([items, everything]) => {
        if (cancelled) return;
        setRows(items);
        setAllRows(everything);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof ApiError ? error.detail : "Could not load holidays.");
        }
      })
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [year, filter, isHr, version, reloadKey]);

  const states = useMemo(
    () => Array.from(new Set(allRows.map((row) => row.state_code).filter(Boolean))).sort() as string[],
    [allRows],
  );

  const today = toISODate(new Date());
  const upcoming = rows.find((row) => row.holiday_date >= today && (!row.is_optional || row.selected));
  const quota = optional.data?.quota ?? 0;
  const chosen = optional.data?.chosen ?? 0;

  const toggle = async (holiday: Holiday) => {
    setBusyId(holiday.id);
    try {
      if (holiday.selected) {
        await del(`/leave/optional-holidays/${holiday.id}`);
        toast.success(`${holiday.name} withdrawn`);
      } else {
        await post(`/leave/optional-holidays/${holiday.id}`);
        toast.success(`${holiday.name} added to your holidays`);
      }
      reloadOptional();
      setReloadKey((key) => key + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not update your choice.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card tier="tier1" className="gap-0 py-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
          <SelectTrigger size="sm" className="w-28" aria-label="Year">
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
        {isHr && (
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger size="sm" className="w-48" aria-label="Whose holidays">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {hasEmployee && <SelectItem value="mine">My holidays</SelectItem>}
              <SelectItem value="all">Every location</SelectItem>
              {states.map((state) => (
                <SelectItem key={state} value={state}>
                  {state} and national
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-sm text-muted-foreground">
          {filter === "mine"
            ? "National holidays, your state's and your office's."
            : "National holidays apply everywhere; state and office holidays only there."}
        </p>
        {hasEmployee && quota > 0 && (
          <Badge variant={chosen >= quota ? "secondary" : "accent"} className="ml-auto">
            {chosen} of {quota} optional holidays chosen
          </Badge>
        )}
      </div>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={PartyPopper}
            title={`No holidays published for ${year}`}
            description="HR adds them from the state gazette notification, in Setup."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Date</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Holiday</TableHead>
                <TableHead>Applies to</TableHead>
                {hasEmployee && <TableHead className="w-36 pr-5" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const date = parseISODate(row.holiday_date);
                const past = row.holiday_date < today;
                const canChoose =
                  hasEmployee && row.is_optional && row.applies_to_me && !past;
                return (
                  <TableRow key={row.id} className={cn(past && "text-muted-foreground")}>
                    <TableCell className="pl-5 whitespace-nowrap tabular-nums">
                      {new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(
                        date,
                      )}
                    </TableCell>
                    <TableCell>
                      {new Intl.DateTimeFormat("en-IN", { weekday: "long" }).format(date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn(!past && "font-medium text-foreground")}>
                          {row.name}
                        </span>
                        {upcoming?.id === row.id && <Badge variant="accent">Next</Badge>}
                        {row.is_optional &&
                          (row.selected ? (
                            <Badge variant="success">Optional · chosen</Badge>
                          ) : (
                            <Badge variant="outline">Optional</Badge>
                          ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.scope === "national" ? (
                        <span className="text-sm">National</span>
                      ) : (
                        <Badge variant="secondary">
                          {holidayScopeLabel(row)}
                          {row.scope === "location" && row.state_code && ` · ${row.state_code}`}
                        </Badge>
                      )}
                    </TableCell>
                    {hasEmployee && (
                      <TableCell className="pr-5 text-right">
                        {canChoose && (
                          <Button
                            variant={row.selected ? "ghost" : "outline"}
                            size="sm"
                            disabled={busyId === row.id || (!row.selected && chosen >= quota)}
                            onClick={() => void toggle(row)}
                          >
                            {busyId === row.id ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              !row.selected && <Check />
                            )}
                            {row.selected ? "Withdraw" : "Take it"}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
