"use client";

import { Loader2, UserRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { recalledLogin, rememberLogin, type WorkspaceBranding } from "@/components/auth/signinState";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { FormField } from "@/components/common/FormField";
import { IconInput } from "@/components/common/IconInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError, get, post } from "@/lib/api";

/**
 * Sign-in, step one: who are you?
 *
 * One field — a work email or a mobile number. AskMira finds the company it
 * belongs to and opens that company's own sign-in page, with its name and
 * logo, for the password or the company's single sign-on.
 */
function IdentifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [login, setLogin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);
  const next = params.get("next");

  // `?expired=1` is set by the API client when a 401 forces a sign-out.
  useEffect(() => {
    if (params.get("expired")) toast.info("Your session expired. Please sign in again.");
  }, [params]);

  useEffect(() => {
    setLogin(recalledLogin());
    get<{ providers: string[] }>("/auth/social/providers", { skipAuthRedirect: true })
      .then((result) => setProviders(result.providers))
      .catch(() => setProviders([]));
  }, []);

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

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign in to AskMira</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your work email or mobile number. We will take you to your company&apos;s sign-in.
        </p>
      </div>

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
        New organisation? Your AskMira account manager sets up your workspace and its first admin.
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
