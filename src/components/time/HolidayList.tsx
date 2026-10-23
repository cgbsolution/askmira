"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Check, Loader2, PartyPopper } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

/** "26 Jan". */
function dayAndMonth(holiday: Holiday): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(
    parseISODate(holiday.holiday_date),
  );
}

/** "Monday". */
function weekday(holiday: Holiday): string {
  return new Intl.DateTimeFormat("en-IN", { weekday: "long" }).format(parseISODate(holiday.holiday_date));
}

/** The Applies to column as text: "National", "KA", or "Bengaluru office · KA". */
function appliesTo(holiday: Holiday): string {
  return `${holidayScopeLabel(holiday)}${holiday.scope === "location" && holiday.state_code ? ` · ${holiday.state_code}` : ""}`;
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

  const actionColumn: ColumnDef<Holiday> = {
    id: "actions",
    header: "",
    enableHiding: false,
    meta: { className: "w-36 text-right", text: false },
    cell: ({ row }) => {
      const holiday = row.original;
      const canChoose = holiday.is_optional && holiday.applies_to_me && holiday.holiday_date >= today;
      return (
        canChoose && (
          <Button
            variant={holiday.selected ? "ghost" : "outline"}
            size="sm"
            disabled={busyId === holiday.id || (!holiday.selected && chosen >= quota)}
            onClick={() => void toggle(holiday)}
          >
            {busyId === holiday.id ? <Loader2 className="animate-spin" /> : !holiday.selected && <Check />}
            {holiday.selected ? "Withdraw" : "Take it"}
          </Button>
        )
      );
    },
  };

  const columns: ColumnDef<Holiday>[] = [
    {
      accessorKey: "holiday_date",
      header: "Date",
      meta: { cellClassName: "whitespace-nowrap tabular-nums", text: dayAndMonth },
      cell: ({ row }) => dayAndMonth(row.original),
    },
    { id: "day", header: "Day", accessorFn: weekday },
    {
      accessorKey: "name",
      header: "Holiday",
      meta: {
        text: (row) => (row.is_optional ? `${row.name} · ${row.selected ? "Optional · chosen" : "Optional"}` : row.name),
      },
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn(row.original.holiday_date >= today && "font-medium text-foreground")}>
            {row.original.name}
          </span>
          {upcoming?.id === row.original.id && <Badge variant="accent">Next</Badge>}
          {row.original.is_optional &&
            (row.original.selected ? (
              <Badge variant="success">Optional · chosen</Badge>
            ) : (
              <Badge variant="outline">Optional</Badge>
            ))}
        </div>
      ),
    },
    {
      id: "applies_to",
      header: "Applies to",
      accessorFn: appliesTo,
      cell: ({ row }) =>
        row.original.scope === "national" ? (
          <span className="text-sm">National</span>
        ) : (
          <Badge variant="secondary">{appliesTo(row.original)}</Badge>
        ),
    },
    ...(hasEmployee ? [actionColumn] : []),
  ];

  return (
    <DataTable
      description={
        filter === "mine"
          ? "National holidays, your state's and your office's."
          : "National holidays apply everywhere; state and office holidays only there."
      }
      columns={columns}
      data={rows}
      noun="holidays"
      exportName={`holidays-${year}`}
      searchPlaceholder="Search holidays"
      rowClassName={(row) => cn(row.holiday_date < today && "text-muted-foreground")}
      filters={
        <>
          <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
            <SelectTrigger className="h-9 w-28" aria-label="Year">
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
              <SelectTrigger className="h-9 w-48" aria-label="Whose holidays">
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
        </>
      }
      actions={
        hasEmployee &&
        quota > 0 && (
          <Badge variant={chosen >= quota ? "secondary" : "accent"}>
            {chosen} of {quota} optional holidays chosen
          </Badge>
        )
      }
      isLoading={isLoading}
      empty={{
        icon: PartyPopper,
        title: `No holidays published for ${year}`,
        description: "HR adds them from the state gazette notification, in Setup.",
      }}
    />
  );
}
