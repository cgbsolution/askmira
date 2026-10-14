"use client";

import { Copy, KeyRound, TriangleAlert } from "lucide-react";
import React from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import type { DeviceWithToken } from "@/lib/types/attendance";

import { admsAddress, kioskUrl, PUSH_URL_PATTERN, pushUrl } from "./DeviceShared";

export interface IssuedToken {
  device: DeviceWithToken;
  reason: "registered" | "rotated";
}

/**
 * The push token, shown exactly once.
 *
 * The server stores only a hash, so this dialog is the one chance to copy it.
 * The parent drops the token from state the moment this closes.
 */
export function DeviceTokenDialog({
  issued,
  onClose,
}: {
  issued: IssuedToken | null;
  onClose: () => void;
}) {
  const copy = async (text: string, what: string) => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  };

  const token = issued?.device.push_token ?? "";
  const url = token ? pushUrl(token) : "";
  const adms = token ? admsAddress(token) : "";
  const speaksAdms = issued?.device.vendor === "essl" || issued?.device.vendor === "zkteco";
  const isKiosk = issued?.device.vendor === "kiosk";
  const kiosk = token && isKiosk ? kioskUrl(token) : "";

  return (
    <Dialog open={issued !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            {issued?.reason === "rotated" ? "New push token" : "Device registered"}
          </DialogTitle>
          <DialogDescription>
            {issued &&
              `${issued.device.name} (${issued.device.device_id}). Configure the device with the token or the push URL below.`}
          </DialogDescription>
        </DialogHeader>

        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>This token will not be shown again</AlertTitle>
          <AlertDescription>
            Copy it now. If it is lost, rotate the token and configure the device again.
            {issued?.reason === "rotated" && " The previous token has already stopped working."}
          </AlertDescription>
        </Alert>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="device-token">Push token</Label>
            <div className="flex gap-2">
              <Input id="device-token" readOnly value={token} className="tabular-nums" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copy token"
                onClick={() => void copy(token, "Token")}
              >
                <Copy />
              </Button>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="device-push-url">Push URL (POST)</Label>
            <div className="flex gap-2">
              <Input id="device-push-url" readOnly value={url} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copy push URL"
                onClick={() => void copy(url, "Push URL")}
              >
                <Copy />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Pattern: POST {PUSH_URL_PATTERN}</p>
          </div>
          {isKiosk && (
            <div className="grid gap-1.5">
              <Label htmlFor="device-kiosk-url">Kiosk page</Label>
              <div className="flex gap-2">
                <Input id="device-kiosk-url" readOnly value={kiosk} />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Copy kiosk page address"
                  onClick={() => void copy(kiosk, "Kiosk address")}
                >
                  <Copy />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Open this on the tablet and pin it full screen. People punch with their employee
                code and the PIN they set on their Attendance page.
              </p>
            </div>
          )}
          {speaksAdms && (
            <div className="grid gap-1.5">
              <Label htmlFor="device-adms-url">ADMS server address (eSSL / ZKTeco)</Label>
              <div className="flex gap-2">
                <Input id="device-adms-url" readOnly value={adms} />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Copy ADMS address"
                  onClick={() => void copy(adms, "ADMS address")}
                >
                  <Copy />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter this as the device&apos;s cloud server address; it adds /iclock/cdata
                itself. If the device takes only a host and port, edit the device here and turn
                on push by serial number instead.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>I have saved it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
