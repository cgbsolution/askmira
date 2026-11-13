"use client";

import { ArrowLeft, Loader2, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { AccountChooser } from "@/components/auth/AccountChooser";
import { recalledLogin, rememberLogin, type WorkspaceBranding } from "@/components/auth/signinState";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { FormField } from "@/components/common/FormField";
import { IconInput } from "@/components/common/IconInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { ApiError, get, post } from "@/lib/api";
import type { SavedAccount } from "@/lib/types";

/**
 * Sign-in, step one: who are you?
 *
 * One field — a work email or a mobile number. AskMiraa finds the company it
 * belongs to and opens that company's own sign-in page, with its name and
 * logo, for the password or the company's single sign-on.
 *
 * With accounts already signed in on this browser it opens on the list of
 * them instead ("Choose an account"). `?add=1` — "Add another account" in the
 * account menu — goes straight to the form, and the accounts already signed in
 * stay signed in.
 */
function IdentifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { savedAccounts, isAuthenticated } = useAuth();
  const [login, setLogin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);
  const next = params.get("next");
  const adding = params.get("add") === "1";
  // null while the browser's signed-in accounts are being read.
  const [accounts, setAccounts] = useState<SavedAccount[] | null>(adding ? [] : null);
  const [useAnother, setUseAnother] = useState(false);

  useEffect(() => {
    if (adding) return;
    savedAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, [adding, savedAccounts]);

  // `?expired=1` is set by the API client when a 401 forces a sign-out.
  useEffect(() => {
    if (params.get("expired")) toast.info("Your session expired. Please sign in again.");
  }, [params]);

  useEffect(() => {
    // Adding an account starts empty: the email remembered is the one already signed in.
    if (!adding) setLogin(recalledLogin());
    get<{ providers: string[] }>("/auth/social/providers", { skipAuthRedirect: true })
      .then((result) => setProviders(result.providers))
      .catch(() => setProviders([]));
  }, [adding]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = login.trim();
    if (!value) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const found = await post<WorkspaceBranding>(
        "/auth/identify",
        { login: value },
        { skipAuthRedirect: true },
      );
      rememberLogin(value);
      const query = next ? `?next=${encodeURIComponent(next)}` : "";
      router.push(`/signin/${found.workspace}${query}`);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.detail : "Could not look that up. Try again.");
      setIsSubmitting(false);
    }
  }

  if (accounts === null) {
    return (
      <div className="grid gap-3" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (accounts.length > 0 && !useAnother) {
    return (
      <AccountChooser
        accounts={accounts}
        next={next}
        onChange={setAccounts}
        onUseAnother={() => {
          setLogin("");
          setUseAnother(true);
        }}
      />
    );
  }

  return (
    <>
      {adding || useAnother ? (
        <div className="mb-8">
          {adding && isAuthenticated ? (
            <Button asChild variant="link" className="mb-4 h-auto p-0 text-muted-foreground">
              <Link href="/">
                <ArrowLeft /> Back to AskMiraa
              </Link>
            </Button>
          ) : useAnother ? (
            <Button
              type="button"
              variant="link"
              className="mb-4 h-auto p-0 text-muted-foreground"
              onClick={() => setUseAnother(false)}
            >
              <ArrowLeft /> Choose an account
            </Button>
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Add another account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with the login for another workspace. Accounts already signed in on this browser stay signed
            in — switch between them from your profile menu.
          </p>
        </div>
      ) : (
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign in to AskMiraa</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your work email or mobile number. We will take you to your company&apos;s sign-in.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField htmlFor="login" label="Work email or mobile number" required>
          <IconInput
            id="login"
            icon={UserRound}
            autoComplete="username"
            autoFocus
            required
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            placeholder="you@company.com or 98765 43210"
          />
        </FormField>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="h-12 w-full font-semibold" disabled={isSubmitting || !login.trim()}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {isSubmitting ? "Finding your company…" : "Continue"}
        </Button>
      </form>

      {providers.length > 0 ? (
        <div className="mt-6 grid gap-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <SocialButtons providers={providers} next={next} />
        </div>
      ) : null}

      <p className="mt-8 text-center text-sm text-muted-foreground">
        New organisation? Your AskMiraa account manager sets up your workspace and its first admin.
      </p>
    </>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <IdentifyForm />
    </Suspense>
  );
}
