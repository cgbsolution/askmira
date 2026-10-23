"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Download, Loader2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { RequireRole } from "@/components/common/RequireRole";
import { EMPLOYMENT_STATUS, NONE, fromSelect, personName } from "@/components/people/labels";
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
import { useApiQuery } from "@/hooks/useApiQuery";
import { HR } from "@/lib/access";
import { ApiError, downloadFile } from "@/lib/api";
import type { EmploymentStatus, Page } from "@/lib/types";
import type { DirectoryEmployee } from "@/lib/types/people";

const PAGE_SIZE = 25;

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
  const org = useOrgReference();

  const [term, setTerm] = useState(params.get("search") ?? "");
  const [debounced, setDebounced] = useState(term);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
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
  if (fromSelect(department)) query.set("department_id", department);
  if (fromSelect(location)) query.set("location_id", location);
  if (fromSelect(status)) query.set("status", status);
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
    Boolean(debounced.trim()) || [department, location, status].some((v) => v !== NONE);

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
      description="Everyone in the company — names, roles, departments and work contacts."
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
        filters={
          <>
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
              <SelectTrigger aria-label="Status" className="h-9 w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Any status</SelectItem>
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
          onPageChange: (next) => update({ page: String(next) }),
          onPageSizeChange: (size) => {
            setPageSize(size);
            update({ page: null });
          },
        }}
      />
    </PageShell>
  );
}
