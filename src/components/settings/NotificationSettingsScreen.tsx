"use client";

import { Bell, CircleCheck, CircleSlash, Loader2, Mail, Send, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post, put } from "@/lib/api";
import type {
  ChannelStatus,
  NotificationPolicy,
  SmtpSettings,
} from "@/lib/types/notifications";

import { NotificationTemplatesPanel } from "./NotificationTemplatesPanel";
import { errorDetail, formatDateTime } from "./settingsShared";

const CHANNEL_LABEL: Record<string, string> = {
  in_app: "In-app",
  email: "Email",
  push: "Mobile push",
  whatsapp: "WhatsApp",
};

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "UTC"];

/**
 * Settings → Notifications.
 *
 * Three questions in order: does this channel actually deliver, when may we
 * disturb people, and what does the message say. The first is deliberately
 * first — a workspace that assumes email is going out when the adapter is
 * writing to a log is the failure this screen exists to prevent.
 */
export function NotificationSettingsScreen() {
  const channels = useApiQuery<ChannelStatus[]>("/notifications/channels");

  return (
    <PageShell
      title="Notifications"
      description="Which channels deliver, when people may be disturbed, and what the messages say."
    >
      <DataPanel
        title="Channels"
        description="What happens when the product sends something, per channel."
        isLoading={channels.isLoading}
        error={channels.error?.detail ?? null}
        onRetry={channels.reload}
        isEmpty={(channels.data ?? []).length === 0}
        empty={{ icon: Bell, title: "No channels reported" }}
      >
        <ul className="divide-y divide-border">
          {(channels.data ?? []).map((channel) => (
            <li key={channel.channel} className="flex items-start gap-3 px-5 py-4">
              {channel.state === "live" ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-foreground" />
              ) : (
                <CircleSlash className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {CHANNEL_LABEL[channel.channel] ?? channel.channel}
                  </span>
                  <Badge variant={channel.state === "live" ? "secondary" : "outline"}>
                    {channel.state === "live" ? "Delivering" : "Not delivered"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{channel.summary}</p>
              </div>
            </li>
          ))}
        </ul>
      </DataPanel>

      <Tabs defaultValue="policy">
        <TabsList>
          <TabsTrigger value="policy">Quiet hours &amp; limits</TabsTrigger>
          <TabsTrigger value="relay">Mail relay</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="policy" className="mt-4">
          <PolicyPanel onSaved={channels.reload} />
        </TabsContent>
        <TabsContent value="relay" className="mt-4">
          <SmtpPanel onSaved={channels.reload} />
        </TabsContent>
        <TabsContent value="whatsapp" className="mt-4">
          <WhatsAppPanel onSaved={channels.reload} />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <NotificationTemplatesPanel />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

/** Quiet hours, the hourly cap and how many times a failed send is retried. */
function PolicyPanel({ onSaved }: { onSaved: () => void }) {
  const { data, error, isLoading, reload } = useApiQuery<NotificationPolicy>(
    "/notifications/admin/policy",
  );
  const [values, setValues] = useState<NotificationPolicy | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (data) setValues(data);
  }, [data]);

  const set = <K extends keyof NotificationPolicy>(key: K, value: NotificationPolicy[K]) =>
    setValues((current) => (current ? { ...current, [key]: value } : current));

  const submit = async () => {
    if (!values) return;
    setIsBusy(true);
    try {
      await put("/notifications/admin/policy", {
        quiet_hours_enabled: values.quiet_hours_enabled,
        quiet_start: values.quiet_start,
        quiet_end: values.quiet_end,
        timezone: values.timezone,
        rate_limit_per_hour: values.rate_limit_per_hour,
        max_attempts: values.max_attempts,
      });
      reload();
      onSaved();
      toast.success("Notification policy saved.");
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not save the policy."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <DataPanel
      title="Quiet hours and limits"
      description={
        data && !data.configured
          ? "These are the shipped defaults. Nothing is saved for this workspace until you save."
          : undefined
      }
      isLoading={isLoading || (data !== null && values === null)}
      error={error?.detail ?? null}
      onRetry={reload}
    >
      {values && (
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch
              id="quiet-enabled"
              checked={values.quiet_hours_enabled}
              onCheckedChange={(next) => set("quiet_hours_enabled", next)}
            />
            <Label htmlFor="quiet-enabled" className="text-sm font-normal">
              Hold non-urgent notifications during quiet hours and send them afterwards.
            </Label>
          </div>

          <FormField htmlFor="quiet-start" label="Quiet hours start">
            <Input
              id="quiet-start"
              type="time"
              value={values.quiet_start}
              disabled={!values.quiet_hours_enabled}
              onChange={(event) => set("quiet_start", event.target.value)}
            />
          </FormField>
          <FormField htmlFor="quiet-end" label="Quiet hours end">
            <Input
              id="quiet-end"
              type="time"
              value={values.quiet_end}
              disabled={!values.quiet_hours_enabled}
              onChange={(event) => set("quiet_end", event.target.value)}
            />
          </FormField>

          <FormField
            htmlFor="quiet-timezone"
            label="Quiet hours are read in"
            hint="One zone for the workspace, so a notification is not quiet for one office and loud for another."
          >
            <Select value={values.timezone} onValueChange={(next) => set("timezone", next)}>
              <SelectTrigger id="quiet-timezone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            htmlFor="rate-limit"
            label="Most notifications per person per hour"
            hint="Beyond this they are held, not dropped."
          >
            <Input
              id="rate-limit"
              type="number"
              min={1}
              max={1000}
              value={values.rate_limit_per_hour}
              onChange={(event) => set("rate_limit_per_hour", Number(event.target.value))}
            />
          </FormField>

          <FormField
            htmlFor="max-attempts"
            label="Delivery attempts before giving up"
            hint="Attempts back off between tries; the last failure goes to the dead-letter list."
          >
            <Input
              id="max-attempts"
              type="number"
              min={1}
              max={20}
              value={values.max_attempts}
              onChange={(event) => set("max_attempts", Number(event.target.value))}
            />
          </FormField>

          {values.urgent_events.length > 0 && (
            <Alert className="sm:col-span-2">
              <TriangleAlert />
              <AlertTitle>These events ignore quiet hours and the rate cap</AlertTitle>
              <AlertDescription>
                <div className="flex flex-wrap gap-1.5">
                  {values.urgent_events.map((event) => (
                    <Badge key={event} variant="outline" className="font-mono text-[11px]">
                      {event}
                    </Badge>
                  ))}
                </div>
                <p className="mt-2">
                  Something that must reach somebody tonight is worth more than a quiet evening.
                </p>
              </AlertDescription>
            </Alert>
          )}

          <div className="sm:col-span-2">
            <Button onClick={submit} disabled={isBusy}>
              {isBusy && <Loader2 className="animate-spin" />} Save policy
            </Button>
          </div>
        </div>
      )}
    </DataPanel>
  );
}

/** The workspace's own SMTP relay, and a test that proves it works. */
function SmtpPanel({ onSaved }: { onSaved: () => void }) {
  const { data, error, isLoading, reload } = useApiQuery<SmtpSettings>("/notifications/admin/smtp");
  const [values, setValues] = useState<SmtpSettings | null>(null);
  const [password, setPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (!data) return;
    setValues({
      ...data,
      enabled: data.enabled ?? true,
      host: data.host ?? "",
      port: data.port ?? 587,
      username: data.username ?? "",
      use_starttls: data.use_starttls ?? true,
      use_ssl: data.use_ssl ?? false,
      from_address: data.from_address ?? "",
      from_name: data.from_name ?? "",
    });
    setPassword("");
  }, [data]);

  const set = <K extends keyof SmtpSettings>(key: K, value: SmtpSettings[K]) =>
    setValues((current) => (current ? { ...current, [key]: value } : current));

  const submit = async () => {
    if (!values) return;
    setIsBusy(true);
    try {
      await put("/notifications/admin/smtp", {
        enabled: values.enabled,
        host: (values.host ?? "").trim(),
        port: values.port,
        username: (values.username ?? "").trim() || null,
        // Omitted keeps the stored password; only a typed one replaces it.
        ...(password ? { password } : {}),
        use_starttls: values.use_starttls,
        use_ssl: values.use_ssl,
        from_address: (values.from_address ?? "").trim(),
        from_name: (values.from_name ?? "").trim() || null,
      });
      setPassword("");
      reload();
      onSaved();
      toast.success("Mail relay saved.");
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not save the relay."));
    } finally {
      setIsBusy(false);
    }
  };

  const sendTest = async () => {
    setIsTesting(true);
    try {
      await post("/notifications/admin/smtp/test");
      reload();
      toast.success("Test message sent to your own address. Check that it arrived.");
    } catch (caught) {
      reload();
      toast.error(errorDetail(caught, "The test message could not be sent."));
    } finally {
      setIsTesting(false);
    }
  };

  const bothTls = Boolean(values?.use_ssl && values?.use_starttls);

  return (
    <DataPanel
      title="Mail relay"
      description="Where this workspace's email is sent from. Without one, email is written to the server log and nobody receives it."
      isLoading={isLoading || (data !== null && values === null)}
      error={error?.detail ?? null}
      onRetry={reload}
    >
      {values && (
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          {!values.configured && values.platform_relay_configured && (
            <Alert className="sm:col-span-2">
              <Mail />
              <AlertTitle>Email is going out through the platform relay</AlertTitle>
              <AlertDescription>
                Configuring your own relay here means messages arrive from your domain, which
                matters for deliverability and for how they look to your people.
              </AlertDescription>
            </Alert>
          )}

          {values.last_test_at && (
            <Alert className="sm:col-span-2">
              {values.last_test_ok ? <CircleCheck /> : <TriangleAlert />}
              <AlertTitle>
                Last test {values.last_test_ok ? "succeeded" : "failed"} on{" "}
                {formatDateTime(values.last_test_at)}
              </AlertTitle>
              {!values.last_test_ok && values.last_test_error && (
                <AlertDescription>{values.last_test_error}</AlertDescription>
              )}
            </Alert>
          )}

          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch
              id="smtp-enabled"
              checked={values.enabled ?? false}
              onCheckedChange={(next) => set("enabled", next)}
            />
            <Label htmlFor="smtp-enabled" className="text-sm font-normal">
              Use this relay for all of this workspace&apos;s email.
            </Label>
          </div>

          <FormField htmlFor="smtp-host" label="Host">
            <Input
              id="smtp-host"
              value={values.host ?? ""}
              onChange={(event) => set("host", event.target.value)}
              placeholder="smtp.yourdomain.com"
            />
          </FormField>
          <FormField htmlFor="smtp-port" label="Port">
            <Input
              id="smtp-port"
              type="number"
              min={1}
              max={65535}
              value={values.port ?? 587}
              onChange={(event) => set("port", Number(event.target.value))}
            />
          </FormField>

          <FormField htmlFor="smtp-username" label="Username" optional>
            <Input
              id="smtp-username"
              value={values.username ?? ""}
              onChange={(event) => set("username", event.target.value)}
              autoComplete="off"
            />
          </FormField>
          <FormField
            htmlFor="smtp-password"
            label="Password"
            optional
            hint={
              values.has_password
                ? "A password is stored. Leave this blank to keep it."
                : "Stored encrypted; it is never shown again."
            }
          >
            <Input
              id="smtp-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={values.has_password ? "••••••••" : ""}
              autoComplete="new-password"
            />
          </FormField>

          <FormField htmlFor="smtp-from" label="From address">
            <Input
              id="smtp-from"
              type="email"
              value={values.from_address ?? ""}
              onChange={(event) => set("from_address", event.target.value)}
              placeholder="people@yourdomain.com"
            />
          </FormField>
          <FormField htmlFor="smtp-from-name" label="From name" optional>
            <Input
              id="smtp-from-name"
              value={values.from_name ?? ""}
              onChange={(event) => set("from_name", event.target.value)}
              placeholder="Acme People Team"
            />
          </FormField>

          <div className="flex flex-wrap items-center gap-6 sm:col-span-2">
            <div className="flex items-center gap-3">
              <Switch
                id="smtp-starttls"
                checked={values.use_starttls ?? false}
                onCheckedChange={(next) => {
                  set("use_starttls", next);
                  if (next) set("use_ssl", false);
                }}
              />
              <Label htmlFor="smtp-starttls" className="text-sm font-normal">
                STARTTLS (usually port 587)
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="smtp-ssl"
                checked={values.use_ssl ?? false}
                onCheckedChange={(next) => {
                  set("use_ssl", next);
                  if (next) set("use_starttls", false);
                }}
              />
              <Label htmlFor="smtp-ssl" className="text-sm font-normal">
                Implicit TLS (usually port 465)
              </Label>
            </div>
          </div>

          {bothTls && (
            <Alert className="sm:col-span-2">
              <TriangleAlert />
              <AlertTitle>Choose one of the two</AlertTitle>
              <AlertDescription>
                Implicit TLS and STARTTLS are alternatives, not layers. The API refuses both.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              onClick={submit}
              disabled={
                isBusy ||
                bothTls ||
                !(values.host ?? "").trim() ||
                !(values.from_address ?? "").includes("@")
              }
            >
              {isBusy && <Loader2 className="animate-spin" />} Save relay
            </Button>
            <Button
              variant="outline"
              onClick={sendTest}
              disabled={isTesting || !values.configured}
              title={values.configured ? undefined : "Save the relay before testing it."}
            >
              {isTesting ? <Loader2 className="animate-spin" /> : <Send />} Send a test to myself
            </Button>
          </div>
        </div>
      )}
    </DataPanel>
  );
}

interface WhatsAppSettings {
  configured: boolean;
  platform_connected: boolean;
  enabled?: boolean;
  phone_number_id?: string;
  has_token?: boolean;
}

/** The workspace's own WhatsApp Business account (Meta Cloud API). */
function WhatsAppPanel({ onSaved }: { onSaved: () => void }) {
  const { data, error, isLoading, reload } = useApiQuery<WhatsAppSettings>("/notifications/admin/whatsapp");
  const [enabled, setEnabled] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setEnabled(Boolean(data.enabled));
    setPhoneNumberId(data.phone_number_id ?? "");
    setToken("");
  }, [data]);

  const save = async () => {
    setBusy(true);
    try {
      await put("/notifications/admin/whatsapp", {
        enabled,
        phone_number_id: phoneNumberId.trim(),
        access_token: token.trim() ? token.trim() : null,
      });
      toast.success("WhatsApp settings saved.");
      reload();
      onSaved();
    } catch (caught) {
      toast.error(errorDetail(caught, "The settings were not saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DataPanel
      title="WhatsApp Business account"
      description="Your own Meta WhatsApp Cloud API number. Messages go only to people (and candidates) who opted in, and only with templates Meta has approved."
      isLoading={isLoading && !data}
      error={error?.detail ?? null}
      onRetry={reload}
    >
      <div className="grid gap-4 p-5 md:max-w-xl">
        {data?.platform_connected && (
          <Alert>
            <AlertDescription>WhatsApp is already connected for every workspace on this platform.</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center gap-3">
          <Switch id="wa-enabled" checked={enabled} onCheckedChange={setEnabled} />
          <Label htmlFor="wa-enabled" className="text-sm font-normal">
            Send WhatsApp messages through this account
          </Label>
        </div>
        <FormField htmlFor="wa-phone-id" label="Phone number id" hint="From Meta Business Manager → WhatsApp → API setup.">
          <Input
            id="wa-phone-id"
            inputMode="numeric"
            value={phoneNumberId}
            onChange={(event) => setPhoneNumberId(event.target.value)}
          />
        </FormField>
        <FormField
          htmlFor="wa-token"
          label="Access token"
          hint={data?.has_token ? "A token is saved. Leave blank to keep it." : "A permanent system-user token."}
        >
          <Input
            id="wa-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </FormField>
        <Button className="w-fit" disabled={busy || !phoneNumberId.trim()} onClick={() => void save()}>
          {busy && <Loader2 className="animate-spin" />}
          Save
        </Button>
      </div>
    </DataPanel>
  );
}
