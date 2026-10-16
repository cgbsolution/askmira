"use client";

import { Loader2 } from "lucide-react";
import React, { useState } from "react";

import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

/**
 * The second factor, after a right password or a provider's sign-in: a code
 * from the authenticator app, or a recovery code.
 */
export function MfaStep({
  mfaToken,
  next,
  onCancel,
}: {
  mfaToken: string;
  next: string | null;
  onCancel: () => void;
}) {
  const { completeMfa } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCode(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await completeMfa(mfaToken, code, next);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.detail : "Could not sign you in.");
      if (failure instanceof ApiError && failure.status === 401 && /too long/i.test(failure.detail)) {
        onCancel();
      }
      setIsSubmitting(false);
    }
  }

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
        <Button type="button" variant="ghost" className="w-full" onClick={onCancel}>
          Use a different account
        </Button>
      </form>
    </>
  );
}
