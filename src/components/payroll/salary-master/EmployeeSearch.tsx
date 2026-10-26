"use client";

import { Loader2, Search, UserRound, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { EMPLOYMENT_STATUS, personName } from "@/components/people/labels";
import { apiMessage } from "@/components/payroll/labels";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { get } from "@/lib/api";
import type { EmployeeSummary, EmploymentStatus, Page } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

const ALL = "all";
type StatusFilter = EmploymentStatus | typeof ALL;

/** The dot on a person's avatar: employed, leaving, gone. */
const STATUS_DOT: Record<EmploymentStatus, string> = {
  active: "bg-success",
  on_notice: "bg-warning",
  on_leave: "bg-info",
  exited: "bg-destructive",
  pre_joining: "bg-muted-foreground",
};

/** "CDL23-424 - Deepak Rawat", the way people are picked on this screen. */
export function employeeLabel(employee: EmployeeSummary): string {
  return `${employee.employee_code} - ${personName(employee)}`;
}

/** A person's avatar with their employment status as a dot on it. */
export function StatusAvatar({
  employee,
  className,
}: {
  employee: Pick<EmployeeSummary, "first_name" | "last_name" | "display_name" | "photo_url" | "status">;
  className?: string;
}) {
  const name = personName(employee);
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <Avatar className="size-full">
        {employee.photo_url && <AvatarImage src={employee.photo_url} alt="" />}
        <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
      </Avatar>
      <span
        aria-label={EMPLOYMENT_STATUS[employee.status]?.label}
        className={cn(
          "absolute right-0 bottom-0 size-3 rounded-full ring-2 ring-background",
          STATUS_DOT[employee.status] ?? "bg-muted-foreground",
        )}
      />
    </span>
  );
}

/**
 * Find one employee by name or code, with a status filter beside the box.
 * Results come from the API as you type; arrow keys and Enter pick one.
 */
export function EmployeeSearch({
  value,
  onChange,
  className,
}: {
  value: EmployeeSummary | null;
  onChange: (employee: EmployeeSummary | null) => void;
  className?: string;
}) {
  const [status, setStatus] = useState<StatusFilter>(ALL);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<EmployeeSummary[]>([]);
  const [active, setActive] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The box shows the chosen person until someone starts typing over it.
  useEffect(() => {
    setText(value ? employeeLabel(value) : "");
  }, [value]);

  const query = value && text === employeeLabel(value) ? "" : text.trim();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setIsLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ page_size: "20" });
      if (query) params.set("search", query);
      if (status !== ALL) params.set("status", status);
      get<Page<EmployeeSummary>>(`/employees?${params}`)
        .then((page) => {
          if (cancelled) return;
          setResults(page.items);
          setActive(0);
          setError(null);
        })
        .catch((caught) => {
          if (cancelled) return;
          setResults([]);
          setError(apiMessage(caught, "Could not search employees."));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, status]);

  const pick = (employee: EmployeeSummary) => {
    onChange(employee);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && results[active]) {
      event.preventDefault();
      pick(results[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            "flex h-11 w-full items-stretch overflow-hidden rounded-lg border border-input bg-background shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
            className,
          )}
        >
          <Select value={status} onValueChange={(next) => setStatus(next as StatusFilter)}>
            <SelectTrigger
              aria-label="Employment status"
              className="h-full w-auto shrink-0 gap-2 rounded-none border-0 border-r border-input px-3 shadow-none focus-visible:ring-0"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>
                <span className="size-2.5 rounded-full bg-primary" /> Everyone
              </SelectItem>
              {(Object.keys(EMPLOYMENT_STATUS) as EmploymentStatus[]).map((key) => (
                <SelectItem key={key} value={key}>
                  <span className={cn("size-2.5 rounded-full", STATUS_DOT[key])} />
                  {EMPLOYMENT_STATUS[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex min-w-0 flex-1 items-center">
            <Input
              ref={inputRef}
              role="combobox"
              aria-expanded={open}
              aria-label="Search an employee"
              value={text}
              placeholder="Search by name or employee code"
              className="h-full rounded-none border-0 pr-16 shadow-none focus-visible:ring-0"
              onFocus={(event) => {
                setOpen(true);
                event.currentTarget.select();
              }}
              onChange={(event) => {
                setText(event.target.value);
                setOpen(true);
              }}
              onKeyDown={onKeyDown}
            />
            <span className="pointer-events-none absolute right-9 text-muted-foreground">
              {isLoading && open ? <Loader2 className="size-4 animate-spin" /> : <UserRound className="size-4" />}
            </span>
            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Clear the selected employee"
                className="absolute right-1 size-8"
                onClick={() => {
                  onChange(null);
                  setText("");
                  inputRef.current?.focus();
                }}
              >
                <X />
              </Button>
            ) : (
              <Search className="pointer-events-none absolute right-3 size-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-80 p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          // Clicking back into the box is not "outside".
          if (event.target instanceof Node && inputRef.current?.parentElement?.parentElement?.contains(event.target)) {
            event.preventDefault();
          }
        }}
      >
        {error ? (
          <p className="px-4 py-3 text-sm text-destructive">{error}</p>
        ) : results.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            {isLoading ? "Searching…" : query ? "Nobody matches that search." : "No employees to show."}
          </p>
        ) : (
          <ul role="listbox" aria-label="Employees" className="max-h-80 divide-y divide-border overflow-y-auto">
            {results.map((employee, index) => (
              <li key={employee.id} role="option" aria-selected={index === active}>
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    "h-auto w-full justify-start gap-3 rounded-none px-3 py-2.5 text-left",
                    index === active && "bg-accent",
                  )}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(employee)}
                >
                  <StatusAvatar employee={employee} className="size-10" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {employeeLabel(employee)}
                    </span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      {employee.work_email}
                      {employee.designation && ` · ${employee.designation}`}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
