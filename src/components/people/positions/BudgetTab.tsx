"use client";

import { Info, Landmark, Loader2, Plus, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Money } from "@/components/common/Money";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post, put } from "@/lib/api";
import type {
  BudgetUpsertResult,
  BudgetView,
  CostCentre,
  HeadcountBudget,
} from "@/lib/types/people";

import { NONE, apiMessage, currentFinancialYear, fromSelect } from "../labels";
import { useOrgReference } from "../useOrgReference";

interface CostGap {
  scope: string;
  budgeted_cost: string;
  actual_cost: string;
  gap: string;
}

/**
 * Headcount budget: approved against filled against vacant, then the budgets
 * themselves and the cost centres they hang off.
 *
 * Cost is a separate switch because it needs payroll access — a planning view
 * that returned salaries to every manager would be a salary leak with a
 * planning name. The API refuses it for anyone without that access, and so the
 * switch is only offered to the roles that have it.
 */
export function BudgetTab() {
  const { hasRole } = useAuth();
  // Payroll-only in the semantic layer: tenant and HR admins, not HR ops.
  const canSeeCost = hasRole("tenant_admin", "hr_admin");
  const canManage = hasRole("tenant_admin", "hr_admin");
  const org = useOrgReference();

  const [includeCost, setIncludeCost] = useState(false);
  const view = useApiQuery<BudgetView>(
    `/positions/budget?by=department&include_cost=${includeCost ? "true" : "false"}`,
  );
  const budgets = useApiQuery<HeadcountBudget[]>("/positions/budgets");
  const costCentres = useApiQuery<CostCentre[]>("/positions/cost-centres");

  const [budgetForm, setBudgetForm] = useState<{ open: boolean; editing: HeadcountBudget | null }>({
    open: false,
    editing: null,
  });
  const [addingCentre, setAddingCentre] = useState(false);

  const totals = Object.entries(view.data?.totals ?? {});
  const costRows = (view.data?.cost ?? []) as CostGap[];
  const centreName = new Map((costCentres.data ?? []).map((row) => [row.id, row.name]));

  return (
    <div className="flex flex-col gap-4">
      <DataPanel
        title="Headcount by department"
        description={
          view.data ? `${view.data.financial_year}, as of ${view.data.as_of}.` : undefined
        }
        actions={
          canSeeCost ? (
            <div className="flex items-center gap-2">
              <Switch id="budget-cost" checked={includeCost} onCheckedChange={setIncludeCost} />
              <Label htmlFor="budget-cost" className="text-sm font-normal">
                Include cost
              </Label>
            </div>
          ) : undefined
        }
        isLoading={view.isLoading}
        error={view.error?.detail ?? null}
        onRetry={view.reload}
        isEmpty={totals.length === 0}
        empty={{ icon: Landmark, title: "No positions to count yet" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Approved FTE</TableHead>
              <TableHead className="text-right">Filled</TableHead>
              <TableHead className="text-right">Vacant</TableHead>
              <TableHead className="text-right">Frozen</TableHead>
              <TableHead className="text-right">People</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {totals.map(([key, row]) => (
              <TableRow key={key}>
                <TableCell className="font-medium text-foreground">{key}</TableCell>
                <TableCell className="text-right tabular-nums">{row.approved_fte}</TableCell>
                <TableCell className="text-right tabular-nums">{row.filled_fte}</TableCell>
                <TableCell className="text-right tabular-nums">{row.vacant_fte}</TableCell>
                <TableCell className="text-right tabular-nums">{row.frozen_fte}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.people}
                  {row.covered_only > 0 && (
                    <div className="text-[11px] text-muted-foreground">
                      +{row.covered_only} covered only
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      {view.data?.cost_note && !includeCost && canSeeCost && (
        <Alert>
          <Info />
          <AlertTitle>Cost is off</AlertTitle>
          <AlertDescription>{view.data.cost_note}</AlertDescription>
        </Alert>
      )}

      {includeCost && costRows.length > 0 && (
        <DataPanel title="Budgeted against actual cost" description="Budgeted is each seat's CTC ceiling times its FTE; actual is what the people in those seats cost.">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Budgeted</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Headroom</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costRows.map((row) => (
                <TableRow key={row.scope}>
                  <TableCell className="font-medium text-foreground">{row.scope}</TableCell>
                  <TableCell className="text-right">
                    <Money value={row.budgeted_cost} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={row.actual_cost} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money
                      value={row.gap}
                      className={row.gap.startsWith("-") ? "text-destructive" : undefined}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataPanel>
      )}

      <DataPanel
        title="Approved budgets"
        description="New seats and fills are refused where they would exceed these. A budget cut below what exists is saved — it is a decision — and flagged."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setBudgetForm({ open: true, editing: null })}>
              <Plus /> Set a budget
            </Button>
          ) : undefined
        }
        isLoading={budgets.isLoading}
        error={budgets.error?.detail ?? null}
        onRetry={budgets.reload}
        isEmpty={(budgets.data ?? []).length === 0}
        empty={{
          icon: Wallet,
          title: "No headcount budgets set",
          description: "Without one, positions are created without a budget check.",
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead className="text-right">Positions</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(budgets.data ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-sm">{row.financial_year}</TableCell>
                <TableCell className="text-sm">
                  {row.department_id
                    ? org.departmentName(row.department_id)
                    : row.cost_centre_id
                      ? `Cost centre: ${centreName.get(row.cost_centre_id) ?? "—"}`
                      : "Whole workspace"}
                  {row.note && <div className="text-xs text-muted-foreground">{row.note}</div>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.approved_positions}</TableCell>
                <TableCell className="text-right">
                  <Money value={row.approved_cost} />
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBudgetForm({ open: true, editing: row })}
                    >
                      Revise
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      <DataPanel
        title="Cost centres"
        actions={
          canManage ? (
            <Button size="sm" variant="outline" onClick={() => setAddingCentre(true)}>
              <Plus /> Add cost centre
            </Button>
          ) : undefined
        }
        isLoading={costCentres.isLoading}
        error={costCentres.error?.detail ?? null}
        onRetry={costCentres.reload}
        isEmpty={(costCentres.data ?? []).length === 0}
        empty={{ icon: Landmark, title: "No cost centres" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cost centre</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(costCentres.data ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                <TableCell className="font-mono text-xs">{row.code}</TableCell>
                <TableCell>
                  <Badge variant={row.is_active ? "secondary" : "outline"}>
                    {row.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      <BudgetDialog
        open={budgetForm.open}
        editing={budgetForm.editing}
        costCentres={costCentres.data ?? []}
        onOpenChange={(open) => setBudgetForm({ open, editing: open ? budgetForm.editing : null })}
        onSaved={() => {
          budgets.reload();
          view.reload();
        }}
      />
      <CostCentreDialog
        open={addingCentre}
        onOpenChange={setAddingCentre}
        onSaved={costCentres.reload}
      />
    </div>
  );
}

const FY = /^FY \d{4}-\d{2}$/;
const AMOUNT = /^\d+(\.\d{1,2})?$/;

function BudgetDialog({
  open,
  editing,
  costCentres,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  editing: HeadcountBudget | null;
  costCentres: CostCentre[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const org = useOrgReference();
  const [year, setYear] = useState(currentFinancialYear());
  const [department, setDepartment] = useState(NONE);
  const [centre, setCentre] = useState(NONE);
  const [positions, setPositions] = useState("0");
  const [cost, setCost] = useState("0");
  const [note, setNote] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setYear(editing?.financial_year ?? currentFinancialYear());
    setDepartment(editing?.department_id ?? NONE);
    setCentre(editing?.cost_centre_id ?? NONE);
    setPositions(String(editing?.approved_positions ?? 0));
    setCost(editing?.approved_cost ?? "0");
    setNote(editing?.note ?? "");
  }, [open, editing]);

  const yearOk = FY.test(year) && Number(year.slice(8, 10)) === (Number(year.slice(3, 7)) + 1) % 100;
  const invalid = !yearOk || !/^\d+$/.test(positions) || !AMOUNT.test(cost);

  const submit = async () => {
    setIsBusy(true);
    try {
      const result = await put<BudgetUpsertResult>("/positions/budgets", {
        financial_year: year,
        department_id: fromSelect(department),
        cost_centre_id: fromSelect(centre),
        approved_positions: Number(positions),
        approved_cost: cost,
        note: note.trim() || null,
      });
      if (result.over_budget.length > 0) {
        toast.warning(
          `Saved, but ${result.over_budget.length} scope${result.over_budget.length === 1 ? " is" : "s are"} already over it. New seats there will be refused until the numbers agree.`,
        );
      } else {
        toast.success("Budget saved.");
      }
      onSaved();
      onOpenChange(false);
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not save the budget."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Revise budget" : "Set a headcount budget"}</DialogTitle>
          <DialogDescription>
            One budget per year and scope. Saving the same year and scope again revises it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            htmlFor="budget-year"
            label="Financial year"
            error={year && !yearOk ? 'Written as "FY 2026-27".' : undefined}
          >
            <Input id="budget-year" value={year} onChange={(e) => setYear(e.target.value)} disabled={editing !== null} />
          </FormField>
          <FormField htmlFor="budget-department" label="Department" optional>
            <Select value={department} onValueChange={setDepartment} disabled={editing !== null}>
              <SelectTrigger id="budget-department" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Whole workspace</SelectItem>
                {org.departments.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="budget-centre" label="Cost centre" optional>
            <Select value={centre} onValueChange={setCentre} disabled={editing !== null}>
              <SelectTrigger id="budget-centre" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {costCentres.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="budget-positions" label="Approved positions">
            <Input id="budget-positions" value={positions} onChange={(e) => setPositions(e.target.value.trim())} inputMode="numeric" />
          </FormField>
          <FormField htmlFor="budget-cost-amount" label="Approved annual cost" hint="In rupees. Zero means no cost ceiling.">
            <Input id="budget-cost-amount" value={cost} onChange={(e) => setCost(e.target.value.trim())} inputMode="decimal" />
          </FormField>
          <FormField htmlFor="budget-note" label="Note" optional className="sm:col-span-2">
            <Textarea id="budget-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || invalid}>
            {isBusy && <Loader2 className="animate-spin" />} Save budget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CostCentreDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCode("");
      setName("");
    }
  }, [open]);

  const submit = async () => {
    setIsBusy(true);
    try {
      await post("/positions/cost-centres", { code: code.trim(), name: name.trim() });
      toast.success("Cost centre added.");
      onSaved();
      onOpenChange(false);
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not add the cost centre."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a cost centre</DialogTitle>
          <DialogDescription>Positions and budgets can be tagged to it.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="centre-name" label="Name">
            <Input id="centre-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Platform engineering" />
          </FormField>
          <FormField htmlFor="centre-code" label="Code">
            <Input id="centre-code" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" placeholder="CC-ENG-01" />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={isBusy || !name.trim() || !/^[A-Za-z0-9_\-/]+$/.test(code.trim())}
          >
            {isBusy && <Loader2 className="animate-spin" />} Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
