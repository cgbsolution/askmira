"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Copy, Download, ExternalLink, Loader2, Plus, QrCode, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AmountInput } from "@/components/common/AmountInput";
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
import { formatDateTime, formatINR } from "@/lib/utils";

interface Workspace {
  id: string;
  name: string;
  workspace: string;
  is_active: boolean;
}

const STATUS = {
  live: { label: "Live", variant: "success" },
  scheduled: { label: "Scheduled", variant: "secondary" },
  ended: { label: "Ended", variant: "muted" },
  off: { label: "Off", variant: "muted" },
} as const;

const NO_BRAND = "none";

// ── Form ────────────────────────────────────────────────────────────────────

interface FormState {
  label: string;
  brand: string;
  client: string;
  role: string;
  headcount: string;
  months: string;
  order: string;
  budget: string;
  laptop: string;
  paymentDays: string;
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
    brand: NO_BRAND,
    client: "Acme Technologies",
    role: "Java Developer",
    headcount: "6",
    months: "12",
    order: "5000000",
    budget: "3000000",
    laptop: "55000",
    paymentDays: "30",
    startsAt: toLocal(start),
    endsAt: toLocal(end),
    active: true,
  };
}

function fromLink(link: ShowcaseLink): FormState {
  const plain = (amount: string) => amount.replace(/\.00$/, "");
  return {
    label: link.label,
    brand: link.brand_tenant_id ?? NO_BRAND,
    client: link.client_name,
    role: link.role_title,
    headcount: String(link.headcount),
    months: String(link.months),
    order: plain(link.order_value),
    budget: plain(link.team_budget),
    laptop: plain(link.laptop_price),
    paymentDays: String(link.payment_days),
    startsAt: toLocal(new Date(link.starts_at)),
    endsAt: toLocal(new Date(link.ends_at)),
    active: link.is_active,
  };
}

/** Rupees as whole paise, so the margin is worked out without a float. */
function paise(amount: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match) return null;
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0") || "0");
}

/** (order − budget) ÷ order to one decimal place, or null when it is not a margin. */
function marginFloor(order: string, budget: string): string | null {
  const o = paise(order);
  const b = paise(budget);
  if (o === null || b === null || o <= BigInt(0) || b <= BigInt(0) || b >= o) return null;
  const tenths = ((o - b) * BigInt(2000) + o) / (BigInt(2) * o); // rounded half up, in tenths of a percent
  return `${tenths / BigInt(10)}.${tenths % BigInt(10)}`;
}

function whole(value: string, min: number, max: number, what: string): string | undefined {
  if (!/^\d+$/.test(value)) return `Enter ${what}.`;
  const number = Number.parseInt(value, 10);
  if (number < min || number > max) return `Between ${min} and ${max}.`;
  return undefined;
}

function validate(form: FormState, creating: boolean): Errors {
  const errors: Errors = {};
  if (form.label.trim().length < 3) errors.label = "Name the event (at least 3 characters).";
  if (form.client.trim().length < 2) errors.client = "Enter the client's name.";
  if (form.role.trim().length < 2) errors.role = "Enter the role being hired.";
  errors.headcount = whole(form.headcount, 1, 10, "the team size");
  errors.months = whole(form.months, 3, 36, "the months");
  errors.paymentDays = whole(form.paymentDays, 0, 90, "the days");
  const order = paise(form.order);
  const budget = paise(form.budget);
  const laptop = paise(form.laptop);
  if (order === null || order <= BigInt(0)) errors.order = "Enter the order value.";
  if (budget === null || budget <= BigInt(0)) errors.budget = "Enter the team budget.";
  else if (order !== null && budget >= order) errors.budget = "Must be less than the order value, or there is no margin.";
  if (laptop === null || laptop < BigInt(100_000) || laptop > BigInt(50_000_000))
    errors.laptop = "Between ₹1,000 and ₹5,00,000.";
  const starts = form.startsAt ? new Date(form.startsAt) : null;
  const ends = form.endsAt ? new Date(form.endsAt) : null;
  if (!starts) errors.startsAt = "Pick when the link starts.";
  if (!ends) errors.endsAt = "Pick when the link ends.";
  else if (starts && ends <= starts) errors.endsAt = "Must be after the start.";
  else if (creating && ends <= new Date()) errors.endsAt = "Must be in the future.";
  else if (starts && ends.getTime() - starts.getTime() > 366 * 86_400_000) errors.endsAt = "A year at most.";
  for (const key of Object.keys(errors) as (keyof FormState)[]) if (!errors[key]) delete errors[key];
  return errors;
}

function payload(form: FormState) {
  return {
    label: form.label.trim(),
    client_name: form.client.trim(),
    role_title: form.role.trim(),
    headcount: Number.parseInt(form.headcount, 10),
    months: Number.parseInt(form.months, 10),
    order_value: form.order,
    team_budget: form.budget,
    laptop_price: form.laptop,
    payment_days: Number.parseInt(form.paymentDays, 10),
    is_active: form.active,
    starts_at: new Date(form.startsAt).toISOString(),
    ends_at: new Date(form.endsAt).toISOString(),
  };
}

// ── Screen ──────────────────────────────────────────────────────────────────

