"use client";

import { KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { apiMessage } from "@/components/people/labels";
import { DetailItem } from "@/components/people/StatusBadges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { post } from "@/lib/api";
import { formatDateTime, humanizeRole } from "@/lib/utils";

/** Mirrors the backend rule in app/schemas/auth.py: ten characters, a letter and a digit. */
function passwordProblem(value: string): string | null {
  if (value.length < 10) return "At least 10 characters.";
  if (!/[A-Za-z]/.test(value)) return "Include at least one letter.";
  if (!/\d/.test(value)) return "Include at least one digit.";
  return null;
}

function ChangePasswordCard() {
  const { logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!current) found.current = "Enter your current password.";
    const problem = passwordProblem(next);
    if (problem) found.next = problem;
    else if (next === current) found.next = "Choose a password different from the current one.";
    if (confirm !== next) found.confirm = "The two new passwords do not match.";
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length) return;

    setIsSaving(true);
    try {
      await post("/auth/change-password", { current_password: current, new_password: next });
      // Changing the password ends every session, this one included.
      toast.success("Password changed. Sign in again with your new password.");
      await logout();
    } catch (error) {
      setServerError(apiMessage(error, "Your password could not be changed."));
      setIsSaving(false);
    }
  };

  return (
    <Card tier="tier1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4 text-brand-600" /> Change password
        </CardTitle>
        <CardDescription>
          Every device you are signed in on is signed out, including this one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid max-w-md gap-4" noValidate>
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          <FormField htmlFor="pw-current" label="Current password" error={errors.current}>
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </FormField>
          <FormField
            htmlFor="pw-new"
            label="New password"
            hint="At least 10 characters, with a letter and a digit."
            error={errors.next}
          >
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
          </FormField>
          <FormField htmlFor="pw-confirm" label="Confirm new password" error={errors.confirm}>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </FormField>
          <div>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              Change password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** The login behind the profile: email, role, last sign-in, and the password. */
export function AccountSecurityTab() {
  const { user, tenant } = useAuth();
  if (!user) return null;
  return (
    <div className="grid gap-6">
      <Card tier="tier1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-brand-600" /> Your login
          </CardTitle>
          <CardDescription>How you sign in to {tenant?.name ?? "this workspace"}.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="Login email">
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5 text-muted-foreground" />
              {user.email}
            </span>
          </DetailItem>
          <DetailItem label="Role">
            <Badge variant="secondary">{humanizeRole(user.role)}</Badge>
          </DetailItem>
          <DetailItem label="Email">
            {user.is_email_verified ? (
              <Badge variant="success">Verified</Badge>
            ) : (
              <Badge variant="warning">Not verified</Badge>
            )}
          </DetailItem>
          <DetailItem label="Last sign-in">{formatDateTime(user.last_login_at)}</DetailItem>
          <DetailItem label="Account created">{formatDateTime(user.created_at)}</DetailItem>
        </CardContent>
      </Card>
      <ChangePasswordCard />
    </div>
  );
}
