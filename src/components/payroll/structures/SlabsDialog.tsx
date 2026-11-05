"use client";

import { Plus, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";

import { AmountInput } from "@/components/common/AmountInput";
import { FIGURES, type RuleDraft, rupees } from "@/components/payroll/structures/rules";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Slab = RuleDraft["slabs"][number];

/**
 * Slabs for one line, e.g. Professional Tax: nothing up to ₹15,000 of gross a
 * month, ₹200 above. Every slab but the last has an upper limit; the last one
 * covers everything above the one before it.
 */
export function SlabsDialog({
  open,
  onOpenChange,
  lineName,
  draft,
  lines,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineName: string;
  draft: RuleDraft;
  /** Other lines a slab may be read on, by code. */
  lines: { code: string; name: string }[];
  onSave: (patch: Pick<RuleDraft, "slabs" | "of">) => void;
}) {
  const [slabs, setSlabs] = useState<Slab[]>(draft.slabs);
  const [of, setOf] = useState(draft.of);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSlabs(draft.slabs.length ? draft.slabs.map((slab) => ({ ...slab })) : [{ up_to: "", amount: "" }]);
    setOf(FIGURES.some((f) => f.value === draft.of) || lines.some((l) => l.code === draft.of) ? draft.of : "GROSS");
    setError(null);
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (index: number, patch: Partial<Slab>) =>
    setSlabs((current) => current.map((slab, i) => (i === index ? { ...slab, ...patch } : slab)));

  const save = () => {
    for (let i = 0; i < slabs.length; i += 1) {
      const last = i === slabs.length - 1;
      if (!slabs[i].amount.trim()) return setError(`Enter what slab ${i + 1} charges (0 for nothing).`);
      if (!last && !slabs[i].up_to.trim()) return setError(`Enter slab ${i + 1}'s upper limit.`);
      if (!last && i > 0 && Number(slabs[i].up_to) <= Number(slabs[i - 1].up_to)) {
        return setError(`Slab ${i + 1}'s limit must be above slab ${i}'s.`);
      }
    }
    onSave({ slabs: slabs.map((slab, i) => (i === slabs.length - 1 ? { ...slab, up_to: "" } : slab)), of });
    onOpenChange(false);
  };

  const lower = (index: number) => (index > 0 ? slabs[index - 1].up_to.trim() : "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Slabs for {lineName}</DialogTitle>
          <DialogDescription>
            An amount a month for each band of a monthly figure — for example Professional Tax: ₹0 up to
            ₹15,000 of gross, ₹200 above it. The last slab covers everything above the one before it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="slab-of">Slabs are on</Label>
            <Select value={of} onValueChange={setOf}>
              <SelectTrigger id="slab-of" className="w-full">
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
          </div>

          <div className="grid gap-2">
            {slabs.map((slab, index) => {
              const last = index === slabs.length - 1;
              return (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`slab-${index}-to`} className="text-xs text-muted-foreground">
                      {last ? "Band" : `Slab ${index + 1}: up to (₹)`}
                    </Label>
                    {last ? (
                      <p id={`slab-${index}-to`} className="flex h-9 items-center text-sm">
                        {lower(index) ? `Above ${rupees(lower(index))}` : "Any amount"}
                      </p>
                    ) : (
                      <AmountInput
                        id={`slab-${index}-to`}
                        value={slab.up_to}
                        placeholder="15000"
                        onValueChange={(value) => set(index, { up_to: value })}
                      />
                    )}
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`slab-${index}-amount`} className="text-xs text-muted-foreground">
                      Charge a month (₹)
                    </Label>
                    <AmountInput
                      id={`slab-${index}-amount`}
                      value={slab.amount}
                      placeholder="0"
                      onValueChange={(value) => set(index, { amount: value })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove slab ${index + 1}`}
                    disabled={slabs.length === 1}
                    onClick={() => setSlabs((current) => current.filter((_, i) => i !== index))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={slabs.length >= 20}
            onClick={() =>
              // A new band goes before the open-ended last one.
              setSlabs((current) => [...current.slice(0, -1), { up_to: "", amount: "" }, current[current.length - 1]])
            }
          >
            <Plus /> Add a slab
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Use these slabs</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
