"use client";

import { CheckCircle2, Loader2, Megaphone, Plus, Send, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { ErrorState } from "@/components/common/ErrorState";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { useOrgReference } from "@/components/people/useOrgReference";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post } from "@/lib/api";
import type { AcknowledgementRegister, Announcement, ManagedAnnouncement } from "@/lib/types/culture";
import { cn, formatDateTime } from "@/lib/utils";

import { apiDetail } from "./cultureShared";

/**
 * Culture → Announcements.
 *
 * Some announcements must be acknowledged — a policy change, a new code of
 * conduct. An acknowledgement is tied to the exact text: edit the text and the
 * old acknowledgements go stale, because agreeing to version one is not agreeing
 * to version two. HR sees who has and has not acknowledged, by name.
 */
export function AnnouncementsScreen() {
  const { hasRole } = useAuth();
  const isHr = hasRole("tenant_admin", "hr_admin", "hr_ops");

  return (
    <PageShell tier="tier2" title="Announcements" description="What the company wants everyone to know.">
      {isHr ? (
        <Tabs defaultValue="mine">
          <TabsList>
            <TabsTrigger value="mine">For me</TabsTrigger>
            <TabsTrigger value="manage">Publish &amp; track</TabsTrigger>
          </TabsList>
          <TabsContent value="mine" className="mt-4">
            <MyAnnouncements />
          </TabsContent>
          <TabsContent value="manage" className="mt-4">
            <ManageAnnouncements />
          </TabsContent>
        </Tabs>
      ) : (
        <MyAnnouncements />
      )}
    </PageShell>
  );
}

