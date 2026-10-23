"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { List, Plus, Wallet } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Money } from "@/components/common/Money";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { apiMessage } from "@/components/payroll/labels";
import { EmployeeSearch } from "@/components/payroll/salary-master/EmployeeSearch";
import { RevisionTimeline } from "@/components/payroll/salary-master/RevisionTimeline";
import { type EditorMode, SalaryEditor } from "@/components/payroll/salary-master/SalaryEditor";
import { addDays, periodName, revisionDate } from "@/components/payroll/salary-master/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { del, downloadFile } from "@/lib/api";
import type { EmployeeSummary, EmploymentStatus, Page } from "@/lib/types";
import type { SalaryComponent, SalaryOverview, SalaryRevision, SalaryStructure } from "@/lib/types/payroll";
import { formatDay } from "@/lib/utils";

const PAGE_SIZE = 25;

/** Salary master: search a person, see every salary revision, add or correct one. */
export default function SalaryMasterPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SalaryMaster />
    </Suspense>
  );
}

function SalaryMaster() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const employeeId = params.get("employee");

  const [picked, setPicked] = useState<EmployeeSummary | null>(null);
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [deleting, setDeleting] = useState<SalaryRevision | null>(null);

  // Arriving by link (or after a reload) gives only the id: fetch the person.
  const fetched = useApiQuery<EmployeeSummary>(
    employeeId && picked?.id !== employeeId ? `/employees/${employeeId}` : null,
  );
  const employee = employeeId ? (picked?.id === employeeId ? picked : fetched.data) : null;

  const revisions = useApiQuery<SalaryRevision[]>(
    employeeId ? `/employees/${employeeId}/salary/revisions` : null,
  );
  const structures = useApiQuery<SalaryStructure[]>("/salary-structures");
  const components = useApiQuery<SalaryComponent[]>("/salary-components");

  const choose = (person: EmployeeSummary | null) => {
    setPicked(person);
    router.replace(person ? `${pathname}?employee=${person.id}` : pathname);
  };

  const list = revisions.data ?? [];
  const openNew = () => {
    const latest = list[0] ?? null;
    setEditor({ kind: "new", base: latest, min: latest ? addDays(latest.effective_from, 1) : undefined });
  };
  const openEdit = (revision: SalaryRevision) => {
    const index = list.findIndex((r) => r.id === revision.id);
    const newer = index > 0 ? list[index - 1] : null;
    const older = list[index + 1] ?? null;
    setEditor({
      kind: "edit",
      revision,
      hasLater: newer !== null,
      min: older ? addDays(older.effective_from, 1) : undefined,
      max: newer ? addDays(newer.effective_from, -1) : undefined,
    });
  };

  const confirmDelete = async () => {
    if (!employee || !deleting) return;
    try {
      const result = await del<{ runs_to_recompute: string[] }>(
        `/employees/${employee.id}/salary/${deleting.id}`,
      );
      const runs = result?.runs_to_recompute ?? [];
      if (runs.length) {
        toast.warning("Revision deleted.", {
          description: `Recompute payroll for ${runs.map(periodName).join(", ")} to pick this up.`,
          duration: 12000,
        });
      } else {
        toast.success("Revision deleted.");
      }
      revisions.reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "Could not delete the revision."));
      throw caught;
    }
  };

  const deletingIndex = deleting ? list.findIndex((r) => r.id === deleting.id) : -1;
  const before = deletingIndex >= 0 ? (list[deletingIndex + 1] ?? null) : null;

  return (
    <PageShell
      title="Salary master"
      description="Search a person to see every salary revision. Add a new one, or correct one payroll has not paid yet."
    >
      <Card tier="tier1" className="py-4">
        <CardContent className="flex flex-wrap items-center gap-3 px-4">
          <EmployeeSearch value={employee ?? null} onChange={choose} className="max-w-xl flex-1 basis-80" />
          <Button disabled={!employee || revisions.isLoading} onClick={openNew}>
            <Plus /> {revisions.data && list.length === 0 ? "Assign salary" : "New revision"}
          </Button>
          {employeeId && (
            <Button variant="outline" className="ml-auto" onClick={() => choose(null)}>
              <List /> List of employees
            </Button>
          )}
        </CardContent>
      </Card>

      {!employeeId ? (
        <EmployeeList onOpen={choose} />
      ) : fetched.error ? (
        <ErrorState message={fetched.error.detail} onRetry={fetched.reload} />
      ) : revisions.error ? (
        <ErrorState message={revisions.error.detail} onRetry={revisions.reload} />
      ) : revisions.isLoading && !revisions.data ? (
        <div className="grid gap-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : list.length === 0 ? (
        <Card tier="tier1">
          <EmptyState
            icon={Wallet}
            title="No salary yet"
            description="Assign this person's first salary: pick a structure, enter the CTC, and type any amounts that differ."
            action={
              <Button disabled={!employee} onClick={openNew}>
                <Plus /> Assign salary
              </Button>
            }
          />
        </Card>
      ) : (
        <RevisionTimeline
          revisions={list}
          onView={(revision) => setEditor({ kind: "view", revision })}
          onEdit={openEdit}
          onDelete={setDeleting}
          onDownload={(revision) => {
            if (!employee) return;
            void downloadFile(
              `/employees/${employee.id}/salary/${revision.id}/attachment`,
              revision.attachment_name ?? "salary-revision",
            ).catch((caught) => toast.error(apiMessage(caught, "Could not download the file.")));
          }}
        />
      )}

      {employee && (
        <SalaryEditor
          employee={employee}
          mode={editor}
          structures={structures.data ?? []}
          components={components.data ?? []}
          onClose={() => setEditor(null)}
          onSaved={revisions.reload}
          onEdit={openEdit}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete the revision from ${revisionDate(deleting.effective_from)}?` : "Delete revision"}
        description={
          deleting
            ? before
              ? `The revision from ${revisionDate(before.effective_from)} will apply in its place. This is recorded in the audit log.`
              : "This person will have no salary from that date. This is recorded in the audit log."
            : undefined
        }
        confirmLabel="Delete revision"
        destructive
        onConfirm={confirmDelete}
      />
    </PageShell>
  );
}

/** Everyone and the salary they are on today. Picking a row opens their revisions. */
function EmployeeList({ onOpen }: { onOpen: (employee: EmployeeSummary) => void }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

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

  const open = (row: SalaryOverview) =>
    onOpen({
      id: row.employee_id,
      employee_code: row.employee_code,
      first_name: row.employee_name,
      last_name: null,
      display_name: row.employee_name,
      work_email: row.work_email ?? "",
      designation: row.designation,
      department_id: null,
      manager_id: null,
      photo_url: row.photo_url ?? null,
      status: row.status as EmploymentStatus,
    });

  const columns: ColumnDef<SalaryOverview>[] = [
    {
      accessorKey: "employee_name",
      header: "Employee",
      meta: { text: (row) => `${row.employee_name} ${row.employee_code}` },
      cell: ({ row }) => (
        <PersonCell
          name={row.original.employee_name}
          photoUrl={row.original.photo_url}
          subtitle={`${row.original.employee_code}${row.original.designation ? ` · ${row.original.designation}` : ""}`}
        />
      ),
    },
    {
      id: "structure",
      header: "Structure",
      accessorFn: (row) => row.current_salary?.structure_name ?? "No salary assigned",
      meta: { cellClassName: "text-sm" },
      cell: ({ row }) =>
        row.original.current_salary?.structure_name ?? (
          <span className="text-muted-foreground">
            {row.original.current_salary ? "—" : "No salary assigned"}
          </span>
        ),
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
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              open(row.original);
            }}
          >
            {row.original.current_salary ? "Open" : "Assign"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      title="List of employees"
      description="The salary each person is on today. Open one to see every revision."
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
      onRowClick={open}
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
  );
}
