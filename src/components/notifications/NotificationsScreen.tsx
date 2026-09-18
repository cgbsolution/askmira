"use client";

import { Bell, BellOff, CheckCheck, CircleSlash, Loader2, MessageCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { PageShell } from "@/components/common/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, patch, post, put } from "@/lib/api";
import type {
  Channel,
  ChannelStatus,
  DigestMode,
  NotificationEvent,
  NotificationItem,
  NotificationPreference,
  WhatsAppConsent,
} from "@/lib/types/notifications";
import { cn, formatDateTime } from "@/lib/utils";

const CHANNELS: Channel[] = ["in_app", "email", "push", "whatsapp"];
const CHANNEL_LABEL: Record<Channel, string> = {
  in_app: "In-app",
  email: "Email",
  push: "Push",
  whatsapp: "WhatsApp",
};

const MODE_LABEL: Record<DigestMode, string> = {
  immediate: "Straight away",
  daily_digest: "Daily digest",
  off: "Off",
};

function detail(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.detail : fallback;
}

/** "payroll.payslip_published" → "Payroll: payslip published". */
function eventLabel(key: string): string {
  const [area, ...rest] = key.split(".");
  const what = rest.join(" ").replaceAll("_", " ");
  return what ? `${area.replaceAll("_", " ")}: ${what}` : key.replaceAll("_", " ");
}

/**
 * My notifications: what has been sent to me, and how I want to be told.
 *
 * Preferences are shown beside whether each channel actually delivers, so a
 * person who switches WhatsApp on in a workspace with no verified WhatsApp
 * account is told their choice is saved but nothing will be sent yet — rather
 * than wondering why the message never came.
 */
export function NotificationsScreen() {
  return (
    <PageShell title="Notifications" description="What has been sent to you, and how you want to be told.">
      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox" className="mt-4">
          <InboxTab />
        </TabsContent>
        <TabsContent value="preferences" className="mt-4">
          <PreferencesTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function InboxTab() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, error, isLoading, reload, setData } = useApiQuery<NotificationItem[]>(
    `/notifications?limit=100${unreadOnly ? "&unread=true" : ""}`,
  );
  const [markingAll, setMarkingAll] = useState(false);

  const rows = data ?? [];
  const unread = (data ?? []).filter((row) => row.read_at === null).length;

  const markRead = async (row: NotificationItem) => {
    try {
      const updated = await post<NotificationItem>(`/notifications/${row.id}/read`);
      setData((current) => (current ?? []).map((item) => (item.id === row.id ? updated : item)));
    } catch (caught) {
      toast.error(detail(caught, "Could not mark it read."));
    }
  };

  const markAll = async () => {
    setMarkingAll(true);
    try {
      await post("/notifications/read-all");
      reload();
    } catch (caught) {
      toast.error(detail(caught, "Could not mark everything read."));
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <DataPanel
      title="Inbox"
      description={data ? `${unread} unread.` : undefined}
      actions={
        <>
          <div className="flex items-center gap-2">
            <Switch id="unread-only" checked={unreadOnly} onCheckedChange={setUnreadOnly} />
            <Label htmlFor="unread-only" className="text-sm font-normal">
              Unread only
            </Label>
          </div>
          <Button size="sm" variant="outline" onClick={markAll} disabled={markingAll || unread === 0}>
            {markingAll ? <Loader2 className="animate-spin" /> : <CheckCheck />} Mark all read
          </Button>
        </>
      }
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
      isEmpty={rows.length === 0}
      empty={{
        icon: unreadOnly ? CheckCheck : Bell,
        title: unreadOnly ? "You are all caught up" : "Nothing has been sent to you yet",
      }}
    >
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li
            key={row.id}
            className={cn("flex items-start gap-3 px-5 py-4", row.read_at === null && "bg-accent/40")}
          >
            <span
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                row.read_at === null ? "bg-primary" : "bg-transparent",
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {row.rendered_subject ?? eventLabel(row.event_key)}
                </span>
                {row.is_urgent && <Badge variant="warning">Urgent</Badge>}
                {row.channel !== "in_app" && <Badge variant="outline">{CHANNEL_LABEL[row.channel]}</Badge>}
                {(row.status === "failed" || row.status === "dead_letter") && (
                  <Badge variant="destructive">Not delivered</Badge>
                )}
                {row.status === "deferred" && <Badge variant="muted">Held for quiet hours</Badge>}
              </div>
              <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{row.rendered_body}</p>
              <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(row.created_at)}</div>
            </div>
            {row.read_at === null && (
              <Button size="sm" variant="ghost" onClick={() => markRead(row)}>
                Mark read
              </Button>
            )}
          </li>
        ))}
      </ul>
    </DataPanel>
  );
}

