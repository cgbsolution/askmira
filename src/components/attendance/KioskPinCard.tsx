"use client";

import { KeyRound, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApiQuery } from "@/hooks/useApiQuery";
import { put } from "@/lib/api";
import { formatDate } from "@/lib/utils";

import { errorDetail } from "./shared";

interface PinStatus {
  is_set: boolean;
  set_at: string | null;
  locked_until: string | null;
}

/** Your PIN for punching at a shared kiosk tablet. Only you set it; nobody can read it. */
export function KioskPinCard() {
  const { data, reload } = useApiQuery<PinStatus>("/attendance/kiosk-pin");
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await put("/attendance/kiosk-pin", { pin });
      toast.success("Kiosk PIN saved.");
      setPin("");
      setAgain("");
      reload();
    } catch (caught) {
      toast.error(errorDetail(caught, "The PIN could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  const mismatch = again.length > 0 && again !== pin;
  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4 text-primary" /> Kiosk PIN
        </CardTitle>
        <CardDescription>
          {data?.is_set
            ? `Set ${formatDate(data.set_at)}. Use it with your employee code at a shared punch kiosk.`
            : "Set a PIN to punch at a shared kiosk with your employee code."}
          {data?.locked_until && ` Paused after wrong tries until ${formatDate(data.locked_until)}; a new PIN lifts the pause.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <FormField htmlFor="kiosk-new-pin" label={data?.is_set ? "New PIN" : "PIN"} hint="4 to 6 digits">
          <Input
            id="kiosk-new-pin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />
        </FormField>
        <FormField htmlFor="kiosk-pin-again" label="Again" error={mismatch ? "The two do not match." : null}>
          <Input
            id="kiosk-pin-again"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            value={again}
            onChange={(e) => setAgain(e.target.value.replace(/\D/g, ""))}
          />
        </FormField>
        <Button disabled={busy || pin.length < 4 || pin !== again} onClick={() => void save()}>
          {busy && <Loader2 className="animate-spin" />} Save PIN
        </Button>
      </CardContent>
    </Card>
  );
}
