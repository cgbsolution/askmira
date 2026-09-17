"use client";

import React, { useEffect, useState } from "react";

import { apiMessage } from "@/components/payroll/labels";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { get } from "@/lib/api";
import type { EmployeeSummary, Page } from "@/lib/types";

/**
 * Search the directory and pick one person. The list is the API's; nothing is
 * cached beyond the current search.
 */
export function EmployeePicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (employeeId: string, employee: EmployeeSummary | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState<EmployeeSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      const query = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "";
      get<Page<EmployeeSummary>>(`/employees?page_size=50${query}`)
        .then((page) => {
          if (cancelled) return;
          setPeople(page.items);
          setError(null);
        })
        .catch((caught) => {
          if (!cancelled) setError(apiMessage(caught, "Could not search employees."));
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  return (
    <div className="grid gap-2">
      <Input
        id={`${id}-search`}
        placeholder="Search by name or code"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label="Search employees"
      />
      <Select
        value={value}
        onValueChange={(next) => onChange(next, people.find((p) => p.id === next) ?? null)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={people.length ? "Choose an employee" : "No matches"} />
        </SelectTrigger>
        <SelectContent>
          {people.map((person) => (
            <SelectItem key={person.id} value={person.id}>
              {person.display_name ?? `${person.first_name} ${person.last_name ?? ""}`.trim()} ·{" "}
              {person.employee_code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