function MyAnnouncements() {
  const { data, error, isLoading, reload, setData } = useApiQuery<Announcement[]>("/culture/announcements");
  const [busy, setBusy] = useState<string | null>(null);

  const acknowledge = async (row: Announcement) => {
    setBusy(row.id);
    try {
      const updated = await post<Announcement>(`/culture/announcements/${row.id}/acknowledge`, { channel: "in_app" });
      setData((current) => (current ?? []).map((item) => (item.id === row.id ? updated : item)));
      toast.success("Acknowledged.");
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not record your acknowledgement."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <DataPanel
      tier="tier2"
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
      isEmpty={(data ?? []).length === 0}
      empty={{ icon: Megaphone, title: "No announcements for you" }}
    >
      <ul className="divide-y divide-border">
        {(data ?? []).map((row) => {
          const pending = row.requires_acknowledgement && !row.acknowledged;
          return (
            <li key={row.id} className={cn("grid gap-2 px-5 py-5", pending && "bg-accent/40")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-foreground">{row.title}</h2>
                <span className="text-xs text-muted-foreground">{formatDateTime(row.publish_at)}</span>
              </div>
              <p className="text-sm whitespace-pre-line text-foreground">{row.body}</p>
              {row.requires_acknowledgement && (
                <div className="flex flex-wrap items-center gap-2">
                  {row.acknowledged ? (
                    <Badge variant="success">
                      <CheckCircle2 /> Acknowledged {row.acknowledged_at && formatDateTime(row.acknowledged_at)}
                    </Badge>
                  ) : (
                    <Button size="sm" disabled={busy === row.id} onClick={() => acknowledge(row)}>
                      {busy === row.id && <Loader2 className="animate-spin" />} I have read this
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </DataPanel>
  );
}

function ManageAnnouncements() {
  const { data, error, isLoading, reload } = useApiQuery<ManagedAnnouncement[]>("/culture/announcements/manage");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<ManagedAnnouncement | null>(null);
  const [delivering, setDelivering] = useState(false);

  const deliverDue = async () => {
    setDelivering(true);
    try {
      const result = await post<{ delivered: number; people_notified: number; skipped_stale: number }>(
        "/culture/announcements/deliver-due",
      );
      toast.success(
        `${result.delivered} delivered to ${result.people_notified} people${result.skipped_stale ? `; ${result.skipped_stale} too old to send late` : ""}.`,
      );
      reload();
    } catch (caught) {
      toast.error(apiDetail(caught, "Delivery did not run."));
    } finally {
      setDelivering(false);
    }
  };

  return (
    <>
      <DataPanel
        tier="tier2"
        title="Published"
        actions={
          <>
            <Button size="sm" variant="outline" onClick={deliverDue} disabled={delivering}>
              {delivering ? <Loader2 className="animate-spin" /> : <Send />} Deliver scheduled now
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> New announcement
            </Button>
          </>
        }
        isLoading={isLoading}
        error={error?.detail ?? null}
        onRetry={reload}
        isEmpty={(data ?? []).length === 0}
        empty={{ icon: Megaphone, title: "Nothing published yet" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Announcement</TableHead>
              <TableHead>Audience</TableHead>
              <TableHead>Delivery</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{row.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(row.publish_at)}
                    {row.expires_at && ` · until ${formatDateTime(row.expires_at)}`}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {row.is_live ? <Badge variant="success">Live</Badge> : <Badge variant="outline">Not live</Badge>}
                    {row.requires_acknowledgement && <Badge variant="secondary">Needs acknowledgement</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{row.audience_description}</TableCell>
                <TableCell className="text-sm">
                  {row.delivered_at ? (
                    <>
                      {row.delivered_count} people
                      <div className="text-xs text-muted-foreground">{formatDateTime(row.delivered_at)}</div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Scheduled</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {row.requires_acknowledgement && (
                    <Button size="sm" variant="outline" onClick={() => setViewing(row)}>
                      <Users /> Who has read it
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      <NewAnnouncementDialog open={creating} onOpenChange={setCreating} onCreated={reload} />
      <RegisterSheet announcement={viewing} onOpenChange={(open) => !open && setViewing(null)} />
    </>
  );
}

function RegisterSheet({
  announcement,
  onOpenChange,
}: {
  announcement: ManagedAnnouncement | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, error, isLoading, reload } = useApiQuery<AcknowledgementRegister>(
    announcement ? `/culture/announcements/${announcement.id}/register` : null,
  );
  const name = (id: string) => data?.people[id] ?? "Someone no longer in the directory";

  return (
    <Sheet open={announcement !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{announcement?.title}</SheetTitle>
          <SheetDescription>
            {data ? `${data.acknowledged} of ${data.expected} have acknowledged this version.` : " "}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-6">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : error ? (
            <ErrorState message={error.detail} onRetry={reload} />
          ) : data ? (
            <>
              {data.complete && (
                <Alert variant="success">
                  <CheckCircle2 />
                  <AlertTitle>Everyone in the audience has acknowledged</AlertTitle>
                </Alert>
              )}
              {data.stale.length > 0 && (
                <Alert variant="warning">
                  <AlertTitle>{data.stale.length} acknowledged an earlier version</AlertTitle>
                  <AlertDescription>
                    The text changed after they read it, so their acknowledgement no longer counts:{" "}
                    {data.stale.map(name).join(", ")}.
                  </AlertDescription>
                </Alert>
              )}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-foreground">Not yet ({data.outstanding.length})</h3>
                {data.outstanding.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nobody.</p>
                ) : (
                  <ul className="grid gap-1 text-sm">
                    {data.outstanding.map((id) => (
                      <li key={id}>{name(id)}</li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h3 className="mb-2 text-sm font-semibold text-foreground">Acknowledged ({data.acknowledged_people.length})</h3>
                <ul className="grid gap-1 text-sm">
                  {data.acknowledged_people.map((row) => (
                    <li key={row.employee_id} className="flex justify-between gap-3">
                      <span>{row.name}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(row.acknowledged_at)}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <p className="text-xs text-muted-foreground">{data.note}</p>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const CHANNELS = [
  { value: "in_app", label: "In-app" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "push", label: "Push" },
] as const;

function NewAnnouncementDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const org = useOrgReference();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [publishAt, setPublishAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [needsAck, setNeedsAck] = useState(false);
  const [channels, setChannels] = useState<string[]>(["in_app"]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setBody("");
    setPublishAt("");
    setExpiresAt("");
    setNeedsAck(false);
    setChannels(["in_app"]);
    setDepartments([]);
    setLocations([]);
  }, [open]);

  const toggle = (list: string[], set: (next: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  const submit = async () => {
    setIsBusy(true);
    try {
      await post("/culture/announcements", {
        title: title.trim(),
        body: body.trim(),
        // datetime-local has no zone; the browser's own zone is the author's intent.
        publish_at: publishAt ? new Date(publishAt).toISOString() : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        requires_acknowledgement: needsAck,
        channels,
        audience: { department_ids: departments, location_ids: locations, grades: [] },
      });
      toast.success(publishAt ? "Scheduled." : "Published and delivered.");
      onCreated();
      onOpenChange(false);
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not publish."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New announcement</DialogTitle>
          <DialogDescription>
            Channels are your intent; each person&apos;s notification preferences decide which actually carry it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField htmlFor="announce-title" label="Title">
            <Input id="announce-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField htmlFor="announce-body" label="Message">
            <Textarea id="announce-body" value={body} onChange={(e) => setBody(e.target.value)} rows={7} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="announce-publish" label="Publish at" optional hint="Blank means now.">
              <Input id="announce-publish" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
            </FormField>
            <FormField htmlFor="announce-expires" label="Stop showing at" optional>
              <Input id="announce-expires" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </FormField>
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Channels</legend>
            <div className="flex flex-wrap gap-4">
              {CHANNELS.map((option) => (
                <div key={option.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`announce-channel-${option.value}`}
                    checked={channels.includes(option.value)}
                    disabled={option.value === "in_app"}
                    onCheckedChange={() => toggle(channels, setChannels, option.value)}
                  />
                  <Label htmlFor={`announce-channel-${option.value}`} className="text-sm font-normal">
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Audience</legend>
            <p className="text-xs text-muted-foreground">Nothing ticked means everyone. Departments and locations combine: both must match.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid max-h-40 gap-1.5 overflow-y-auto rounded-md border border-border p-2">
                {org.departments.map((row) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`announce-dept-${row.id}`}
                      checked={departments.includes(row.id)}
                      onCheckedChange={() => toggle(departments, setDepartments, row.id)}
                    />
                    <Label htmlFor={`announce-dept-${row.id}`} className="text-sm font-normal">
                      {row.name}
                    </Label>
                  </div>
                ))}
              </div>
              <div className="grid max-h-40 gap-1.5 overflow-y-auto rounded-md border border-border p-2">
                {org.locations.map((row) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`announce-loc-${row.id}`}
                      checked={locations.includes(row.id)}
                      onCheckedChange={() => toggle(locations, setLocations, row.id)}
                    />
                    <Label htmlFor={`announce-loc-${row.id}`} className="text-sm font-normal">
                      {row.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </fieldset>

          <div className="flex items-start gap-3">
            <Switch id="announce-ack" checked={needsAck} onCheckedChange={setNeedsAck} />
            <Label htmlFor="announce-ack" className="text-sm font-normal">
              Require each person to acknowledge they have read it. You will see who has not.
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || !title.trim() || !body.trim()}>
            {isBusy && <Loader2 className="animate-spin" />} {publishAt ? "Schedule" : "Publish now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
