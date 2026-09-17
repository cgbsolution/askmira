"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { patch, post } from "@/lib/api";
import type {
  Device,
  DeviceInput,
  DeviceUpdateInput,
  DeviceVendor,
  DeviceWithToken,
  WorkLocation,
} from "@/lib/types/attendance";

import { DEVICE_VENDORS, NO_LOCATION, VENDOR_LABEL, errorDetail } from "./DeviceShared";

const DEFAULT_TIMEZONE = "Asia/Kolkata";

/**
 * Register a device, or edit one.
 *
 * Registering returns the push token once; the parent shows it. Editing never
 * touches the token — that is a separate, deliberate rotation.
 */
export function DeviceFormDialog({
  open,
  onOpenChange,
  device,
  locations,
  locationsError,
  onRegistered,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null registers a new device. */
  device: Device | null;
  locations: WorkLocation[] | null;
  locationsError: string | null;
  onRegistered: (created: DeviceWithToken) => void;
  onUpdated: () => void;
}) {
  const isEdit = device !== null;
  const [deviceId, setDeviceId] = useState("");
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState<DeviceVendor | "">("");
  const [locationId, setLocationId] = useState(NO_LOCATION);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [threshold, setThreshold] = useState("60");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDeviceId(device?.device_id ?? "");
    setName(device?.name ?? "");
    setVendor(device?.vendor ?? "");
    setLocationId(device?.work_location_id ?? NO_LOCATION);
    setTimezone(device?.assumed_timezone ?? DEFAULT_TIMEZONE);
    setThreshold(device ? String(device.silence_threshold_minutes) : "60");
    setEnabled(device ? device.status !== "disabled" : true);
  }, [open, device]);

  const validate = (): string | null => {
    if (!isEdit && !deviceId.trim()) return "Enter the device ID printed on or configured in the device.";
    if (!name.trim()) return "Give the device a name.";
    if (!isEdit && !vendor) return "Choose the vendor.";
    if (!timezone.trim()) return "Enter the timezone the device clock runs in.";
    if (!/^\d+$/.test(threshold.trim()) || Number(threshold) < 1) {
      return "The silence threshold must be a whole number of minutes, at least 1.";
    }
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setIsSaving(true);
    const workLocationId = locationId === NO_LOCATION ? null : locationId;
    try {
      if (device) {
        const body: DeviceUpdateInput = {
          name: name.trim(),
          assumed_timezone: timezone.trim(),
          silence_threshold_minutes: Number(threshold.trim()),
          enabled,
        };
        if (workLocationId) body.work_location_id = workLocationId;
        else if (device.work_location_id) body.clear_work_location = true;
        await patch<Device>(`/devices/${device.id}`, body);
        toast.success(`${name.trim()} updated`);
        onOpenChange(false);
        onUpdated();
      } else {
        const body: DeviceInput = {
          device_id: deviceId.trim(),
          name: name.trim(),
          vendor: vendor as DeviceVendor,
          work_location_id: workLocationId,
          assumed_timezone: timezone.trim(),
          silence_threshold_minutes: Number(threshold.trim()),
        };
        const created = await post<DeviceWithToken>("/devices", body);
        onOpenChange(false);
        onRegistered(created);
      }
    } catch (caught) {
      setError(errorDetail(caught, "Could not save the device."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${device?.name}` : "Register a device"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "The push token is not changed here. Rotate it separately if it may have leaked."
              : "A push token is issued on save and shown once."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="device-id">Device ID</Label>
              <Input
                id="device-id"
                value={deviceId}
                disabled={isEdit}
                maxLength={100}
                onChange={(event) => setDeviceId(event.target.value)}
                placeholder="Serial number"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="device-vendor">Vendor</Label>
              <Select
                value={vendor}
                disabled={isEdit}
                onValueChange={(value) => setVendor(value as DeviceVendor)}
              >
                <SelectTrigger id="device-vendor" className="w-full">
                  <SelectValue placeholder="Choose a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_VENDORS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {VENDOR_LABEL[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="device-name">Name</Label>
            <Input
              id="device-name"
              value={name}
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Reception, ground floor"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="device-location">
              Work location <span className="text-muted-foreground">(optional)</span>
            </Label>
            {locationsError ? (
              <p className="text-sm text-muted-foreground">
                Work locations could not be loaded: {locationsError}
              </p>
            ) : (
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger id="device-location" className="w-full">
                  <SelectValue placeholder="No location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LOCATION}>No location</SelectItem>
                  {(locations ?? []).map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                      {!location.active && " (inactive)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="device-timezone">Device clock timezone</Label>
              <Input
                id="device-timezone"
                value={timezone}
                maxLength={64}
                onChange={(event) => setTimezone(event.target.value)}
                placeholder="Asia/Kolkata"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="device-threshold">Silent after (minutes)</Label>
              <Input
                id="device-threshold"
                inputMode="numeric"
                value={threshold}
                className="tabular-nums"
                onChange={(event) => setThreshold(event.target.value)}
              />
            </div>
          </div>

          {isEdit && (
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="device-enabled">Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  A disabled device&apos;s pushes are refused.
                </p>
              </div>
              <Switch id="device-enabled" checked={enabled} onCheckedChange={setEnabled} />
            </div>
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              {isEdit ? "Save changes" : "Register device"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
