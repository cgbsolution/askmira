"use client";

import { Loader2, PlugZap } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { ApiError, get, post } from "@/lib/api";

interface Details {
  client_name: string;
  redirect_host: string | null;
  scopes: { scope: string; label: string }[];
}

/**
 * The consent screen an MCP connector (claude.ai, ChatGPT) sends a person to.
 *
 * Signed in, the person sees which client asks and what it will be able to read
 * as them — never more than their own role allows — and approves or declines.
 * Either way their browser goes back to the client's registered address.
 */
function AuthorizeConsent() {
  const params = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const scope = params.get("scope");

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      const here = `/oauth/authorize?${params.toString()}`;
      router.replace(`/signin?next=${encodeURIComponent(here)}`);
      return;
    }
    const query = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri });
    if (scope) query.set("scope", scope);
    get<Details>(`/oauth/authorize/details?${query.toString()}`)
      .then(setDetails)
      .catch((caught) => setError(caught instanceof ApiError ? caught.detail : "This request could not be read."));
  }, [isLoading, isAuthenticated, clientId, redirectUri, scope, params, router]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    try {
      const result = await post<{ redirect_to: string }>("/oauth/authorize", {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: params.get("response_type") ?? "code",
        code_challenge: params.get("code_challenge") ?? "",
        code_challenge_method: params.get("code_challenge_method") ?? "S256",
        scope,
        state: params.get("state"),
        approve,
      });
      window.location.assign(result.redirect_to);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "That did not go through.");
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-8">
        <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted text-primary">
          <PlugZap className="size-5" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {details ? `Connect ${details.client_name} to AskMira` : "Connect an app to AskMira"}
        </h1>
        {user && (
          <p className="mt-1 text-sm text-muted-foreground">
            It will read AskMira as {user.full_name}. It cannot change anything.
          </p>
        )}
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !details ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-2">
            <p className="text-sm font-medium text-foreground">It will be able to:</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {details.scopes.map((item) => (
                <li key={item.scope}>{item.label}</li>
              ))}
            </ul>
            {details.redirect_host && (
              <p className="text-xs text-muted-foreground">You will be sent back to {details.redirect_host}.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void decide(true)}>
              Allow
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void decide(false)}>
              Decline
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            You can disconnect it any time under Profile → Account and security.
          </p>
        </div>
      )}
    </>
  );
}

export default function AuthorizePage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <AuthorizeConsent />
    </Suspense>
  );
}
