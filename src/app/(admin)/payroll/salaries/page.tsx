"use client";

import { Search, Wallet } from "lucide-react";
import React, { useEffect, useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { SalaryHistoryList } from "@/components/pay/SalaryHistoryList";
import { AssignSalaryDialog } from "@/components/payroll/AssignSalaryDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    `/salaries?page=${page}&page_size=${PAGE_SIZE}${debounced ? `&search=${encodeURIComponent(debounced)}` : ""}`,
  );
  const structures = useApiQuery<SalaryStructure[]>("/salary-structures");
  const history = useApiQuery<SalaryRecord[]>(
    historyFor ? `/employees/${historyFor.employee_id}/salary/history` : null,
  );
  const structureName = (id: string) => structures.data?.find((s) => s.id === id)?.name;

  const rows = overview.data?.items ?? [];
  const pages = overview.data ? Math.max(1, Math.ceil(overview.data.total / PAGE_SIZE)) : 1;

  return (
    <PageShell title="Salaries" description="Assign and revise salaries. Every revision is effective-dated and audited.">
      <DataPanel
        title="Employees"
        toolbar={
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search by name or code"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search employees"
            />
          </div>
        }
        isLoading={overview.isLoading && !overview.data}
        error={overview.error?.detail}
        onRetry={overview.reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: Wallet,
          title: debounced ? "Nobody matches that search" : "No employees yet",
          description: debounced ? undefined : "Employees appear here once they are added to the directory.",
        }}
        footer={
          overview.data && overview.data.total > PAGE_SIZE ? (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {page} of {pages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Structure</TableHead>
                <TableHead className="text-right">Annual CTC</TableHead>
                <TableHead>Since</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.employee_id}>
                  <TableCell>
                    <PersonCell
                      name={row.employee_name}
                      subtitle={`${row.employee_code}${row.designation ? ` · ${row.designation}` : ""}`}
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.current_salary
                      ? (row.current_salary.structure_name ?? structureName(row.current_salary.structure_id) ?? "—")
                      : <span className="text-muted-foreground">No salary assigned</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.current_salary ? <Money value={row.current_salary.ctc_annual} /> : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.current_salary ? formatDay(row.current_salary.effective_from, true) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setHistoryFor(row)}>
                        History
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                        {row.current_salary ? "Revise" : "Assign"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DataPanel>

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
