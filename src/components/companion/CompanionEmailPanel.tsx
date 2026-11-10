"use client";

import { Copy, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, post } from "@/lib/api";

type Provider = "sendgrid" | "mailgun";

interface EmailInbound {
  enabled: boolean;
  provider?: Provider;
  has_signing_key?: boolean;
  inbound_url?: string | null;
}

const PROVIDER_LABEL: Record<Provider, string> = {
  sendgrid: "SendGrid (Inbound Parse)",
  mailgun: "Mailgun (Routes)",
};

const FORWARD_STEP: Record<Provider, string> = {
  sendgrid: "In SendGrid → Settings → Inbound Parse, add your Ask Miraa address's domain and paste the secret address as the destination URL. Leave “Send raw” off.",
  mailgun: "In Mailgun → Receiving → Routes, add a route for your Ask Miraa address with the action “Forward” to the secret address.",
};

/**
 * Settings → Company → AI → Ask Miraa by email.
 *
 * The workspace's inbound mail provider, the one chosen here, posts each email
 * sent to Ask Miraa's address to a secret AskMiraa address shown once. A sender
 * is answered only when their own domain vouches for the From address (DKIM for
 * that domain, or SPF for that same address), and only as themselves; Mailgun's
 * posts are also checked against its webhook signing key. Offers are confirmed
 * in AskMiraa, never by reply.
 */
export function CompanionEmailPanel() {
  const { data, error, isLoading, reload } = useApiQuery<EmailInbound>("/companion/email-inbound");
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<"new" | "off" | null>(null);
  const [chosen, setChosen] = useState<Provider | null>(null);
  const [signingKey, setSigningKey] = useState("");

  const provider: Provider = chosen ?? data?.provider ?? "sendgrid";
  const keyKept = Boolean(data?.has_signing_key && data?.provider === "mailgun");
  const keyMissing = provider === "mailgun" && !signingKey.trim() && !keyKept;

  const switchOn = async () => {
    setBusy(true);
    try {
      const result = await post<EmailInbound>("/companion/email-inbound", {
        provider,
        signing_key: provider === "mailgun" && signingKey.trim() ? signingKey.trim() : undefined,
      });
      setAddress(result.inbound_url ?? null);
      setSigningKey("");
      toast.success("Ask Miraa by email is on. Copy the address now: it is shown once.");
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "It was not switched on.");
      throw caught;
    } finally {
      setBusy(false);
    }
  };

  const switchOff = async () => {
    try {
      await del("/companion/email-inbound");
      setAddress(null);
      toast.success("Ask Miraa by email is off.");
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "It was not switched off.");
      throw caught;
    }
  };

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      toast.success("Copied.");
    } catch {
      toast.error("Copy it by hand: the browser did not allow it.");
    }
  };

  const on = Boolean(data?.enabled);
  return (
    <DataPanel
      title="Ask Miraa by email"
      description="People email a question and get Ask Miraa's answer back, as themselves. Anything it offers to do is confirmed in AskMiraa, never by replying."
      isLoading={isLoading && !data}
      error={error?.detail ?? null}
      onRetry={reload}
    >
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Mail className="size-4 text-muted-foreground" /> Email to Ask Miraa
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {on && data?.provider ? <Badge variant="outline">{PROVIDER_LABEL[data.provider]}</Badge> : null}
            <Badge variant={on ? "secondary" : "outline"}>{on ? "On" : "Off"}</Badge>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="mira-email-provider" label="Your inbound mail provider">
            <Select value={provider} onValueChange={(value) => setChosen(value as Provider)} disabled={busy}>
              <SelectTrigger id="mira-email-provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sendgrid">{PROVIDER_LABEL.sendgrid}</SelectItem>
                <SelectItem value="mailgun">{PROVIDER_LABEL.mailgun}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {provider === "mailgun" ? (
            <FormField
              htmlFor="mira-email-key"
              label="Mailgun HTTP webhook signing key"
              hint={keyKept ? "Saved. Leave blank to keep it." : "Mailgun → Sending → Webhooks → HTTP webhook signing key."}
            >
              <Input
                id="mira-email-key"
                type="password"
                autoComplete="off"
                value={signingKey}
                onChange={(event) => setSigningKey(event.target.value)}
              />
            </FormField>
          ) : null}
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>Pick an address for Ask Miraa on a domain your mail provider receives for (like mira@yourcompany.com).</li>
          <li>Choose your provider, switch this on and copy the secret AskMiraa address that appears.</li>
          <li>{FORWARD_STEP[provider]}</li>
          <li>
            A sender is answered only when their own domain vouches for the From address (DKIM for that domain, or SPF
            for that same address) and they sign in to AskMiraa with it. Pay, leave and other personal records are not
            written into the email: it links to AskMiraa. People your two-step rule covers are asked to use AskMiraa
            itself.
          </li>
        </ol>
        {address && (
          <FormField htmlFor="mira-email-address" label="Secret address (shown once)">
            <div className="flex gap-2">
              <Input id="mira-email-address" readOnly value={address} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" aria-label="Copy the address" onClick={() => void copy()}>
                <Copy />
              </Button>
            </div>
          </FormField>
        )}
        {on && !address && (
          <Alert>
            <AlertDescription>
              It is on. The secret address was shown when it was switched on; get a new one to see it again (the old one
              stops working). A new address also saves a change of provider or key.
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          {!on ? (
            <Button disabled={busy || keyMissing} onClick={() => void switchOn().catch(() => undefined)}>
              {busy && <Loader2 className="animate-spin" />}
              Switch on
            </Button>
          ) : (
            <>
              <Button variant="outline" disabled={busy || keyMissing} onClick={() => setConfirming("new")}>
                Get a new address
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setConfirming("off")}>
                Switch off
              </Button>
            </>
          )}
        </div>
        {keyMissing ? (
          <p className="text-xs text-muted-foreground">Mailgun needs its signing key, so AskMiraa can tell its posts from anyone else&apos;s.</p>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming === "off" ? "Switch Ask Miraa by email off?" : "Get a new secret address?"}
        description={
          confirming === "off"
            ? "Email sent to Ask Miraa is no longer answered. Your mail provider can keep sending it; AskMiraa refuses it."
            : "The old address stops working at once. Put the new one in your mail provider straight after."
        }
        confirmLabel={confirming === "off" ? "Switch off" : "Get a new address"}
        destructive={confirming === "off"}
        onConfirm={confirming === "off" ? switchOff : switchOn}
      />
    </DataPanel>
  );
}
