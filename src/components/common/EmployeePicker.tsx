"use client";

import { Loader2, Search, UserRound } from "lucide-react";
import React, { useEffect, useState } from "react";

import { apiErrorMessage } from "@/components/payroll-ops/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { get } from "@/lib/api";
import { COLLEAGUE_HINT, COLLEAGUE_MIN_CHARS, findColleagues } from "@/lib/colleagues";
import type { EmployeeSummary, Page } from "@/lib/types";
import { cn } from "@/lib/utils";

/** What the picker needs of a person: a directory entry and a colleague both have it. */
type Pickable = Pick<
  EmployeeSummary,
  "id" | "employee_code" | "first_name" | "last_name" | "display_name" | "designation"
>;

export function employeeDisplayName(
  employee: Pick<EmployeeSummary, "display_name" | "first_name" | "last_name">,
): string {
  return (
    employee.display_name || [employee.first_name, employee.last_name].filter(Boolean).join(" ")
  );
}

/**
 * Search employees and pick one. Which employees come back is the API's
 * decision; the caller's own record is left out, since nobody starts their
 * own exit here. Pass `excludeId={null}` to allow everyone.
 *
 * The person picked is somebody to act for — start their exit, raise their
 * adjustment — so the list is whom the caller may act for: everyone for HR,
 * their own reporting line for a manager. Never their manager or the
 * colleagues beside them, whom the directory does show.
 *
 * `colleagues` picks anybody in the company instead — a colleague to give or
 * ask feedback. It searches by name from two letters and hands back a
 * `Colleague`: names and titles, nothing from their record.
 */
export function EmployeePicker<T extends Pickable = EmployeeSummary>({
  id,
  value,
  onChange,
  excludeId,
  invalid = false,
  disabled = false,
  colleagues = false,
}: {
  id: string;
  value: T | null;
  onChange: (employee: T | null) => void;
  excludeId: string | null;
  invalid?: boolean;
  disabled?: boolean;
  /** Search the whole company by name; keep the picked person as a `Colleague`. */
  colleagues?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const tooShort = colleagues && search.trim().length < COLLEAGUE_MIN_CHARS;
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (value) return;
    let cancelled = false;
    if (tooShort) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ search: search.trim(), page_size: "20", reporting_line: "true" });
      const found = colleagues
        ? (findColleagues(search) as Promise<unknown[]> as Promise<T[]>)
        : get<Page<T>>(`/employees?${params}`).then((page) => page.items);
      found
        .then((items) => {
          if (cancelled) return;
          setResults(items.filter((employee) => employee.id !== excludeId));
          setError(null);
        })
        .catch((caught) => {
          if (cancelled) return;
          setResults([]);
          setError(apiErrorMessage(caught, "Could not search employees."));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, excludeId, value, colleagues, tooShort]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {employeeDisplayName(value)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {value.employee_code}
            {value.designation && ` · ${value.designation}`}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onChange(null)}
        >
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={search}
          disabled={disabled}
          aria-invalid={invalid}
          placeholder={colleagues ? "Type a name or employee code" : "Search by name or employee code"}
          className="pl-9"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div
        className={cn(
          "max-h-52 overflow-y-auto rounded-md border border-border",
          invalid && "border-destructive",
        )}
      >
        {isLoading ? (
          <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Searching…
          </p>
        ) : tooShort ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">{COLLEAGUE_HINT}</p>
        ) : error ? (
          <p className="px-3 py-3 text-sm text-destructive">{error}</p>
        ) : results.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">
            {search.trim()
              ? "Nobody you can see matches this search."
              : "No employees to show."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {results.map((employee) => (
              <li key={employee.id}>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={disabled}
                  className="h-auto w-full justify-start rounded-none px-3 py-2 text-left"
                  onClick={() => onChange(employee)}
                >
                  <UserRound className="text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-foreground">
                      {employeeDisplayName(employee)}
                    </span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      {employee.employee_code}
                      {employee.designation && ` · ${employee.designation}`}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
