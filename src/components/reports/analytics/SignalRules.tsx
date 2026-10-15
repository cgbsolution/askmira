"use client";

import { Loader2, SlidersHorizontal } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, put } from "@/lib/api";

type Rules = Record<string, number | string>;

/** Each threshold, what it means, and its unit. Zero switches a signal off. */
const FIELDS: { key: string; label: string; unit: string; decimal?: boolean }[] = [
  { key: "no_leave_days", label: "No leave for", unit: "days" },
  { key: "overtime_hours_30d", label: "Overtime in 30 days, with no leave", unit: "hours" },
  { key: "bridge_absences_90d", label: "Mondays or Fridays off in 90 days", unit: "days" },
  { key: "lop_days_90d", label: "Loss of pay in 90 days", unit: "days" },
  { key: "bradford_review", label: "Bradford factor at or above", unit: "" },
  { key: "pay_revision_months", label: "No pay revision for", unit: "months" },
  { key: "team_exits", label: "Others who resigned from the same team", unit: "people" },
  { key: "team_exit_days", label: "… within", unit: "days" },
  { key: "manager_change_days", label: "New line manager within", unit: "days" },
  { key: "rating_drop", label: "Review score fell by at least", unit: "points", decimal: true },
  { key: "no_role_change_months", label: "No promotion or new designation for", unit: "months" },
];

/** An admin's thresholds for the people signals. Everyone sees what they are. */
export function SignalRulesButton({ onSaved }: { onSaved: () => void }) {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [open, setOpen] = useState(false);
  const { data, reload } = useApiQuery<Rules>(open ? "/reports/analytics/signal-rules" : null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setValues(Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])));
  }, [data]);

  const save = async () => {
    setBusy(true);
    try {
      const body = Object.fromEntries(
        FIELDS.map(({ key, decimal }) => [key, decimal ? values[key] : Number.parseInt(values[key] ?? "0", 10) || 0]),
      );
      await put("/reports/analytics/signal-rules", body);
      toast.success("Thresholds saved. The signals use them from now.");
      setOpen(false);
      reload();
      onSaved();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The thresholds were not saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <SlidersHorizontal /> Rules
      </Button>
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Signal rules</DialogTitle>
            <DialogDescription>
              The thresholds every signal is checked against. Zero switches a signal off.
              {isAdmin ? "" : " An admin can change them."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(({ key, label, unit, decimal }) => (
              <FormField key={key} htmlFor={`rule-${key}`} label={label} hint={unit || undefined}>
                <Input
                  id={`rule-${key}`}
                  inputMode={decimal ? "decimal" : "numeric"}
                  value={values[key] ?? ""}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    setValues((current) => ({
                      ...current,
                      [key]: e.target.value.replace(decimal ? /[^\d.]/g : /\D/g, ""),
                    }))
                  }
                />
              </FormField>
            ))}
          </div>
          {isAdmin && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Save rules
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
