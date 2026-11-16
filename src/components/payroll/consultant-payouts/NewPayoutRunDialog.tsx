"use client";

import { Loader2, Plus } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DatePicker } from "@/components/common/DatePicker";
import { FormField } from "@/components/common/FormField";
import { apiMessage } from "@/components/payroll/labels";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { get, post } from "@/lib/api";
import type { PayoutRun } from "@/lib/types/consultant-payouts";
import type { EntityOption } from "@/lib/types/payroll";

const ALL_COMPANIES = "all";

/** Draft a payout run: every approved consultant week ending by the cut-off. */
export function NewPayoutRunDialog({
  onCreated,
}: {
  onCreated: (run: PayoutRun) => void;
}) {
  const [open, setOpen] = useState(false);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [entityId, setEntityId] = useState(ALL_COMPANIES);
  const [cutOff, setCutOff] = useState("");
  const [payDate, setPayDate] = useState("");
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
      .catch((caught) =>
        setError(apiMessage(caught, "Could not load the companies.")),
      );
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cutOff) return setError("Pick the cut-off date.");
    if (!payDate) return setError("Pick the pay date.");
    setError(null);
    setIsSaving(true);
    try {
      const run = await post<PayoutRun>("/consultant-payouts", {
        legal_entity_id: entityId === ALL_COMPANIES ? null : entityId,
        cut_off: cutOff,
        pay_date: payDate,
      });
      toast.success("Payout run drafted.");
      setOpen(false);
      onCreated(run);
    } catch (caught) {
      setError(apiMessage(caught, "Could not draft the run."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && setOpen(next)}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New payout run
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New payout run</DialogTitle>
            <DialogDescription>
              Takes every approved consultant week, not yet paid, that ends on
              or before the cut-off date. Tax is worked out as on the pay date.
            </DialogDescription>
          </DialogHeader>
          <FormField htmlFor="payout-entity" label="Company">
            <Select value={entityId} onValueChange={setEntityId}>
              <SelectTrigger id="payout-entity" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_COMPANIES}>Every company</SelectItem>
                {entities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id}>
                    {entity.name} ({entity.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              htmlFor="payout-cut-off"
              label="Cut-off date"
              hint="Weeks ending by this day."
            >
              <DatePicker
                id="payout-cut-off"
                required
                value={cutOff}
                onChange={setCutOff}
              />
            </FormField>
            <FormField htmlFor="payout-pay-date" label="Pay date">
              <DatePicker
                id="payout-pay-date"
                required
                value={payDate}
                onChange={setPayDate}
              />
            </FormField>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              Draft run
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
