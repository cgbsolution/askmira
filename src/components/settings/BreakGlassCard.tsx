"use client";

import { KeyRound, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { TenantSettings } from "@/lib/types/admin";

import { errorDetail } from "./settingsShared";

/**
 * The break-glass account.
 *
 * The one login that may still use a password when SSO is enforced. Without
 * it, an identity provider outage is a workspace nobody — not even its owner —
 * can get into, and the only remedy is a support call. The API refuses to
 * enforce SSO until one is designated, and this card is placed above the
 * providers so the order on screen matches the order the API requires.
 */
export function BreakGlassCard({
  canManage,
  enforcing,
}: {
  canManage: boolean;
  enforcing: boolean;
}) {
  const { data, error, isLoading, reload } = useApiQuery<TenantSettings>("/admin/tenant");
  const [email, setEmail] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const current = data ? String(data.settings?.break_glass_email ?? "") : "";

  useEffect(() => {
    setEmail(current);
  }, [current]);

  const submit = async () => {
    setIsBusy(true);
    try {
      await post("/sso/break-glass", { email: email.trim().toLowerCase() });
      reload();
      toast.success("Break-glass account designated.");
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not set the break-glass account."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <DataPanel
      title={
        <span className="flex items-center gap-2">
          <KeyRound className="size-4" /> Break-glass account
          {current ? (
            <Badge variant="secondary">Designated</Badge>
          ) : (
            <Badge variant="outline">Not set</Badge>
          )}
        </span>
      }
      description="The one account that may still sign in with a password while SSO is enforced."
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
    >
      <div className="grid gap-4 p-5">
        {!current && enforcing && (
          <Alert>
            <AlertTitle>SSO is enforced with no break-glass account</AlertTitle>
            <AlertDescription>
              If your identity provider is unreachable, nobody can sign in. Designate an account
              now.
            </AlertDescription>
          </Alert>
        )}

        {!current && !enforcing && (
          <Alert>
            <AlertTitle>Required before SSO can be enforced</AlertTitle>
            <AlertDescription>
              The API will refuse to enforce SSO until this is set, because an identity provider
              outage would otherwise be an unrecoverable lockout.
            </AlertDescription>
          </Alert>
        )}

        <FormField
          htmlFor="break-glass-email"
          label="Account email"
          hint="Must be an existing administrator in this workspace. Its sign-ins are audited at high severity — a break-glass sign-in is either a genuine outage or an incident, and both should be visible."
        >
          <Input
            id="break-glass-email"
            type="email"
            value={email}
            disabled={!canManage}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="owner@company.com"
            autoComplete="off"
          />
        </FormField>

        {canManage && (
          <div>
            <Button
              onClick={submit}
              disabled={
                isBusy ||
                !email.trim().includes("@") ||
                email.trim().toLowerCase() === current.toLowerCase()
              }
            >
              {isBusy && <Loader2 className="animate-spin" />}
              {current ? "Change break-glass account" : "Designate account"}
            </Button>
          </div>
        )}
      </div>
    </DataPanel>
  );
}
