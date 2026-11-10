"use client";

import { BookOpen, Check, Copy, Loader2, Unlink } from "lucide-react";
import React, { useState } from "react";
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
import { ApiError, del, patch, put } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

interface ZohoState {
  connected: boolean;
  account_label?: string | null;
  last_checked_at?: string | null;
  last_error?: string | null;
  organisations: { id: string; name: string }[];
  organisation_id: string | null;
  needs_organisation: boolean;
  data_centres: { key: string; label: string }[];
  scopes: string;
}

/**
 * Zoho Books for posting approved payroll journals straight into the books.
 * Connected with a Zoho "Self Client": no app has to be registered by anyone
 * but the customer, and the one-time code is swapped for a refresh token at once.
 */
export function ZohoBooksCard({ onChanged }: { onChanged: () => void }) {
  const { data, error, isLoading, reload } = useApiQuery<ZohoState>(
    "/integrations/zoho-books",
  );
  const [dataCentre, setDataCentre] = useState("in");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [code, setCode] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [copied, setCopied] = useState(false);

  const connected = Boolean(data?.connected);

  const connect = async () => {
    const next: Record<string, string> = {};
    if (!clientId.trim()) next.clientId = "Enter the client id.";
    if (!clientSecret.trim()) next.clientSecret = "Enter the client secret.";
    if (!code.trim()) next.code = "Paste the code you generated.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const result = await put<ZohoState>("/integrations/zoho-books", {
        data_centre: dataCentre,
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        code: code.trim(),
      });
      setClientSecret("");
      setCode("");
      toast.success(
        result.needs_organisation
          ? "Zoho connected — choose the organisation"
          : "Zoho Books connected",
      );
      reload();
      onChanged();
    } catch (caught) {
      toast.error(
        caught instanceof ApiError
          ? caught.detail
          : "Could not connect Zoho Books.",
      );
    } finally {
      setBusy(false);
    }
  };

  const choose = async () => {
    if (!organisation) {
      setErrors({ organisation: "Choose the organisation payroll posts to." });
      return;
    }
    setBusy(true);
    try {
      await patch("/integrations/zoho-books/organisation", {
        organisation_id: organisation,
      });
      toast.success("Organisation saved");
      reload();
      onChanged();
    } catch (caught) {
      toast.error(
        caught instanceof ApiError
          ? caught.detail
          : "Could not save the organisation.",
      );
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    try {
      await del("/integrations/zoho-books");
      toast.success("Zoho Books disconnected");
      reload();
      onChanged();
    } catch (caught) {
      toast.error(
        caught instanceof ApiError
          ? caught.detail
          : "Could not disconnect Zoho Books.",
      );
      throw caught;
    }
  };

  const copyScopes = async () => {
    if (!data?.scopes) return;
    try {
      await navigator.clipboard.writeText(data.scopes);
      setCopied(true);
    } catch {
      toast.error("Could not copy. Select the scopes and copy them by hand.");
    }
  };

  let body: React.ReactNode;
  if (isLoading && !data) body = <Skeleton className="h-48 w-full" />;
  else if (error)
    body = (
      <ErrorState message={error.detail} onRetry={reload} className="py-6" />
    );
  else if (connected && data)
    body = (
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={data.needs_organisation ? "warning" : "success"}>
            {data.needs_organisation ? "Choose organisation" : "Connected"}
          </Badge>
          {data.account_label && (
            <span className="font-medium">{data.account_label}</span>
          )}
          {data.last_checked_at && (
            <span className="text-muted-foreground">
              · saved {formatDateTime(data.last_checked_at)}
            </span>
          )}
        </div>
        {data.last_error && (
          <p className="text-sm text-destructive">
            Last error: {data.last_error}
          </p>
        )}
        {data.needs_organisation ? (
          <div className="grid gap-3">
            <FormField
              htmlFor="zoho-organisation"
              label="Books organisation"
              required
              error={errors.organisation}
            >
              <Select value={organisation} onValueChange={setOrganisation}>
                <SelectTrigger id="zoho-organisation" className="w-full">
                  <SelectValue placeholder="Choose an organisation" />
                </SelectTrigger>
                <SelectContent>
                  {data.organisations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <Button
              onClick={() => void choose()}
              disabled={busy}
              className="w-fit"
            >
              {busy && <Loader2 className="animate-spin" />} Save organisation
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Post an approved run from its page: Journal → Post to Zoho Books.
            Ledger names under Payroll → Accounting must match account names in
            Zoho Books.
          </p>
        )}
        <Button
          variant="outline"
          className="w-fit"
          onClick={() => setConfirmOff(true)}
        >
          <Unlink /> Disconnect
        </Button>
      </div>
    );
  else
    body = (
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void connect();
        }}
      >
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            In the Zoho API Console (api-console.zoho.in for India), add a
            client of type Self Client.
          </li>
          <li>
            Under Generate Code, paste the scopes below, choose 10 minutes, and
            create the code.
          </li>
          <li>
            Paste the client id, client secret and the code here straight away —
            the code works once.
          </li>
        </ol>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            readOnly
            value={data?.scopes ?? ""}
            aria-label="Scopes"
            className="font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void copyScopes()}
          >
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy scopes"}
          </Button>
        </div>
        <FormField htmlFor="zoho-dc" label="Zoho data centre">
          <Select value={dataCentre} onValueChange={setDataCentre}>
            <SelectTrigger id="zoho-dc" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(data?.data_centres ?? []).map((dc) => (
                <SelectItem key={dc.key} value={dc.key}>
                  {dc.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          htmlFor="zoho-client-id"
          label="Client id"
          required
          error={errors.clientId}
        >
          <Input
            id="zoho-client-id"
            value={clientId}
            maxLength={200}
            autoComplete="off"
            onChange={(event) => setClientId(event.target.value)}
          />
        </FormField>
        <FormField
          htmlFor="zoho-client-secret"
          label="Client secret"
          required
          error={errors.clientSecret}
        >
          <Input
            id="zoho-client-secret"
            type="password"
            value={clientSecret}
            maxLength={500}
            autoComplete="new-password"
            onChange={(event) => setClientSecret(event.target.value)}
          />
        </FormField>
        <FormField
          htmlFor="zoho-code"
          label="Code"
          required
          error={errors.code}
        >
          <Input
            id="zoho-code"
            value={code}
            maxLength={500}
            autoComplete="off"
            onChange={(event) => setCode(event.target.value)}
          />
        </FormField>
        <Button type="submit" disabled={busy} className="w-fit">
          {busy && <Loader2 className="animate-spin" />} Connect Zoho Books
        </Button>
      </form>
    );

  return (
    <Card tier="tier1" id="zoho-books" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="size-4" /> Zoho Books — payroll journals
        </CardTitle>
        <CardDescription>
          Post each approved payroll run&apos;s journal straight into Zoho
          Books, once. Tally takes the same journal as an XML import from the
          run&apos;s Journal menu.
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title="Disconnect Zoho Books?"
        description="Journals already posted stay in Zoho Books. New runs can still be exported as files."
        confirmLabel="Disconnect"
        destructive
        onConfirm={disconnect}
      />
    </Card>
  );
}
