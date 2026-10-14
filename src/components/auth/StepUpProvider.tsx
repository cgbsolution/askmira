"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { ApiError, get, post, setStepUpHandler } from "@/lib/api";

interface Pending {
  action: string;
  reason: string;
  resolve: (ok: boolean) => void;
}

/**
 * Answers the API's "confirm it is you" (428 with `X-Step-Up-Action`) for the
 * whole app: asks for the password — and the authenticator code when two-step
 * sign-in is on — proves it, and lets the original request go again. A screen
 * that approves payroll needs no code of its own for this.
 */
export function StepUpProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [needsCode, setNeedsCode] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pendingRef = useRef<Pending | null>(null);

  const ask = useCallback(
    (action: string, reason: string) =>
      new Promise<boolean>((resolve) => {
        const next = { action, reason, resolve };
        pendingRef.current = next;
        setPending(next);
        setPassword("");
        setCode("");
        setError(null);
        get<{ enabled: boolean }>("/auth/mfa")
          .then((status) => setNeedsCode(status.enabled))
          .catch(() => setNeedsCode(false));
      }),
    [],
  );

  useEffect(() => {
    setStepUpHandler(ask);
    return () => setStepUpHandler(null);
  }, [ask]);

  const finish = (ok: boolean) => {
    pendingRef.current?.resolve(ok);
    pendingRef.current = null;
    setPending(null);
  };

  const submit = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const challenge = await post<{ satisfied?: boolean; challenge_id?: string }>("/opsec/step-up", {
        action_key: pending.action,
      });
      if (!challenge.satisfied && challenge.challenge_id) {
        const result = await post<{ satisfied: boolean }>(`/opsec/step-up/${challenge.challenge_id}`, {
          password,
          code: needsCode ? code.trim() : undefined,
        });
        if (!result.satisfied) {
          setError(needsCode ? "The password or the code is not right." : "That password is not right.");
          return;
        }
      }
      finish(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Could not confirm. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {children}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && !busy && finish(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" /> Confirm it is you
            </DialogTitle>
            <DialogDescription>{pending?.reason}</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <FormField htmlFor="step-up-password" label="Your password">
              <Input
                id="step-up-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </FormField>
            {needsCode && (
              <FormField htmlFor="step-up-code" label="Code from your authenticator app">
                <Input
                  id="step-up-code"
                  autoComplete="one-time-code"
                  maxLength={16}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </FormField>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => finish(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !password || (needsCode && !code.trim())}>
                {busy && <Loader2 className="animate-spin" />} Confirm
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
