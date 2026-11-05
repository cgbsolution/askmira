"use client";

import { SlidersHorizontal } from "lucide-react";
import React from "react";

import { AmountInput } from "@/components/common/AmountInput";
import { FIGURES, type RuleDraft, limitSummary } from "@/components/payroll/structures/rules";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

/**
 * A rule's limit, condition and rounding: "PF on wages up to ₹15,000", "ESI only
 * while ESI wages are up to ₹21,000", "a tax only above an amount".
 */
export function LimitsPopover({
  id,
  lineName,
  draft,
  lines,
  names,
  onChange,
  disabled,
}: {
  id: string;
  lineName: string;
  draft: RuleDraft;
  /** Other lines a condition may test, by code. */
  lines: { code: string; name: string }[];
  names: Record<string, string>;
  onChange: (patch: Partial<RuleDraft>) => void;
  disabled?: boolean;
}) {
  const summary = limitSummary(draft, names);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={summary ? "secondary" : "ghost"}
          size="sm"
          disabled={disabled}
          aria-label={`Limits and conditions for ${lineName}`}
          className="h-8 max-w-40 justify-start truncate px-2 text-xs font-normal"
        >
          <SlidersHorizontal className="size-3.5" />
          <span className="truncate">{summary ?? "Add a limit"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-80 gap-4">
        <p className="text-sm font-semibold">{lineName}</p>

        {draft.method === "percent" && (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-ceiling`}>Take the base only up to (₹ a month)</Label>
            <AmountInput
              id={`${id}-ceiling`}
              value={draft.ceiling}
              placeholder="No limit"
              onValueChange={(ceiling) => onChange({ ceiling })}
            />
            <p className="text-xs text-muted-foreground">PF, for example: 12% of PF wages up to ₹15,000.</p>
          </div>
        )}

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`${id}-when`}>Apply only when…</Label>
            <Switch
              id={`${id}-when`}
              checked={draft.useWhen}
              onCheckedChange={(useWhen) => onChange({ useWhen })}
            />
          </div>
          {draft.useWhen && (
            <div className="grid gap-2">
              <Select value={draft.whenOn} onValueChange={(whenOn) => onChange({ whenOn })}>
                <SelectTrigger aria-label="Figure the condition tests" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIGURES.map((figure) => (
                    <SelectItem key={figure.value} value={figure.value}>
                      {figure.label} a month
                    </SelectItem>
                  ))}
                  {lines.map((line) => (
                    <SelectItem key={line.code} value={line.code}>
                      {line.name} a month
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-[8rem_1fr] gap-2">
                <Select
                  value={draft.whenOp}
                  onValueChange={(whenOp) => onChange({ whenOp: whenOp as RuleDraft["whenOp"] })}
                >
                  <SelectTrigger aria-label="Up to or above" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="up_to">is up to</SelectItem>
                    <SelectItem value="above">is above</SelectItem>
                  </SelectContent>
                </Select>
                <AmountInput
                  aria-label="Condition amount (₹ a month)"
                  value={draft.whenAmount}
                  placeholder="21000"
                  onValueChange={(whenAmount) => onChange({ whenAmount })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                ESI, for example: only while ESI wages are up to ₹21,000. A tax: only while gross is above an amount.
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-round`}>Rounding</Label>
          <Select
            value={draft.rounding}
            onValueChange={(rounding) => onChange({ rounding: rounding as RuleDraft["rounding"] })}
          >
            <SelectTrigger id={`${id}-round`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nearest">Nearest</SelectItem>
              <SelectItem value="up">Up (ESIC rounds up)</SelectItem>
              <SelectItem value="down">Down</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
