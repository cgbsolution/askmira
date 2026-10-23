"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Landmark, Loader2, Plus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { EmployeePicker } from "@/components/payroll/EmployeePicker";
import { apiMessage } from "@/components/payroll/labels";
import { useEmployeeNames } from "@/components/payroll/useEmployeeNames";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { PfElection } from "@/lib/types/payroll";
import { formatDay } from "@/lib/utils";

/** "1 Apr 2026 – open": the dates an election applies between. */
function periodText(row: PfElection): string {
  return `${formatDay(row.effective_from, true)} – ${row.effective_to ? formatDay(row.effective_to, true) : "open"}`;
}

/** Each employee's PF ceiling election and voluntary PF, effective-dated. */
export function PfElectionsPanel() {
  const { data, error, isLoading, reload } = useApiQuery<PfElection[]>("/statutory/pf-elections");
  const nameOf = useEmployeeNames();
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [actualWage, setActualWage] = useState(false);
  const [vpfKind, setVpfKind] = useState<"none" | "percent" | "fixed">("none");
  const [vpfValue, setVpfValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!employeeId) return setFormError("Choose the employee.");
    if (!effectiveFrom) return setFormError("Give the date the election applies from.");
    if (vpfKind !== "none" && !/^\d+(\.\d{1,3})?$/.test(vpfValue.trim())) {
      return setFormError("Enter the VPF amount or percentage as a number.");
    }
    setSaving(true);
    setFormError(null);
    try {
      await post("/statutory/pf-elections", {
        employee_id: employeeId,
        effective_from: effectiveFrom,
        pf_on_actual_wage: actualWage,
        vpf_percentage: vpfKind === "percent" ? vpfValue.trim() : null,
        vpf_fixed_amount: vpfKind === "fixed" ? vpfValue.trim() : null,
      });
      toast.success("PF election recorded.");
      setOpen(false);
      reload();
    } catch (caught) {
      setFormError(apiMessage(caught, "Could not record the election."));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<PfElection>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (row) => nameOf(row.employee_id),
    },
    {
      accessorKey: "effective_from",
      header: "Period",
      meta: { cellClassName: "text-sm", text: periodText },
      cell: ({ row }) => periodText(row.original),
    },
    {
      accessorKey: "pf_on_actual_wage",
      header: "PF wage",
      meta: { text: (row) => (row.pf_on_actual_wage ? "Actual wage" : "Ceiling") },
      cell: ({ row }) => (
        <Badge variant={row.original.pf_on_actual_wage ? "accent" : "muted"}>
          {row.original.pf_on_actual_wage ? "Actual wage" : "Ceiling"}
        </Badge>
      ),
    },
    {
      // A percentage or a fixed amount: one column, so it is not sorted.
      id: "voluntary_pf",
      header: "Voluntary PF",
      meta: {
        cellClassName: "text-sm tabular-nums",
        text: (row) =>
          [row.vpf_percentage ? `${row.vpf_percentage}% of PF wage` : null, row.vpf_fixed_amount]
            .filter(Boolean)
            .join(" "),
      },
      cell: ({ row }) => (
        <>
          {row.original.vpf_percentage ? `${row.original.vpf_percentage}% of PF wage` : null}
          {row.original.vpf_fixed_amount ? <Money value={row.original.vpf_fixed_amount} /> : null}
          {!row.original.vpf_percentage && !row.original.vpf_fixed_amount && "—"}
        </>
      ),
    },
  ];

  return (
    <>
      <DataTable
        title="PF elections"
        description="PF on actual wages instead of the ceiling, and voluntary PF. A new election closes the previous one."
        columns={columns}
        data={data ?? []}
        noun="elections"
        exportName="pf-elections"
        searchPlaceholder="Search employees"
        actions={
          <Button size="sm" className="h-9" onClick={() => setOpen(true)}>
            <Plus /> Record election
          </Button>
        }
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        empty={{
          icon: Landmark,
          title: "No PF elections",
          description: "Without one, PF follows the approved rule set's ceiling and nobody contributes VPF.",
        }}
      />

      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={(event) => void submit(event)} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Record a PF election</DialogTitle>
              <DialogDescription>
                Applies from its date forward. Payslips already computed are not changed.
              </DialogDescription>
            </DialogHeader>
            <FormField htmlFor="pf-employee" label="Employee">
              <EmployeePicker id="pf-employee" value={employeeId} onChange={(id) => setEmployeeId(id)} />
            </FormField>
            <FormField htmlFor="pf-from" label="Effective from">
              <Input id="pf-from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </FormField>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <FormField htmlFor="pf-actual" label="PF on actual wages" hint="Raises the employer's contribution too.">
                <span />
              </FormField>
              <Switch id="pf-actual" checked={actualWage} onCheckedChange={setActualWage} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField htmlFor="pf-vpf-kind" label="Voluntary PF">
                <Select value={vpfKind} onValueChange={(v) => setVpfKind(v as typeof vpfKind)}>
                  <SelectTrigger id="pf-vpf-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="percent">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              {vpfKind !== "none" && (
                <FormField htmlFor="pf-vpf-value" label={vpfKind === "percent" ? "Percent" : "Monthly ₹"}>
                  <Input id="pf-vpf-value" inputMode="decimal" value={vpfValue} onChange={(e) => setVpfValue(e.target.value)} />
                </FormField>
              )}
            </div>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
