"use client";

import { Loader2, Plus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { apiMessage, COMPONENT_TYPE_LABEL } from "@/components/payroll/labels";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { post } from "@/lib/api";
import type {
  CalculationType,
  ComponentType,
  SalaryComponent,
  SalaryComponentInput,
} from "@/lib/types/payroll";

const CALCULATION_LABEL: Record<CalculationType, string> = {
  fixed: "Fixed monthly amount",
  percentage_of: "Percentage of another component",
  formula: "Formula",
  balance: "Balance of CTC",
};

const FLAGS: { key: keyof SalaryComponentInput; label: string; hint: string }[] = [
  { key: "taxable", label: "Taxable", hint: "Counts toward income tax." },
  { key: "part_of_ctc", label: "Part of CTC", hint: "Consumes part of the annual CTC." },
  { key: "pro_rate_on_lop", label: "Reduced by loss of pay", hint: "Prorated for LOP days." },
  { key: "counts_toward_pf", label: "PF wage", hint: "Part of the PF wage base (Basic + DA)." },
  { key: "counts_toward_esi", label: "ESI wage", hint: "Part of the ESI wage base." },
];

/** Define a salary component. The API rejects a malformed one with the reason. */
export function NewComponentDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [componentType, setComponentType] = useState<ComponentType>("earning");
  const [calculation, setCalculation] = useState<CalculationType>("fixed");
  const [base, setBase] = useState("");
  const [value, setValue] = useState("");
  const [formula, setFormula] = useState("");
  const [order, setOrder] = useState("0");
  const [flags, setFlags] = useState({
    taxable: true,
    part_of_ctc: true,
    pro_rate_on_lop: true,
    counts_toward_pf: false,
    counts_toward_esi: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^[A-Z][A-Z0-9_]*$/.test(code)) {
      return setError("The code is capital letters, digits and underscores, e.g. BASIC.");
    }
    if (!name.trim()) return setError("Give the component a name.");
    if (calculation === "percentage_of" && !base.trim()) {
      return setError("Say what this is a percentage of (e.g. CTC or BASIC).");
    }
    if ((calculation === "fixed" || calculation === "percentage_of") && !/^\d+(\.\d{1,4})?$/.test(value)) {
      return setError("Enter the amount or percentage as a number.");
    }
    if (calculation === "formula" && !formula.trim()) return setError("Enter the formula.");
    setSaving(true);
    setError(null);
    try {
      const body: SalaryComponentInput = {
        code,
        name: name.trim(),
        component_type: componentType,
        calculation_type: calculation,
        base_component_code: calculation === "percentage_of" ? base.trim().toUpperCase() : null,
        value: calculation === "fixed" || calculation === "percentage_of" ? value : null,
        formula: calculation === "formula" ? formula.trim() : null,
        display_order: Number.parseInt(order, 10) || 0,
        ...flags,
      };
      await post<SalaryComponent>("/salary-components", body);
      toast.success(`Component ${code} created.`);
      setOpen(false);
      setCode("");
      setName("");
      setValue("");
      setFormula("");
      onCreated();
    } catch (caught) {
      setError(apiMessage(caught, "Could not create the component."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus /> New component
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New salary component</DialogTitle>
            <DialogDescription>
              A line a structure can use: Basic, HRA, an allowance, an employer contribution.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <FormField htmlFor="cmp-code" label="Code">
              <Input id="cmp-code" value={code} maxLength={32} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            </FormField>
            <FormField htmlFor="cmp-name" label="Name">
              <Input id="cmp-name" value={name} maxLength={128} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField htmlFor="cmp-type" label="Type">
              <Select value={componentType} onValueChange={(v) => setComponentType(v as ComponentType)}>
                <SelectTrigger id="cmp-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COMPONENT_TYPE_LABEL).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="cmp-calc" label="Calculated as">
              <Select value={calculation} onValueChange={(v) => setCalculation(v as CalculationType)}>
                <SelectTrigger id="cmp-calc" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CALCULATION_LABEL).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {calculation === "percentage_of" && (
              <FormField htmlFor="cmp-base" label="Percentage of" hint="CTC, or another component's code">
                <Input id="cmp-base" value={base} onChange={(e) => setBase(e.target.value.toUpperCase())} />
              </FormField>
            )}
            {(calculation === "fixed" || calculation === "percentage_of") && (
              <FormField htmlFor="cmp-value" label={calculation === "fixed" ? "Monthly amount (₹)" : "Percentage"}>
                <Input id="cmp-value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
              </FormField>
            )}
            <FormField htmlFor="cmp-order" label="Display order">
              <Input id="cmp-order" inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value)} />
            </FormField>
          </div>
          {calculation === "formula" && (
            <FormField htmlFor="cmp-formula" label="Formula" hint="Arithmetic over other component codes, e.g. BASIC * 0.1">
              <Input id="cmp-formula" value={formula} onChange={(e) => setFormula(e.target.value)} />
            </FormField>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {FLAGS.map((flag) => (
              <div key={flag.key} className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2">
                <FormField htmlFor={`cmp-${flag.key}`} label={flag.label} hint={flag.hint}>
                  <span />
                </FormField>
                <Switch
                  id={`cmp-${flag.key}`}
                  checked={flags[flag.key as keyof typeof flags]}
                  onCheckedChange={(checked) => setFlags((current) => ({ ...current, [flag.key]: checked }))}
                />
              </div>
            ))}
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
              Create component
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
