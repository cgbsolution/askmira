"use client";

import { FileText, Loader2, RotateCcw, Save, Search, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post, put } from "@/lib/api";
import type { EmailCatalogueItem, EmailTestResult } from "@/lib/types/notifications";

import { EmailPreviewFrame } from "./EmailPreviewFrame";
import { errorDetail, formatDateTime } from "./settingsShared";

type EditableChannel = "email" | "in_app" | "push";

const CHANNEL_LABEL: Record<EditableChannel, string> = {
  email: "Email",
  in_app: "In-app",
  push: "Mobile push",
};

const ALL = "__all";

function changedChannels(item: EmailCatalogueItem): EditableChannel[] {
  return (Object.keys(item.custom) as EditableChannel[]).filter((channel) => item.custom[channel]);
}

/**
 * Settings → Notifications → Emails and messages.
 *
 * Every message AskMira can send, in its built-in wording until the workspace
 * writes its own. Saving writes the next version and retires the current one,
 * so what last month's email said stays on record; "Use the built-in wording"
 * retires the workspace's version without deleting it.
 */
export function NotificationTemplatesPanel() {
  const catalogue = useApiQuery<EmailCatalogueItem[]>("/notifications/admin/emails");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState(ALL);
  const [show, setShow] = useState<"all" | "changed" | "builtin">("all");
  const [editing, setEditing] = useState<EmailCatalogueItem | null>(null);

  const items = useMemo(() => catalogue.data ?? [], [catalogue.data]);
  const groups = useMemo(() => [...new Set(items.map((item) => item.group))].sort(), [items]);
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items
      .filter((item) => group === ALL || item.group === group)
      .filter((item) => {
        const changed = changedChannels(item).length > 0;
        return show === "all" || (show === "changed" ? changed : !changed);
      })
      .filter((item) => {
        if (!needle) return true;
        const own = item.custom.email;
        return [item.event_key, item.default_subject, item.default_body, own?.subject, own?.body]
          .filter(Boolean)
          .some((text) => String(text).toLowerCase().includes(needle));
      })
      .sort((a, b) => a.group.localeCompare(b.group) || a.event_key.localeCompare(b.event_key));
  }, [items, group, show, search]);

  // Keep the open editor on the latest catalogue after a save.
  useEffect(() => {
    if (!editing) return;
    const fresh = items.find((item) => item.event_key === editing.event_key);
    if (fresh && fresh !== editing) setEditing(fresh);
  }, [items, editing]);

  const changedCount = items.filter((item) => changedChannels(item).length > 0).length;

  return (
    <>
      <DataPanel
        tier="tier1"
        title="Emails and messages"
        description={`Every message AskMira sends: ${items.length} in all, ${changedCount} in your own words. Each save is a new version; nothing is overwritten.`}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search messages"
                placeholder="Search subject, wording or event"
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger aria-label="Area" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Every area</SelectItem>
                {groups.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={show} onValueChange={(value) => setShow(value as typeof show)}>
              <SelectTrigger aria-label="Which messages" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All messages</SelectItem>
                <SelectItem value="changed">In your own words</SelectItem>
                <SelectItem value="builtin">Built-in wording</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        isLoading={catalogue.isLoading}
        error={catalogue.error?.detail ?? null}
        onRetry={catalogue.reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: FileText,
          title: "No message matches",
          description: "Clear the search or pick another area.",
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Message</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Wording</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => {
              const own = item.custom.email;
              const changed = changedChannels(item);
              return (
                <TableRow key={item.event_key}>
                  <TableCell className="max-w-md">
                    <div className="truncate text-sm font-medium">
                      {own?.subject || item.default_subject || item.event_key}
                    </div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">
                      {item.event_key}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.approval_buttons ? <Badge variant="secondary">Approve / Reject buttons</Badge> : null}
                      {item.audience === "candidate" ? <Badge variant="outline">To candidates</Badge> : null}
                      {item.urgent ? <Badge variant="outline">Urgent</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{item.group}</TableCell>
                  <TableCell className="text-sm">
                    {changed.length ? (
                      <div className="space-y-1">
                        {changed.map((channel) => (
                          <Badge key={channel} variant="default">
                            {CHANNEL_LABEL[channel]} · v{item.custom[channel]?.version}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Built-in</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setEditing(item)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DataPanel>

      <MessageEditor
        item={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={catalogue.reload}
      />
    </>
  );
}

function MessageEditor({
  item,
  onOpenChange,
  onSaved,
}: {
  item: EmailCatalogueItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [channel, setChannel] = useState<EditableChannel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "reset" | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const own = item?.custom[channel] ?? null;
  const itemKey = item?.event_key ?? null;
  const ownVersion = own?.version ?? 0;

  useEffect(() => {
    if (!item) return;
    const current = item.custom[channel];
    setSubject(current?.subject ?? item.default_subject);
    setBody(current?.body ?? item.default_body);
    // Reload the wording when the message, the channel or the saved version changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, channel, ownVersion]);

  useEffect(() => {
    if (itemKey) setChannel("email");
  }, [itemKey]);

  const insert = (name: string) => {
    const token = `{${name}}`;
    const field = bodyRef.current;
    if (!field) {
      setBody((current) => current + token);
      return;
    }
    const start = field.selectionStart ?? body.length;
    const end = field.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async () => {
    if (!item) return;
    setBusy("save");
    try {
      await put("/notifications/admin/templates", {
        event_key: item.event_key,
        channel,
        locale: "en-IN",
        subject: channel === "email" ? subject.trim() || null : null,
        body: body.trim(),
      });
      toast.success(`Saved as version ${ownVersion + 1}.`);
      onSaved();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not save the message."));
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    if (!item) return;
    setBusy("reset");
    try {
      await post("/notifications/admin/templates/reset", {
        event_key: item.event_key,
        channel,
        locale: "en-IN",
      });
      toast.success("Back to the built-in wording. Your versions are kept in the history.");
      onSaved();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not go back to the built-in wording."));
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async () => {
    if (!item) return;
    setBusy("test");
    try {
      const result = await post<EmailTestResult>("/notifications/admin/emails/test", {
        event_key: item.event_key,
        subject,
        body,
      });
      if (!result.ok) toast.error(result.error ?? "The test email could not be sent.");
      else if (!result.delivered)
        toast.warning("No mail relay is set up, so the test went to the server log, not an inbox.");
      else toast.success(`Test email sent to ${result.sent_to}.`);
    } catch (caught) {
      toast.error(errorDetail(caught, "The test email could not be sent."));
    } finally {
      setBusy(null);
    }
  };

  const unchanged =
    body.trim() === (own?.body ?? item?.default_body ?? "").trim() &&
    (channel !== "email" || subject.trim() === (own?.subject ?? item?.default_subject ?? "").trim());

  return (
    <Sheet open={item !== null} onOpenChange={(open) => busy === null && onOpenChange(open)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-6xl">
        {item ? (
          <>
            <SheetHeader>
              <SheetTitle>{item.default_subject || item.event_key}</SheetTitle>
              <SheetDescription>
                <span className="font-mono text-xs">{item.event_key}</span> · {item.group}
                {own
                  ? ` · your version ${own.version}${own.updated_at ? `, saved ${formatDateTime(own.updated_at)}` : ""}`
                  : " · built-in wording"}
              </SheetDescription>
            </SheetHeader>

            <div className="grid gap-6 px-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="space-y-4">
                <Tabs value={channel} onValueChange={(value) => setChannel(value as EditableChannel)}>
                  <TabsList>
                    {(Object.keys(CHANNEL_LABEL) as EditableChannel[]).map((key) => (
                      <TabsTrigger key={key} value={key}>
                        {CHANNEL_LABEL[key]}
                        {item.custom[key] ? " (edited)" : ""}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                {item.urgent ? (
                  <Alert>
                    <AlertTitle>An urgent message</AlertTitle>
                    <AlertDescription>
                      It is sent even in quiet hours, so the wording should earn the interruption.
                    </AlertDescription>
                  </Alert>
                ) : null}
                {item.approval_buttons && channel === "email" ? (
                  <Alert>
                    <AlertTitle>Approve and Reject are added for you</AlertTitle>
                    <AlertDescription>
                      The approver&apos;s copy carries the buttons under your wording, unless your
                      company turned them off under Email design.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {channel === "email" ? (
                  <FormField htmlFor="message-subject" label="Subject">
                    <Input
                      id="message-subject"
                      value={subject}
                      maxLength={512}
                      onChange={(event) => setSubject(event.target.value)}
                    />
                  </FormField>
                ) : null}

                <FormField
                  htmlFor="message-body"
                  label="Message"
                  hint="A blank line starts a paragraph · a line starting “- ” is a bullet · **words** are bold · web addresses become links."
                >
                  <Textarea
                    id="message-body"
                    ref={bodyRef}
                    rows={10}
                    maxLength={8000}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    className="font-mono text-xs"
                  />
                </FormField>

                {item.placeholders.length ? (
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">Insert a value</p>
                    <div className="flex flex-wrap gap-1.5">
                      {item.placeholders.map((name) => (
                        <Button
                          key={name}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 font-mono text-xs"
                          onClick={() => insert(name)}
                        >
                          {`{${name}}`}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Filled in for each person when the message is sent.
                    </p>
                  </div>
                ) : null}
              </div>

              {channel === "email" ? (
                <EmailPreviewFrame eventKey={item.event_key} subject={subject} body={body} />
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {channel === "push" ? "On the phone" : "In the bell"}
                  </p>
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-sm font-medium">{item.default_subject || "AskMira"}</p>
                    <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{body}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    In-app and push messages are plain text; placeholders are filled in when sent.
                  </p>
                </div>
              )}
            </div>

            <SheetFooter className="flex-row flex-wrap gap-2 border-t border-border">
              <Button onClick={() => void save()} disabled={busy !== null || !body.trim() || unchanged}>
                {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} Save new version
              </Button>
              {channel === "email" ? (
                <Button variant="outline" onClick={() => void sendTest()} disabled={busy !== null || !body.trim()}>
                  {busy === "test" ? <Loader2 className="animate-spin" /> : <Send />} Send me a test
                </Button>
              ) : null}
              {own && item.default_body ? (
                <Button variant="ghost" onClick={() => void reset()} disabled={busy !== null}>
                  {busy === "reset" ? <Loader2 className="animate-spin" /> : <RotateCcw />} Use the built-in wording
                </Button>
              ) : null}
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
