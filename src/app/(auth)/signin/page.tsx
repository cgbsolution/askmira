"use client";

import { Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { IconInput, PasswordInput } from "@/components/common/IconInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

function SignInForm() {
  const { login, completeMfa } = useAuth();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");

  // `?expired=1` is set by the API client when a 401 forces a sign-out, so the
  // user is told why they landed back here.
  useEffect(() => {
    if (params.get("expired")) {
      toast.info("Your session expired. Please sign in again.");
    }
  }, [params]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      // `next` is checked by safeNextPath inside login: only a local path is followed.
      const challenge = await login(email, password, params.get("next"));
      if (challenge) {
        setMfaToken(challenge.mfaToken);
        setIsSubmitting(false);
      }
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.detail : "Could not sign you in.");
      setIsSubmitting(false);
    }
  }

  async function handleCode(event: React.FormEvent) {
    event.preventDefault();
    if (!mfaToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await completeMfa(mfaToken, code, params.get("next"));
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.detail : "Could not sign you in.");
      if (failure instanceof ApiError && failure.status === 401 && /too long/i.test(failure.detail)) {
        setMfaToken(null);
      }
      setIsSubmitting(false);
    }
  }

  if (mfaToken) {
    return (
      <>
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Two-step sign-in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the six-digit code from your authenticator app, or one of your recovery codes.
          </p>
        </div>
        <form onSubmit={handleCode} className="space-y-5">
          <FormField htmlFor="mfa-code" label="Code" required>
            <Input
              id="mfa-code"
              autoComplete="one-time-code"
              inputMode="text"
              autoFocus
              required
              maxLength={16}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="123456"
            />
          </FormField>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={isSubmitting || !code.trim()}>
            {isSubmitting && <Loader2 className="animate-spin" />} Verify and sign in
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setMfaToken(null);
              setCode("");
              setError(null);
            }}
          >
            Use a different account
          </Button>
        </form>
      </>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your work email and password to open your workspace.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField htmlFor="email" label="Work email" required>
          <IconInput
            id="email"
            icon={Mail}
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
          />
        </FormField>

        <FormField htmlFor="password" label="Password" required>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
          />
        </FormField>
        <div className="-mt-2 flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="h-12 w-full font-semibold" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New organisation? Your AskMira account manager sets up your workspace and its first admin.
      </p>
    </>
  );
}

export default function SignInPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
