"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Wallet } from "lucide-react";
import React, { useEffect, useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { SalaryHistoryList } from "@/components/pay/SalaryHistoryList";
import { AssignSalaryDialog } from "@/components/payroll/AssignSalaryDialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Page } from "@/lib/types";
import type { SalaryOverview, SalaryRecord, SalaryStructure } from "@/lib/types/payroll";
import { formatDay } from "@/lib/utils";

const PAGE_SIZE = 25;

/** Who is on what salary today, and every revision before it. */
export default function SalariesPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [editing, setEditing] = useState<SalaryOverview | null>(null);
  const [historyFor, setHistoryFor] = useState<SalaryOverview | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const overview = useApiQuery<Page<SalaryOverview>>(
    `/salaries?page=${page}&page_size=${pageSize}${debounced ? `&search=${encodeURIComponent(debounced)}` : ""}`,
  );
  const structures = useApiQuery<SalaryStructure[]>("/salary-structures");
  const history = useApiQuery<SalaryRecord[]>(
    historyFor ? `/employees/${historyFor.employee_id}/salary/history` : null,
  );
  const structureName = (id: string) => structures.data?.find((s) => s.id === id)?.name;
  const structureOf = (row: SalaryOverview) =>
    row.current_salary
      ? (row.current_salary.structure_name ?? structureName(row.current_salary.structure_id) ?? "—")
      : null;

  const columns: ColumnDef<SalaryOverview>[] = [
    {
      accessorKey: "employee_name",
      header: "Employee",
      meta: { text: (row) => `${row.employee_name} ${row.employee_code}` },
      cell: ({ row }) => (
        <PersonCell
          name={row.original.employee_name}
          subtitle={`${row.original.employee_code}${row.original.designation ? ` · ${row.original.designation}` : ""}`}
        />
      ),
    },
    {
      id: "structure",
      header: "Structure",
      accessorFn: (row) => structureOf(row) ?? "No salary assigned",
      meta: { cellClassName: "text-sm" },
      cell: ({ row }) =>
        structureOf(row.original) ?? <span className="text-muted-foreground">No salary assigned</span>,
    },
    {
      id: "ctc_annual",
      header: "Annual CTC",
      accessorFn: (row) => row.current_salary?.ctc_annual ?? null,
      meta: { className: "text-right" },
      cell: ({ row }) =>
        row.original.current_salary ? <Money value={row.original.current_salary.ctc_annual} /> : "—",
    },
    {
      id: "since",
      header: "Since",
      accessorFn: (row) => row.current_salary?.effective_from ?? null,
      meta: { cellClassName: "text-sm" },
      cell: ({ row }) =>
        row.original.current_salary ? formatDay(row.original.current_salary.effective_from, true) : "—",
    },
    {
      id: "actions",
      header: "Actions",
      enableHiding: false,
      meta: { className: "text-right", text: false },
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setHistoryFor(row.original)}>
            History
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(row.original)}>
            {row.original.current_salary ? "Revise" : "Assign"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageShell title="Salaries" description="Assign and revise salaries. Every revision is effective-dated and audited.">
      <DataTable
        title="Employees"
        columns={columns}
        data={overview.data?.items ?? []}
        getRowId={(row) => row.employee_id}
        noun="employees"
        exportName="salaries"
        isLoading={overview.isLoading && !overview.data}
        error={overview.error?.detail}
        onRetry={overview.reload}
        empty={{
          icon: Wallet,
          title: "No employees yet",
          description: "Employees appear here once they are added to the directory.",
        }}
        emptyMessage="Nobody matches that search."
        searchPlaceholder="Search by name or code"
        search={search}
        onSearchChange={setSearch}
        server={{
          page,
          pageSize,
          total: overview.data?.total ?? 0,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
        }}
      />

      <AssignSalaryDialog
        employee={editing}
        structures={(structures.data ?? []).filter((s) => s.active)}
        onClose={() => setEditing(null)}
        onSaved={overview.reload}
      />

      <Sheet open={historyFor !== null} onOpenChange={(open) => !open && setHistoryFor(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{historyFor?.employee_name}</SheetTitle>
            <SheetDescription>Every salary this person has been on, newest first.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <SalaryHistoryList
              rows={history.data ?? []}
              isLoading={history.isLoading && !history.data}
              error={history.error?.detail}
              onRetry={history.reload}
              structureName={structureName}
            />
          </div>
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
