"use client";

import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { BreakdownTable } from "@/components/payroll/BreakdownTable";
import { apiMessage, isAmount, periodLabel } from "@/components/payroll/labels";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { get, post } from "@/lib/api";
import type {
  SalaryAssignInput,
  SalaryBreakdown,
  SalaryOverview,
  SalaryStructure,
} from "@/lib/types/payroll";
import type { EmployeeSalary } from "@/lib/types/payroll-ops";

/**
 * Assign or revise one employee's salary, with the resolved breakdown shown
 * live from the API before anything is saved.
 */
export function AssignSalaryDialog({
  employee,
  structures,
  onClose,
  onSaved,
}: {
  employee: SalaryOverview | null;
  structures: SalaryStructure[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const current = employee?.current_salary ?? null;
  const [structureId, setStructureId] = useState("");
  const [ctc, setCtc] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [reason, setReason] = useState("");
  const [breakdown, setBreakdown] = useState<SalaryBreakdown | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStructureId(current?.structure_id ?? "");
    setCtc("");
    setEffectiveFrom("");
    setReason("");
    setError(null);
  }, [employee, current?.structure_id]);

  useEffect(() => {
    if (!structureId || !isAmount(ctc)) {
      setBreakdown(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    setPreviewing(true);
    const timer = setTimeout(() => {
      get<SalaryBreakdown>(`/salary-structures/${structureId}/preview?ctc=${encodeURIComponent(ctc.trim())}`)
        .then((result) => {
          if (cancelled) return;
          setBreakdown(result);
          setPreviewError(null);
        })
        .catch((caught) => {
          if (cancelled) return;
          setBreakdown(null);
          setPreviewError(apiMessage(caught, "This CTC does not resolve against the structure."));
        })
        .finally(() => {
          if (!cancelled) setPreviewing(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [structureId, ctc]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!employee) return;
    if (!structureId) return setError("Choose a salary structure.");
    if (!isAmount(ctc) || /^0+(\.0+)?$/.test(ctc.trim())) return setError("Enter the annual CTC.");
    if (!effectiveFrom) return setError("Give the date this salary applies from.");
    if (current && !reason.trim()) return setError("Say why the salary is being revised.");
    setSaving(true);
    setError(null);
    try {
      const body: SalaryAssignInput = {
        structure_id: structureId,
        ctc_annual: ctc.trim(),
        effective_from: effectiveFrom,
        revision_reason: reason.trim() || null,
      };
      const saved = await post<EmployeeSalary>(`/employees/${employee.employee_id}/salary`, body);
      const paid = saved?.paid_months_affected ?? [];
      if (paid.length) {
        // Months already paid at the earlier salary are trued up by arrears,
        // which are raised separately. Say so now, not at the next payslip.
        const [first, last] = [paid[0], paid[paid.length - 1]].map((period) => {
          const [year, month] = period.split("-").map(Number);
          return periodLabel(year, month);
        });
        toast.warning(current ? "Salary revised." : "Salary assigned.", {
          description:
            `Payroll already paid ${paid.length === 1 ? first : `${first} to ${last}`} at the ` +
            "earlier salary. Raise the arrears under Payroll → Arrears to pay the difference.",
          duration: 15000,
        });
      } else {
        toast.success(current ? "Salary revised." : "Salary assigned.");
      }
      onSaved();
      onClose();
    } catch (caught) {
      setError(apiMessage(caught, "Could not save the salary."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={employee !== null} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {current ? "Revise salary" : "Assign salary"} · {employee?.employee_name}
            </DialogTitle>
            <DialogDescription>
              {current ? (
                <>
                  Currently <Money value={current.ctc_annual} /> a year from {current.effective_from}. A
                  revision starts after that date; a backdated change is an arrears revision.
                </>
              ) : (
                "The resolved amounts are stored with the salary, so a later structure edit never changes them."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField htmlFor="sal-structure" label="Structure">
              <Select value={structureId} onValueChange={setStructureId}>
                <SelectTrigger id="sal-structure" className="w-full">
                  <SelectValue placeholder={structures.length ? "Choose" : "No structures"} />
                </SelectTrigger>
                <SelectContent>
                  {structures.map((structure) => (
                    <SelectItem key={structure.id} value={structure.id}>
                      {structure.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="sal-ctc" label="Annual CTC (₹)">
              <Input
                id="sal-ctc"
                inputMode="decimal"
                className="tabular-nums"
                value={ctc}
                onChange={(event) => setCtc(event.target.value)}
              />
            </FormField>
            <FormField htmlFor="sal-from" label="Effective from">
              <Input
                id="sal-from"
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
            </FormField>
          </div>
          <FormField htmlFor="sal-reason" label="Reason" optional={!current}>
            <Input
              id="sal-reason"
              maxLength={255}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={current ? "Annual increment" : "New joiner"}
            />
          </FormField>
          <div className="max-h-80 overflow-y-auto">
            {previewing && !breakdown ? (
              <Skeleton className="h-32 w-full" />
            ) : previewError ? (
              <p className="text-sm text-destructive">{previewError}</p>
            ) : breakdown ? (
              <BreakdownTable breakdown={breakdown} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Choose a structure and enter a CTC to see how it resolves.
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || previewError !== null}>
              {saving && <Loader2 className="animate-spin" />}
              {current ? "Save revision" : "Assign salary"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
