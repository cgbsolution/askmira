"use client";

import React from "react";

import { FormField } from "@/components/common/FormField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Page } from "@/lib/types";
import type { RequisitionSummary } from "@/lib/types/hiring";

/** Pick one open requisition, for scheduling and for configuring interview rounds. */
export function InterviewRequisitionSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { data, error, isLoading } = useApiQuery<Page<RequisitionSummary>>(
    "/hiring/requisitions?status=open&page_size=200",
  );
  const items = data?.items ?? [];
  const hint = error
    ? undefined
    : isLoading
      ? "Loading open requisitions…"
      : items.length === 0
        ? "There are no open requisitions."
        : undefined;
  return (
    <FormField htmlFor={id} label="Requisition" hint={hint} error={error?.detail}>
      <Select value={value} onValueChange={onChange} disabled={items.length === 0}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Choose an open requisition" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.code} · {item.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}
