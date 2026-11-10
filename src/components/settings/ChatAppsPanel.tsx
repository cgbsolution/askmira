"use client";

import { Copy, Download, Loader2, Send, Unplug } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useApiQuery } from "@/hooks/useApiQuery";
import { del, downloadFile, post, put } from "@/lib/api";

import { errorDetail, formatDateTime } from "./settingsShared";

type Provider = "slack" | "teams";

interface ChatApp {
  provider: Provider;
  name: string;
  configured: boolean;
  enabled: boolean;
  events: "approvals" | "all";
  has_secret?: boolean;
  app_id?: string | null;
  directory_tenant_id?: string | null;
  connected_as?: string | null;
  last_checked_at?: string | null;
  last_error?: string | null;
  /** People may message the app to ask Ask Mira. */
  ask_mira: boolean;
  /** Slack: its signing secret is saved (checks each event is Slack's). */
  has_signing_secret: boolean;
  /** Where Slack sends events, or Teams its messages, for Ask Mira here. */
  inbound_url: string | null;
}

/** What to do in Slack or Azure so people can message Ask Mira there. */
const ASK_STEPS: Record<Provider, string> = {
  slack:
    "Paste the app's Signing Secret (Basic Information → App Credentials), switch this on and save. Then download the manifest again and paste it over the app's own (Features → App Manifest): it adds direct messages and this address under Event Subscriptions.",
  teams:
    "Switch this on and save, then paste this address as the Azure Bot's Messaging endpoint (Azure Bot → Configuration).",
};

const STEPS: Record<Provider, string[]> = {
  slack: [
    "Download the Slack app manifest below.",
    "In Slack, go to api.slack.com/apps → Create New App → From an app manifest, pick your workspace and paste it.",
    "Install the app to your workspace, then copy the Bot User OAuth Token (it starts with xoxb-) from OAuth & Permissions.",
    "Paste the token here, switch Slack on and save. Send yourself a test.",
  ],
  teams: [
    "In the Azure portal, create an Azure Bot (single tenant) in your Microsoft 365 tenant. Copy its Microsoft App ID and create a client secret.",
    "In Microsoft Entra ID → App registrations → that bot's app → API permissions, add Microsoft Graph → Application → User.Read.All and grant admin consent.",
    "Paste the App ID, the secret and your Directory (tenant) ID here, switch Teams on and save.",
    "Download the Teams app package below and upload it in the Teams admin centre → Manage apps; install it for everyone under Setup policies. Then send yourself a test.",
  ],
};

/**
 * Settings → Notifications → Slack & Teams.
 *
 * The workspace's own Slack app and Teams bot: AskMira messages each person
 * directly, found by their work email, and approval requests carry the same
 * Approve and Reject buttons as the approval email.
 */
export function ChatAppsPanel({ onSaved }: { onSaved: () => void }) {
  const { data, error, isLoading, reload } = useApiQuery<ChatApp[]>("/notifications/admin/chat-apps");
  const changed = () => {
    reload();
    onSaved();
  };
  return (
    <DataPanel
      title="Slack and Microsoft Teams"
      description="Your company's own Slack app or Teams bot sends each person what is waiting on them, with Approve and Reject buttons, found by their work email."
      isLoading={isLoading && !data}
      error={error?.detail ?? null}
      onRetry={reload}
    >
      <div className="grid gap-6 p-5 lg:grid-cols-2">
        {(data ?? []).map((app) => (
          <ChatAppCard key={app.provider} app={app} onChanged={changed} />
        ))}
      </div>
    </DataPanel>
  );
}

