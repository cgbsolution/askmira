"use client";

import { CheckCircle2 } from "lucide-react";
import React, { useMemo, useState } from "react";

import { DataPanel } from "@/components/common/DataPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ApiError } from "@/lib/api";
import type { Device, DevicePunchException } from "@/lib/types/attendance";

import { DeviceResolveDialog } from "./DeviceResolveDialog";
import { formatDateTime } from "./DeviceShared";

/** Punches a device sent that could not be matched to an employee. */
export function DeviceExceptions({
  exceptions,
  error,
  isLoading,
  devices,
  canManage,
  onRetry,
  onResolved,
}: {
  exceptions: DevicePunchException[] | null;
  error: ApiError | null;
  isLoading: boolean;
  devices: Device[];
  canManage: boolean;
  onRetry: () => void;
  onResolved: () => void;
}) {
  const [showResolved, setShowResolved] = useState(false);
  const [resolving, setResolving] = useState<DevicePunchException | null>(null);

  // The exception names its device; match the record id first, then the
  // device's own identifier, and fall back to what the API sent.
  const deviceLabel = useMemo(() => {
    const byId = new Map(devices.map((device) => [device.id, device]));
    const byDeviceId = new Map(devices.map((device) => [device.device_id, device]));
    return (value: string) => {
      const device = byId.get(value) ?? byDeviceId.get(value);
      return device ? `${device.name} (${device.device_id})` : value;
    };
  }, [devices]);

  const all = exceptions ?? [];
  const rows = showResolved ? all : all.filter((row) => row.resolved_at === null);

  return (
    <>
      <DataPanel
        title="Punch exceptions"
        description="Punches a device sent that could not be matched to an employee. A payload that could not be read at all cannot be admitted."
        isLoading={isLoading && !exceptions}
        error={exceptions ? null : (error?.detail ?? null)}
        onRetry={onRetry}
        isEmpty={rows.length === 0}
        empty={{
          icon: CheckCircle2,
          title: showResolved ? "No punch exceptions" : "No open punch exceptions",
          description:
            "Punches with an employee code that matches nobody in the directory appear here for HR to attach.",
        }}
        toolbar={
          <div className="ml-auto flex items-center gap-2">
            <Label htmlFor="exceptions-show-resolved" className="text-sm font-normal text-muted-foreground">
              Show resolved
            </Label>
            <Switch id="exceptions-show-resolved" checked={showResolved} onCheckedChange={setShowResolved} />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Code sent</TableHead>
                <TableHead>Punched at</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>State</TableHead>
                {canManage && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{deviceLabel(row.device_id)}</TableCell>
                  <TableCell className="tabular-nums">{row.employee_code ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatDateTime(row.punched_at)}
                  </TableCell>
                  <TableCell className="max-w-xs whitespace-normal text-muted-foreground">
                    {row.reason}
                  </TableCell>
                  <TableCell>
                    {row.resolved_at ? (
                      <Badge variant="success">Resolved {formatDateTime(row.resolved_at)}</Badge>
                    ) : (
                      <Badge variant="warning">Open</Badge>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      {!row.resolved_at && row.employee_code !== null && (
                        <Button size="sm" variant="outline" onClick={() => setResolving(row)}>
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DataPanel>

      <DeviceResolveDialog
        exception={resolving}
        deviceLabel={resolving ? deviceLabel(resolving.device_id) : ""}
        onOpenChange={(open) => !open && setResolving(null)}
        onResolved={onResolved}
      />
    </>
  );
}