/**
 * The super admin's exhibition QR codes. Each opens the order-to-day-one story
 * with Ask Miraa, in a sandbox: no sign-in and no workspace's data. A link
 * works only inside its window and while it is switched on.
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
            <p className="text-xs text-muted-foreground">Shown as {row.original.company}</p>
          </div>
        ),
      },
      {
        id: "story",
        header: "The story",
        accessorFn: (row) => `${row.client_name} ${row.role_title}`,
        cell: ({ row }) => {
          const link = row.original;
          return (
            <div className="min-w-56">
              <p className="text-foreground">
                {link.client_name}: {link.headcount} × {link.role_title}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {formatINR(link.order_value)} for {link.months} months · team {formatINR(link.team_budget)} · margin{" "}
                {link.margin_floor}%
              </p>
            </div>
          );
        },
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
        header: "Stories",
        cell: ({ row }) => (
          <div className="whitespace-nowrap tabular-nums">
            <p>{row.original.visits}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.last_visit_at ? `last ${formatDateTime(row.original.last_visit_at)}` : "none yet"}
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
            <Button asChild size="icon" variant="ghost" aria-label={`Open the story for ${row.original.label}`}>
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
      description="QR codes for exhibitions. A scan opens the order-to-day-one story with Ask Miraa in a sandbox: no sign-in, and no workspace's data is read or changed. Switch a link off and open pages stop at their next step."
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
        searchPlaceholder="Search event or client"
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
  onClose,
  onSaved,
  onDeleted,
}: {
  link: ShowcaseLink | "new" | null;
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
  const floor = marginFloor(form.order, form.budget);

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function digits(field: "headcount" | "months" | "paymentDays", max: number) {
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
      const body = { ...payload(form), brand_tenant_id: form.brand === NO_BRAND ? null : form.brand };
      let saved: ShowcaseLink;
      if (link === "new") {
        saved = await post<ShowcaseLink>("/platform/showcase-links", body);
        toast.success(`${saved.label}: link created`);
      } else {
        const { brand_tenant_id: brand, ...rest } = body;
        saved = await patch<ShowcaseLink>(`/platform/showcase-links/${link.id}`, {
          ...rest,
          ...(brand ? { brand_tenant_id: brand } : { clear_tenant: true }),
        });
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

  const brands = (workspaces.data ?? []).filter((w) => w.is_active);

  return (
    <>
      <Sheet open={link !== null} onOpenChange={(next) => (next ? undefined : requestClose())}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{creating ? "New showcase link" : "Edit showcase link"}</SheetTitle>
            <SheetDescription>
              The story is a sandbox with sample candidates, vendors and claims. Only the brand comes from the workspace
              you pick.
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
            <FormField htmlFor="sc-brand" label="Shown as" hint="Whose name and logo the story wears. Nothing else is read.">
              <Select value={form.brand} onValueChange={(value) => set("brand", value)}>
                <SelectTrigger id="sc-brand" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BRAND}>AskMiraa</SelectItem>
                  {brands.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <Separator />
            <p className="text-sm font-medium">The order the story runs</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField htmlFor="sc-client" label="Client" required error={shown.client}>
                <Input
                  id="sc-client"
                  value={form.client}
                  maxLength={80}
                  aria-invalid={Boolean(shown.client)}
                  onChange={(event) => set("client", event.target.value)}
                />
              </FormField>
              <FormField htmlFor="sc-role" label="Role hired" required error={shown.role}>
                <Input
                  id="sc-role"
                  value={form.role}
                  maxLength={60}
                  aria-invalid={Boolean(shown.role)}
                  onChange={(event) => set("role", event.target.value)}
                />
              </FormField>
              <FormField htmlFor="sc-headcount" label="Team size" required hint="1 to 10 people" error={shown.headcount}>
                <Input
                  id="sc-headcount"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.headcount}
                  aria-invalid={Boolean(shown.headcount)}
                  onChange={digits("headcount", 2)}
                />
              </FormField>
              <FormField htmlFor="sc-months" label="Months" required hint="3 to 36" error={shown.months}>
                <Input
                  id="sc-months"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.months}
                  aria-invalid={Boolean(shown.months)}
                  onChange={digits("months", 2)}
                />
              </FormField>
              <FormField htmlFor="sc-order" label="Order value (₹)" required error={shown.order}>
                <AmountInput
                  id="sc-order"
                  value={form.order}
                  aria-invalid={Boolean(shown.order)}
                  onValueChange={(value) => set("order", value)}
                />
              </FormField>
              <FormField
                htmlFor="sc-budget"
                label="Team budget (₹)"
                required
                hint={floor ? `Margin floor ${floor}%` : "What the team may cost over the contract"}
                error={shown.budget}
              >
                <AmountInput
                  id="sc-budget"
                  value={form.budget}
                  aria-invalid={Boolean(shown.budget)}
                  onValueChange={(value) => set("budget", value)}
                />
              </FormField>
              <FormField htmlFor="sc-laptop" label="Laptop price (₹)" required hint="The lowest quote, each" error={shown.laptop}>
                <AmountInput
                  id="sc-laptop"
                  value={form.laptop}
                  aria-invalid={Boolean(shown.laptop)}
                  onValueChange={(value) => set("laptop", value)}
                />
              </FormField>
              <FormField
                htmlFor="sc-payment"
                label="Client pays after (days)"
                required
                hint="Why cash dips at the start"
                error={shown.paymentDays}
              >
                <Input
                  id="sc-payment"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.paymentDays}
                  aria-invalid={Boolean(shown.paymentDays)}
                  onChange={digits("paymentDays", 2)}
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
        description="Its QR code stops working at once, and the stories visitors started from it are deleted. Printed codes cannot be reused."
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
