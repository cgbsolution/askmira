"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Building2, FolderKanban, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

import { DataTable } from "@/components/common/data-table/DataTable";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { RequireRole } from "@/components/common/RequireRole";
import { ExportEmployeesDialog } from "@/components/people/ExportEmployeesDialog";
import { EMPLOYMENT_STATUS, NONE, fromSelect, personName } from "@/components/people/labels";
import { MoveToCompanyDialog } from "@/components/people/MoveToCompanyDialog";
import { MoveToProjectDialog } from "@/components/people/MoveToProjectDialog";
import { EmploymentStatusBadge } from "@/components/people/StatusBadges";
import { useOrgReference } from "@/components/people/useOrgReference";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { HR } from "@/lib/access";
import { get } from "@/lib/api";
import type { EmploymentStatus, Page } from "@/lib/types";
import type { DirectoryEmployee } from "@/lib/types/people";

const PAGE_SIZE = 25;
/** The company filter's value for people with no company at all. */
const NO_COMPANY = "none";
/** A directory row with its reference names worked out. */
type DirectoryRow = DirectoryEmployee & {
  company_name: string;
  project_name: string;
  department_name: string;
  location_name: string;
};

/** The project filter's value for people on no project. */
const NO_PROJECT = "none";
/** The status filter's value for everybody who has not left (any status but exited). */
const CURRENT = "current";

/**
 * The company directory. Every colleague may browse it; it carries names,
 * titles, departments and work email — nothing personal.
 *
 * The header search lands here as `?search=`, and the filters stay in the URL
 * so a filtered view can be shared.
 */
