"use client";

import type { ColumnDef, SortingFn } from "@tanstack/react-table";
import { Loader2, MapPin, Plus } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/common/data-table/DataTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import type { OrgLocationOption, WorkLocation, WorkLocationInput } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";

import { errorDetail, parseWholeNumber } from "./shared";
import { Field, loadErrorProps } from "./ShiftsTab";

const NO_ORG_LOCATION = "__none__";
const DECIMAL = /^-?\d{1,3}(\.\d{1,8})?$/;

/** Coordinates arrive as decimal strings; they sort as numbers. */
const byNumber: SortingFn<WorkLocation> = (a, b, columnId) =>
  Number(a.getValue(columnId)) - Number(b.getValue(columnId));

function radiusText(row: WorkLocation): string {
  return `${row.radius_metres.toLocaleString("en-IN")} m`;
}

export function WorkLocationsTab() {
  const { data, error, isLoading, reload } = useApiQuery<WorkLocation[]>("/attendance/work-locations");
  // Optional: linking is a convenience, so a failure here does not block the tab.
  const orgLocations = useApiQuery<OrgLocationOption[]>("/org/locations");
  const [adding, setAdding] = useState(false);

  const orgById = useMemo(
    () => new Map((orgLocations.data ?? []).map((location) => [location.id, location])),
    [orgLocations.data],
  );
  const rows = [...(data ?? [])].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
  );
  const orgLocationText = (row: WorkLocation) => {
    const org = row.location_id ? orgById.get(row.location_id) : undefined;
    return row.location_id ? (org ? `${org.name}${org.city ? `, ${org.city}` : ""}` : "Linked") : "—";
  };

  const columns: ColumnDef<WorkLocation>[] = [
    { accessorKey: "name", header: "Name", meta: { cellClassName: "font-medium" } },
    {
      accessorKey: "latitude",
      header: "Latitude",
      sortingFn: byNumber,
      meta: { className: "text-right", cellClassName: "tabular-nums" },
    },
    {
      accessorKey: "longitude",
      header: "Longitude",
      sortingFn: byNumber,
      meta: { className: "text-right", cellClassName: "tabular-nums" },
    },
    {
      accessorKey: "radius_metres",
      header: "Radius",
      meta: { className: "text-right", cellClassName: "tabular-nums", text: radiusText },
      cell: ({ row }) => radiusText(row.original),
    },
    { id: "org_location", header: "Org location", accessorFn: orgLocationText },
    {
      id: "state",
      header: "State",
      accessorFn: (row) => (row.active ? "Active" : "Inactive"),
      cell: ({ row }) => (
        <Badge variant={row.original.active ? "success" : "muted"}>
          {row.original.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <DataTable
        tier="tier1"
        title="Work locations"
        description="Geofences for located punches. A punch outside every radius is recorded and flagged for HR, never rejected."
        actions={
          <Button size="sm" className="h-9" onClick={() => setAdding(true)}>
            <Plus /> Add location
          </Button>
        }
        columns={columns}
        data={rows}
        noun="work locations"
        exportName="work-locations"
        searchPlaceholder="Search locations"
        rowClassName={(row) => cn(!row.active && "text-muted-foreground")}
        isLoading={isLoading && !data}
        loadingRows={3}
        {...loadErrorProps(error, reload)}
        empty={{
          icon: MapPin,
          title: "No work locations",
          description:
            "Without a work location, no punch can be flagged as outside a geofence. Add your offices and sites.",
        }}
      />

      <AddLocationDialog
        open={adding}
        orgLocations={orgLocations.data ?? []}
        onClose={() => setAdding(false)}
        onSaved={() => {
          setAdding(false);
          reload();
        }}
      />
    </>
  );
}

function AddLocationDialog({
  open,
  orgLocations,
  onClose,
  onSaved,
}: {
  open: boolean;
  orgLocations: OrgLocationOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("");
  const [orgLocationId, setOrgLocationId] = useState(NO_ORG_LOCATION);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const reset = () => {
    setName("");
    setLatitude("");
    setLongitude("");
    setRadius("");
    setOrgLocationId(NO_ORG_LOCATION);
    setSubmitted(false);
    setServerError(null);
  };

  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = "A name is required.";
  const lat = latitude.trim();
  if (!DECIMAL.test(lat) || Math.abs(Number(lat)) > 90) errors.latitude = "A decimal between -90 and 90.";
  const lng = longitude.trim();
  if (!DECIMAL.test(lng) || Math.abs(Number(lng)) > 180) errors.longitude = "A decimal between -180 and 180.";
  const radiusValue = parseWholeNumber(radius);
  if (radiusValue === null || radiusValue <= 0) errors.radius = "Whole metres, more than 0.";
  const shown = submitted ? errors : {};

  const close = () => {
    if (isSaving) return;
    reset();
    onClose();
  };

  const save = async () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0 || radiusValue === null) return;
    const body: WorkLocationInput = {
      name: name.trim(),
      latitude: lat,
      longitude: lng,
      radius_metres: radiusValue,
      location_id: orgLocationId === NO_ORG_LOCATION ? null : orgLocationId,
    };
    setIsSaving(true);
    setServerError(null);
    try {
      const created = await post<WorkLocation>("/attendance/work-locations", body);
      toast.success(`${created.name} added`);
      reset();
      onSaved();
    } catch (caught) {
      setServerError(errorDetail(caught, "Could not add the work location."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add work location</DialogTitle>
          <DialogDescription>
            Coordinates in decimal degrees, e.g. from a map pin. The radius is how far from that
            point a punch still counts as on site.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field id="wl-name" label="Name" error={shown.name}>
            <Input
              id="wl-name"
              value={name}
              maxLength={100}
              aria-invalid={Boolean(shown.name)}
              onChange={(event) => setName(event.target.value)}
              placeholder="Pune office"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="wl-lat" label="Latitude" error={shown.latitude}>
              <Input
                id="wl-lat"
                inputMode="decimal"
                className="tabular-nums"
                value={latitude}
                aria-invalid={Boolean(shown.latitude)}
                onChange={(event) => setLatitude(event.target.value)}
              />
            </Field>
            <Field id="wl-lng" label="Longitude" error={shown.longitude}>
              <Input
                id="wl-lng"
                inputMode="decimal"
                className="tabular-nums"
                value={longitude}
                aria-invalid={Boolean(shown.longitude)}
                onChange={(event) => setLongitude(event.target.value)}
              />
            </Field>
          </div>
          <Field id="wl-radius" label="Radius (metres)" error={shown.radius}>
            <Input
              id="wl-radius"
              type="number"
              min={1}
              step={1}
              className="w-40 tabular-nums"
              value={radius}
              aria-invalid={Boolean(shown.radius)}
              onChange={(event) => setRadius(event.target.value)}
            />
          </Field>
          {orgLocations.length > 0 && (
            <Field
              id="wl-org"
              label={<>Org location <span className="text-muted-foreground">(optional)</span></>}
            >
              <Select value={orgLocationId} onValueChange={setOrgLocationId}>
                <SelectTrigger id="wl-org" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ORG_LOCATION}>Not linked</SelectItem>
                  {orgLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                      {location.city ? `, ${location.city}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={close}>
            Cancel
          </Button>
          <Button disabled={isSaving} onClick={() => void save()}>
            {isSaving && <Loader2 className="animate-spin" />}
            Add location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
