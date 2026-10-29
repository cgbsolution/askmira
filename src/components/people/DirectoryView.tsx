"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Download, Loader2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { RequireRole } from "@/components/common/RequireRole";
import { EMPLOYMENT_STATUS, NONE, fromSelect, personName } from "@/components/people/labels";
import { MoveToCompanyDialog } from "@/components/people/MoveToCompanyDialog";
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
import { ApiError, downloadFile, get } from "@/lib/api";
import type { EmploymentStatus, Page } from "@/lib/types";
import type { DirectoryEmployee } from "@/lib/types/people";

const PAGE_SIZE = 25;
/** The company filter's value for people with no company at all. */
const NO_COMPANY = "none";
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

  const [term, setTerm] = useState(params.get("search") ?? "");
  const [debounced, setDebounced] = useState(term);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const company = params.get("company") ?? NONE;
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
  if (fromSelect(department)) query.set("department_id", department);
  if (fromSelect(location)) query.set("location_id", location);
  if (status === CURRENT) query.set("current", "true");
  else if (fromSelect(status)) query.set("status", status);
  const { data, error, isLoading, reload } = useApiQuery<Page<DirectoryEmployee>>(
    `/employees?${query}`,
  );

  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    const filters = new URLSearchParams(query);
    filters.delete("page");
    filters.delete("page_size");
    setExporting(true);
    try {
      await downloadFile(`/employees/export${filters.toString() ? `?${filters}` : ""}`, "directory.csv");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "The directory could not be exported.");
    } finally {
      setExporting(false);
    }
  };
  const filtered =
    Boolean(debounced.trim()) || [company, department, location, status].some((v) => v !== NONE);

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

  const columns: ColumnDef<DirectoryEmployee>[] = [
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
      accessorFn: (row) => (row.legal_entity_id ? org.entityName(row.legal_entity_id) : "No company"),
      meta: { cellClassName: "text-muted-foreground" },
    },
    {
      id: "department",
      header: "Department",
      accessorFn: (row) => org.departmentName(row.department_id),
      meta: { cellClassName: "text-muted-foreground" },
    },
    {
      id: "location",
      header: "Location",
      accessorFn: (row) => org.locationName(row.location_id),
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
      description="Everyone in the company — names, roles, companies, departments and work contacts."
      actions={
        <RequireRole roles={HR}>
          <Button variant="outline" onClick={() => void exportCsv()} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />} Export CSV
          </Button>
        </RequireRole>
      }
    >
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        noun="people"
        exportName="directory"
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
                <Button size="sm" variant="outline" onClick={() => setMoving({ people: selected, clear })}>
                  <Building2 /> Move to company
                </Button>
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
