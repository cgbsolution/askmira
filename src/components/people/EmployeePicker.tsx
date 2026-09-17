"use client";

import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import React, { useEffect, useState } from "react";

import { personName } from "@/components/people/labels";
import { PersonCell } from "@/components/common/PersonCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { get } from "@/lib/api";
import type { Page } from "@/lib/types";
import type { DirectoryEmployee } from "@/lib/types/people";
import { cn } from "@/lib/utils";

export interface PickedEmployee {
  id: string;
  label: string;
}

/**
 * Search the directory and pick one person.
 *
 * Built from Popover, Input and Button — the directory is paged on the server,
 * so the list is whatever the search returns, never the whole company.
 */
export function EmployeePicker({
  id,
  value,
  onChange,
  placeholder = "Choose a person",
  excludeId,
  disabled,
  allowClear = false,
}: {
  id?: string;
  value: PickedEmployee | null;
  onChange: (value: PickedEmployee | null) => void;
  placeholder?: string;
  excludeId?: string | null;
  disabled?: boolean;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<DirectoryEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setIsLoading(true);
      const params = new URLSearchParams({ page: "1", page_size: "20" });
      if (term.trim()) params.set("search", term.trim());
      get<Page<DirectoryEmployee>>(`/employees?${params}`)
        .then((page) => {
          if (cancelled) return;
          setRows(page.items.filter((row) => row.id !== excludeId));
          setFailed(null);
        })
        .catch(() => !cancelled && setFailed("Could not search the directory."))
        .finally(() => !cancelled && setIsLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, term, excludeId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72 p-2" align="start">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Name, code or email"
            className="pl-8"
            aria-label="Search people"
          />
        </div>
        <ScrollArea className="max-h-64">
          {isLoading ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Searching…
            </div>
          ) : failed ? (
            <p className="p-3 text-sm text-destructive">{failed}</p>
          ) : rows.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Nobody matches that search.</p>
          ) : (
            <ul className="grid gap-0.5">
              {allowClear && value && (
                <li>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground"
                    onClick={() => {
                      onChange(null);
                      setOpen(false);
                    }}
                  >
                    Clear selection
                  </Button>
                </li>
              )}
              {rows.map((row) => {
                const label = `${personName(row)} (${row.employee_code})`;
                return (
                  <li key={row.id}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-between py-1.5"
                      onClick={() => {
                        onChange({ id: row.id, label });
                        setOpen(false);
                      }}
                    >
                      <PersonCell
                        size="sm"
                        name={personName(row)}
                        photoUrl={row.photo_url}
                        subtitle={`${row.employee_code} · ${row.designation ?? row.work_email}`}
                      />
                      {value?.id === row.id && <Check className="text-primary" />}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
