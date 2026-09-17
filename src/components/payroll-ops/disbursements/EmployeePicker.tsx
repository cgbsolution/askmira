"use client";

import { Loader2, Search, X } from "lucide-react";
import React, { useEffect, useState } from "react";

import { apiErrorMessage } from "@/components/payroll-ops/shared";
import { employeeDisplayName } from "@/components/payroll-ops/disbursements/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { get } from "@/lib/api";
import type { EmployeeSummary, Page } from "@/lib/types";

/**
 * Search for one employee by name or code (`GET /employees?search=`).
 * Shows the chosen person with a way to change them.
 */
export function EmployeePicker({
  id,
  value,
  onChange,
  initialSearch = "",
  disabled = false,
}: {
  id: string;
  value: EmployeeSummary | null;
  onChange: (employee: EmployeeSummary | null) => void;
  initialSearch?: string;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [results, setResults] = useState<EmployeeSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    if (value || search.trim().length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    const timer = setTimeout(() => {
      get<Page<EmployeeSummary>>(
        `/employees?search=${encodeURIComponent(search.trim())}&page_size=20`,
      )
        .then((page) => {
          if (cancelled) return;
          setResults(page.items);
          setError(null);
        })
        .catch((caught) => {
          if (cancelled) return;
          setResults([]);
          setError(apiErrorMessage(caught, "Employees could not be searched."));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, value]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{employeeDisplayName(value)}</p>
          <p className="text-xs text-muted-foreground">{value.employee_code}</p>
        </div>
        {!disabled && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Choose a different employee"
            onClick={() => onChange(null)}
          >
            <X />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={search}
          disabled={disabled}
          autoComplete="off"
          placeholder="Search by name or employee code"
          onChange={(event) => setSearch(event.target.value)}
          className="pl-9"
        />
        {isLoading && (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!isLoading && !error && search.trim().length >= 2 && results.length === 0 && (
        <p className="text-xs text-muted-foreground">Nobody matches “{search.trim()}”.</p>
      )}
      {results.length > 0 && (
        <ul className="max-h-56 overflow-y-auto rounded-lg border border-border p-1">
          {results.map((employee) => (
            <li key={employee.id}>
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start px-2 py-1.5 text-left"
                onClick={() => onChange(employee)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">
                    {employeeDisplayName(employee)}
                  </span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {employee.employee_code}
                    {employee.designation ? ` · ${employee.designation}` : ""}
                  </span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
