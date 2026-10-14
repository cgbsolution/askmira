"use client";

import { Download, Loader2, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { PersonCell } from "@/components/common/PersonCell";
import { RequireRole } from "@/components/common/RequireRole";
import { EMPLOYMENT_STATUS, NONE, fromSelect, personName } from "@/components/people/labels";
import { EmploymentStatusBadge } from "@/components/people/StatusBadges";
import { useOrgReference } from "@/components/people/useOrgReference";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const query = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
  if (debounced.trim()) query.set("search", debounced.trim());
  if (fromSelect(department)) query.set("department_id", department);
  if (fromSelect(location)) query.set("location_id", location);
  if (fromSelect(status)) query.set("status", status);
  const { data, error, isLoading, reload } = useApiQuery<Page<DirectoryEmployee>>(
    `/employees?${query}`,
  );

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
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

  return (
    <PageShell
      title="People"
      description="Everyone in the company — names, roles, departments and work contacts."
      actions={
        <RequireRole roles={HR}>
          <Button variant="outline" onClick={() => void exportCsv()} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />} Export CSV
          </Button>
          <Button variant="accent" asChild>
            <Link href="/people/new">
              <Plus /> Add employee
            </Link>
          </Button>
        </RequireRole>
      }
    >
      <DataPanel
        isLoading={isLoading && !data}
        error={error?.detail}
        onRetry={reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: Users,
          title: filtered ? "No one matches these filters" : "No employees yet",
          description: filtered
            ? "Try a different name, or clear a filter."
            : "Employees appear here once HR adds them.",
        }}
        toolbar={
          <>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Name, code, email or title"
                className="pl-9"
                aria-label="Search people"
              />
            </div>
            <Select value={department} onValueChange={(v) => update({ department: v })}>
              <SelectTrigger aria-label="Department" className="w-44">
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
              <SelectTrigger aria-label="Location" className="w-44">
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
              <SelectTrigger aria-label="Status" className="w-36">
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
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              {total} {total === 1 ? "person" : "people"}
            </span>
          </>
        }
        footer={
          total > PAGE_SIZE ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {page} of {lastPage}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => update({ page: String(page - 1) })}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= lastPage}
                  onClick={() => update({ page: String(page + 1) })}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link
                    href={`/people/${row.id}`}
                    className="block rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                  >
                    <PersonCell
                      name={personName(row)}
                      photoUrl={row.photo_url}
                      subtitle={row.designation ?? row.work_email}
                    />
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.employee_code}</TableCell>
                <TableCell className="text-muted-foreground">
                  {org.departmentName(row.department_id)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {org.locationName(row.location_id)}
                </TableCell>
                <TableCell>
                  <EmploymentStatusBadge status={row.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>
    </PageShell>
  );
}
