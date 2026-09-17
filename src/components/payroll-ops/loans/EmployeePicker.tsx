"use client";

import { Loader2, Search, X } from "lucide-react";
import React, { useEffect, useState } from "react";

import { apiErrorMessage } from "@/components/payroll-ops/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { get } from "@/lib/api";
import type { EmployeeSummary, Page } from "@/lib/types";
import { cn } from "@/lib/utils";

import { employeeName } from "./common";

/**
 * Search for one employee by name, code or email.
 *
 * Results come from `GET /employees`, which already limits them to the people
 * the caller may see.
 */
export function EmployeePicker({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = "Search by name, code or email",
  className,
}: {
  id?: string;
  value: EmployeeSummary | null;
  onChange: (employee: EmployeeSummary | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<EmployeeSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const term = search.trim();
    if (value || term.length < 2) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ search: term, page_size: "20" });
      get<Page<EmployeeSummary>>(`/employees?${params}`)
        .then((page) => {
          if (cancelled) return;
          setResults(page.items);
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
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, value]);

  if (value) {
    return (
      <div
        className={cn(
          "flex h-9 items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-sm",
          className,
        )}
      >
        <span className="truncate">
          <span className="font-medium text-foreground">{employeeName(value)}</span>{" "}
          <span className="text-muted-foreground">· {value.employee_code}</span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-6"
          disabled={disabled}
          aria-label="Clear employee"
          onClick={() => {
            onChange(null);
            setSearch("");
          }}
        >
          <X />
        </Button>
      </div>
    );
  }

  const term = search.trim();

  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={search}
          disabled={disabled}
          placeholder={placeholder}
          className="pl-9"
          autoComplete="off"
          onChange={(event) => setSearch(event.target.value)}
        />
        {isLoading && (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {term.length >= 2 && !isLoading && !error && results.length === 0 && (
        <p className="text-xs text-muted-foreground">Nobody you can see matches “{term}”.</p>
      )}
      {results.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-lg border border-border bg-card p-1">
          {results.map((employee) => (
            <li key={employee.id}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-between font-normal"
                onClick={() => {
                  onChange(employee);
                  setSearch("");
                }}
              >
                <span className="truncate text-foreground">{employeeName(employee)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {employee.employee_code}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
