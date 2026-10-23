"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, MapPin, Plus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { FormField } from "@/components/common/FormField";
import { EmployeePicker } from "@/components/payroll/EmployeePicker";
import { apiMessage } from "@/components/payroll/labels";
import { useEmployeeNames } from "@/components/payroll/useEmployeeNames";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { LocationOption, WorkLocation } from "@/lib/types/payroll";
import { formatDay } from "@/lib/utils";

/** "1 Apr 2026 – open": the dates a posting runs between. */
function periodText(row: WorkLocation): string {
  return `${formatDay(row.effective_from, true)} – ${row.effective_to ? formatDay(row.effective_to, true) : "open"}`;
}

/**
 * Where each employee worked, and from when. This is what lets payroll see a
 * mid-month move to another state instead of guessing which state's PT applies.
 */
export function WorkLocationsPanel() {
  const postings = useApiQuery<WorkLocation[]>("/statutory/work-locations");
  const locations = useApiQuery<LocationOption[]>("/org/locations");
  const nameOf = useEmployeeNames();
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const locationLabel = (id: string) => {
    const location = locations.data?.find((item) => item.id === id);
    return location ? `${location.name} (${location.state_code})` : "Unknown location";
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!employeeId) return setFormError("Choose the employee.");
    if (!locationId) return setFormError("Choose the location.");
    if (!effectiveFrom) return setFormError("Give the date of the move.");
    setSaving(true);
    setFormError(null);
    try {
      await post("/statutory/work-locations", {
        employee_id: employeeId,
        location_id: locationId,
        effective_from: effectiveFrom,
        reason: reason.trim() || null,
      });
      toast.success("Posting recorded.");
      setOpen(false);
      postings.reload();
    } catch (caught) {
      setFormError(apiMessage(caught, "Could not record the posting."));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<WorkLocation>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (row) => nameOf(row.employee_id),
    },
    {
      id: "location",
      header: "Location",
      accessorFn: (row) => locationLabel(row.location_id),
    },
    {
      accessorKey: "effective_from",
      header: "Period",
      meta: { cellClassName: "text-sm", text: periodText },
      cell: ({ row }) => periodText(row.original),
    },
    {
      accessorKey: "reason",
      header: "Reason",
      // Not "auto": it compares a missing reason inconsistently against a present one.
      sortingFn: "alphanumeric",
      meta: { cellClassName: "text-sm text-muted-foreground" },
      cell: ({ row }) => row.original.reason ?? "—",
    },
  ];

  return (
    <>
      <DataTable
        title="Work locations"
        description="Postings by date. Professional Tax and LWF follow the state of the location."
        columns={columns}
        data={postings.data ?? []}
        noun="postings"
        exportName="work-locations"
        searchPlaceholder="Search employees or locations"
        actions={
          <Button size="sm" className="h-9" onClick={() => setOpen(true)}>
            <Plus /> Record posting
          </Button>
        }
        isLoading={postings.isLoading && !postings.data}
        error={postings.error?.detail}
        onRetry={postings.reload}
        empty={{
          icon: MapPin,
          title: "No postings recorded",
          description: "Without one, payroll uses each employee's current location for the whole month.",
        }}
      />

      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={(event) => void submit(event)} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Record a posting</DialogTitle>
              <DialogDescription>
                Closes the employee&apos;s current posting the day before and updates their directory
                location.
              </DialogDescription>
            </DialogHeader>
            <FormField htmlFor="wl-employee" label="Employee">
              <EmployeePicker id="wl-employee" value={employeeId} onChange={(id) => setEmployeeId(id)} />
            </FormField>
            <FormField htmlFor="wl-location" label="Location">
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger id="wl-location" className="w-full">
                  <SelectValue placeholder="Choose a location" />
                </SelectTrigger>
                <SelectContent>
                  {(locations.data ?? [])
                    .filter((location) => location.is_active)
                    .map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name} ({location.state_code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="wl-from" label="From">
              <Input id="wl-from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </FormField>
            <FormField htmlFor="wl-reason" label="Reason" optional>
              <Input id="wl-reason" maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
            </FormField>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
