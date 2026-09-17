"use client";

import { Loader2, Plus } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { apiMessage, MONTHS } from "@/components/payroll/labels";
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
import { get, post } from "@/lib/api";
import type { EntityOption, PayrollRun, PayrollRunInput } from "@/lib/types/payroll";

/** Open a draft regular run for one legal entity and month. */
export function CreateRunDialog({ onCreated }: { onCreated: (run: PayrollRun) => void }) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [entityId, setEntityId] = useState("");
  const [year, setYear] = useState(String(today.getFullYear()));
  const [month, setMonth] = useState(String(today.getMonth() + 1));
  const [paymentDate, setPaymentDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    get<EntityOption[]>("/org/legal-entities")
      .then((rows) => {
        const active = rows.filter((row) => row.is_active);
        setEntities(active);
        if (active.length === 1) setEntityId(active[0].id);
      })
      .catch((caught) => setError(apiMessage(caught, "Could not load legal entities.")));
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const yearNumber = Number.parseInt(year, 10);
    if (!entityId) return setError("Choose the legal entity this run pays.");
    if (!/^\d{4}$/.test(year) || yearNumber < 2000 || yearNumber > 2100) {
      return setError("Enter a four-digit year.");
    }
    setError(null);
    setIsSaving(true);
    try {
      const body: PayrollRunInput = {
        legal_entity_id: entityId,
        period_year: yearNumber,
        period_month: Number.parseInt(month, 10),
        payment_date: paymentDate || null,
      };
      const run = await post<PayrollRun>("/payroll/runs", body);
      toast.success("Draft run opened.");
      setOpen(false);
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
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Open a payroll run</DialogTitle>
            <DialogDescription>
              A regular run for one month. Rule versions are resolved by the last day of that
              month, and never change afterwards.
            </DialogDescription>
          </DialogHeader>
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
