"use client";

import { AlertTriangle, Loader2, Plane, Plus, Trash2 } from "lucide-react";
import React, { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { post } from "@/lib/api";
import type {
  BlockStatus,
  CityTier,
  TravelRequest,
  TravelRequestInput,
} from "@/lib/types/expenses";
import { toISODate } from "@/lib/utils";

import { CITY_TIER_LABEL, errorDetail, isMoneyInput, isPositiveAmount } from "./shared";

const UNSET = "__unset";
const ALL_TIERS = Object.keys(CITY_TIER_LABEL) as CityTier[];

interface DestinationRow {
  key: number;
  city: string;
  tier: CityTier | typeof UNSET;
}

/** Ask for a trip to be approved, with an advance if one is needed. */
export function TravelRequestDialog({
  tiers,
  currency,
  block,
  onCreated,
}: {
  tiers: CityTier[];
  currency: string;
  block: BlockStatus | null;
  onCreated: () => void;
}) {
  const today = toISODate(new Date());
  const nextKey = useRef(1);
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [destinations, setDestinations] = useState<DestinationRow[]>([{ key: 0, city: "", tier: UNSET }]);
  const [estimatedCost, setEstimatedCost] = useState("");
  const [advance, setAdvance] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const tierOptions = tiers.length > 0 ? tiers : ALL_TIERS;

  const reset = () => {
    setPurpose("");
    setFromDate(today);
    setToDate(today);
    setDestinations([{ key: 0, city: "", tier: UNSET }]);
    setEstimatedCost("");
    setAdvance("0");
    setError(null);
  };

  const updateRow = (key: number, change: Partial<DestinationRow>) =>
    setDestinations((rows) => rows.map((row) => (row.key === key ? { ...row, ...change } : row)));

  const validate = (): string | null => {
    if (!purpose.trim()) return "Say what the trip is for.";
    if (!fromDate || !toDate) return "Enter the travel dates.";
    if (toDate < fromDate) return "The return date cannot be before the start date.";
    if (destinations.length === 0 || destinations.some((row) => !row.city.trim())) {
      return "Enter a city for every destination, or remove the empty one.";
    }
    if (!isMoneyInput(estimatedCost)) return "Enter the estimated cost, for example 25000.";
    if (!isMoneyInput(advance)) return "Enter the advance needed, 0 if none.";
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const body: TravelRequestInput = {
        purpose: purpose.trim(),
        from_date: fromDate,
        to_date: toDate,
        destinations: destinations.map((row) =>
          row.tier === UNSET ? { city: row.city.trim() } : { city: row.city.trim(), city_tier: row.tier },
        ),
        estimated_cost: estimatedCost.trim(),
        advance_requested: advance.trim(),
      };
      await post<TravelRequest>("/expenses/travel-requests", body);
      toast.success("Travel request submitted", { description: "Finance will review it." });
      setOpen(false);
      reset();
      onCreated();
    } catch (caught) {
      setError(errorDetail(caught, "Could not submit the travel request."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSaving) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="accent">
          <Plane /> New travel request
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New travel request</DialogTitle>
          <DialogDescription>
            Trips are approved before you travel. Claims that need pre-approval are linked to an
            approved trip.
          </DialogDescription>
        </DialogHeader>

        <form
          id="travel-request-form"
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="travel-purpose">Purpose</Label>
            <Textarea
              id="travel-purpose"
              rows={2}
              maxLength={500}
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              placeholder="e.g. Quarterly review with the Chennai client"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="travel-from">From</Label>
              <Input
                id="travel-from"
                type="date"
                value={fromDate}
                onChange={(event) => {
                  const value = event.target.value;
                  setFromDate(value);
                  if (value && toDate < value) setToDate(value);
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="travel-to">To</Label>
              <Input
                id="travel-to"
                type="date"
                min={fromDate}
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </div>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-medium text-foreground">Destinations</legend>
            {destinations.map((row, index) => (
              <div key={row.key} className="grid grid-cols-[1fr_10rem_auto] items-end gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor={`travel-city-${row.key}`} className="sr-only">
                    City {index + 1}
                  </Label>
                  <Input
                    id={`travel-city-${row.key}`}
                    value={row.city}
                    maxLength={100}
                    onChange={(event) => updateRow(row.key, { city: event.target.value })}
                    placeholder="City"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`travel-tier-${row.key}`} className="sr-only">
                    City tier {index + 1}
                  </Label>
                  <Select
                    value={row.tier}
                    onValueChange={(value) => updateRow(row.key, { tier: value as DestinationRow["tier"] })}
                  >
                    <SelectTrigger id={`travel-tier-${row.key}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNSET}>Tier not set</SelectItem>
                      {tierOptions.map((tier) => (
                        <SelectItem key={tier} value={tier}>
                          {CITY_TIER_LABEL[tier]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove destination ${index + 1}`}
                  disabled={destinations.length === 1}
                  onClick={() => setDestinations((rows) => rows.filter((item) => item.key !== row.key))}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => {
                const key = nextKey.current++;
                setDestinations((rows) => [...rows, { key, city: "", tier: UNSET }]);
              }}
            >
              <Plus /> Add destination
            </Button>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="travel-estimate">Estimated cost ({currency})</Label>
              <Input
                id="travel-estimate"
                inputMode="decimal"
                className="tabular-nums"
                value={estimatedCost}
                onChange={(event) => setEstimatedCost(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="travel-advance">Advance needed ({currency})</Label>
              <Input
                id="travel-advance"
                inputMode="decimal"
                className="tabular-nums"
                value={advance}
                onChange={(event) => setAdvance(event.target.value)}
              />
            </div>
          </div>

          {block && !block.permitted && isPositiveAmount(advance) && (
            <p className="flex items-start gap-2 rounded-md bg-mustard-50 px-3 py-2.5 text-sm text-mustard-900 dark:bg-mustard-900/20 dark:text-mustard-100">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {block.message}
            </p>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>

        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="travel-request-form" disabled={isSaving}>
            {isSaving && <Loader2 className="animate-spin" />}
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
