"use client";

import { Loader2, Plus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { apiMessage } from "@/components/payroll/labels";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { post } from "@/lib/api";
import type {
  RoundingMode,
  SalaryComponent,
  SalaryStructure,
  SalaryStructureInput,
} from "@/lib/types/payroll";

/**
 * Build a structure from existing components. The API refuses one with no
 * BALANCE component, two of them, or a circular reference — and names it.
 */
export function NewStructureDialog({
  components,
  onCreated,
}: {
  components: SalaryComponent[];
  onCreated: (structure: SalaryStructure) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [rounding, setRounding] = useState<RoundingMode>("half_up");
  const [precision, setPrecision] = useState("0");
  const [chosen, setChosen] = useState<Record<string, { on: boolean; override: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const active = components.filter((component) => component.active);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const selected = active.filter((component) => chosen[component.code]?.on);
    if (!name.trim()) return setError("Name the structure.");
    if (!effectiveFrom) return setError("Give the date the structure applies from.");
    if (selected.length === 0) return setError("Choose at least one component.");
    const badOverride = selected.find((component) => {
      const override = chosen[component.code]?.override.trim();
      return override && !/^\d+(\.\d{1,4})?$/.test(override);
    });
    if (badOverride) return setError(`The override for ${badOverride.code} is not a number.`);
    setSaving(true);
    setError(null);
    try {
      const body: SalaryStructureInput = {
        name: name.trim(),
        effective_from: effectiveFrom,
        rounding_mode: rounding,
        rounding_precision: Number.parseInt(precision, 10),
        components: selected.map((component) => ({
          component_code: component.code,
          override_value: chosen[component.code]?.override.trim() || null,
          display_order: component.display_order,
        })),
      };
      const structure = await post<SalaryStructure>("/salary-structures", body);
      toast.success(`Structure ${structure.name} created.`);
      setOpen(false);
      setName("");
      setChosen({});
      onCreated(structure);
    } catch (caught) {
      setError(apiMessage(caught, "Could not create the structure."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
      <DialogTrigger asChild>
        <Button disabled={active.length === 0} title={active.length === 0 ? "Create components first" : undefined}>
          <Plus /> New structure
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New salary structure</DialogTitle>
            <DialogDescription>
              Effective-dated. Editing a structure later never changes a salary already assigned.
            </DialogDescription>
          </DialogHeader>
          <FormField htmlFor="st-name" label="Name">
            <Input id="st-name" value={name} maxLength={255} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField htmlFor="st-from" label="Effective from">
              <Input id="st-from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </FormField>
            <FormField htmlFor="st-rounding" label="Rounding">
              <Select value={rounding} onValueChange={(v) => setRounding(v as RoundingMode)}>
                <SelectTrigger id="st-rounding" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="half_up">Half up</SelectItem>
                  <SelectItem value="half_even">Half even</SelectItem>
                  <SelectItem value="ceiling">Up</SelectItem>
                  <SelectItem value="floor">Down</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="st-precision" label="Precision">
              <Select value={precision} onValueChange={setPrecision}>
                <SelectTrigger id="st-precision" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Whole rupees</SelectItem>
                  <SelectItem value="2">Paise</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <div className="grid gap-1.5">
            <p className="text-sm font-medium text-foreground">Components</p>
            <p className="text-xs text-muted-foreground">
              Exactly one must be a balance component. An override replaces the component&apos;s
              own value or percentage in this structure only.
            </p>
            <ScrollArea className="h-56 rounded-md border border-border">
              <ul className="divide-y divide-border">
                {active.map((component) => {
                  const state = chosen[component.code] ?? { on: false, override: "" };
                  return (
                    <li key={component.code} className="flex items-center gap-3 px-3 py-2">
                      <Checkbox
                        id={`st-cmp-${component.code}`}
                        checked={state.on}
                        onCheckedChange={(checked) =>
                          setChosen((current) => ({
                            ...current,
                            [component.code]: { ...state, on: checked === true },
                          }))
                        }
                        aria-label={`Include ${component.name}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{component.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {component.code} · {component.calculation_type.replace("_", " ")}
                          {component.value ? ` · ${component.value}` : ""}
                        </p>
                      </div>
                      {state.on &&
                        (component.calculation_type === "fixed" ||
                          component.calculation_type === "percentage_of") && (
                          <Input
                            aria-label={`Override for ${component.code}`}
                            placeholder="Override"
                            className="w-24"
                            inputMode="decimal"
                            value={state.override}
                            onChange={(event) =>
                              setChosen((current) => ({
                                ...current,
                                [component.code]: { ...state, override: event.target.value },
                              }))
                            }
                          />
                        )}
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Create structure
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
