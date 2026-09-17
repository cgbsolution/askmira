"use client";

import { Loader2, MapPin, Plus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { LocationOption, WorkLocation } from "@/lib/types/payroll";
import { formatDay } from "@/lib/utils";

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

  const rows = postings.data ?? [];
  return (
    <>
      <DataPanel
        title="Work locations"
        description="Postings by date. Professional Tax and LWF follow the state of the location."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus /> Record posting
          </Button>
        }
        isLoading={postings.isLoading && !postings.data}
        error={postings.error?.detail}
        onRetry={postings.reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: MapPin,
          title: "No postings recorded",
          description: "Without one, payroll uses each employee's current location for the whole month.",
        }}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{nameOf(row.employee_id)}</TableCell>
                  <TableCell>{locationLabel(row.location_id)}</TableCell>
                  <TableCell className="text-sm">
                    {formatDay(row.effective_from, true)} –{" "}
                    {row.effective_to ? formatDay(row.effective_to, true) : "open"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.reason ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DataPanel>

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
