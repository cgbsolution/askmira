"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { ApiError, post } from "@/lib/api";
import type { AuthResponse } from "@/lib/types";

import { MfaStep } from "./MfaStep";

type Finish = (code: string, state: string) => Promise<AuthResponse | { mfa_required: true; mfa_token: string }>;

/**
 * Where a provider sends the browser back after sign-in: exchange the code
 * once, then open the portal — or ask for the two-step code.
 */
export function ExternalSignIn({ label, finish }: { label: string; finish: Finish }) {
  const params = useSearchParams();
  const { completeExternal } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const started = useRef(false);
  const next = typeof window !== "undefined" ? window.sessionStorage.getItem("askmira_signin_next") : null;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = params.get("code");
    const state = params.get("state");
    const denied = params.get("error_description") || params.get("error");
    if (denied) {
      setError(denied);
      return;
    }
    if (!code || !state) {
      setError("The sign-in did not come back with what it needs. Start again.");
      return;
    }
    finish(code, state)
      .then((result) => {
        if ("mfa_required" in result && result.mfa_required) {
          setMfaToken(result.mfa_token);
          return;
        }
        window.sessionStorage.removeItem("askmira_signin_next");
        completeExternal(result as AuthResponse, next);
      })
      .catch((caught) => setError(caught instanceof ApiError ? caught.detail : "Could not sign you in."));
  }, [params, finish, completeExternal, next]);

  if (mfaToken) {
    return <MfaStep mfaToken={mfaToken} next={next} onCancel={() => setMfaToken(null)} />;
  }
  if (error) {
    return (
      <div className="grid gap-4">
        <Alert variant="destructive">
          <AlertTitle>{label} sign-in did not finish</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link href="/signin">Back to sign in</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
      Signing you in with {label}…
    </div>
  );
}

export const finishSocial = (provider: string): Finish => (code, state) =>
  post(`/auth/social/${provider}/callback`, { code, state }, { skipAuthRedirect: true });

export const finishSso: Finish = (code, state) => {
  const form = new FormData();
  form.set("code", code);
  form.set("state", state);
  return post("/sso/oidc/callback", form, { skipAuthRedirect: true });
};
