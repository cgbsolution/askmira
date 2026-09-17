"use client";

import React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RequisitionSummary } from "@/lib/types/hiring";
import { cn } from "@/lib/utils";

export const ALL = "all";

/**
 * Pick one requisition from an already-loaded list. With `allLabel`, the first
 * option (`"all"`) means no filter.
 */
export function PostingRequisitionSelect({
  id,
  requisitions,
  value,
  onChange,
  allLabel,
  placeholder = "Choose a requisition",
  disabled,
  className,
}: {
  id: string;
  requisitions: RequisitionSummary[];
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className={cn("w-full", className)} aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
        {requisitions.map((requisition) => (
          <SelectItem key={requisition.id} value={requisition.id}>
            {requisition.code} · {requisition.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
