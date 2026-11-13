"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Copy, Download, ExternalLink, Eye, EyeOff, Loader2, Plus, QrCode, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/data-table/DataTable";
import { DateTimePicker } from "@/components/common/DateTimePicker";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import type { ShowcaseLink } from "@/components/showcase/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, del, downloadFile, fetchFile, patch, post } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

interface Workspace {
  id: string;
  name: string;
  workspace: string;
  is_active: boolean;
  admins: { id: string; full_name: string; email: string; is_active: boolean }[];
}

const STATUS = {
  live: { label: "Live", variant: "success" },
  scheduled: { label: "Scheduled", variant: "secondary" },
  ended: { label: "Ended", variant: "muted" },
  off: { label: "Off", variant: "muted" },
} as const;

// ── Form ────────────────────────────────────────────────────────────────────

interface FormState {
  label: string;
  workspace: string;
  acting: string;
  pin: string;
  daily: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

type Errors = Partial<Record<keyof FormState, string>>;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** An ISO time as the date-time picker holds it: local "YYYY-MM-DDTHH:MM". */
function toLocal(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(
    value.getMinutes(),
  )}`;
}

function blankForm(): FormState {
  const start = new Date();
  start.setSeconds(0, 0);
  start.setMinutes(Math.floor(start.getMinutes() / 5) * 5);
  const end = new Date(start);
  end.setDate(end.getDate() + 3);
  end.setHours(19, 0, 0, 0);
  return {
    label: "",
    workspace: "",
    acting: "",
    pin: "",
    daily: "300",
    startsAt: toLocal(start),
    endsAt: toLocal(end),
    active: true,
  };
}

function fromLink(link: ShowcaseLink): FormState {
  return {
    label: link.label,
    workspace: link.workspace_id,
    acting: link.acting_user_id,
    pin: link.pin ?? "",
    daily: String(link.daily_messages),
    startsAt: toLocal(new Date(link.starts_at)),
    endsAt: toLocal(new Date(link.ends_at)),
    active: link.is_active,
  };
}

function validate(form: FormState, creating: boolean): Errors {
  const errors: Errors = {};
  if (form.label.trim().length < 3) errors.label = "Name the event (at least 3 characters).";
  if (!form.workspace) errors.workspace = "Pick the workspace whose Ask Miraa opens.";
  if (!form.acting) errors.acting = "Pick the admin the chat answers as.";
  if (form.pin && !/^\d{4,8}$/.test(form.pin)) errors.pin = "4 to 8 digits, or leave it empty.";
  if (!/^\d+$/.test(form.daily)) errors.daily = "Enter how many messages a day.";
  else if (Number(form.daily) < 10 || Number(form.daily) > 5000) errors.daily = "Between 10 and 5,000.";
  const starts = form.startsAt ? new Date(form.startsAt) : null;
  const ends = form.endsAt ? new Date(form.endsAt) : null;
  if (!starts) errors.startsAt = "Pick when the link starts.";
  if (!ends) errors.endsAt = "Pick when the link ends.";
  else if (starts && ends <= starts) errors.endsAt = "Must be after the start.";
  else if (creating && ends <= new Date()) errors.endsAt = "Must be in the future.";
  else if (starts && ends.getTime() - starts.getTime() > 366 * 86_400_000) errors.endsAt = "A year at most.";
  return errors;
}

function payload(form: FormState, creating: boolean) {
  return {
    label: form.label.trim(),
    // The QR belongs to its workspace for good: only a new link names one.
    ...(creating ? { workspace_id: form.workspace } : {}),
    acting_user_id: form.acting,
    ...(form.pin ? { pin: form.pin } : creating ? {} : { clear_pin: true }),
    daily_messages: Number.parseInt(form.daily, 10),
    is_active: form.active,
    starts_at: new Date(form.startsAt).toISOString(),
    ends_at: new Date(form.endsAt).toISOString(),
  };
}

// ── Screen ──────────────────────────────────────────────────────────────────

/**
 * The super admin's exhibition QR codes. Each opens a workspace's Ask Miraa,
 * answering as one of its admins over its real records, with no portal sign-in.
 * A link works only inside its window, while it is switched on, and (when it
 * has one) after the stand PIN.
 */
export function ShowcaseLinksScreen() {
  const { data, error, isLoading, reload, setData } = useApiQuery<ShowcaseLink[]>("/platform/showcase-links");
  const [editing, setEditing] = useState<ShowcaseLink | "new" | null>(null);
  const [qrFor, setQrFor] = useState<ShowcaseLink | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);

  function replace(saved: ShowcaseLink) {
    setData((rows) => {
      if (!rows) return [saved];
      return rows.some((r) => r.id === saved.id) ? rows.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...rows];
    });
  }

  async function toggle(link: ShowcaseLink, active: boolean) {
    if (switching) return;
    setSwitching(link.id);
    try {
      const saved = await patch<ShowcaseLink>(`/platform/showcase-links/${link.id}`, { is_active: active });
      replace(saved);
      toast.success(`${saved.label}: switched ${active ? "on" : "off"}`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not switch the link. Please try again.");
    } finally {
      setSwitching(null);
    }
  }

  async function copy(link: ShowcaseLink) {
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy. Select the link in the QR window instead.");
    }
  }

  const columns = useMemo<ColumnDef<ShowcaseLink>[]>(
    () => [
      {
        accessorKey: "label",
        header: "Event",
        cell: ({ row }) => (
          <div className="min-w-48">
            <p className="font-medium text-foreground">{row.original.label}</p>
            <p className="text-xs text-muted-foreground">{row.original.company}</p>
          </div>
        ),
      },
      {
        id: "acting",
        header: "Answers as",
        accessorFn: (row) => `${row.acting_name} ${row.acting_email}`,
        cell: ({ row }) => (
          <div className="min-w-48">
            <p className="text-foreground">{row.original.acting_name}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.pin ? "Stand PIN on" : "No PIN: the scan opens it"}
            </p>
          </div>
        ),
      },
      {
        id: "window",
        header: "Works",
        accessorFn: (row) => row.starts_at,
        cell: ({ row }) => (
          <div className="whitespace-nowrap text-sm">
            <p>{formatDateTime(row.original.starts_at)}</p>
            <p className="text-xs text-muted-foreground">to {formatDateTime(row.original.ends_at)}</p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = STATUS[row.original.status];
          return <Badge variant={status.variant}>{status.label}</Badge>;
        },
      },
      {
        accessorKey: "visits",
        header: "Chats",
        cell: ({ row }) => (
          <div className="whitespace-nowrap tabular-nums">
            <p>{row.original.visits}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.messages_today} of {row.original.daily_messages} messages today
            </p>
          </div>
        ),
      },
      {
        id: "on",
        header: "On",
        meta: { text: false },
        cell: ({ row }) => (
          <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
            <Switch
              checked={row.original.is_active}
              disabled={switching === row.original.id}
              onCheckedChange={(checked) => void toggle(row.original, checked)}
              aria-label={`${row.original.is_active ? "Switch off" : "Switch on"} ${row.original.label}`}
            />
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        meta: { text: false },
        cell: ({ row }) => (
          <div
            className="flex justify-end gap-1"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Button size="sm" variant="outline" onClick={() => setQrFor(row.original)}>
              <QrCode /> QR
            </Button>
            <Button size="icon" variant="ghost" aria-label={`Copy the link for ${row.original.label}`} onClick={() => void copy(row.original)}>
              <Copy />
            </Button>
            <Button asChild size="icon" variant="ghost" aria-label={`Open the chat for ${row.original.label}`}>
              <a href={`/showcase/${row.original.code}`} target="_blank" rel="noopener">
                <ExternalLink />
              </a>
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [switching],
  );

  const live = data?.filter((link) => link.status === "live").length ?? 0;

  return (
    <PageShell
      title="Showcase links"
      eyebrow="Platform"
      icon={QrCode}
      description="One QR code per workspace, for good: print it once. A scan opens the workspace's Ask Miraa, answering as the admin you pick, over its real records. Edit the event, PIN or dates any time and the code stays the same; switch it off to stop open pages at their next message."
      actions={
        <Button onClick={() => setEditing("new")}>
          <Plus /> New showcase link
        </Button>
      }
    >
      <DataTable
        title="Links"
        description={live > 0 ? `${live} ${live === 1 ? "link is" : "links are"} live now.` : "Newest first. Click a row to edit it."}
        columns={columns}
        data={data ?? []}
        getRowId={(row) => row.id}
        noun="links"
        isLoading={isLoading}
        error={error?.message ?? null}
        onRetry={reload}
        selectable={false}
        exportName={false}
        searchPlaceholder="Search event, workspace or admin"
        onRowClick={setEditing}
        empty={{
          icon: QrCode,
          title: "No showcase links yet",
          description: "Make one for your next event, then print its QR code.",
          action: (
            <Button onClick={() => setEditing("new")}>
              <Plus /> New showcase link
            </Button>
          ),
        }}
      />
      <LinkSheet
        link={editing}
        taken={(data ?? []).map((row) => row.workspace_id)}
        onClose={() => setEditing(null)}
        onSaved={(saved, created) => {
          replace(saved);
          setEditing(null);
          if (created) setQrFor(saved);
        }}
        onDeleted={(id) => {
          setData((rows) => (rows ? rows.filter((r) => r.id !== id) : rows));
          setEditing(null);
        }}
      />
      <QrDialog link={qrFor} onClose={() => setQrFor(null)} />
    </PageShell>
  );
}

// ── Create / edit ───────────────────────────────────────────────────────────

function LinkSheet({
  link,
  taken,
  onClose,
  onSaved,
  onDeleted,
}: {
  link: ShowcaseLink | "new" | null;
  /** Workspaces that already have their QR: a new link can't be made for them. */
  taken: string[];
  onClose: () => void;
  onSaved: (saved: ShowcaseLink, created: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  const workspaces = useApiQuery<Workspace[]>(link ? "/platform/workspaces" : null);
  const creating = link === "new";
  const [form, setForm] = useState<FormState>(blankForm);
  const [initial, setInitial] = useState<string>("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const key = link === null ? null : link === "new" ? "new" : link.id;
  if (key !== loadedFor) {
    setLoadedFor(key);
    if (link !== null) {
      const next = link === "new" ? blankForm() : fromLink(link);
      setForm(next);
      setInitial(JSON.stringify(next));
      setSubmitted(false);
      setProblem(null);
    }
  }

  const errors = validate(form, creating);
  const shown = submitted ? errors : {};
  const dirty = link !== null && JSON.stringify(form) !== initial;
  const [showPin, setShowPin] = useState(false);

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function digits(field: "pin" | "daily", max: number) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value.replace(/\s/g, "");
      if (value === "" || (/^\d+$/.test(value) && value.length <= max)) set(field, value);
    };
  }

  function requestClose() {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  async function save() {
    // A ref, not only state: two clicks in one frame both see `saving` false.
    if (savingRef.current || link === null) return;
    setSubmitted(true);
    setProblem(null);
    if (Object.keys(errors).length > 0) return;
    savingRef.current = true;
    setSaving(true);
    try {
      let saved: ShowcaseLink;
      if (link === "new") {
        saved = await post<ShowcaseLink>("/platform/showcase-links", payload(form, true));
        toast.success(`${saved.label}: link created`);
      } else {
        saved = await patch<ShowcaseLink>(`/platform/showcase-links/${link.id}`, payload(form, false));
        toast.success(`${saved.label}: saved`);
      }
      onSaved(saved, link === "new");
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : "Could not save. Please try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function remove() {
    if (link === null || link === "new") return;
    try {
      await del(`/platform/showcase-links/${link.id}`);
      toast.success(`${link.label}: deleted`);
      setConfirmDelete(false);
      onDeleted(link.id);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not delete. Please try again.");
    }
  }

  const choices = (workspaces.data ?? []).filter((w) => w.is_active || w.id === form.workspace);
  const chosen = choices.find((w) => w.id === form.workspace);
  const admins = (chosen?.admins ?? []).filter((a) => a.is_active || a.id === form.acting);

  function pickWorkspace(id: string) {
    const next = choices.find((w) => w.id === id);
    const first = next?.admins.find((a) => a.is_active);
    setForm((current) => ({ ...current, workspace: id, acting: first?.id ?? "" }));
  }

  return (
    <>
      <Sheet open={link !== null} onOpenChange={(next) => (next ? undefined : requestClose())}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{creating ? "New showcase link" : "Edit showcase link"}</SheetTitle>
            <SheetDescription>
              A scan opens this workspace&apos;s Ask Miraa chat, answering as the admin you pick: real records, and
              anything it does happens for real once the visitor presses Confirm.
            </SheetDescription>
          </SheetHeader>
          <form
            className="grid gap-5 px-4 pb-2"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <FormField htmlFor="sc-label" label="Event" required error={shown.label}>
              <Input
                id="sc-label"
                value={form.label}
                maxLength={120}
                placeholder="HR Tech Expo, Bengaluru"
                aria-invalid={Boolean(shown.label)}
                onChange={(event) => set("label", event.target.value)}
              />
            </FormField>
            <FormField
              htmlFor="sc-workspace"
              label="Workspace"
              required
              hint={
                creating
                  ? "One QR per workspace. Deleted this workspace's link before? Making it again brings back the same printed QR."
                  : "The QR belongs to this workspace, and its code never changes."
              }
              error={shown.workspace}
            >
              <Select value={form.workspace} onValueChange={pickWorkspace} disabled={!creating}>
                <SelectTrigger id="sc-workspace" className="w-full" aria-invalid={Boolean(shown.workspace)}>
                  <SelectValue placeholder={workspaces.isLoading ? "Loading…" : "Pick a workspace"} />
                </SelectTrigger>
                <SelectContent>
                  {choices.map((w) => (
                    <SelectItem
                      key={w.id}
                      value={w.id}
                      disabled={creating && taken.includes(w.id)}
                    >
                      {w.name}
                      {creating && taken.includes(w.id) ? " (has its QR: edit it in the list)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              htmlFor="sc-acting"
              label="Answers as"
              required
              hint="Visitors see what this admin sees. A login kept for events keeps the chats out of a person's own history."
              error={shown.acting}
            >
              <Select value={form.acting} onValueChange={(value) => set("acting", value)} disabled={!chosen}>
                <SelectTrigger id="sc-acting" className="w-full" aria-invalid={Boolean(shown.acting)}>
                  <SelectValue placeholder={chosen ? "Pick an admin" : "Pick the workspace first"} />
                </SelectTrigger>
                <SelectContent>
                  {admins.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name} · {a.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {chosen && admins.length === 0 ? (
              <Alert>
                <AlertDescription>{chosen.name} has no active admin. Add one under Organisations first.</AlertDescription>
              </Alert>
            ) : null}

            <Separator />
            <p className="text-sm font-medium">Who can open it</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                htmlFor="sc-pin"
                label="Stand PIN"
                hint="4 to 8 digits your team types on the visitor's phone. Empty: the scan alone opens the chat."
                error={shown.pin}
              >
                <div className="relative">
                  <Input
                    id="sc-pin"
                    inputMode="numeric"
                    autoComplete="off"
                    type={showPin ? "text" : "password"}
                    value={form.pin}
                    placeholder="None"
                    className="pr-10"
                    aria-invalid={Boolean(shown.pin)}
                    onChange={digits("pin", 8)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-0 right-0 size-9"
                    aria-label={showPin ? "Hide the PIN" : "Show the PIN"}
                    onClick={() => setShowPin((on) => !on)}
                  >
                    {showPin ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </FormField>
              <FormField
                htmlFor="sc-daily"
                label="Messages a day"
                required
                hint="For all visitors together. Each chat takes up to 60."
                error={shown.daily}
              >
                <Input
                  id="sc-daily"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.daily}
                  aria-invalid={Boolean(shown.daily)}
                  onChange={digits("daily", 4)}
                />
              </FormField>
            </div>

            <Separator />
            <p className="text-sm font-medium">When it works</p>
            <div className="grid gap-4">
              <FormField htmlFor="sc-starts" label="Starts" required error={shown.startsAt}>
                <DateTimePicker
                  id="sc-starts"
                  value={form.startsAt}
                  aria-invalid={Boolean(shown.startsAt)}
                  onChange={(value) => set("startsAt", value)}
                />
              </FormField>
              <FormField htmlFor="sc-ends" label="Ends" required error={shown.endsAt}>
                <DateTimePicker
                  id="sc-ends"
                  value={form.endsAt}
                  aria-invalid={Boolean(shown.endsAt)}
                  onChange={(value) => set("endsAt", value)}
                />
              </FormField>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="grid gap-0.5">
                  <Label htmlFor="sc-active">Switched on</Label>
                  <p className="text-xs text-muted-foreground">Off: the QR code opens a page that says so.</p>
                </div>
                <Switch id="sc-active" checked={form.active} onCheckedChange={(checked) => set("active", checked)} />
              </div>
            </div>
            {problem ? (
              <Alert variant="destructive">
                <AlertDescription>{problem}</AlertDescription>
              </Alert>
            ) : null}
            <SheetFooter className="flex-row flex-wrap justify-between gap-2 px-0">
              {creating ? (
                <span />
              ) : (
                <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Delete
                </Button>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={requestClose} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || (!creating && !dirty)}>
                  {saving ? <Loader2 className="animate-spin" /> : null}
                  {creating ? "Create link" : "Save changes"}
                </Button>
              </div>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard your changes?"
        description="What you typed here has not been saved."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this link?"
        description="Its QR code shows “switched off” at once and open chats end; the conversations stay in the admin's Ask Miraa history. The code is kept: make a link for this workspace again and the same printed QR works again."
        confirmLabel="Delete link"
        destructive
        onConfirm={remove}
      />
    </>
  );
}

// ── QR code ─────────────────────────────────────────────────────────────────

function QrDialog({ link, onClose }: { link: ShowcaseLink | null; onClose: () => void }) {
  const [image, setImage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const id = link?.id ?? null;

  useEffect(() => {
    setFailed(false);
    setImage(null);
    if (!id) return;
    let made: string | null = null;
    let cancelled = false;
    fetchFile(`/platform/showcase-links/${id}/qr?format=svg`)
      .then(({ blob }) => {
        if (cancelled) return;
        made = URL.createObjectURL(blob);
        setImage(made);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);

  async function save(format: "svg" | "png") {
    if (!link) return;
    try {
      await downloadFile(`/platform/showcase-links/${link.id}/qr?format=${format}`, `${link.label}-qr.${format}`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not download the QR code.");
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy. Select the link and copy it.");
    }
  }

  return (
    <Dialog open={link !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{link?.label}</DialogTitle>
          <DialogDescription>
            Scan it with a phone before you print. SVG stays sharp at any size; PNG suits slides.
          </DialogDescription>
        </DialogHeader>
        <div className="grid justify-items-center gap-3">
          <div className="flex size-64 items-center justify-center rounded-xl border bg-logo-plate p-2">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={`QR code for ${link?.label ?? "the showcase"}`} className="size-full" />
            ) : failed ? (
              <p className="px-4 text-center text-sm text-muted-foreground">The QR code could not be loaded.</p>
            ) : (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            )}
          </div>
          {link && link.status !== "live" ? (
            <Alert>
              <AlertDescription>
                This link is {STATUS[link.status].label.toLowerCase()}: a scan now shows a page that says so.
              </AlertDescription>
            </Alert>
          ) : null}
          <p className="w-full break-all rounded-md bg-muted px-3 py-2 text-center font-mono text-xs">{link?.url}</p>
        </div>
        <DialogFooter className="flex-row flex-wrap gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => void copy()}>
            <Copy /> Copy link
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void save("png")}>
              <Download /> PNG
            </Button>
            <Button onClick={() => void save("svg")}>
              <Download /> SVG
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
