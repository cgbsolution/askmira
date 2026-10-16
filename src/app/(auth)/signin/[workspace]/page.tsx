"use client";

import { Building2, KeyRound, Loader2, UserRound } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";

import { MfaStep } from "@/components/auth/MfaStep";
import { recalledLogin, rememberLogin, type WorkspaceBranding } from "@/components/auth/signinState";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { IconInput, PasswordInput } from "@/components/common/IconInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { ApiError, get } from "@/lib/api";

/**
 * Sign-in, step two: the company's own page.
 *
 * Its name and logo, the email or mobile from step one already filled in, and
 * the password — or the company's single sign-on, where it has one. A company
 * that enforces SSO shows only that, with a password link kept for its
 * break-glass admin.
 */
function CompanySignIn() {
  const { login } = useAuth();
  const router = useRouter();
  const { workspace } = useParams<{ workspace: string }>();
  const params = useSearchParams();
  const next = params.get("next");

  const [brand, setBrand] = useState<WorkspaceBranding | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [ssoBusy, setSsoBusy] = useState(false);

  useEffect(() => {
    setIdentifier(recalledLogin());
    get<WorkspaceBranding>(`/public/workspaces/${encodeURIComponent(workspace)}`, { skipAuthRedirect: true })
      .then(setBrand)
      .catch((caught) =>
        setLoadError(caught instanceof ApiError ? caught.detail : "This sign-in page could not be loaded."),
      );
  }, [workspace]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      rememberLogin(identifier.trim());
      const challenge = await login(identifier.trim(), password, next, workspace);
      if (challenge) {
        setMfaToken(challenge.mfaToken);
        setIsSubmitting(false);
      }
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.detail : "Could not sign you in.");
      setIsSubmitting(false);
    }
  }

  async function startSso() {
    if (!brand?.sso) return;
    setSsoBusy(true);
    setError(null);
    try {
      if (next) window.sessionStorage.setItem("askmira_signin_next", next);
      const redirect = `${window.location.origin}/signin/sso`;
      const started = await get<{ authorization_url: string }>(
        `/sso/start/${brand.sso.provider_id}?redirect_uri=${encodeURIComponent(redirect)}`,
        { skipAuthRedirect: true },
      );
      window.location.assign(started.authorization_url);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.detail : "Could not start single sign-on.");
      setSsoBusy(false);
    }
  }

  if (mfaToken) {
    return <MfaStep mfaToken={mfaToken} next={next} onCancel={() => setMfaToken(null)} />;
  }
  if (loadError) {
    return (
      <div className="grid gap-4">
        <ErrorState message={loadError} />
        <Button asChild variant="outline">
          <Link href="/signin">Back to sign in</Link>
        </Button>
      </div>
    );
  }
  if (!brand) {
    return (
      <div className="grid gap-4">
        <Skeleton className="mx-auto h-16 w-40" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const ssoOnly = Boolean(brand.sso?.required) && !showPassword;

  return (
    <>
      <div className="mb-8 flex flex-col items-center text-center">
        {brand.logo_url ? (
          // A company's own uploaded logo; its size is not known in advance.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logo_url} alt={brand.name} className="mb-4 max-h-16 max-w-[220px] object-contain" />
        ) : (
          <span className="mb-4 flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="size-7" />
          </span>
        )}
        <h1 className="text-xl font-bold tracking-tight text-foreground">{brand.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your workspace</p>
      </div>

      {brand.sso ? (
        <div className="mb-6 grid gap-3">
          <Button type="button" className="h-12 w-full font-semibold" onClick={() => void startSso()} disabled={ssoBusy}>
            {ssoBusy ? <Loader2 className="animate-spin" /> : <KeyRound />}
            Sign in with {brand.sso.name}
          </Button>
          {ssoOnly ? (
            <p className="text-center text-xs text-muted-foreground">
              {brand.name} signs in only through {brand.sso.name}.{" "}
              <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => setShowPassword(true)}>
                Admin password sign-in
              </Button>
            </p>
          ) : (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or with your password
              <span className="h-px flex-1 bg-border" />
            </div>
          )}
        </div>
      ) : null}

      {!ssoOnly ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormField htmlFor="login" label="Work email or mobile number" required>
            <IconInput
              id="login"
              icon={UserRound}
              autoComplete="username"
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="you@company.com"
            />
          </FormField>
          <FormField htmlFor="password" label="Password" required>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              autoFocus
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
            />
          </FormField>
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button
            type="submit"
            className="h-12 w-full font-semibold"
            disabled={isSubmitting || !identifier.trim() || !password}
          >
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Not your company?{" "}
        <Button type="button" variant="link" className="h-auto p-0" onClick={() => router.push("/signin")}>
          Use a different email or number
        </Button>
      </p>
    </>
  );
}

export default function CompanySignInPage() {
  return (
    <Suspense>
      <CompanySignIn />
    </Suspense>
  );
}
