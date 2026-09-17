import React from "react";

import { Badge } from "@/components/ui/badge";
import type { DeviceStatus, DeviceVendor } from "@/lib/types/attendance";

/** Presentation shared by the device settings screen. */

export const VENDOR_LABEL: Record<DeviceVendor, string> = {
  essl: "eSSL",
  matrix: "Matrix",
  zkteco: "ZKTeco",
  generic: "Generic (push API)",
};

export const DEVICE_VENDORS: DeviceVendor[] = ["essl", "matrix", "zkteco", "generic"];

const STATUS: Record<DeviceStatus, ["success" | "warning" | "muted", string]> = {
  active: ["success", "Active"],
  silent: ["warning", "Silent"],
  disabled: ["muted", "Disabled"],
};

export function DeviceStatusBadge({ status, silent }: { status: DeviceStatus; silent?: boolean }) {
  // The ingestion report can see silence before the stored status catches up.
  const effective: DeviceStatus = status === "active" && silent ? "silent" : status;
  const [variant, label] = STATUS[effective];
  return <Badge variant={variant}>{label}</Badge>;
}

/** An API timestamp as "16 Sep 2026, 2:05 pm" in the viewer's zone. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** "12 min ago" from the server's own minutes-since-seen figure. */
export function formatMinutesAgo(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined) return null;
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h ago`;
  return `${Math.floor(minutes / (60 * 24))} d ago`;
}

/** The API's `detail` from a thrown ApiError, or a fallback sentence. */
export function errorDetail(error: unknown, fallback: string): string {
  const detail = (error as { detail?: unknown } | null)?.detail;
  return typeof detail === "string" && detail ? detail : fallback;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** Where a device pushes its punches. The token is part of the path. */
export function pushUrl(token: string): string {
  return `${API_BASE}/api/v1/devices/${encodeURIComponent(token)}/punches`;
}

export const PUSH_URL_PATTERN = `${API_BASE}/api/v1/devices/{token}/punches`;

export const NO_LOCATION = "__none";
