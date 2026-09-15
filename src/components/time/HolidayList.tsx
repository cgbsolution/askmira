"use client";

import { PartyPopper } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { ApiError, get } from "@/lib/api";
import type { Holiday } from "@/lib/types";
import { cn, parseISODate, toISODate } from "@/lib/utils";

export function HolidayList({ version }: { version: number }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [rows, setRows] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    get<Holiday[]>(`/leave/holidays?year=${year}`)
      .then((items) => !cancelled && setRows(items))
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof ApiError ? error.detail : "Could not load holidays.");
        }
      })
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [year, version]);

  const today = toISODate(new Date());
  const upcoming = rows.find((row) => row.holiday_date >= today);

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
        <p className="text-sm text-muted-foreground">
          National holidays apply everywhere; state holidays apply to offices in that state.
        </p>
      </div>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <PartyPopper className="size-6" />
            </span>
            <p className="font-medium text-foreground">No holidays published for {year}</p>
            <p className="text-sm text-muted-foreground">
              HR adds them from the state gazette notification.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Holiday</TableHead>
                <TableHead>Applies to</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const date = parseISODate(row.holiday_date);
                const past = row.holiday_date < today;
                return (
                  <TableRow key={row.id} className={cn(past && "text-muted-foreground")}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(
                        date,
                      )}
                    </TableCell>
                    <TableCell>
                      {new Intl.DateTimeFormat("en-IN", { weekday: "long" }).format(date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={cn(!past && "font-medium text-foreground")}>
                          {row.name}
                        </span>
                        {upcoming?.id === row.id && <Badge variant="accent">Next</Badge>}
                        {row.is_optional && <Badge variant="outline">Optional</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.state_code ? (
                        <Badge variant="secondary">{row.state_code}</Badge>
                      ) : (
                        <span className="text-sm">National</span>
                      )}
                    </TableCell>
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
