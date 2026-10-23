"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const PAGE_SIZES = [10, 20, 50, 100];

/**
 * "Showing 1–10 of 42 employees · Rows per page" at the left, Previous · 1 / 5
 * · Next at the right. Pages are 1-based here, whatever the table counts from.
 */
export function DataTablePagination({
  page,
  pageSize,
  total,
  selected = 0,
  noun,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  selected?: number;
  noun: string;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const sizes = PAGE_SIZES.includes(pageSize) ? PAGE_SIZES : [...PAGE_SIZES, pageSize].sort((a, b) => a - b);

  return (
    <div
      data-slot="data-table-pagination"
      className={cn(
        "flex flex-col gap-3 border-t border-border py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <p>
          Showing {first}–{last} of {total} {noun}
          {selected > 0 && <span className="font-medium text-foreground"> · {selected} selected</span>}
        </p>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
              <SelectTrigger size="sm" className="w-[76px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {sizes.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft /> Previous
        </Button>
        <span className="inline-flex h-8 min-w-14 items-center justify-center rounded-md border border-border bg-card px-3 text-sm tabular-nums">
          {page} / {pages}
        </span>
        <Button variant="ghost" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= pages}>
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
