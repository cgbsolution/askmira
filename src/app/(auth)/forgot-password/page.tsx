"use client";

import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { FormField } from "@/components/common/FormField";
import { IconInput } from "@/components/common/IconInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError, post } from "@/lib/api";

/**
 * Ask for a password reset link.
 *
 * The answer is the same whether or not the address has an account, so this
 * page cannot be used to find out who works where.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await post("/auth/forgot-password", { email });
      setSent(true);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.detail : "Could not send the reset link.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Forgot your password?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your work email and we will send you a link to set a new one.
        </p>
      </div>

      {sent ? (
        <Alert variant="success">
          <MailCheck />
          <AlertTitle>Check your inbox</AlertTitle>
          <AlertDescription>
            If {email} has an AskMira account, a reset link is on its way. It works once and
            expires in 30 minutes. Nothing arrived? Check spam, or ask your admin to issue a
            temporary password.
          </AlertDescription>
        </Alert>
      ) : (
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

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="h-12 w-full font-semibold" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isSubmitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/signin" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
      </p>
    </>
  );
}
