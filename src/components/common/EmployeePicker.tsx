"use client";

import { Loader2, Search, UserRound } from "lucide-react";
import React, { useEffect, useState } from "react";

import { apiErrorMessage } from "@/components/payroll-ops/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { get } from "@/lib/api";
import type { EmployeeSummary, Page } from "@/lib/types";
import { cn } from "@/lib/utils";

export function employeeDisplayName(employee: EmployeeSummary): string {
  return (
    employee.display_name || [employee.first_name, employee.last_name].filter(Boolean).join(" ")
  );
}

/**
 * Search employees and pick one. Which employees come back is the API's
 * decision; the caller's own record is left out, since nobody starts their
 * own exit here. Pass `excludeId={null}` to allow everyone.
 */
export function EmployeePicker({
  id,
  value,
  onChange,
  excludeId,
  invalid = false,
  disabled = false,
}: {
  id: string;
  value: EmployeeSummary | null;
  onChange: (employee: EmployeeSummary | null) => void;
  excludeId: string | null;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<EmployeeSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (value) return;
    let cancelled = false;
    setIsLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ search: search.trim(), page_size: "20" });
      get<Page<EmployeeSummary>>(`/employees?${params}`)
        .then((page) => {
          if (cancelled) return;
          setResults(page.items.filter((employee) => employee.id !== excludeId));
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
  }, [search, excludeId, value]);

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
          placeholder="Search by name or employee code"
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
