"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import { patch, post } from "@/lib/api";
import type { CostCentre, Position } from "@/lib/types/people";
import { toISODate } from "@/lib/utils";

import { NONE, apiMessage, fromSelect } from "../labels";
import { useOrgReference } from "../useOrgReference";
import { DatePicker } from "@/components/common/DatePicker";

const CODE = /^[A-Za-z0-9_\-/]+$/;
const AMOUNT = /^\d+(\.\d{1,2})?$/;

interface Values {
  code: string;
  title: string;
  grade: string;
  department_id: string;
  location_id: string;
  cost_centre_id: string;
  reports_to_position_id: string;
  budgeted_ctc_min: string;
  budgeted_ctc_max: string;
  fte: string;
  effective_from: string;
}

function emptyValues(): Values {
  return {
    code: "",
    title: "",
    grade: "",
    department_id: NONE,
    location_id: NONE,
    cost_centre_id: NONE,
    reports_to_position_id: NONE,
    budgeted_ctc_min: "",
    budgeted_ctc_max: "",
    fte: "1.0",
    effective_from: toISODate(new Date()),
  };
}

/**
 * Create or edit a position.
 *
 * Amounts stay strings end to end — they are money, and the API holds them as
 * `Numeric` — so they are validated as decimal text rather than parsed into a
 * float. Freezing and abolishing are not edits; they have their own action with
 * a reason.
 */
