"use client";

import { Plus, Search, Users } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageShell } from "@/components/common/PageShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, get } from "@/lib/api";
import type { EmploymentStatus, EmployeeSummary, Page } from "@/lib/types";
import { initials } from "@/lib/utils";

const PAGE_SIZE = 25;

const STATUS_VARIANT: Record<EmploymentStatus, "success" | "warning" | "muted" | "outline"> = {
  active: "success",
  on_notice: "warning",
  on_leave: "outline",
  exited: "muted",
  pre_joining: "outline",
};

const STATUS_LABEL: Record<EmploymentStatus, string> = {
  active: "Active",
  on_notice: "On notice",
  on_leave: "On leave",
  exited: "Exited",
  pre_joining: "Pre-joining",
};

export default function PeoplePage() {
  const [rows, setRows] = useState<EmployeeSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async (currentPage: number, term: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        page_size: String(PAGE_SIZE),
      });
      if (term.trim()) params.set("search", term.trim());

      const result = await get<Page<EmployeeSummary>>(`/employees?${params}`);
      setRows(result.items);
      setTotal(result.total);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.detail : "Could not load the employee list.";
      toast.error(message);
      setRows([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => void load(page, search), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, page, search]);

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageShell
      title="People"
      description="The employee master record — the system of record everything else references."
      actions={
        <Button variant="accent">
          <Plus /> Add employee
        </Button>
      }
    >
      <Card tier="tier1" className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name, code or email"
              className="pl-9"
              aria-label="Search employees"
            />
          </div>
          <span className="ml-auto text-sm text-muted-foreground">
            {isLoading ? "Loading…" : `${total} ${total === 1 ? "person" : "people"}`}
          </span>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Users className="size-6" />
              </span>
              <div>
                <p className="font-medium text-foreground">
                  {search ? "No one matches that search" : "No employees yet"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search
                    ? "Try a different name, employee code or email."
                    : "Add your first employee, or import a roster to get started."}
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const name =
                    row.display_name ?? [row.first_name, row.last_name].filter(Boolean).join(" ");
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            {row.photo_url && <AvatarImage src={row.photo_url} alt="" />}
                            <AvatarFallback>{initials(name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {row.work_email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.employee_code}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.designation ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[row.status]}>
                          {STATUS_LABEL[row.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border p-4">
            <span className="text-sm text-muted-foreground">
              Page {page} of {lastPage}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= lastPage}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </PageShell>
  );
}
