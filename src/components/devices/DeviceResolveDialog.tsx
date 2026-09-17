"use client";

import { AlertTriangle, Check, Loader2, Search, Users } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { EmployeeSummary, Page } from "@/lib/types";
import type { DevicePunchException } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";

import { errorDetail, formatDateTime } from "./DeviceShared";

function employeeName(employee: EmployeeSummary): string {
  return employee.display_name ?? [employee.first_name, employee.last_name].filter(Boolean).join(" ");
}

/**
 * Attach an unmatched punch to the person who made it.
 *
 * The device sent a code the directory did not know; HR picks the employee and
 * the punch is recorded against them.
 */
export function DeviceResolveDialog({
  exception,
  deviceLabel,
  onOpenChange,
  onResolved,
}: {
  exception: DevicePunchException | null;
  deviceLabel: string;
  onOpenChange: (open: boolean) => void;
  onResolved: () => void;
}) {
  const open = exception !== null;
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<EmployeeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!exception) return;
    const initial = exception.employee_code ?? "";
    setSearch(initial);
    setDebounced(initial);
    setSelected(null);
    setError(null);
  }, [exception]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = new URLSearchParams({ page_size: "50" });
  if (debounced) query.set("search", debounced);
  const employees = useApiQuery<Page<EmployeeSummary>>(open ? `/employees?${query.toString()}` : null);

  const resolve = async () => {
    if (!exception) return;
    if (!selected) {
      setError("Choose the employee this punch belongs to.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await post<DevicePunchException>(`/devices/exceptions/${exception.id}/resolve`, {
        employee_id: selected.id,
      });
      toast.success(`Punch attached to ${employeeName(selected)}`);
      onOpenChange(false);
      onResolved();
    } catch (caught) {
      setError(errorDetail(caught, "Could not resolve the exception."));
    } finally {
      setIsSaving(false);
    }
  };

  const items = employees.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolve punch exception</DialogTitle>
          <DialogDescription>
            {exception &&
              `${deviceLabel}, ${formatDateTime(exception.punched_at)}${
                exception.employee_code ? `, code ${exception.employee_code}` : ""
              }. ${exception.reason}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="resolve-search">Employee</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="resolve-search"
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, code or email"
              />
            </div>
          </div>

          <ScrollArea className="h-64 rounded-md border border-border">
            {employees.isLoading ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : employees.error ? (
              <p className="p-3 text-sm text-destructive">{employees.error.detail}</p>
            ) : items.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No matching employees"
                description="Try a different name or employee code."
                className="py-8"
              />
            ) : (
              <ul className="p-1">
                {items.map((employee) => {
                  const isSelected = selected?.id === employee.id;
                  return (
                    <li key={employee.id}>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-pressed={isSelected}
                        onClick={() => setSelected(employee)}
                        className={cn(
                          "h-auto w-full justify-between px-3 py-2 text-left",
                          isSelected && "bg-secondary text-secondary-foreground",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{employeeName(employee)}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {employee.employee_code}
                            {employee.designation && ` · ${employee.designation}`}
                          </span>
                        </span>
                        {isSelected && <Check className="shrink-0" />}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
          {employees.data && employees.data.total > items.length && (
            <p className="text-xs text-muted-foreground">
              Showing {items.length} of {employees.data.total}. Narrow the search to find someone else.
            </p>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isSaving} onClick={() => void resolve()}>
            {isSaving && <Loader2 className="animate-spin" />}
            Attach punch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