type Grid = Record<string, Partial<Record<Channel, { enabled: boolean; mode: DigestMode }>>>;

function PreferencesTab() {
  const events = useApiQuery<NotificationEvent[]>("/notifications/events");
  const prefs = useApiQuery<NotificationPreference[]>("/notifications/preferences");
  const channels = useApiQuery<ChannelStatus[]>("/notifications/channels");
  const [grid, setGrid] = useState<Grid>({});
  const [dirty, setDirty] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // Shipped defaults first, then the person's own choices on top.
  useEffect(() => {
    if (!events.data || !prefs.data) return;
    const next: Grid = {};
    for (const event of events.data) {
      next[event.event_key] = {};
      for (const [channel, mode] of Object.entries(event.defaults) as [Channel, DigestMode][]) {
        next[event.event_key][channel] = { enabled: mode !== "off", mode: mode === "off" ? "immediate" : mode };
      }
    }
    for (const pref of prefs.data) {
      next[pref.event_key] = next[pref.event_key] ?? {};
      next[pref.event_key][pref.channel] = { enabled: pref.enabled, mode: pref.digest_mode };
    }
    setGrid(next);
    setDirty(false);
  }, [events.data, prefs.data]);

  const live = useMemo(
    () => new Map((channels.data ?? []).map((row) => [row.channel, row])),
    [channels.data],
  );
  const offered = CHANNELS.filter((channel) => live.has(channel) || channel === "in_app");
  const notDelivered = (channels.data ?? []).filter((row) => row.state !== "live");

  const setCell = (eventKey: string, channel: Channel, value: { enabled: boolean; mode: DigestMode }) => {
    setGrid((current) => ({ ...current, [eventKey]: { ...current[eventKey], [channel]: value } }));
    setDirty(true);
  };

  const save = async () => {
    setIsBusy(true);
    const preferences = Object.entries(grid).flatMap(([event_key, cells]) =>
      (Object.entries(cells) as [Channel, { enabled: boolean; mode: DigestMode }][]).map(
        ([channel, cell]) => ({ event_key, channel, enabled: cell.enabled, digest_mode: cell.mode }),
      ),
    );
    try {
      // The API takes at most 200 per call.
      for (let index = 0; index < preferences.length; index += 200) {
        await patch("/notifications/preferences", { preferences: preferences.slice(index, index + 200) });
      }
      toast.success("Preferences saved.");
      prefs.reload();
    } catch (caught) {
      toast.error(detail(caught, "Could not save your preferences."));
    } finally {
      setIsBusy(false);
    }
  };

  const eventsList = events.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      {notDelivered.length > 0 && (
        <Alert>
          <CircleSlash />
          <AlertTitle>Some channels are not delivering in this workspace yet</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {notDelivered.map((row) => (
                <li key={row.channel}>
                  <strong>{CHANNEL_LABEL[row.channel]}:</strong> {row.summary}
                </li>
              ))}
            </ul>
            <p className="mt-2">Your choices for these are saved and will apply once they are connected.</p>
          </AlertDescription>
        </Alert>
      )}

      <WhatsAppConsentCard />

      <DataPanel
        title="How you are told"
        description="Urgent notifications ignore quiet hours and cannot be switched off entirely."
        actions={
          <Button size="sm" onClick={save} disabled={isBusy || !dirty}>
            {isBusy && <Loader2 className="animate-spin" />} Save preferences
          </Button>
        }
        isLoading={events.isLoading || prefs.isLoading}
        error={events.error?.detail ?? prefs.error?.detail ?? null}
        onRetry={() => {
          events.reload();
          prefs.reload();
        }}
        isEmpty={eventsList.length === 0}
        empty={{ icon: BellOff, title: "No notification types to configure" }}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Notification</TableHead>
                {offered.map((channel) => (
                  <TableHead key={channel}>
                    {CHANNEL_LABEL[channel]}
                    {live.get(channel)?.state !== "live" && channel !== "in_app" && (
                      <span className="block text-[11px] font-normal text-muted-foreground">not delivering</span>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventsList.map((event) => (
                <TableRow key={event.event_key}>
                  <TableCell className="text-sm">
                    <span className="capitalize">{eventLabel(event.event_key)}</span>
                    {event.urgent && (
                      <Badge variant="warning" className="ml-2">
                        Urgent
                      </Badge>
                    )}
                  </TableCell>
                  {offered.map((channel) => {
                    const cell = grid[event.event_key]?.[channel] ?? { enabled: false, mode: "immediate" as DigestMode };
                    const id = `pref-${event.event_key}-${channel}`;
                    return (
                      <TableCell key={channel}>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={id}
                            checked={cell.enabled}
                            aria-label={`${eventLabel(event.event_key)} by ${CHANNEL_LABEL[channel]}`}
                            onCheckedChange={(enabled) => setCell(event.event_key, channel, { ...cell, enabled })}
                          />
                          {cell.enabled && channel !== "in_app" && (
                            <Select
                              value={cell.mode === "off" ? "immediate" : cell.mode}
                              onValueChange={(mode) => setCell(event.event_key, channel, { ...cell, mode: mode as DigestMode })}
                            >
                              <SelectTrigger className="h-8 w-36" aria-label="When">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="immediate">{MODE_LABEL.immediate}</SelectItem>
                                {!event.urgent && <SelectItem value="daily_digest">{MODE_LABEL.daily_digest}</SelectItem>}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DataPanel>
    </div>
  );
}

/** WhatsApp needs an explicit, recorded opt-in before anything is sent there. */
function WhatsAppConsentCard() {
  const { data, isLoading, reload } = useApiQuery<WhatsAppConsent | null>("/notifications/whatsapp/consent");
  const [isBusy, setIsBusy] = useState(false);
  const optedIn = data?.opted_in ?? false;

  const toggle = async (next: boolean) => {
    setIsBusy(true);
    try {
      await put("/notifications/whatsapp/consent", { opted_in: next, source: "ess_settings" });
      toast.success(next ? "You have opted in to WhatsApp messages." : "You have opted out of WhatsApp messages.");
      reload();
    } catch (caught) {
      toast.error(detail(caught, "Could not record your choice."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <DataPanel title="WhatsApp" isLoading={isLoading}>
      <div className="flex items-start gap-3 p-5">
        <MessageCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <Label htmlFor="whatsapp-consent" className="text-sm font-medium">
            Send me messages on WhatsApp
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Nothing is sent to WhatsApp without this. Your choice and when you made it are recorded, and
            you can withdraw it at any time.
            {data?.opted_in_at && optedIn && ` Opted in ${formatDateTime(data.opted_in_at)}.`}
            {data?.opted_out_at && !optedIn && ` Opted out ${formatDateTime(data.opted_out_at)}.`}
          </p>
        </div>
        <Switch id="whatsapp-consent" checked={optedIn} disabled={isBusy} onCheckedChange={toggle} />
      </div>
    </DataPanel>
  );
}