export function DirectoryView() {
  const router = useRouter();
  const params = useSearchParams();
  const [orgVersion, setOrgVersion] = useState(0);
  const org = useOrgReference(orgVersion);
  const { hasRole } = useAuth();
  const isHr = hasRole(...HR);
  const [moving, setMoving] = useState<{ people: DirectoryEmployee[]; clear: () => void } | null>(
    null,
  );
  const [projecting, setProjecting] = useState<{
    people: DirectoryEmployee[];
    clear: () => void;
  } | null>(null);

  const [term, setTerm] = useState(params.get("search") ?? "");
  const [debounced, setDebounced] = useState(term);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const company = params.get("company") ?? NONE;
  const project = params.get("project") ?? NONE;
  const department = params.get("department") ?? NONE;
  const location = params.get("location") ?? NONE;
  const status = params.get("status") ?? NONE;
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  // The header search changes the URL while this page is open.
  useEffect(() => {
    const incoming = params.get("search") ?? "";
    setTerm(incoming);
    setDebounced(incoming);
  }, [params]);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === "" || value === NONE) next.delete(key);
      else next.set(key, value);
    });
    if (!("page" in changes)) next.delete("page");
    router.replace(`/people${next.toString() ? `?${next}` : ""}`);
  };

  useEffect(() => {
    if (term === debounced) return;
    const timer = setTimeout(() => {
      setDebounced(term);
      update({ search: term.trim() || null });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (debounced.trim()) query.set("search", debounced.trim());
  if (company === NO_COMPANY) query.set("without_legal_entity", "true");
  else if (fromSelect(company)) query.set("legal_entity_id", company);
  if (project === NO_PROJECT) query.set("without_project", "true");
  else if (fromSelect(project)) query.set("project_id", project);
  if (fromSelect(department)) query.set("department_id", department);
  if (fromSelect(location)) query.set("location_id", location);
  if (status === CURRENT) query.set("current", "true");
  else if (fromSelect(status)) query.set("status", status);
  const { data, error, isLoading, reload } = useApiQuery<Page<DirectoryEmployee>>(
    `/employees?${query}`,
  );

  // Each row carries its company, project, department and location by name.
  // The table keeps what it first works out for a row, and those names come
  // from lists that can arrive after the rows (projects take longest): worked
  // out here, the rows are made again when a list arrives, so a person on a
  // project never reads "—" until the page is reloaded.
  const rows = useMemo<DirectoryRow[]>(
    () =>
      (data?.items ?? []).map((row) => ({
        ...row,
        company_name: row.legal_entity_id ? org.entityName(row.legal_entity_id) : "No company",
        project_name: row.project_id ? org.projectName(row.project_id) : "—",
        department_name: org.departmentName(row.department_id),
        location_name: org.locationName(row.location_id),
      })),
    [data, org],
  );

  const filtered =
    Boolean(debounced.trim()) ||
    [company, project, department, location, status].some((v) => v !== NONE);

  // Export: the ticked people, or everyone the filters match, every column to start with.
  const [exporting, setExporting] = useState<{ ids: string[] | null } | null>(null);
  const exportFilters: Record<string, string | boolean> = {};
  query.forEach((value, key) => {
    if (key === "page" || key === "page_size") return;
    exportFilters[key] = value === "true" ? true : value;
  });

  // "Select all N people": every page under the current filters, for HR's bulk move.
  const fetchAll = async () => {
    const everyone: DirectoryEmployee[] = [];
    const all = new URLSearchParams(query);
    all.set("page_size", "200");
    for (let next = 1; next <= 100; next += 1) {
      all.set("page", String(next));
      const batch = await get<Page<DirectoryEmployee>>(`/employees?${all}`);
      everyone.push(...batch.items);
      if (everyone.length >= batch.total || batch.items.length === 0) break;
    }
    return everyone;
  };

  const columns: ColumnDef<DirectoryRow>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (row) => personName(row),
      cell: ({ row }) => (
        <Link
          href={`/people/${row.original.id}`}
          className="block rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <PersonCell
            name={personName(row.original)}
            photoUrl={row.original.photo_url}
            subtitle={row.original.designation ?? row.original.work_email}
          />
        </Link>
      ),
    },
    {
      accessorKey: "employee_code",
      header: "Code",
      meta: { cellClassName: "text-muted-foreground" },
    },
    {
      id: "company",
      header: "Company",
      accessorFn: (row) => row.company_name,
      meta: { cellClassName: "text-muted-foreground" },
    },
    {
      id: "project",
      header: "Project",
      accessorFn: (row) => row.project_name,
      meta: { cellClassName: "text-muted-foreground" },
    },
    {
      id: "department",
      header: "Department",
      accessorFn: (row) => row.department_name,
      meta: { cellClassName: "text-muted-foreground" },
    },
    {
      id: "location",
      header: "Location",
      accessorFn: (row) => row.location_name,
      meta: { cellClassName: "text-muted-foreground" },
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: { text: (row) => EMPLOYMENT_STATUS[row.status].label },
      cell: ({ row }) => <EmploymentStatusBadge status={row.original.status} />,
    },
  ];

  return (
    <PageShell
      title="Employees"
      description="Everyone in the company — names, roles, companies, projects, departments and work contacts."
    >
      <DataTable
        columns={columns}
        data={rows}
        noun="people"
        exportName="directory"
        onExport={
          isHr
            ? (selected) => setExporting({ ids: selected ? selected.map((person) => person.id) : null })
            : undefined
        }
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        filtered={filtered}
        empty={{
          icon: Users,
          title: "No employees yet",
          description: "People appear here once HR adds them under Onboarding → Add employees.",
        }}
        emptyMessage="No one matches these filters. Try a different name, or clear a filter."
        searchPlaceholder="Name, code, email or title"
        search={term}
        onSearchChange={setTerm}
        bulkActions={
          isHr
            ? (selected, clear) => (
                <>
                  <Button size="sm" variant="outline" onClick={() => setProjecting({ people: selected, clear })}>
                    <FolderKanban /> Move to project
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setMoving({ people: selected, clear })}>
                    <Building2 /> Move to company
                  </Button>
                </>
              )
            : undefined
        }
        filters={
          <>
            {org.entities.length > 0 && (
              <Select value={company} onValueChange={(v) => update({ company: v })}>
                <SelectTrigger aria-label="Company" className="h-9 w-48">
                  <SelectValue placeholder="Company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All companies</SelectItem>
                  {org.entities.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_COMPANY}>No company</SelectItem>
                </SelectContent>
              </Select>
            )}
            {org.projects.length > 0 && (
              <Select value={project} onValueChange={(v) => update({ project: v })}>
                <SelectTrigger aria-label="Project" className="h-9 w-48">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All projects</SelectItem>
                  {org.projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_PROJECT}>No project</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select value={department} onValueChange={(v) => update({ department: v })}>
              <SelectTrigger aria-label="Department" className="h-9 w-44">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>All departments</SelectItem>
                {org.departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={location} onValueChange={(v) => update({ location: v })}>
              <SelectTrigger aria-label="Location" className="h-9 w-44">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>All locations</SelectItem>
                {org.locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => update({ status: v })}>
              <SelectTrigger aria-label="Status" className="h-9 w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Any status</SelectItem>
                <SelectItem value={CURRENT}>Current staff</SelectItem>
                {(Object.keys(EMPLOYMENT_STATUS) as EmploymentStatus[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {EMPLOYMENT_STATUS[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        server={{
          page,
          pageSize,
          total: data?.total ?? 0,
          fetchAll: isHr ? fetchAll : undefined,
          onPageChange: (next) => update({ page: String(next) }),
          onPageSizeChange: (size) => {
            setPageSize(size);
            update({ page: null });
          },
        }}
      />
      <RequireRole roles={HR}>
        <ExportEmployeesDialog
          open={exporting !== null}
          onOpenChange={(open) => {
            if (!open) setExporting(null);
          }}
          people={exporting?.ids ?? null}
          count={exporting?.ids ? exporting.ids.length : (data?.total ?? 0)}
          filters={exportFilters}
          description={
            exporting?.ids
              ? "the people you ticked"
              : filtered
                ? "everyone matching your filters"
                : "everyone in the directory"
          }
        />
      </RequireRole>
      <MoveToProjectDialog
        open={projecting !== null}
        people={projecting?.people ?? []}
        projects={org.projects}
        onOpenChange={(open) => {
          if (!open) setProjecting(null);
        }}
        onMoved={() => {
          projecting?.clear();
          reload();
          setOrgVersion((v) => v + 1);
        }}
      />
      <MoveToCompanyDialog
        open={moving !== null}
        people={moving?.people ?? []}
        entities={org.entities}
        onOpenChange={(open) => {
          if (!open) setMoving(null);
        }}
        onMoved={() => {
          moving?.clear();
          reload();
          setOrgVersion((v) => v + 1);
        }}
      />
    </PageShell>
  );
}
