"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { List, Plus, Upload, Wallet } from "lucide-react";
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
import { BulkUploadDialog } from "@/components/payroll/salary-master/BulkUploadDialog";
import { EmployeeSearch } from "@/components/payroll/salary-master/EmployeeSearch";
import { RevisionTimeline } from "@/components/payroll/salary-master/RevisionTimeline";
import { type EditorMode, SalaryEditor } from "@/components/payroll/salary-master/SalaryEditor";
import { SalaryTrail } from "@/components/payroll/salary-master/SalaryTrail";
import { StandardSetupCallout } from "@/components/payroll/salary-master/StandardSetupCallout";
import { addDays, periodName, revisionDate } from "@/components/payroll/salary-master/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/useApiQuery";
import { del, downloadFile, get } from "@/lib/api";
import type { EmployeeSummary, EmploymentStatus, Page } from "@/lib/types";
import type {
  SalaryComponent,
  SalaryOverview,
  SalaryRevision,
  SalaryStructure,
  StandardStatus,
} from "@/lib/types/payroll";
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
  const [bulkOpen, setBulkOpen] = useState(false);
  // Bumped after a bulk upload so the list of employees shows the new salaries.
  const [listVersion, setListVersion] = useState(0);
  const [tab, setTab] = useState("revisions");

  // Arriving by link (or after a reload) gives only the id: fetch the person.
  const fetched = useApiQuery<EmployeeSummary>(
    employeeId && picked?.id !== employeeId ? `/employees/${employeeId}` : null,
  );
  const employee = employeeId ? (picked?.id === employeeId ? picked : fetched.data) : null;

  const revisions = useApiQuery<SalaryRevision[]>(employeeId ? `/employees/${employeeId}/salary/revisions` : null);
  const structures = useApiQuery<SalaryStructure[]>("/salary-structures");
  const components = useApiQuery<SalaryComponent[]>("/salary-components");
  const standard = useApiQuery<StandardStatus>("/salary-components/standard");

  const nameOf = (code: string) => components.data?.find((c) => c.code === code)?.name ?? code;
  const setupDone = () => {
    structures.reload();
    components.reload();
    standard.reload();
  };

  const choose = (person: EmployeeSummary | null) => {
    setPicked(person);
    setTab("revisions");
    router.replace(person ? `${pathname}?employee=${person.id}` : pathname);
  };

  const list = revisions.data ?? [];
  const openNew = () => {
    const latest = list[0] ?? null;
    setEditor({
      kind: "new",
      base: latest,
      min: latest ? addDays(latest.effective_from, 1) : undefined,
    });
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
      const result = await del<{ runs_to_recompute: string[] }>(`/employees/${employee.id}/salary/${deleting.id}`);
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
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload /> Bulk upload
          </Button>
          {employeeId && (
            <Button variant="outline" className="ml-auto" onClick={() => choose(null)}>
              <List /> List of employees
            </Button>
          )}
        </CardContent>
      </Card>

      {standard.data && !standard.data.complete && <StandardSetupCallout status={standard.data} onDone={setupDone} />}

      {!employeeId ? (
        <EmployeeList key={listVersion} onOpen={choose} />
      ) : fetched.error ? (
        <ErrorState message={fetched.error.detail} onRetry={fetched.reload} />
      ) : revisions.error ? (
        <ErrorState message={revisions.error.detail} onRetry={revisions.reload} />
      ) : revisions.isLoading && !revisions.data ? (
        <div className="grid gap-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="revisions">Revisions ({list.length})</TabsTrigger>
            <TabsTrigger value="history">Change history</TabsTrigger>
          </TabsList>
          <TabsContent value="revisions" className="mt-4">
            {list.length === 0 ? (
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
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            {employeeId && <SalaryTrail employeeId={employeeId} nameOf={nameOf} />}
          </TabsContent>
        </Tabs>
      )}

      {employee && (
        <SalaryEditor
          employee={employee}
          mode={editor}
          structures={structures.data ?? []}
          standard={standard.data}
          components={components.data ?? []}
          onClose={() => setEditor(null)}
          onSaved={revisions.reload}
          onEdit={openEdit}
          onSetupDone={setupDone}
        />
      )}

      <BulkUploadDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onDone={() => {
          revisions.reload();
          setListVersion((version) => version + 1);
        }}
      />

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

  const searchQuery = debounced ? `&search=${encodeURIComponent(debounced)}` : "";
  const overview = useApiQuery<Page<SalaryOverview>>(`/salaries?page=${page}&page_size=${pageSize}${searchQuery}`);

  /** Everyone the list holds (with the search applied), page by page. */
  const fetchAll = async (): Promise<SalaryOverview[]> => {
    const everyone: SalaryOverview[] = [];
    for (let next = 1; ; next += 1) {
      const chunk = await get<Page<SalaryOverview>>(`/salaries?page=${next}&page_size=200${searchQuery}`);
      everyone.push(...chunk.items);
      if (chunk.items.length === 0 || everyone.length >= chunk.total) return everyone;
    }
  };

  /**
   * The present salary of the ticked people, every detail, as an Excel sheet in
   * the bulk-upload layout. Nothing ticked: everyone the list shows.
   */
  const exportSalaries = async (selected: SalaryOverview[] | null) => {
    try {
      const chosen = selected ?? (debounced ? await fetchAll() : null);
      if (chosen && chosen.length === 0) {
        toast.error("Nobody matches that search.");
        return;
      }
      await downloadFile("/salaries/export", "EmployeeSalaryMaster.xlsx", {
        method: "POST",
        body: { employee_ids: chosen ? chosen.map((row) => row.employee_id) : null },
      });
      const count = chosen ? chosen.length : (overview.data?.total ?? 0);
      toast.success(`Exported the salary of ${count} employee${count === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(apiMessage(error, "Could not export the salaries."));
    }
  };

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
          <span className="text-muted-foreground">{row.original.current_salary ? "—" : "No salary assigned"}</span>
        ),
    },
    {
      id: "ctc_annual",
      header: "Annual CTC",
      accessorFn: (row) => row.current_salary?.ctc_annual ?? null,
      meta: { className: "text-right" },
      cell: ({ row }) => (row.original.current_salary ? <Money value={row.original.current_salary.ctc_annual} /> : "—"),
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
      exportName="salary-master"
      onExport={exportSalaries}
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
        fetchAll,
        onPageChange: setPage,
        onPageSizeChange: (size) => {
          setPageSize(size);
          setPage(1);
        },
      }}
    />
  );
}
