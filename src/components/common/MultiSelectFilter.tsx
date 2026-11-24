"use client";

import { Check, ChevronDown } from "lucide-react";
import React, { useMemo, useState } from "react";

import { PredictiveSearch } from "@/components/common/PredictiveSearch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { matchWords, normalise } from "@/lib/predictive";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  /** How many hold it, shown at the right. */
  count?: number;
  /** Small text after the label: an employee code. */
  hint?: string;
}

/**
 * Tick any number of values from a list: "All departments" until something is
 * ticked, then the one name or "3 departments". The list has a search box
 * once it is long, and Clear / Select all at the foot.
 */
export function MultiSelectFilter({
  id,
  options,
  value,
  onChange,
  allLabel,
  noun,
  disabled = false,
  className,
}: {
  id: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Shown with nothing ticked: "All departments". */
  allLabel: string;
  /** Plural for the count: "departments". */
  noun: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const chosen = useMemo(() => new Set(value), [value]);

  const shown = useMemo(() => {
    const words = matchWords(search);
    if (words.length === 0) return options;
    return options.filter((option) => {
      const text = normalise(`${option.label} ${option.hint ?? ""}`);
      return words.every((word) => text.includes(word));
    });
  }, [options, search]);

  const summary =
    value.length === 0
      ? allLabel
      : value.length === 1
        ? (options.find((option) => option.value === value[0])?.label ??
          `1 ${noun}`)
        : `${value.length} ${noun}`;

  const toggle = (option: string) =>
    onChange(
      chosen.has(option)
        ? value.filter((v) => v !== option)
        : [...value, option],
    );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled || options.length === 0}
          aria-haspopup="listbox"
          className={cn(
            "h-11 w-full justify-between font-normal",
            value.length === 0 && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{summary}</span>
          <ChevronDown className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-64 p-2"
      >
        {options.length > 7 && (
          <PredictiveSearch
            id={`${id}-search`}
            value={search}
            onValueChange={setSearch}
            placeholder={`Search ${noun}`}
            aria-label={`Search ${noun}`}
            wrapperClassName="mb-2"
          />
        )}
        <ScrollArea className="max-h-64">
          <div
            role="listbox"
            aria-multiselectable="true"
            className="grid gap-0.5 pr-2"
          >
            {shown.length === 0 && (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                Nothing matches.
              </p>
            )}
            {shown.map((option) => {
              const ticked = chosen.has(option.value);
              const checkboxId = `${id}-${option.value}`;
              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={ticked}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                >
                  <Checkbox
                    id={checkboxId}
                    checked={ticked}
                    onCheckedChange={() => toggle(option.value)}
                  />
                  <Label
                    htmlFor={checkboxId}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 font-normal"
                  >
                    <span className="truncate">{option.label}</span>
                    {option.hint && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {option.hint}
                      </span>
                    )}
                    {option.count !== undefined && (
                      <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                        {option.count}
                      </span>
                    )}
                  </Label>
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={value.length === 0}
            onClick={() => onChange([])}
          >
            Clear
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={shown.length === 0}
            onClick={() =>
              onChange(
                Array.from(
                  new Set([...value, ...shown.map((option) => option.value)]),
                ),
              )
            }
          >
            <Check /> Select {search ? "shown" : "all"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
