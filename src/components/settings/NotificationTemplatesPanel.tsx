"use client";

import { FileText, Loader2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { put } from "@/lib/api";
import type {
  Channel,
  NotificationEvent,
  NotificationTemplate,
} from "@/lib/types/notifications";

import { errorDetail, formatDateTime } from "./settingsShared";

/** WhatsApp bodies come from Meta-approved templates, so they are not edited here. */
const EDITABLE_CHANNELS: Channel[] = ["email", "in_app", "push"];

const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  in_app: "In-app",
  push: "Mobile push",
  whatsapp: "WhatsApp",
};

/**
 * Notification templates.
 *
 * Saving writes a new version and retires the current one rather than
 * overwriting it, so the wording that went out with last month's payslip
 * notice is still recoverable. An event with no template here falls back to
 * the shipped default.
 */
export function NotificationTemplatesPanel() {
  const templates = useApiQuery<NotificationTemplate[]>("/notifications/admin/templates");
  const events = useApiQuery<NotificationEvent[]>("/notifications/events");
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = templates.data ?? [];

  return (
    <>
      <DataPanel
        title="Templates"
        description="Each save creates the next version; the previous one is kept, inactive."
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus /> Override a message
          </Button>
        }
        isLoading={templates.isLoading}
        error={templates.error?.detail ?? null}
        onRetry={templates.reload}
        isEmpty={rows.length === 0}
        empty={{
          icon: FileText,
          title: "No overrides — every message uses its shipped wording",
          description:
            "Override one only where your wording has to differ; a template you never revisit is one that goes stale.",
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Version</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">{row.event_key}</TableCell>
                <TableCell>
                  <Badge variant="outline">{CHANNEL_LABEL[row.channel] ?? row.channel}</Badge>
                  <div className="mt-1 text-[11px] text-muted-foreground">{row.locale}</div>
                </TableCell>
                <TableCell className="max-w-xs truncate text-sm">
                  {row.subject ?? <span className="text-muted-foreground">No subject</span>}
                </TableCell>
                <TableCell className="text-sm">
                  v{row.version}
                  {row.updated_at && (
                    <div className="text-[11px] text-muted-foreground">
                      {formatDateTime(row.updated_at)}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => setEditing(row)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataPanel>

      <TemplateDialog
        open={creating || editing !== null}
        editing={editing}
        events={events.data ?? []}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        onSaved={templates.reload}
      />
    </>
  );
}

function TemplateDialog({
  open,
  editing,
  events,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  editing: NotificationTemplate | null;
  events: NotificationEvent[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [eventKey, setEventKey] = useState("");
  const [channel, setChannel] = useState<Channel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEventKey(editing?.event_key ?? events[0]?.event_key ?? "");
    setChannel(editing?.channel ?? "email");
    setSubject(editing?.subject ?? "");
    setBody(editing?.body ?? "");
  }, [open, editing, events]);

  const urgent = useMemo(
    () => events.find((event) => event.event_key === eventKey)?.urgent ?? false,
    [events, eventKey],
  );

  const submit = async () => {
    setIsBusy(true);
    try {
      await put("/notifications/admin/templates", {
        event_key: eventKey,
        channel,
        locale: editing?.locale ?? "en-IN",
        subject: channel === "email" ? subject.trim() || null : null,
        body: body.trim(),
      });
      toast.success("Saved as a new version.");
      onSaved();
      onOpenChange(false);
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not save the template."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit ${editing.event_key} (v${editing.version})` : "Override a message"}
          </DialogTitle>
          <DialogDescription>
            Saving writes version {editing ? editing.version + 1 : 1} and retires the current one.
            Nothing is overwritten.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="template-event" label="Event">
              <Select
                value={eventKey}
                onValueChange={setEventKey}
                disabled={editing !== null}
              >
                <SelectTrigger id="template-event" className="w-full">
                  <SelectValue placeholder="Choose an event" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((event) => (
                    <SelectItem key={event.event_key} value={event.event_key}>
                      {event.event_key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField htmlFor="template-channel" label="Channel">
              <Select
                value={channel}
                onValueChange={(next) => setChannel(next as Channel)}
                disabled={editing !== null}
              >
                <SelectTrigger id="template-channel" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDITABLE_CHANNELS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {CHANNEL_LABEL[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {urgent && (
            <Alert>
              <AlertTitle>This is an urgent event</AlertTitle>
              <AlertDescription>
                It bypasses quiet hours and the hourly cap, so the wording should earn the
                interruption.
              </AlertDescription>
            </Alert>
          )}

          {channel === "email" && (
            <FormField htmlFor="template-subject" label="Subject" optional>
              <Input
                id="template-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Your payslip for {{ month }} is ready"
              />
            </FormField>
          )}

          <FormField
            htmlFor="template-body"
            label="Message"
            hint="Placeholders in double braces are filled from the event, for example {{ employee_name }}."
          >
            <Textarea
              id="template-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={8}
              className="font-mono text-xs"
            />
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isBusy || !eventKey || body.trim().length === 0}>
            {isBusy && <Loader2 className="animate-spin" />} Save new version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
