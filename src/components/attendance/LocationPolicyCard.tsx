"use client";

import { Camera, Loader2, MapPin } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { put } from "@/lib/api";
import type { AttendanceSettings, LocationMode } from "@/lib/types/attendance";

import { errorDetail, LoadError } from "./shared";

const MODES: { value: LocationMode; label: string; detail: string }[] = [
  {
    value: "required",
    label: "Required",
    detail:
      "Every punch from the web or the app carries a location. Without location access the punch is not recorded.",
  },
  {
    value: "optional",
    label: "Optional",
    detail:
      "The punch screen asks for a location by default; people can turn it off, and a punch without one is still recorded.",
  },
  {
    value: "off",
    label: "Off",
    detail: "The punch screen never asks for a location. Geofence flags stay empty.",
  },
];

const PHOTO_MODES: { value: LocationMode; label: string; detail: string }[] = [
  {
    value: "required",
    label: "Required",
    detail:
      "A punch from the web or the app needs a photo taken there and then. It stops a colleague punching for someone else. Devices and imports are unaffected.",
  },
  {
    value: "optional",
    label: "Optional",
    detail: "The punch screen offers the camera; a punch without a photo is still recorded.",
  },
  {
    value: "off",
    label: "Off",
    detail: "No photo is asked for.",
  },
];

/**
 * The workspace's rule for recording where people punch.
 *
 * A punch with a location is compared with the work locations below: inside
 * one it reads "At Bengaluru HQ", outside all of them it is recorded, flagged
 * for HR and shows how far away it was. Devices and imports are unaffected.
 *
 * The photo rule sits beside it. A photo is shown to the person, their
 * reporting line and HR; nothing scores or matches the face.
 */
export function LocationPolicyCard() {
  const { data, error, isLoading, reload } = useApiQuery<AttendanceSettings>("/attendance/settings");
  const [mode, setMode] = useState<LocationMode>("optional");
  const [photoMode, setPhotoMode] = useState<LocationMode>("off");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setMode(data.location_mode);
      setPhotoMode(data.photo_mode);
    }
  }, [data]);

  const unchanged = !data || (data.location_mode === mode && data.photo_mode === photoMode);

  const save = async () => {
    setIsSaving(true);
    try {
      await put<AttendanceSettings>("/attendance/settings", { location_mode: mode, photo_mode: photoMode });
      toast.success(`Punch location is now ${mode}, punch photo ${photoMode}`);
      reload();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not save the location rule."));
    } finally {
      setIsSaving(false);
    }
  };

  const chosen = MODES.find((option) => option.value === mode);
  const chosenPhoto = PHOTO_MODES.find((option) => option.value === photoMode);

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" /> Punch location and photo
        </CardTitle>
        <CardDescription>
          Whether a punch records where it was made, and a photo of who made it. Locations are
          checked against the work locations below.
        </CardDescription>
        <CardAction>
          <Button onClick={() => void save()} disabled={isSaving || unchanged}>
            {isSaving && <Loader2 className="animate-spin" />} Save
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-11 w-full max-w-sm" />
        ) : error ? (
          <LoadError error={error} onRetry={reload} />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <FormField htmlFor="punch-location-rule" label="Location" hint={chosen?.detail}>
              <Select value={mode} onValueChange={(value) => setMode(value as LocationMode)}>
                <SelectTrigger id="punch-location-rule" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              htmlFor="punch-photo-rule"
              hint={chosenPhoto?.detail}
              label={
                <span className="flex items-center gap-1.5">
                  <Camera className="size-3.5" /> Photo
                </span>
              }
            >
              <Select value={photoMode} onValueChange={(value) => setPhotoMode(value as LocationMode)}>
                <SelectTrigger id="punch-photo-rule" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHOTO_MODES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