export function PositionDialog({
  open,
  editing,
  positions,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  editing: Position | null;
  positions: Position[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const org = useOrgReference();
  const costCentres = useApiQuery<CostCentre[]>(open ? "/positions/cost-centres" : null);
  const [values, setValues] = useState<Values>(emptyValues);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(
      editing
        ? {
            code: editing.code,
            title: editing.title,
            grade: editing.grade ?? "",
            department_id: editing.department_id ?? NONE,
            location_id: editing.location_id ?? NONE,
            cost_centre_id: editing.cost_centre_id ?? NONE,
            reports_to_position_id: editing.reports_to_position_id ?? NONE,
            budgeted_ctc_min: editing.budgeted_ctc_min ?? "",
            budgeted_ctc_max: editing.budgeted_ctc_max ?? "",
            fte: editing.fte,
            effective_from: editing.effective_from,
          }
        : emptyValues(),
    );
  }, [open, editing]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const errors: Partial<Record<keyof Values, string>> = {};
  if (!values.title.trim()) errors.title = "A title is required.";
  if (!editing && !CODE.test(values.code.trim()))
    errors.code = "Letters, digits, hyphen, underscore and slash only.";
  if (values.budgeted_ctc_min && !AMOUNT.test(values.budgeted_ctc_min))
    errors.budgeted_ctc_min = "An amount in rupees, up to two decimals.";
  if (values.budgeted_ctc_max && !AMOUNT.test(values.budgeted_ctc_max))
    errors.budgeted_ctc_max = "An amount in rupees, up to two decimals.";
  if (
    !errors.budgeted_ctc_min &&
    !errors.budgeted_ctc_max &&
    values.budgeted_ctc_min &&
    values.budgeted_ctc_max &&
    Number(values.budgeted_ctc_max) < Number(values.budgeted_ctc_min)
  )
    errors.budgeted_ctc_max = "The ceiling is below the floor.";
  const fte = Number(values.fte);
  if (!(fte > 0 && fte <= 1)) errors.fte = "Between 0 and 1. Two people sharing a seat are two seats.";
  const invalid = Object.keys(errors).length > 0;

  // A position cannot report to itself.
  const parents = positions.filter(
    (row) => row.status !== "abolished" && row.id !== editing?.id,
  );

  const submit = async () => {
    setIsBusy(true);
    const body = {
      title: values.title.trim(),
      grade: values.grade.trim() || null,
      department_id: fromSelect(values.department_id),
      location_id: fromSelect(values.location_id),
      cost_centre_id: fromSelect(values.cost_centre_id),
      reports_to_position_id: fromSelect(values.reports_to_position_id),
      budgeted_ctc_min: values.budgeted_ctc_min || null,
      budgeted_ctc_max: values.budgeted_ctc_max || null,
      fte: values.fte,
    };
    try {
      if (editing) {
        await patch(`/positions/${editing.id}`, body);
        toast.success("Position updated.");
      } else {
        await post("/positions", {
          ...body,
          code: values.code.trim(),
          effective_from: values.effective_from,
        });
        toast.success("Position created.");
      }
      onSaved();
      onOpenChange(false);
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not save the position."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.title}` : "New position"}</DialogTitle>
          <DialogDescription>
            A new seat is checked against the headcount budget for its department; the API refuses
            one the budget does not cover.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="position-title" label="Title" error={errors.title}>
            <Input
              id="position-title"
              value={values.title}
              onChange={(event) => set("title", event.target.value)}
              placeholder="Senior Payroll Analyst"
            />
          </FormField>
          <FormField
            htmlFor="position-code"
            label="Position code"
            error={errors.code}
            hint={editing ? "The code is fixed once created." : undefined}
          >
            <Input
              id="position-code"
              value={values.code}
              disabled={editing !== null}
              onChange={(event) => set("code", event.target.value)}
              placeholder="FIN-PAY-003"
              className="font-mono"
            />
          </FormField>

          <FormField htmlFor="position-department" label="Department" optional>
            <Select value={values.department_id} onValueChange={(next) => set("department_id", next)}>
              <SelectTrigger id="position-department" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {org.departments.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="position-location" label="Location" optional>
            <Select value={values.location_id} onValueChange={(next) => set("location_id", next)}>
              <SelectTrigger id="position-location" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {org.locations.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name} ({row.state_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField htmlFor="position-reports-to" label="Reports to" optional>
            <Select
              value={values.reports_to_position_id}
              onValueChange={(next) => set("reports_to_position_id", next)}
            >
              <SelectTrigger id="position-reports-to" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nobody — a top-level seat</SelectItem>
                {parents.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.title} ({row.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="position-cost-centre" label="Cost centre" optional>
            <Select
              value={values.cost_centre_id}
              onValueChange={(next) => set("cost_centre_id", next)}
            >
              <SelectTrigger id="position-cost-centre" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {(costCentres.data ?? [])
                  .filter((row) => row.is_active)
                  .map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name} ({row.code})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField htmlFor="position-grade" label="Grade" optional>
            <Input
              id="position-grade"
              value={values.grade}
              onChange={(event) => set("grade", event.target.value)}
              placeholder="M2"
            />
          </FormField>
          <FormField htmlFor="position-fte" label="FTE" error={errors.fte}>
            <Input
              id="position-fte"
              value={values.fte}
              onChange={(event) => set("fte", event.target.value)}
              inputMode="decimal"
            />
          </FormField>

          <FormField
            htmlFor="position-ctc-min"
            label="Budgeted CTC floor"
            optional
            error={errors.budgeted_ctc_min}
          >
            <Input
              id="position-ctc-min"
              value={values.budgeted_ctc_min}
              onChange={(event) => set("budgeted_ctc_min", event.target.value.trim())}
              inputMode="decimal"
              placeholder="900000"
            />
          </FormField>
          <FormField
            htmlFor="position-ctc-max"
            label="Budgeted CTC ceiling"
            optional
            error={errors.budgeted_ctc_max}
            hint="Offers above the ceiling need an extra approval."
          >
            <Input
              id="position-ctc-max"
              value={values.budgeted_ctc_max}
              onChange={(event) => set("budgeted_ctc_max", event.target.value.trim())}
              inputMode="decimal"
              placeholder="1400000"
            />
          </FormField>

          {!editing && (
            <FormField htmlFor="position-effective" label="Exists from">
              <DatePicker
                id="position-effective"
                value={values.effective_from}
                onChange={(picked) => set("effective_from", picked)}
              />
            </FormField>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || invalid}>
            {isBusy && <Loader2 className="animate-spin" />}
            {editing ? "Save changes" : "Create position"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
