"use client";

import { useCallback } from "react";

import { useApiQuery } from "@/hooks/useApiQuery";
import type { EmployeeSummary, Page } from "@/lib/types";

/**
 * Names for the employee ids a statutory list returns. The directory's first
 * page of 200 is read once; anyone beyond it is shown by id rather than guessed.
 */
export function useEmployeeNames() {
  const { data } = useApiQuery<Page<EmployeeSummary>>("/employees?page_size=200");
  return useCallback(
    (id: string) => {
      const person = data?.items.find((item) => item.id === id);
      if (!person) return `Employee ${id.slice(0, 8)}`;
      const name = person.display_name ?? `${person.first_name} ${person.last_name ?? ""}`.trim();
      return `${name} (${person.employee_code})`;
    },
    [data],
  );
}
