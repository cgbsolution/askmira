"use client";

import { Fingerprint, KeyRound, Pencil, Plus } from "lucide-react";
import React from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Device, DeviceIngestionRow, WorkLocation } from "@/lib/types/attendance";
import { cn } from "@/lib/utils";

import { DeviceStatusBadge, VENDOR_LABEL, formatDateTime, formatMinutesAgo } from "./DeviceShared";

/** Registered devices with what each has sent recently. Silent ones stand out. */
export function DeviceTable({
  devices,
  stats,
  locations,
  canManage,
  onRegister,
  onEdit,
  onRotate,
}: {
  devices: Device[];
  /** Ingestion figures by device record id; absent when the report failed to load. */
  stats: Map<string, DeviceIngestionRow> | null;
  locations: WorkLocation[] | null;
  canManage: boolean;
  onRegister: () => void;
  onEdit: (device: Device) => void;
  onRotate: (device: Device) => void;
}) {
  if (devices.length === 0) {
    return (
      <Card tier="tier1">
        <EmptyState
          icon={Fingerprint}
          title="No devices registered"
          description={
            canManage
              ? "Register a biometric or attendance device to issue it a push token."
              : "An admin registers devices here. None has been registered yet."
          }
          action={
            canManage ? (
              <Button onClick={onRegister}>
                <Plus /> Register device
              </Button>
            ) : undefined
          }
        />
      </Card>
    );
  }

  const locationName = (id: string | null) => {
    if (!id) return "—";
    return locations?.find((location) => location.id === id)?.name ?? "Unknown location";
  };

  return (
    <Card tier="tier1" className="py-2">
      <CardContent className="overflow-x-auto px-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Device ID</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead className="text-right">Punches 24h</TableHead>
              <TableHead className="text-right">Punches 7d</TableHead>
              <TableHead className="text-right">Open exceptions</TableHead>
              <TableHead>Token</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((device) => {
              const row = stats?.get(device.id);
              const silent = row?.is_silent ?? device.status === "silent";
              const ago = formatMinutesAgo(row?.minutes_since_seen);
              return (
                <TableRow
                  key={device.id}
                  className={cn(silent && "bg-mustard-50 hover:bg-mustard-100/60 dark:bg-mustard-900/20")}
                >
                  <TableCell className="font-medium">{device.name}</TableCell>
                  <TableCell className="tabular-nums">{device.device_id}</TableCell>
                  <TableCell>{VENDOR_LABEL[device.vendor] ?? device.vendor}</TableCell>
                  <TableCell>{locationName(device.work_location_id)}</TableCell>
                  <TableCell>
                    <DeviceStatusBadge status={device.status} silent={silent} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {device.last_seen_at ? (
                      <span title={formatDateTime(device.last_seen_at)}>
                        {ago ?? formatDateTime(device.last_seen_at)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row ? row.punches_last_24h : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row ? row.punches_last_7d : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row ? (
                      row.open_exceptions > 0 ? (
                        <Badge variant="warning">{row.open_exceptions}</Badge>
                      ) : (
                        0
                      )
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {device.push_token_hint ? `…${device.push_token_hint}` : "—"}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => onEdit(device)}>
                          <Pencil /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onRotate(device)}>
                          <KeyRound /> Rotate token
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
