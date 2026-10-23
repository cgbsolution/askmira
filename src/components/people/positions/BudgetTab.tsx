"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Info, Landmark, Loader2, Plus, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post, put } from "@/lib/api";
import type {
  BudgetUpsertResult,
  BudgetView,
  CostCentre,
  HeadcountBudget,
  HeadcountTotals,
} from "@/lib/types/people";

import { NONE, apiMessage, currentFinancialYear, fromSelect } from "../labels";
import { useOrgReference } from "../useOrgReference";

interface CostGap {
  scope: string;
  budgeted_cost: string;
  actual_cost: string;
  gap: string;
}

/** One department's line in the headcount view: its name, then its totals. */
type DepartmentHeadcount = HeadcountTotals & { department: string };

const NUMBER_META = { className: "text-right", cellClassName: "tabular-nums" };

const HEADCOUNT_COLUMNS: ColumnDef<DepartmentHeadcount>[] = [
  { accessorKey: "department", header: "Department", meta: { cellClassName: "font-medium text-foreground" } },
  { accessorKey: "approved_fte", header: "Approved FTE", sortingFn: "alphanumeric", meta: NUMBER_META },
  { accessorKey: "filled_fte", header: "Filled", sortingFn: "alphanumeric", meta: NUMBER_META },
  { accessorKey: "vacant_fte", header: "Vacant", sortingFn: "alphanumeric", meta: NUMBER_META },
  { accessorKey: "frozen_fte", header: "Frozen", sortingFn: "alphanumeric", meta: NUMBER_META },
  {
    accessorKey: "people",
    header: "People",
    meta: NUMBER_META,
    cell: ({ row }) => (
      <>
        {row.original.people}
        {row.original.covered_only > 0 && (
          <div className="text-[11px] text-muted-foreground">+{row.original.covered_only} covered only</div>
        )}
      </>
    ),
  },
];

const COST_COLUMNS: ColumnDef<CostGap>[] = [
  { accessorKey: "scope", header: "Department", meta: { cellClassName: "font-medium text-foreground" } },
  {
    accessorKey: "budgeted_cost",
    header: "Budgeted",
    sortingFn: "alphanumeric",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.budgeted_cost} />,
  },
  {
    accessorKey: "actual_cost",
    header: "Actual",
    sortingFn: "alphanumeric",
    meta: { className: "text-right" },
    cell: ({ row }) => <Money value={row.original.actual_cost} />,
  },
  {
    accessorKey: "gap",
    header: "Headroom",
    // A signed decimal string: sorted by value, so -5 comes before -1.
    sortingFn: (a, b, id) => Number(a.getValue(id)) - Number(b.getValue(id)),
    meta: { className: "text-right" },
    cell: ({ row }) => (
      <Money value={row.original.gap} className={row.original.gap.startsWith("-") ? "text-destructive" : undefined} />
    ),
  },
];

