"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useState } from "react";

import { FormField } from "@/components/common/FormField";
import { PasswordInput } from "@/components/common/IconInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError, post } from "@/lib/api";

import { passwordProblem } from "@/lib/password";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  // Arrived from a new login's welcome email rather than Forgot password.
  const isWelcome = params.get("welcome") === "1";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const problem = passwordProblem(password);
  const mismatch = confirm !== password;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (problem || mismatch) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await post("/auth/reset-password", { token, new_password: password });
      setDone(true);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.detail : "Could not reset the password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <Alert variant="destructive">
        <AlertTitle>This link is incomplete</AlertTitle>
        <AlertDescription>
          Open the link from your email again, or{" "}
          <Link href="/forgot-password" className="font-medium underline">
            ask for a new one
          </Link>
          .
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isWelcome ? "Welcome to AskMira" : "Set a new password"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isWelcome
            ? "Choose the password you will sign in with: at least 10 characters, with a letter and a digit."
            : "At least 10 characters, with a letter and a digit. Every device signed in to your account is signed out."}
        </p>
      </div>

      {done ? (
        <div className="space-y-5">
          <Alert variant="success">
            <CheckCircle2 />
            <AlertTitle>{isWelcome ? "Password set" : "Password changed"}</AlertTitle>
            <AlertDescription>
              {isWelcome
                ? "Sign in with your work email and the password you just chose."
                : "Sign in with your new password."}
            </AlertDescription>
          </Alert>
          <Button asChild className="h-12 w-full font-semibold">
            <Link href="/signin">Go to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormField
            htmlFor="password"
            label={isWelcome ? "Password" : "New password"}
            required
            error={submitted ? problem : null}
          >
            <PasswordInput
              id="password"
              autoComplete="new-password"
              autoFocus
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={isWelcome ? "Your password" : "New password"}
            />
          </FormField>
          <FormField
            htmlFor="confirm"
            label={isWelcome ? "Confirm password" : "Confirm new password"}
            required
            error={submitted && mismatch ? "The two passwords do not match." : null}
          >
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Type it again"
            />
          </FormField>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                {error}{" "}
                <Link href="/forgot-password" className="font-medium underline">
                  Ask for a new link
                </Link>
              </AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="h-12 w-full font-semibold" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isWelcome ? "Set my password" : "Set new password"}
          </Button>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
