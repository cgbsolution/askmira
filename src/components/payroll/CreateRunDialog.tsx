"use client";

import { Loader2, Plus } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmployeeMultiPicker } from "@/components/common/EmployeeMultiPicker";
import { FormField } from "@/components/common/FormField";
import { apiMessage, MONTHS, RUN_TYPE } from "@/components/payroll/labels";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { get, post } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import type {
  EntityOption,
  InputSourceOption,
  PayrollRun,
  PayrollRunInput,
  RunType,
} from "@/lib/types/payroll";

/** The run types that can be opened here; full and final is settled from the exit. */
const OPENABLE: RunType[] = ["regular", "off_cycle", "bonus", "arrear"];

/** What each supplementary run draws on unless changed — mirrors the API's defaults. */
const DEFAULT_SOURCES: Partial<Record<RunType, string[]>> = {
  off_cycle: ["payroll_adjustments", "overtime"],
  bonus: ["statutory_bonus", "payroll_adjustments"],
  arrear: ["arrears"],
};

const TYPE_HELP: Record<string, string> = {
  regular:
    "Everyone employed in the month. Rule versions are resolved by the last day of that month, and never change afterwards.",
  off_cycle:
    "Pays chosen people on top of the month's approved regular run — late adjustments or overtime. Nobody's salary is paid twice.",
  bonus: "Pays a bonus to chosen people on top of the month's approved regular run.",
  arrear: "Pays approved arrears to chosen people on top of the month's approved regular run.",
};

/** Open a draft run: regular for a month, or a supplementary run on top of it. */
export function CreateRunDialog({ onCreated }: { onCreated: (run: PayrollRun) => void }) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [sourceOptions, setSourceOptions] = useState<InputSourceOption[]>([]);
  const [entityId, setEntityId] = useState("");
  const [runType, setRunType] = useState<RunType>("regular");
  const [year, setYear] = useState(String(today.getFullYear()));
  const [month, setMonth] = useState(String(today.getMonth() + 1));
  const [paymentDate, setPaymentDate] = useState("");
  const [people, setPeople] = useState<EmployeeSummary[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const supplementary = runType !== "regular";

  useEffect(() => {
    if (!open) return;
    get<EntityOption[]>("/org/legal-entities")
      .then((rows) => {
        const active = rows.filter((row) => row.is_active);
        setEntities(active);
        if (active.length === 1) setEntityId(active[0].id);
      })
      .catch((caught) => setError(apiMessage(caught, "Could not load legal entities.")));
    get<InputSourceOption[]>("/payroll/input-sources")
      .then(setSourceOptions)
      .catch(() => setSourceOptions([]));
  }, [open]);

  const chooseType = (value: string) => {
    const next = value as RunType;
    setRunType(next);
    setSources(DEFAULT_SOURCES[next] ?? []);
    setError(null);
  };

  const toggleSource = (key: string, checked: boolean) =>
    setSources((current) => (checked ? [...current, key] : current.filter((k) => k !== key)));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const yearNumber = Number.parseInt(year, 10);
    if (!entityId) return setError("Choose the legal entity this run pays.");
    if (!/^\d{4}$/.test(year) || yearNumber < 2000 || yearNumber > 2100) {
      return setError("Enter a four-digit year.");
    }
    if (supplementary) {
      if (people.length === 0) return setError("Choose the people this run pays.");
      if (sources.length === 0) return setError("Choose at least one source to pay from.");
      if (reason.trim().length < 3) return setError("Say why this run is needed.");
    }
    setError(null);
    setIsSaving(true);
    try {
      const body: PayrollRunInput = {
        legal_entity_id: entityId,
        period_year: yearNumber,
        period_month: Number.parseInt(month, 10),
        payment_date: paymentDate || null,
        run_type: runType,
        ...(supplementary
          ? {
              employee_ids: people.map((person) => person.id),
              included_sources: sources,
              reason: reason.trim(),
            }
          : {}),
      };
      const run = await post<PayrollRun>("/payroll/runs", body);
      toast.success("Draft run opened.");
      setOpen(false);
      setPeople([]);
      setReason("");
      onCreated(run);
    } catch (caught) {
      setError(apiMessage(caught, "Could not open the run."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && setOpen(next)}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New run
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Open a payroll run</DialogTitle>
            <DialogDescription>{TYPE_HELP[runType]}</DialogDescription>
          </DialogHeader>
          <FormField htmlFor="run-type" label="Run type">
            <Select value={runType} onValueChange={chooseType}>
              <SelectTrigger id="run-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPENABLE.map((type) => (
                  <SelectItem key={type} value={type}>
                    {RUN_TYPE[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="run-entity" label="Legal entity">
            <Select value={entityId} onValueChange={setEntityId}>
              <SelectTrigger id="run-entity" className="w-full">
                <SelectValue
                  placeholder={entities.length ? "Choose an entity" : "No legal entities"}
                />
              </SelectTrigger>
              <SelectContent>
                {entities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id}>
                    {entity.name} ({entity.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField htmlFor="run-month" label="Month">
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger id="run-month" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((name, index) => (
                    <SelectItem key={name} value={String(index + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="run-year" label="Year">
              <Input
                id="run-year"
                inputMode="numeric"
                value={year}
                onChange={(event) => setYear(event.target.value)}
              />
            </FormField>
          </div>
          {supplementary && (
            <>
              <FormField htmlFor="run-people" label="Who it pays" required>
                <EmployeeMultiPicker id="run-people" value={people} onChange={setPeople} />
              </FormField>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium text-foreground">Pays from</legend>
                {sourceOptions.map((option) => (
                  <div key={option.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`run-source-${option.key}`}
                      checked={sources.includes(option.key)}
                      onCheckedChange={(checked) => toggleSource(option.key, checked === true)}
                    />
                    <Label htmlFor={`run-source-${option.key}`} className="font-normal">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </fieldset>
              <FormField htmlFor="run-reason" label="Why this run is needed" required>
                <Textarea
                  id="run-reason"
                  rows={2}
                  maxLength={1000}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="e.g. Q2 incentives approved after the September run closed"
                />
              </FormField>
            </>
          )}
          <FormField
            htmlFor="run-payment-date"
            label="Payment date"
            optional
            hint="Can also be recorded when the run is marked paid."
          >
            <Input
              id="run-payment-date"
              type="date"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
            />
          </FormField>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              Open run
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