function ChatAppCard({ app, onChanged }: { app: ChatApp; onChanged: () => void }) {
  const [enabled, setEnabled] = useState(app.enabled);
  const [events, setEvents] = useState<ChatApp["events"]>(app.events);
  const [secret, setSecret] = useState("");
  const [appId, setAppId] = useState(app.app_id ?? "");
  const [directory, setDirectory] = useState(app.directory_tenant_id ?? "");
  const [askMira, setAskMira] = useState(app.ask_mira);
  const [signing, setSigning] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "manifest" | null>(null);
  const [removing, setRemoving] = useState(false);
  const teams = app.provider === "teams";

  useEffect(() => {
    setEnabled(app.enabled);
    setEvents(app.events);
    setSecret("");
    setAppId(app.app_id ?? "");
    setDirectory(app.directory_tenant_id ?? "");
    setAskMira(app.ask_mira);
    setSigning("");
  }, [app]);

  const save = async () => {
    setBusy("save");
    try {
      await put(`/notifications/admin/chat-apps/${app.provider}`, {
        enabled,
        events,
        secret: secret.trim() ? secret.trim() : null,
        app_id: teams ? appId.trim() : null,
        directory_tenant_id: teams ? directory.trim() : null,
        ask_mira: askMira && enabled,
        signing_secret: !teams && signing.trim() ? signing.trim() : null,
      });
      toast.success(`${app.name} saved.`);
      onChanged();
    } catch (caught) {
      toast.error(errorDetail(caught, `${app.name} was not saved.`));
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    try {
      const result = await post<{ sent: boolean; error: string | null }>(
        `/notifications/admin/chat-apps/${app.provider}/test`,
      );
      if (result.sent) toast.success(`Sent. Check ${app.name}.`);
      else toast.error(result.error ?? "The test was not sent.");
      onChanged();
    } catch (caught) {
      toast.error(errorDetail(caught, "The test was not sent."));
    } finally {
      setBusy(null);
    }
  };

  const manifest = async () => {
    setBusy("manifest");
    try {
      await downloadFile(
        `/notifications/admin/chat-apps/${app.provider}/manifest`,
        teams ? "askmira-teams-app.zip" : "askmira-slack-manifest.json",
      );
    } catch (caught) {
      toast.error(errorDetail(caught, "The download did not start."));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    try {
      await del(`/notifications/admin/chat-apps/${app.provider}`);
      toast.success(`${app.name} disconnected.`);
      onChanged();
    } catch (caught) {
      toast.error(errorDetail(caught, `${app.name} was not disconnected.`));
      throw caught;
    }
  };

  const missing = teams
    ? !appId.trim() || !directory.trim() || (!secret.trim() && !app.has_secret)
    : !secret.trim() && !app.has_secret;
  const signingMissing = !teams && askMira && !signing.trim() && !app.has_signing_secret;

  const copy = async () => {
    if (!app.inbound_url) return;
    try {
      await navigator.clipboard.writeText(app.inbound_url);
      toast.success("Copied.");
    } catch {
      toast.error("Copy it by hand: the browser did not allow it.");
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-border p-4" aria-label={app.name}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{app.name}</h3>
        <Badge variant={app.enabled && app.has_secret ? "secondary" : "outline"}>
          {app.enabled && app.has_secret ? "On" : app.configured ? "Saved, off" : "Not connected"}
        </Badge>
      </div>
      {app.connected_as && (
        <p className="text-xs text-muted-foreground">
          Connected to {app.connected_as}
          {app.last_checked_at ? ` · checked ${formatDateTime(app.last_checked_at)}` : ""}
        </p>
      )}
      {app.last_error && (
        <Alert variant="destructive">
          <AlertDescription>Last test: {app.last_error}</AlertDescription>
        </Alert>
      )}

      <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
        {STEPS[app.provider].map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <div className="flex items-center gap-3">
        <Switch id={`${app.provider}-enabled`} checked={enabled} onCheckedChange={setEnabled} />
        <Label htmlFor={`${app.provider}-enabled`} className="text-sm font-normal">
          Send messages through {app.name}
        </Label>
      </div>

      <FormField htmlFor={`${app.provider}-events`} label="What to send">
        <Select value={events} onValueChange={(value) => setEvents(value as ChatApp["events"])}>
          <SelectTrigger id={`${app.provider}-events`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="approvals">Approval requests only</SelectItem>
            <SelectItem value="all">Everything people are told in AskMira</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      {teams && (
        <>
          <FormField htmlFor="teams-app-id" label="Microsoft App ID" hint="The Azure Bot's app (client) id.">
            <Input
              id="teams-app-id"
              autoComplete="off"
              spellCheck={false}
              value={appId}
              onChange={(event) => setAppId(event.target.value)}
            />
          </FormField>
          <FormField
            htmlFor="teams-directory"
            label="Directory (tenant) ID"
            hint="Microsoft Entra ID → Overview → Tenant ID."
          >
            <Input
              id="teams-directory"
              autoComplete="off"
              spellCheck={false}
              value={directory}
              onChange={(event) => setDirectory(event.target.value)}
            />
          </FormField>
        </>
      )}
      <FormField
        htmlFor={`${app.provider}-secret`}
        label={teams ? "Client secret" : "Bot User OAuth Token"}
        hint={
          app.has_secret
            ? "Saved. Leave blank to keep it."
            : teams
              ? "From the bot's app registration → Certificates & secrets."
              : "Starts with xoxb-."
        }
      >
        <Input
          id={`${app.provider}-secret`}
          type="password"
          autoComplete="off"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
        />
      </FormField>

      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-3">
          {/* Ask Mira replies through the same connected app, so sending must be on. */}
          <Switch
            id={`${app.provider}-ask`}
            checked={askMira && enabled}
            disabled={!enabled}
            onCheckedChange={setAskMira}
          />
          <Label htmlFor={`${app.provider}-ask`} className="text-sm font-normal">
            People can ask Ask Mira by messaging the app in {app.name}
          </Label>
        </div>
        {!enabled ? (
          <p className="text-xs text-muted-foreground">
            Switch on sending messages through {app.name} first: Ask Mira answers through the same app.
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Ask Mira answers each person as themselves, found by the same work email they sign in with, and
          offers are confirmed by replying yes. Pay, leave and other personal records stay in AskMira: the
          reply links to them. People your two-step rule covers are asked to use AskMira itself.{" "}
          {ASK_STEPS[app.provider]}
        </p>
        {!teams && (
          <FormField
            htmlFor="slack-signing"
            label="Signing secret"
            hint={app.has_signing_secret ? "Saved. Leave blank to keep it." : "32 letters and digits."}
          >
            <Input
              id="slack-signing"
              type="password"
              autoComplete="off"
              value={signing}
              onChange={(event) => setSigning(event.target.value)}
            />
          </FormField>
        )}
        {app.inbound_url && (
          <FormField htmlFor={`${app.provider}-inbound`} label={teams ? "Messaging endpoint" : "Event Subscriptions address"}>
            <div className="flex gap-2">
              <Input id={`${app.provider}-inbound`} readOnly value={app.inbound_url} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" aria-label="Copy the address" onClick={() => void copy()}>
                <Copy />
              </Button>
            </div>
          </FormField>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy !== null || (enabled && missing) || signingMissing} onClick={() => void save()}>
          {busy === "save" && <Loader2 className="animate-spin" />}
          Save
        </Button>
        <Button
          variant="outline"
          disabled={busy !== null || !app.has_secret}
          onClick={() => void test()}
        >
          {busy === "test" ? <Loader2 className="animate-spin" /> : <Send />}
          Send me a test
        </Button>
        <Button
          variant="outline"
          disabled={busy !== null || (teams && !app.app_id)}
          onClick={() => void manifest()}
        >
          {busy === "manifest" ? <Loader2 className="animate-spin" /> : <Download />}
          {teams ? "Teams app package" : "Slack app manifest"}
        </Button>
        {app.configured && (
          <Button variant="ghost" disabled={busy !== null} onClick={() => setRemoving(true)}>
            <Unplug /> Disconnect
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={`Disconnect ${app.name}?`}
        description={`AskMira stops sending messages through ${app.name}, and forgets its credentials. People still get email and in-app notices.`}
        confirmLabel="Disconnect"
        destructive
        onConfirm={remove}
      />
    </section>
  );
}
