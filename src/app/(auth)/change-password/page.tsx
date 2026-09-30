"use client";

import { KeyRound, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { PasswordInput } from "@/components/common/IconInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { ApiError, post } from "@/lib/api";
import { passwordProblem } from "@/lib/password";

/**
 * Replace a temporary password before anything else.
 *
 * HR hands out a one-time password when it creates a login or resets one; the
 * portal sends that person here first. Changing a password ends every session,
 * so the page signs straight back in with the new one.
 */
export default function ChangePasswordPage() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/signin?next=/change-password");
  }, [isLoading, isAuthenticated, router]);

  const problem = passwordProblem(password);
  const mismatch = confirm !== password;
  const reused = password.length > 0 && password === current;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!user || problem || mismatch || reused || !current) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await post("/auth/change-password", {
        current_password: current,
        new_password: password,
      });
      toast.success("Password changed");
      // Every earlier session ended with the change, this one included.
      await login(user.email, password, "/");
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.detail : "Could not change the password.");
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="mb-8">
        <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted text-primary">
          <KeyRound className="size-5" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Choose your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user?.must_change_password
            ? "You signed in with a temporary password. Set your own to continue."
            : "Set a new password for your account."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField
          htmlFor="current"
          label={user?.must_change_password ? "Temporary password" : "Current password"}
          required
          error={submitted && !current ? "Enter the password you signed in with." : null}
        >
          <PasswordInput
            id="current"
            autoComplete="current-password"
            autoFocus
            required
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </FormField>
        <FormField
          htmlFor="password"
          label="New password"
          required
          hint="At least 10 characters, with a letter and a digit."
          error={
            submitted
              ? (problem ?? (reused ? "Choose a password different from the temporary one." : null))
              : null
          }
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>
        <FormField
          htmlFor="confirm"
          label="Confirm new password"
          required
          error={submitted && mismatch ? "The two passwords do not match." : null}
        >
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </FormField>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Password not changed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="h-12 w-full font-semibold" disabled={isSubmitting || !user}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Save and continue
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Not you?{" "}
        <Button variant="link" className="h-auto p-0" onClick={() => void logout()}>
          Sign out
        </Button>
      </p>
    </>
  );
}
