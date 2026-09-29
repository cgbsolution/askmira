"use client";

import { Building2, Loader2, Mail, UserRound } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { FormField } from "@/components/common/FormField";
import { IconInput, PasswordInput } from "@/components/common/IconInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

export default function SignUpPage() {
  const { signup } = useAuth();
  const [form, setForm] = useState({
    company_name: "",
    full_name: "",
    email: "",
    password: "",
  });
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((previous) => ({ ...previous, [field]: event.target.value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (form.password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await signup(form);
    } catch (failure) {
      // The backend's password rules are the authority — surface its message
      // rather than duplicating the policy here and letting the two drift.
      setError(failure instanceof ApiError ? failure.detail : "Could not create the workspace.");
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Create your workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You will be the first administrator on this workspace.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField htmlFor="company_name" label="Company name" required>
          <IconInput
            id="company_name"
            icon={Building2}
            required
            minLength={2}
            autoFocus
            value={form.company_name}
            onChange={update("company_name")}
            placeholder="Acme Technologies"
          />
        </FormField>

        <FormField htmlFor="full_name" label="Your name" required>
          <IconInput
            id="full_name"
            icon={UserRound}
            required
            minLength={2}
            autoComplete="name"
            value={form.full_name}
            onChange={update("full_name")}
            placeholder="Enter your full name"
          />
        </FormField>

        <FormField htmlFor="email" label="Work email" required>
          <IconInput
            id="email"
            icon={Mail}
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={update("email")}
            placeholder="you@company.com"
          />
        </FormField>

        <FormField
          htmlFor="password"
          label="Password"
          required
          hint="At least 10 characters, including a letter and a digit."
        >
          <PasswordInput
            id="password"
            required
            minLength={10}
            autoComplete="new-password"
            value={form.password}
            onChange={update("password")}
            placeholder="Choose a password"
          />
        </FormField>

        <FormField htmlFor="confirm_password" label="Confirm password" required>
          <PasswordInput
            id="confirm_password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="Re-enter your password"
          />
        </FormField>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="h-12 w-full font-semibold" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {isSubmitting ? "Creating workspace…" : "Create workspace"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/signin" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
