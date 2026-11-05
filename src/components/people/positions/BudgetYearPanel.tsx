"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Handshake, Landmark } from "lucide-react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { DataPanel } from "@/components/common/DataPanel";
import { Money } from "@/components/common/Money";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useApiQuery } from "@/hooks/useApiQuery";

interface PurchaseBudget {
  cost_center: string;
  allocated: string;
  committed: string;
  consumed: string;
  available: string;
}

interface DepartmentYear {
  department_id: string;
  department: string;
  approved_positions: number | null;
  positions_filled: string | null;
  positions_left: string | null;
  approved_cost: string | null;
  committed_on_positions: string | null;
  people_cost_left: string | null;
  payroll_paid: string | null;
  expenses: string | null;
  purchase_budget: PurchaseBudget | null;
}

interface BudgetYear {
  financial_year: string;
  as_of: string;
  departments: DepartmentYear[];
  payroll_visible: boolean;
  payroll_unassigned: string | null;
  expenses: { source: string; note: string | null; unassigned: string | null };
  purchasing: { note: string | null; other_cost_centres: (PurchaseBudget & { code?: string })[] } | null;
  sales: {
    stages: { stage: string; label: string; deals: number; amount: string }[];
    open_pipeline?: string;
    won?: string;
    scope?: string;
    note: string | null;
  } | null;
}

const RIGHT = { className: "text-right", cellClassName: "tabular-nums" };

function amount(value: string | null | undefined) {
  return value === null || value === undefined ? <span className="text-muted-foreground">—</span> : <Money value={value} />;
}

/**
 * Employees → Positions → Budget: each department's year so far, beside its budget.
 *
 * Every figure comes from the system that owns it — the headcount budget and
 * payroll from AskMira, expenses from Expense Genie (or AskMira), purchasing
 * from ProcureFlow, the pipeline from Saleinx — and they sit side by side.
 * They are different budgets, so nothing is added into one "remaining" figure.
 */
export function BudgetYearPanel() {
  const { data, error, isLoading, reload } = useApiQuery<BudgetYear>("/positions/budget/year");
  const expenseSource = data?.expenses.source ?? "AskMira";
  const showPurchasing = data?.purchasing !== null && data?.purchasing !== undefined;

  const columns: ColumnDef<DepartmentYear>[] = [
    { accessorKey: "department", header: "Department", meta: { cellClassName: "font-medium text-foreground" } },
    {
      id: "positions",
      header: "Filled / approved",
      meta: RIGHT,
      accessorFn: (row) => row.positions_filled ?? "",
      cell: ({ row }) =>
        row.original.approved_positions === null ? (
          <span className="text-muted-foreground">No budget</span>
        ) : (
          `${row.original.positions_filled} / ${row.original.approved_positions}`
        ),
    },
    {
      id: "people_cost",
      header: "People cost",
      meta: RIGHT,
      accessorFn: (row) => row.committed_on_positions ?? "",
      cell: ({ row }) => {
        const { committed_on_positions: committed, approved_cost: approved } = row.original;
        if (!approved) return <span className="text-muted-foreground">—</span>;
        const over = Number(committed ?? 0) > Number(approved);
        return (
          <>
            <Money value={committed ?? "0"} className={over ? "text-destructive" : undefined} />
            <div className="text-xs text-muted-foreground">
              of <Money value={approved} />
              {over ? " · over budget" : ""}
            </div>
          </>
        );
      },
    },
    ...(data?.payroll_visible
      ? [
          {
            accessorKey: "payroll_paid",
            header: "Payroll paid",
            meta: RIGHT,
            cell: ({ row }) => amount(row.original.payroll_paid),
          } as ColumnDef<DepartmentYear>,
        ]
      : []),
    {
      accessorKey: "expenses",
      header: "Expenses",
      meta: RIGHT,
      cell: ({ row }) => amount(row.original.expenses),
    },
    ...(showPurchasing
      ? [
          {
            id: "purchasing",
            header: "Purchasing left",
            meta: RIGHT,
            accessorFn: (row) => row.purchase_budget?.available ?? "",
            cell: ({ row }) =>
              row.original.purchase_budget ? (
                <>
                  <Money value={row.original.purchase_budget.available} />
                  <div className="text-xs text-muted-foreground">
                    of <Money value={row.original.purchase_budget.allocated} />
                  </div>
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          } as ColumnDef<DepartmentYear>,
        ]
      : []),
  ];

  const notes = [
    data?.expenses.note,
    data?.expenses.unassigned ? `Expenses not matched to a department: ₹${data.expenses.unassigned}.` : null,
    data?.payroll_unassigned ? `Payroll for people with no department: ₹${data.payroll_unassigned}.` : null,
    data?.purchasing?.note,
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        title={`This year against budget${data ? ` · ${data.financial_year}` : ""}`}
        description={`Positions and people cost from the headcount budget, payroll paid from AskMira, expenses from ${expenseSource}${showPurchasing ? ", purchasing from ProcureFlow cost centres of the same name" : ""}. Different budgets, shown side by side, never added into one number.`}
        columns={columns}
        data={data?.departments ?? []}
        getRowId={(row) => row.department_id}
        noun="departments"
        exportName="department-budgets"
        searchPlaceholder="Search departments"
        isLoading={isLoading}
        error={error?.detail}
        onRetry={reload}
        empty={{
          icon: Landmark,
          title: "No departments with a budget or spend yet",
          description: "Set a headcount budget above, and spend appears here as it happens.",
        }}
      />
      {notes.length > 0 && (
        <Alert>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {data?.purchasing && data.purchasing.other_cost_centres.length > 0 && (
        <DataPanel title="Other ProcureFlow cost centres" description="Cost centres whose name is not a department here.">
          <ul className="divide-y divide-border">
            {data.purchasing.other_cost_centres.map((centre) => (
              <li key={centre.cost_center} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="font-medium text-foreground">{centre.cost_center}</span>
                <span className="tabular-nums text-muted-foreground">
                  <Money value={centre.available} /> available of <Money value={centre.allocated} />
                </span>
              </li>
            ))}
          </ul>
        </DataPanel>
      )}
      {data?.sales && (
        <DataPanel
          title="Sales pipeline (Saleinx)"
          description={data.sales.note ?? `Deals by stage, ${data.sales.scope ?? ""}. Shown beside the budget, not added to it.`}
        >
          {data.sales.stages.length > 0 ? (
            <div className="grid gap-3 p-5 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Open pipeline</p>
                <p className="text-lg font-semibold tabular-nums">{amount(data.sales.open_pipeline)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Won</p>
                <p className="text-lg font-semibold tabular-nums">{amount(data.sales.won)}</p>
              </div>
              <ul className="text-xs text-muted-foreground sm:col-span-3">
                {data.sales.stages.map((stage) => (
                  <li key={stage.stage} className="flex justify-between border-b border-border py-1 last:border-0">
                    <span>
                      <Handshake className="mr-1 inline size-3" aria-hidden />
                      {stage.label} · {stage.deals} deal{stage.deals === 1 ? "" : "s"}
                    </span>
                    <Money value={stage.amount} />
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="px-5 py-4 text-sm text-muted-foreground">No deals in Saleinx yet.</p>
          )}
        </DataPanel>
      )}
    </div>
  );
}