const CENTRE_COLUMNS: ColumnDef<CostCentre>[] = [
  { accessorKey: "name", header: "Cost centre", meta: { cellClassName: "font-medium text-foreground" } },
  { accessorKey: "code", header: "Code", meta: { cellClassName: "font-mono text-xs" } },
  {
    id: "status",
    header: "Status",
    accessorFn: (row) => (row.is_active ? "Active" : "Inactive"),
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? "secondary" : "outline"}>
        {row.original.is_active ? "Active" : "Inactive"}
      </Badge>
    ),
  },
];

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
  // Payroll-only in the semantic layer: admins, not sub-admins.
  const canSeeCost = hasRole("admin");
  const canManage = hasRole("admin");
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

  const totals: DepartmentHeadcount[] = Object.entries(view.data?.totals ?? {}).map(([department, row]) => ({
    ...row,
    department,
  }));
  const costRows = (view.data?.cost ?? []) as CostGap[];
  const centreName = new Map((costCentres.data ?? []).map((row) => [row.id, row.name]));
  const scopeOf = (row: HeadcountBudget) =>
    row.department_id
      ? org.departmentName(row.department_id)
      : row.cost_centre_id
        ? `Cost centre: ${centreName.get(row.cost_centre_id) ?? "—"}`
        : "Whole workspace";

  const reviseColumn: ColumnDef<HeadcountBudget> = {
    id: "actions",
    header: "Actions",
    enableHiding: false,
    meta: { className: "text-right", text: false },
    cell: ({ row }) => (
      <Button variant="outline" size="sm" onClick={() => setBudgetForm({ open: true, editing: row.original })}>
        Revise
      </Button>
    ),
  };
  const budgetColumns: ColumnDef<HeadcountBudget>[] = [
    { accessorKey: "financial_year", header: "Year", meta: { cellClassName: "text-sm" } },
    {
      id: "scope",
      header: "Scope",
      accessorFn: scopeOf,
      meta: {
        cellClassName: "text-sm",
        text: (row) => (row.note ? `${scopeOf(row)} ${row.note}` : scopeOf(row)),
      },
      cell: ({ row }) => (
        <>
          {scopeOf(row.original)}
          {row.original.note && <div className="text-xs text-muted-foreground">{row.original.note}</div>}
        </>
      ),
    },
    {
      accessorKey: "approved_positions",
      header: "Positions",
      meta: { className: "text-right", cellClassName: "tabular-nums" },
    },
    {
      accessorKey: "approved_cost",
      header: "Cost",
      sortingFn: "alphanumeric",
      meta: { className: "text-right" },
      cell: ({ row }) => <Money value={row.original.approved_cost} />,
    },
    ...(canManage ? [reviseColumn] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        title="Headcount by department"
        description={
          view.data ? `${view.data.financial_year}, as of ${view.data.as_of}.` : undefined
        }
        columns={HEADCOUNT_COLUMNS}
        data={totals}
        getRowId={(row) => row.department}
        noun="departments"
        exportName="headcount-by-department"
        searchPlaceholder="Search departments"
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
        empty={{ icon: Landmark, title: "No positions to count yet" }}
      />

      {view.data?.cost_note && !includeCost && canSeeCost && (
        <Alert>
          <Info />
          <AlertTitle>Cost is off</AlertTitle>
          <AlertDescription>{view.data.cost_note}</AlertDescription>
        </Alert>
      )}

      {includeCost && costRows.length > 0 && (
        <DataTable
          title="Budgeted against actual cost"
          description="Budgeted is each seat's CTC ceiling times its FTE; actual is what the people in those seats cost."
          columns={COST_COLUMNS}
          data={costRows}
          getRowId={(row) => row.scope}
          noun="departments"
          exportName="budgeted-against-actual-cost"
          searchPlaceholder="Search departments"
        />
      )}

      <DataTable
        title="Approved budgets"
        description="New seats and fills are refused where they would exceed these. A budget cut below what exists is saved — it is a decision — and flagged."
        columns={budgetColumns}
        data={budgets.data ?? []}
        noun="budgets"
        exportName="headcount-budgets"
        searchPlaceholder="Search budgets"
        actions={
          canManage ? (
            <Button size="sm" className="h-9" onClick={() => setBudgetForm({ open: true, editing: null })}>
              <Plus /> Set a budget
            </Button>
          ) : undefined
        }
        isLoading={budgets.isLoading}
        error={budgets.error?.detail ?? null}
        onRetry={budgets.reload}
        empty={{
          icon: Wallet,
          title: "No headcount budgets set",
          description: "Without one, positions are created without a budget check.",
        }}
      />

      <DataTable
        title="Cost centres"
        columns={CENTRE_COLUMNS}
        data={costCentres.data ?? []}
        noun="cost centres"
        exportName="cost-centres"
        searchPlaceholder="Search cost centres"
        actions={
          canManage ? (
            <Button size="sm" variant="outline" className="h-9" onClick={() => setAddingCentre(true)}>
              <Plus /> Add cost centre
            </Button>
          ) : undefined
        }
        isLoading={costCentres.isLoading}
        error={costCentres.error?.detail ?? null}
        onRetry={costCentres.reload}
        empty={{ icon: Landmark, title: "No cost centres" }}
      />

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
