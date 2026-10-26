"use client";

import { Info, Plus } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { PageShell } from "@/components/common/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type {
  Device,
  DeviceIngestionRow,
  DevicePunchException,
  DeviceWithToken,
  IngestionStatus,
  WorkLocation,
} from "@/lib/types/attendance";
import { cn } from "@/lib/utils";

import { DeviceExceptions } from "./DeviceExceptions";
import { DeviceFormDialog } from "./DeviceFormDialog";
import { formatDateTime, errorDetail } from "./DeviceShared";
import { DeviceTable } from "./DeviceTable";
import { DeviceTokenDialog, type IssuedToken } from "./DeviceTokenDialog";

/**
 * Settings → Devices.
 *
 * HR sees every registered device and what it has sent; admins
 * register, edit and rotate. Push tokens are shown once, then only a hint.
 */
export function DevicesScreen() {
  const { hasRole } = useAuth();
  const canManage = hasRole("admin");

  const status = useApiQuery<IngestionStatus>("/devices/ingestion-status");
  const devices = useApiQuery<Device[]>("/devices");
  const locations = useApiQuery<WorkLocation[]>("/attendance/work-locations");
  const exceptions = useApiQuery<DevicePunchException[]>("/devices/exceptions?include_resolved=true");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [rotating, setRotating] = useState<Device | null>(null);
  const [issued, setIssued] = useState<IssuedToken | null>(null);

  const { reload: reloadStatus } = status;
  const { reload: reloadDevices } = devices;
  const { reload: reloadExceptions } = exceptions;
  const reloadAll = useCallback(() => {
    reloadStatus();
    reloadDevices();
    reloadExceptions();
  }, [reloadStatus, reloadDevices, reloadExceptions]);

  const stats = useMemo(() => {
    if (!status.data) return null;
    return new Map<string, DeviceIngestionRow>(status.data.devices.map((row) => [row.device.id, row]));
  }, [status.data]);

  // The device list is the source of truth; the ingestion report stands in if it failed.
  const deviceList: Device[] | null =
    devices.data ?? (status.data ? status.data.devices.map((row) => row.device) : null);

  const openExceptions = (exceptions.data ?? []).filter((row) => row.resolved_at === null).length;

  const rotate = async () => {
    if (!rotating) return;
    try {
      const result = await post<DeviceWithToken>(`/devices/${rotating.id}/rotate-token`);
      setIssued({ device: result, reason: "rotated" });
      reloadAll();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not rotate the token."));
      throw caught;
    }
  };

  return (
    <PageShell
      title="Devices"
      description="Biometric and attendance devices, what they have sent, and punches that need a person attached."
      actions={
        canManage ? (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Register device
          </Button>
        ) : undefined
      }
    >
      <SummaryTiles status={status.data} isLoading={status.isLoading} error={status.error?.detail ?? null} />

      {status.data && (!status.data.pull_ingestion_built || !status.data.silence_alerts_sent) && (
        <Alert>
          <Info />
          <AlertTitle>What this screen does and does not do yet</AlertTitle>
          <AlertDescription>
            {!status.data.pull_ingestion_built && (
              <p>
                Devices push punches to AskMira. Pulling punches from devices, by scheduled polling or
                an on-premises agent, is not built: it needs live vendor devices to build and test
                against.
              </p>
            )}
            {!status.data.silence_alerts_sent && (
              <p>
                A device that stops sending is reported as silent on this page, but no alert is sent
                to anyone.
              </p>
            )}
            {status.data.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="devices">
        <TabsList>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="exceptions">
            Exceptions
            {openExceptions > 0 && (
              <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground tabular-nums">
                {openExceptions}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="mt-4">
          {deviceList === null ? (
            devices.error && !status.isLoading ? (
              <Card tier="tier1">
                <ErrorState message={devices.error.detail} onRetry={reloadAll} />
              </Card>
            ) : (
              <Card tier="tier1">
                <CardContent className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            )
          ) : (
            <DeviceTable
              devices={deviceList}
              stats={stats}
              locations={locations.data}
              canManage={canManage}
              onRegister={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              onEdit={(device) => {
                setEditing(device);
                setFormOpen(true);
              }}
              onRotate={setRotating}
            />
          )}
          {status.data && (
            <p className="mt-2 text-xs text-muted-foreground">
              Figures as of {formatDateTime(status.data.generated_at)}.
            </p>
          )}
        </TabsContent>

        <TabsContent value="exceptions" className="mt-4">
          <DeviceExceptions
            exceptions={exceptions.data}
            error={exceptions.error}
            isLoading={exceptions.isLoading}
            devices={deviceList ?? []}
            canManage={canManage}
            onRetry={reloadExceptions}
            onResolved={reloadAll}
          />
        </TabsContent>
      </Tabs>

      {canManage && (
        <>
          <DeviceFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            device={editing}
            locations={locations.data}
            locationsError={locations.error?.detail ?? null}
            onRegistered={(created) => {
              setIssued({ device: created, reason: "registered" });
              reloadAll();
            }}
            onUpdated={reloadAll}
          />

          <ConfirmDialog
            open={rotating !== null}
            onOpenChange={(open) => !open && setRotating(null)}
            title={`Rotate the token for ${rotating?.name ?? "this device"}?`}
            description="The current token stops working immediately. Punches are refused until the device is configured with the new token."
            confirmLabel="Rotate token"
            destructive
            onConfirm={rotate}
          />
        </>
      )}

      <DeviceTokenDialog issued={issued} onClose={() => setIssued(null)} />
    </PageShell>
  );
}

function SummaryTiles({
  status,
  isLoading,
  error,
}: {
  status: IngestionStatus | null;
  isLoading: boolean;
  error: string | null;
}) {
  if (!status) {
    if (error && !isLoading) {
      return (
        <Card tier="tier1">
          <CardContent className="text-sm text-muted-foreground">
            Ingestion figures could not be loaded: {error}
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const tiles: { label: string; value: number; attention?: boolean }[] = [
    { label: "Devices", value: status.device_count },
    { label: "Silent", value: status.silent_count, attention: status.silent_count > 0 },
    { label: "Open exceptions", value: status.open_exceptions, attention: status.open_exceptions > 0 },
    { label: "Punches, last 24 hours", value: status.punches_last_24h },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label} tier="tier1" className="gap-1 py-4">
          <CardContent>
            <p className="text-sm text-muted-foreground">{tile.label}</p>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold tabular-nums text-foreground",
                tile.attention && "text-marigold-900 dark:text-marigold-100",
              )}
            >
              {tile.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
