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
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

function SignInForm() {
  const { login } = useAuth();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      await login(email, password, params.get("next"));
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.detail : "Could not sign you in.");
      setIsSubmitting(false);
    }
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
        New workspace?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create one
        </Link>
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
