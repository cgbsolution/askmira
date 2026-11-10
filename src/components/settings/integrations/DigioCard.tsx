"use client";

import { Check, Copy, FileSignature, Loader2, Unlink } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, put } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

interface DigioState {
  connected: boolean;
  settings?: { environment?: string; client_id?: string };
  account_label?: string | null;
  has_secret?: boolean;
  has_webhook_secret?: boolean;
  last_checked_at?: string | null;
  last_error?: string | null;
  webhook_path: string | null;
  environments: string[];
}

const ENV_LABEL: Record<string, string> = {
  sandbox: "Sandbox (testing)",
  production: "Production",
};

/**
 * The workspace's own Digio account for Aadhaar eSign. The credentials are
 * checked at Digio before they are kept and are never shown again.
 */
export function DigioCard({ onChanged }: { onChanged: () => void }) {
  const { data, error, isLoading, reload } = useApiQuery<DigioState>(
    "/integrations/digio",
  );
  const [environment, setEnvironment] = useState("sandbox");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!data) return;
    setEnvironment(data.settings?.environment ?? "sandbox");
    setClientId(data.settings?.client_id ?? "");
  }, [data]);

  const connected = Boolean(data?.connected);
  const webhookUrl =
    data?.webhook_path && typeof window !== "undefined"
      ? `${window.location.origin}${data.webhook_path}`
      : null;

  const save = async () => {
    const next: Record<string, string> = {};
    if (!clientId.trim())
      next.clientId = "Enter the client id from your Digio dashboard.";
    if (!connected && !clientSecret.trim())
      next.clientSecret = "Enter the client secret.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await put("/integrations/digio", {
        environment,
        client_id: clientId.trim(),
        client_secret: clientSecret.trim() || null,
        webhook_secret: webhookSecret.trim() || null,
      });
      setClientSecret("");
      setWebhookSecret("");
      toast.success(
        connected ? "Digio connection updated" : "Digio connected",
        {
          description:
            "Digio accepted the credentials. Letters now go out for Aadhaar eSign on your account.",
        },
      );
      reload();
      onChanged();
    } catch (caught) {
      toast.error(
        caught instanceof ApiError ? caught.detail : "Could not connect Digio.",
      );
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    try {
      await del("/integrations/digio");
      toast.success("Digio disconnected");
      setClientId("");
      reload();
      onChanged();
    } catch (caught) {
      toast.error(
        caught instanceof ApiError
          ? caught.detail
          : "Could not disconnect Digio.",
      );
      throw caught;
    }
  };

  const copy = async () => {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
    } catch {
      toast.error("Could not copy. Select the address and copy it by hand.");
    }
  };

  let body: React.ReactNode;
  if (isLoading && !data) body = <Skeleton className="h-48 w-full" />;
  else if (error)
    body = (
      <ErrorState message={error.detail} onRetry={reload} className="py-6" />
    );
  else
    body = (
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {connected ? (
            <Badge variant="success">Connected</Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
          {connected && data?.settings?.environment && (
            <span className="text-muted-foreground">
              {ENV_LABEL[data.settings.environment] ??
                data.settings.environment}
              {data.last_checked_at
                ? ` · checked ${formatDateTime(data.last_checked_at)}`
                : ""}
            </span>
          )}
        </div>
        {data?.last_error && (
          <p className="text-sm text-destructive">
            Last error: {data.last_error}
          </p>
        )}

        <FormField htmlFor="digio-environment" label="Environment">
          <Select value={environment} onValueChange={setEnvironment}>
            <SelectTrigger id="digio-environment" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(data?.environments ?? ["production", "sandbox"]).map((env) => (
                <SelectItem key={env} value={env}>
                  {ENV_LABEL[env] ?? env}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          htmlFor="digio-client-id"
          label="Client id"
          required
          error={errors.clientId}
        >
          <Input
            id="digio-client-id"
            value={clientId}
            maxLength={200}
            autoComplete="off"
            onChange={(event) => setClientId(event.target.value)}
          />
        </FormField>
        <FormField
          htmlFor="digio-client-secret"
          label="Client secret"
          required={!connected}
          hint={connected ? "Stored. Leave blank to keep it." : undefined}
          error={errors.clientSecret}
        >
          <Input
            id="digio-client-secret"
            type="password"
            value={clientSecret}
            maxLength={500}
            autoComplete="new-password"
            onChange={(event) => setClientSecret(event.target.value)}
          />
        </FormField>
        <FormField
          htmlFor="digio-webhook-secret"
          label="Webhook secret"
          optional
          hint={
            data?.has_webhook_secret
              ? "Stored. Leave blank to keep it."
              : "From Digio's webhook settings. Without it, AskMira checks each letter's status with Digio every hour instead."
          }
        >
          <Input
            id="digio-webhook-secret"
            type="password"
            value={webhookSecret}
            maxLength={500}
            autoComplete="new-password"
            onChange={(event) => setWebhookSecret(event.target.value)}
          />
        </FormField>

        {webhookUrl && (
          <div className="grid gap-1.5">
            <p className="text-sm font-medium">Webhook address for Digio</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                readOnly
                value={webhookUrl}
                aria-label="Webhook address"
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void copy()}
              >
                {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste this in Digio&apos;s webhook settings so a letter turns
              Signed the moment it is signed.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {connected ? "Save changes" : "Check and connect"}
          </Button>
          {connected && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOff(true)}
            >
              <Unlink /> Disconnect
            </Button>
          )}
        </div>
      </form>
    );

  return (
    <Card tier="tier1" id="digio" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="size-4" /> Digio — Aadhaar eSign
        </CardTitle>
        <CardDescription>
          Letters you send for signature go out on your own Digio account; Digio
          emails each signer the link and bills the signature to you.
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Find the client id and secret in your Digio dashboard under API
        credentials.
      </CardFooter>
      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title="Disconnect Digio?"
        description="Letters already out for signature can no longer be checked on this account. New letters cannot be sent for eSign until you connect again."
        confirmLabel="Disconnect"
        destructive
        onConfirm={disconnect}
      />
    </Card>
  );
}
