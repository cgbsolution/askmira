"use client";

import { Copy, KeyRound, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, post } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

interface MfaStatus {
  enabled: boolean;
  enabled_at: string | null;
  setup_pending: boolean;
  recovery_codes_left: number;
}

interface Setup {
  secret: string;
  otpauth_uri: string;
  account: string;
}

/** Group a base32 key in fours, the way authenticator apps show it. */
function grouped(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Two-step sign-in: an authenticator app code after the password, and before
 * a payroll approval or a bank file release. Set up here, by the person.
 */
export function TwoStepCard({ onEnabled }: { onEnabled?: () => void } = {}) {
  const status = useApiQuery<MfaStatus>("/auth/mfa");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      setSetup(await post<Setup>("/auth/mfa/setup"));
      setCode("");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Set-up could not start.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const result = await post<{ recovery_codes: string[] }>("/auth/mfa/enable", { code: code.trim() });
      setSetup(null);
      setRecovery(result.recovery_codes);
      status.reload();
      onEnabled?.();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "That code did not work.");
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = async () => {
    if (!recovery) return;
    try {
      await navigator.clipboard.writeText(recovery.join("\n"));
      toast.success("Recovery codes copied");
    } catch {
      toast.error("Copying is blocked here. Write the codes down instead.");
    }
  };

  const enabled = status.data?.enabled ?? false;

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4 text-brand-600" /> Two-step sign-in
          {enabled ? <Badge variant="success">On</Badge> : <Badge variant="muted">Off</Badge>}
        </CardTitle>
        <CardDescription>
          A code from an authenticator app after your password — and again before approving payroll or releasing a bank file —
          so a stolen password is not enough.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {recovery && (
          <Alert variant="warning">
            <ShieldCheck />
            <AlertTitle>Save your recovery codes now</AlertTitle>
            <AlertDescription>
              <p>Each works once if you lose your phone. They are not shown again.</p>
              <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm sm:grid-cols-5">
                {recovery.map((value) => (
                  <li key={value}>{value}</li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void copyCodes()}>
                  <Copy /> Copy
                </Button>
                <Button size="sm" onClick={() => setRecovery(null)}>
                  I have saved them
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {enabled ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              On since {formatDateTime(status.data?.enabled_at)} · {status.data?.recovery_codes_left} recovery code
              {status.data?.recovery_codes_left === 1 ? "" : "s"} left
            </p>
            <Button variant="outline" onClick={() => setDisabling(true)}>
              <ShieldOff /> Turn off
            </Button>
          </div>
        ) : setup ? (
          <div className="grid gap-4">
            <ol className="grid gap-2 text-sm text-foreground">
              <li>1. Open an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password).</li>
              <li>
                2. Add an account with this key, or{" "}
                <a href={setup.otpauth_uri} className="font-medium text-primary underline-offset-4 hover:underline">
                  open it in the app
                </a>{" "}
                on this phone:
              </li>
            </ol>
            <code className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm tracking-wider">{grouped(setup.secret)}</code>
            <FormField htmlFor="mfa-confirm" label="3. Enter the code the app shows">
              <Input
                id="mfa-confirm"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={8}
                className="max-w-40"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </FormField>
            <div className="flex gap-2">
              <Button disabled={busy || code.trim().length < 6} onClick={() => void confirm()}>
                {busy && <Loader2 className="animate-spin" />} Turn on
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setSetup(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button disabled={busy || status.isLoading} onClick={() => void start()}>
              {busy && <Loader2 className="animate-spin" />} Set up two-step sign-in
            </Button>
          </div>
        )}
      </CardContent>
      <DisableDialog
        open={disabling}
        onOpenChange={setDisabling}
        onDone={() => {
          setDisabling(false);
          status.reload();
        }}
      />
    </Card>
  );
}

function DisableDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await post("/auth/mfa/disable", { password, code: code.trim() });
      toast.success("Two-step sign-in is off.");
      setPassword("");
      setCode("");
      onDone();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "It could not be turned off.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Turn off two-step sign-in?</DialogTitle>
          <DialogDescription>Your password alone will then sign you in. Confirm with both.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="mfa-off-password" label="Password">
            <Input id="mfa-off-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </FormField>
          <FormField htmlFor="mfa-off-code" label="Code or recovery code">
            <Input id="mfa-off-code" autoComplete="one-time-code" maxLength={16} value={code} onChange={(event) => setCode(event.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Keep it on
          </Button>
          <Button variant="destructive" disabled={busy || !password || !code.trim()} onClick={() => void submit()}>
            {busy && <Loader2 className="animate-spin" />} Turn off
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
