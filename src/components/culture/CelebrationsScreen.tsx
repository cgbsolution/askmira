"use client";

import {
  Cake,
  CheckCircle2,
  Loader2,
  Mail,
  Paintbrush,
  PartyPopper,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataPanel } from "@/components/common/DataPanel";
import { EmployeePicker } from "@/components/common/EmployeePicker";
import { FormField } from "@/components/common/FormField";
import { PageShell } from "@/components/common/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { del, fetchFile, post, put } from "@/lib/api";
import type { EmployeeSummary } from "@/lib/types";
import type {
  CardDesign,
  CelebrationKind,
  CelebrationPreset,
  CelebrationSettings,
  CelebrationTemplate,
  CelebrationTemplates,
} from "@/lib/types/culture";
import { CARD_COLOUR_PRESETS } from "@/lib/types/culture";
import { cn } from "@/lib/utils";

import { apiDetail } from "./cultureShared";
import { MilestonesPanel } from "./MilestonesPanel";

const KIND_LABEL: Record<CelebrationKind, string> = {
  birthday: "Birthday",
  work_anniversary: "Work anniversary",
};

const COLOUR_FIELDS: { key: keyof CardDesign; label: string }[] = [
  { key: "background_colour", label: "Background" },
  { key: "pattern_colour", label: "Pattern" },
  { key: "heading_colour", label: "Headings and name" },
  { key: "text_colour", label: "Message" },
  { key: "accent_colour", label: "Photo ring and ribbon" },
  { key: "ribbon_text_colour", label: "Name on the ribbon" },
];

// ── Previews ────────────────────────────────────────────────────────────────

/** Rendered cards, by what was asked: a tile scrolled away and back is not redrawn. */
const previewCache = new Map<string, string>();

function previewKey(
  kind: CelebrationKind,
  design: CardDesign,
  employeeId?: string | null,
  years?: number | null,
) {
  return JSON.stringify([kind, design, employeeId ?? null, years ?? null]);
}

/**
 * The card exactly as the server draws it — the same picture that is emailed —
 * re-fetched a moment after the last change.
 */
function useCardPreview(
  kind: CelebrationKind,
  design: CardDesign | null,
  {
    employeeId = null,
    years = null,
    delay = 0,
  }: { employeeId?: string | null; years?: number | null; delay?: number } = {},
) {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const key = design ? previewKey(kind, design, employeeId, years) : null;

  useEffect(() => {
    if (!design || !key) return;
    const cached = previewCache.get(key);
    if (cached) {
      setUrl(cached);
      setProblem(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    const timer = setTimeout(() => {
      fetchFile("/culture/celebrations/preview", {
        method: "POST",
        body: { kind, design, employee_id: employeeId, years },
      })
        .then(({ blob }) => {
          const made = URL.createObjectURL(blob);
          previewCache.set(key, made);
          if (!cancelled) {
            setUrl(made);
            setProblem(null);
          }
        })
        .catch((caught) => {
          if (!cancelled)
            setProblem(apiDetail(caught, "The card could not be drawn."));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `key` covers design, kind, person and years.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, delay]);

  return { url, isLoading, problem };
}

function CardPicture({
  kind,
  design,
  label,
  className,
  employeeId,
  years,
  delay,
}: {
  kind: CelebrationKind;
  design: CardDesign;
  label: string;
  className?: string;
  employeeId?: string | null;
  years?: number | null;
  delay?: number;
}) {
  const { url, isLoading, problem } = useCardPreview(kind, design, {
    employeeId,
    years,
    delay,
  });
  return (
    <div
      className={cn(
        "relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted",
        className,
      )}
    >
      {url ? (
        <Image
          src={url}
          alt={label}
          width={1080}
          height={1080}
          unoptimized
          className="size-full object-cover"
        />
      ) : problem ? (
        <div className="flex size-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
          {problem}
        </div>
      ) : (
        <Skeleton className="size-full rounded-none" />
      )}
      {isLoading && url && (
        <div className="absolute top-2 right-2 rounded-full bg-background/80 p-1">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

// ── The screen ──────────────────────────────────────────────────────────────

/**
 * Culture → Birthdays & anniversaries.
 *
 * Every morning everybody whose birthday or work anniversary is today gets a
 * card — emailed to them and posted on the feed. HR picks and edits the card
 * here, and decides the defaults.
 */
export function CelebrationsScreen() {
  return (
    <PageShell
      tier="tier2"
      title="Birthdays & anniversaries"
      description="Each morning, everybody with a birthday or work anniversary gets a card by email and on the company feed."
    >
      <Tabs defaultValue="cards">
        <TabsList>
          <TabsTrigger value="cards">Cards</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="milestones">Milestone rewards</TabsTrigger>
        </TabsList>
        <TabsContent value="cards" className="mt-4">
          <CardsTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsTab />
        </TabsContent>
        <TabsContent value="milestones" className="mt-4">
          <MilestonesPanel />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function CardsTab() {
  const { data, error, isLoading, reload } = useApiQuery<CelebrationTemplates>(
    "/culture/celebrations/templates",
  );
  const [editing, setEditing] = useState<CelebrationTemplate | null>(null);
  const [creating, setCreating] = useState<CelebrationKind | null>(null);
  const [deleting, setDeleting] = useState<CelebrationTemplate | null>(null);

  const use = async (template: CelebrationTemplate) => {
    try {
      await post(`/culture/celebrations/templates/${template.id}/use`);
      toast.success(
        `"${template.name}" will be used for ${KIND_LABEL[template.kind].toLowerCase()}s.`,
      );
      reload();
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not switch the card."));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await del(`/culture/celebrations/templates/${deleting.id}`);
      toast.success("Template removed.");
      reload();
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not remove the template."));
      throw caught;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {(["birthday", "work_anniversary"] as const).map((kind) => (
        <KindSection
          key={kind}
          kind={kind}
          data={data}
          error={error?.detail ?? null}
          isLoading={isLoading}
          onRetry={reload}
          onNew={() => setCreating(kind)}
          onEdit={setEditing}
          onUse={(template) => void use(template)}
          onDelete={setDeleting}
        />
      ))}

      {data && (
        <NewTemplateDialog
          kind={creating}
          presets={data.presets}
          onOpenChange={(open) => !open && setCreating(null)}
          onCreated={(template) => {
            setCreating(null);
            reload();
            setEditing(template);
          }}
        />
      )}
      {data && (
        <TemplateEditor
          template={editing}
          placeholders={data.placeholders}
          onClose={() => setEditing(null)}
          onSaved={() => reload()}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Remove this card template?"
        description={
          deleting?.in_use
            ? "It is the one in use. The newest other template for this occasion takes over, or the built-in card if there is none. Cards already sent are not changed."
            : "Cards already sent are not changed."
        }
        confirmLabel="Remove"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}

function KindSection({
  kind,
  data,
  error,
  isLoading,
  onRetry,
  onNew,
  onEdit,
  onUse,
  onDelete,
}: {
  kind: CelebrationKind;
  data: CelebrationTemplates | null;
  error: string | null;
  isLoading: boolean;
  onRetry: () => void;
  onNew: () => void;
  onEdit: (template: CelebrationTemplate) => void;
  onUse: (template: CelebrationTemplate) => void;
  onDelete: (template: CelebrationTemplate) => void;
}) {
  const templates = (data?.templates ?? []).filter((t) => t.kind === kind);
  const builtIn = (data?.presets ?? []).find((p) => p.kind === kind);
  const Icon = kind === "birthday" ? Cake : PartyPopper;

  return (
    <DataPanel
      tier="tier2"
      title={`${KIND_LABEL[kind]} cards`}
      description={
        kind === "birthday"
          ? "Sent on the day. {name}, {first_name} and {company} are filled in for each person."
          : "Sent on every anniversary of joining. {years}, {years_ordinal} and {years_label} give the years completed."
      }
      actions={
        <Button size="sm" onClick={onNew} disabled={!data}>
          <Plus /> New template
        </Button>
      }
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
    >
      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {templates.length === 0 && builtIn && (
          <div className="flex flex-col gap-3">
            <CardPicture
              kind={kind}
              design={builtIn.design}
              label={`Built-in ${KIND_LABEL[kind].toLowerCase()} card`}
            />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Icon className="size-4 shrink-0" /> Built-in card
                </div>
                <Badge variant="success" className="mt-1">
                  <CheckCircle2 /> In use
                </Badge>
              </div>
              <Button size="sm" variant="outline" onClick={onNew}>
                <Paintbrush /> Customise
              </Button>
            </div>
          </div>
        )}
        {templates.map((template) => (
          <div key={template.id} className="flex flex-col gap-3">
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full rounded-lg p-0 hover:bg-transparent"
              onClick={() => onEdit(template)}
              aria-label={`Edit ${template.name}`}
            >
              <CardPicture
                kind={kind}
                design={template.design}
                label={template.name}
              />
            </Button>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div
                  className="truncate text-sm font-medium text-foreground"
                  title={template.name}
                >
                  {template.name}
                </div>
                {template.in_use ? (
                  <Badge variant="success" className="mt-1">
                    <CheckCircle2 /> In use
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="link"
                    className="h-auto p-0 text-xs"
                    onClick={() => onUse(template)}
                  >
                    Use this card
                  </Button>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Edit ${template.name}`}
                  onClick={() => onEdit(template)}
                >
                  <Paintbrush />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${template.name}`}
                  onClick={() => onDelete(template)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </DataPanel>
  );
}

// ── New template ────────────────────────────────────────────────────────────

function NewTemplateDialog({
  kind,
  presets,
  onOpenChange,
  onCreated,
}: {
  kind: CelebrationKind | null;
  presets: CelebrationPreset[];
  onOpenChange: (open: boolean) => void;
  onCreated: (template: CelebrationTemplate) => void;
}) {
  const choices = presets.filter((p) => p.kind === kind);
  const [chosen, setChosen] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!kind) return;
    const first = presets.find((p) => p.kind === kind);
    setChosen(first?.key ?? null);
    setName(
      first
        ? `${first.name} ${kind === "birthday" ? "birthday" : "anniversary"}`
        : "",
    );
  }, [kind, presets]);

  const create = async () => {
    if (!kind || !chosen || !name.trim()) return;
    setIsBusy(true);
    try {
      const made = await post<CelebrationTemplate>(
        "/culture/celebrations/templates",
        {
          kind,
          name: name.trim(),
          preset_key: chosen,
        },
      );
      toast.success("Template added. Make it yours.");
      onCreated(made);
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not add the template."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog
      open={kind !== null}
      onOpenChange={(next) => !isBusy && onOpenChange(next)}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            New {kind ? KIND_LABEL[kind].toLowerCase() : ""} card
          </DialogTitle>
          <DialogDescription>
            Start from a design, then change its colours and wording.
          </DialogDescription>
        </DialogHeader>
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          role="radiogroup"
          aria-label="Starting design"
        >
          {kind &&
            choices.map((preset) => (
              <Button
                key={preset.key}
                type="button"
                variant="ghost"
                role="radio"
                aria-checked={chosen === preset.key}
                onClick={() => {
                  setChosen(preset.key);
                  setName(
                    `${preset.name} ${kind === "birthday" ? "birthday" : "anniversary"}`,
                  );
                }}
                className={cn(
                  "h-auto flex-col items-stretch gap-2 rounded-lg border-2 p-1.5 text-left text-xs font-medium whitespace-normal hover:bg-transparent",
                  chosen === preset.key
                    ? "border-primary"
                    : "border-transparent hover:border-border",
                )}
              >
                <CardPicture
                  kind={kind}
                  design={preset.design}
                  label={preset.name}
                  className="border-0"
                />
                <span className="px-1 pb-1">{preset.name}</span>
              </Button>
            ))}
        </div>
        <FormField htmlFor="new-card-name" label="Template name" required>
          <Input
            id="new-card-name"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void create()}
            disabled={isBusy || !chosen || !name.trim()}
          >
            {isBusy && <Loader2 className="animate-spin" />} Add and edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Editor ──────────────────────────────────────────────────────────────────

function TemplateEditor({
  template,
  placeholders,
  onClose,
  onSaved,
}: {
  template: CelebrationTemplate | null;
  placeholders: { token: string; meaning: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [design, setDesign] = useState<CardDesign | null>(null);
  const [previewFor, setPreviewFor] = useState<EmployeeSummary | null>(null);
  const [yearsText, setYearsText] = useState("3");
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!template) return;
    setName(template.name);
    setDesign({ ...template.design });
    setPreviewFor(null);
    setYearsText("3");
  }, [template]);

  const dirty = useMemo(
    () =>
      template !== null &&
      design !== null &&
      (name !== template.name ||
        JSON.stringify(design) !== JSON.stringify(template.design)),
    [template, design, name],
  );

  const change = useCallback(
    <K extends keyof CardDesign>(key: K, value: CardDesign[K]) => {
      setDesign((current) =>
        current ? { ...current, [key]: value } : current,
      );
    },
    [],
  );

  const insert = (token: string) => {
    if (!design) return;
    const box = messageRef.current;
    const at = box?.selectionStart ?? design.message.length;
    const end = box?.selectionEnd ?? at;
    const next = (
      design.message.slice(0, at) +
      token +
      design.message.slice(end)
    ).slice(0, 400);
    change("message", next);
    requestAnimationFrame(() => {
      box?.focus();
      box?.setSelectionRange(at + token.length, at + token.length);
    });
  };

  const close = () => {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  const save = async () => {
    if (!template || !design || !name.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await put(`/culture/celebrations/templates/${template.id}`, {
        name: name.trim(),
        design,
      });
      toast.success("Card saved.");
      onSaved();
      onClose();
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not save the card."));
    } finally {
      setIsSaving(false);
    }
  };

  const sendTest = async () => {
    if (!template || !design) return;
    setIsSending(true);
    try {
      const result = await post<{ sent_to: string; relay: string }>(
        "/culture/celebrations/test-email",
        {
          kind: template.kind,
          design,
        },
      );
      toast.success(
        result.relay === "console"
          ? `No mail server is set up, so the test was only logged. Set one under Settings → Notifications.`
          : `Test email sent to ${result.sent_to}.`,
      );
    } catch (caught) {
      toast.error(apiDetail(caught, "The test email could not be sent."));
    } finally {
      setIsSending(false);
    }
  };

  const years = Math.min(60, Math.max(1, Number(yearsText) || 1));
  const isAnniversary = template?.kind === "work_anniversary";

  return (
    <>
      <Dialog
        open={template !== null}
        onOpenChange={(next) => !next && close()}
      >
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Edit card</DialogTitle>
            <DialogDescription>
              The preview is the picture that goes out: emailed to the person
              and posted on the feed.
            </DialogDescription>
          </DialogHeader>
          {template && design && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
              <div className="flex min-w-0 flex-col gap-5">
                <FormField
                  htmlFor="card-name"
                  label="Template name"
                  required
                  error={name.trim() ? null : "Give it a name."}
                >
                  <Input
                    id="card-name"
                    value={name}
                    maxLength={120}
                    onChange={(e) => setName(e.target.value)}
                  />
                </FormField>

                <FieldSet>
                  <FieldLegend>Look</FieldLegend>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <FormField htmlFor="card-layout" label="Layout">
                      <Select
                        value={design.layout}
                        onValueChange={(v) =>
                          change("layout", v as CardDesign["layout"])
                        }
                      >
                        <SelectTrigger id="card-layout" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="classic">
                            Name on a ribbon
                          </SelectItem>
                          <SelectItem value="minimal">
                            Name in large type
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField
                      htmlFor="card-pattern"
                      label="Background pattern"
                    >
                      <Select
                        value={design.pattern}
                        onValueChange={(v) =>
                          change("pattern", v as CardDesign["pattern"])
                        }
                      >
                        <SelectTrigger id="card-pattern" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stripes">
                            Stripes and sparkles
                          </SelectItem>
                          <SelectItem value="confetti">Confetti</SelectItem>
                          <SelectItem value="dots">Dots</SelectItem>
                          <SelectItem value="none">Plain</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField htmlFor="card-font" label="Headings font">
                      <Select
                        value={design.font}
                        onValueChange={(v) =>
                          change("font", v as CardDesign["font"])
                        }
                      >
                        <SelectTrigger id="card-font" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="modern">Modern (Inter)</SelectItem>
                          <SelectItem value="elegant">
                            Elegant (Fraunces)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>
                  </div>
                </FieldSet>

                <FieldSet>
                  <FieldLegend>Colours</FieldLegend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {COLOUR_FIELDS.map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-3">
                        <ColorPicker
                          value={design[key] as string}
                          presets={CARD_COLOUR_PRESETS}
                          aria-label={label}
                          onChange={(value) => change(key, value as never)}
                        />
                        <div className="min-w-0">
                          <div className="text-sm text-foreground">{label}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {design[key] as string}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </FieldSet>

                <FieldSet>
                  <FieldLegend>Wording</FieldLegend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField htmlFor="card-heading" label="Heading" optional>
                      <Input
                        id="card-heading"
                        value={design.heading}
                        maxLength={60}
                        onChange={(e) => change("heading", e.target.value)}
                      />
                    </FormField>
                    <FormField
                      htmlFor="card-subheading"
                      label="Under the heading"
                      optional
                    >
                      <Input
                        id="card-subheading"
                        value={design.subheading}
                        maxLength={80}
                        onChange={(e) => change("subheading", e.target.value)}
                      />
                    </FormField>
                  </div>
                  <FormField
                    htmlFor="card-title"
                    label="Title under the name"
                    optional
                  >
                    <Input
                      id="card-title"
                      value={design.title}
                      maxLength={70}
                      onChange={(e) => change("title", e.target.value)}
                    />
                  </FormField>
                  <FormField
                    htmlFor="card-message"
                    label="Message"
                    optional
                    hint={`${design.message.length} / 400. Also the text of the email and the feed post.`}
                  >
                    <Textarea
                      id="card-message"
                      ref={messageRef}
                      rows={4}
                      maxLength={400}
                      value={design.message}
                      onChange={(e) => change("message", e.target.value)}
                    />
                  </FormField>
                  <div
                    className="flex flex-wrap gap-1.5"
                    aria-label="Insert a placeholder into the message"
                  >
                    {placeholders
                      .filter(
                        (p) => isAnniversary || !p.token.startsWith("{years"),
                      )
                      .map((p) => (
                        <Button
                          key={p.token}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 font-mono text-xs"
                          title={p.meaning}
                          onClick={() => insert(p.token)}
                        >
                          {p.token}
                        </Button>
                      ))}
                  </div>
                </FieldSet>

                <FieldSet>
                  <FieldLegend>Show</FieldLegend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ToggleRow
                      id="card-logo"
                      label="Company logo"
                      checked={design.show_logo}
                      onChange={(v) => change("show_logo", v)}
                    />
                    <ToggleRow
                      id="card-plate"
                      label="White panel behind the logo"
                      checked={design.logo_plate}
                      disabled={!design.show_logo}
                      onChange={(v) => change("logo_plate", v)}
                    />
                    <ToggleRow
                      id="card-photo"
                      label="Their profile photo"
                      checked={design.show_photo}
                      onChange={(v) => change("show_photo", v)}
                    />
                    <ToggleRow
                      id="card-upper-name"
                      label="Name in capitals"
                      checked={design.uppercase_name}
                      onChange={(v) => change("uppercase_name", v)}
                    />
                    <ToggleRow
                      id="card-upper-titles"
                      label="Headings in capitals"
                      checked={design.uppercase_titles}
                      onChange={(v) => change("uppercase_titles", v)}
                    />
                    <FormField htmlFor="card-name-style" label="Name shown">
                      <Select
                        value={design.name_style}
                        onValueChange={(v) =>
                          change("name_style", v as CardDesign["name_style"])
                        }
                      >
                        <SelectTrigger id="card-name-style" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="first">First name</SelectItem>
                          <SelectItem value="full">Full name</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>
                  </div>
                  {design.show_photo && (
                    <p className="text-xs text-muted-foreground">
                      The emailed card always has their photo. On the feed it
                      appears only for people who let colleagues see their
                      photo; others show their initials.
                    </p>
                  )}
                </FieldSet>
              </div>

              <div className="flex flex-col gap-3 lg:sticky lg:top-0 lg:self-start">
                <CardPicture
                  kind={template.kind}
                  design={design}
                  label="Card preview"
                  employeeId={previewFor?.id ?? null}
                  years={isAnniversary ? years : null}
                  delay={350}
                />
                <FormField
                  htmlFor="card-preview-for"
                  label="Preview for"
                  hint="Your own record, or a sample, if nobody is picked."
                >
                  <EmployeePicker
                    id="card-preview-for"
                    value={previewFor}
                    onChange={setPreviewFor}
                    excludeId={null}
                  />
                </FormField>
                {isAnniversary && (
                  <FormField
                    htmlFor="card-preview-years"
                    label="Years completed"
                    hint="For the preview only. Each card shows the person's own."
                  >
                    <Input
                      id="card-preview-years"
                      inputMode="numeric"
                      maxLength={2}
                      value={yearsText}
                      onChange={(e) =>
                        setYearsText(
                          e.target.value.replace(/\D/g, "").slice(0, 2),
                        )
                      }
                      onBlur={() => setYearsText(String(years))}
                    />
                  </FormField>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => void sendTest()}
              disabled={isSending || !design}
            >
              {isSending ? <Loader2 className="animate-spin" /> : <Mail />} Send
              me a test email
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={close} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                onClick={() => void save()}
                disabled={isSaving || !name.trim() || !dirty}
              >
                {isSaving ? <Loader2 className="animate-spin" /> : <Save />}{" "}
                Save card
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard your changes?"
        description="The card has changes that are not saved."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <Label
        htmlFor={id}
        className={cn(
          "text-sm font-normal",
          disabled && "text-muted-foreground",
        )}
      >
        {label}
      </Label>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}

// ── Settings ────────────────────────────────────────────────────────────────

function SettingsTab() {
  const { data, error, isLoading, reload } = useApiQuery<CelebrationSettings>(
    "/culture/celebrations/settings",
  );
  const [values, setValues] = useState<CelebrationSettings | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (data) setValues({ ...data });
  }, [data]);

  const dirty =
    data !== null &&
    values !== null &&
    JSON.stringify(values) !== JSON.stringify(data);
  const set = <K extends keyof CelebrationSettings>(
    key: K,
    value: CelebrationSettings[K],
  ) =>
    setValues((current) => (current ? { ...current, [key]: value } : current));

  const save = async () => {
    if (!values) return;
    setIsBusy(true);
    try {
      await put("/culture/celebrations/settings", values);
      toast.success("Settings saved.");
      reload();
    } catch (caught) {
      toast.error(apiDetail(caught, "Could not save the settings."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <DataPanel
      tier="tier2"
      title="What happens each morning"
      description="Changes apply from the next morning's wishes."
      actions={
        <Button
          size="sm"
          onClick={() => void save()}
          disabled={!dirty || isBusy}
        >
          {isBusy ? <Loader2 className="animate-spin" /> : <Save />} Save
        </Button>
      }
      isLoading={isLoading}
      error={error?.detail ?? null}
      onRetry={reload}
    >
      {values && (
        <div className="grid gap-6 p-5 lg:grid-cols-2">
          <Card tier="tier2" className="gap-3">
            <CardHeader>
              <CardTitle className="text-base">Wish people on</CardTitle>
              <CardDescription>
                Each is a card, an email and a feed post.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <ToggleRow
                id="set-birthdays"
                label="Their birthday"
                checked={values.birthdays}
                onChange={(v) => set("birthdays", v)}
              />
              <ToggleRow
                id="set-anniversaries"
                label="Every work anniversary"
                checked={values.work_anniversaries}
                onChange={(v) => set("work_anniversaries", v)}
              />
              <ToggleRow
                id="set-email"
                label="Email the card to them"
                checked={values.send_email}
                onChange={(v) => set("send_email", v)}
              />
              <ToggleRow
                id="set-feed"
                label="Post it on the company feed"
                checked={values.post_to_feed}
                onChange={(v) => set("post_to_feed", v)}
              />
              <p className="text-xs text-muted-foreground">
                The email goes to their login email, else their work email.
                People without either still get the feed post.
              </p>
            </CardContent>
          </Card>
          <Card tier="tier2" className="gap-3">
            <CardHeader>
              <CardTitle className="text-base">Who sees it</CardTitle>
              <CardDescription>
                For people who have not chosen for themselves. Anyone can change
                their own under My celebrations on the feed, and their choice
                always wins.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <ToggleRow
                id="set-default"
                label="Share birthdays and anniversaries by default"
                checked={values.share_by_default}
                onChange={(v) => set("share_by_default", v)}
              />
              <FormField htmlFor="set-scope" label="Birthdays are shown to">
                <Select
                  value={values.default_birthday_scope}
                  disabled={!values.share_by_default}
                  onValueChange={(v) =>
                    set(
                      "default_birthday_scope",
                      v as CelebrationSettings["default_birthday_scope"],
                    )
                  }
                >
                  <SelectTrigger id="set-scope" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">
                      Everyone in the workspace
                    </SelectItem>
                    <SelectItem value="team">Their own department</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <p className="text-xs text-muted-foreground">
                {values.share_by_default
                  ? "Work anniversaries are shown to everyone. Someone who switches theirs off is still wished, by email and privately on the feed."
                  : "Nobody is shown on the feed unless they switch it on. Everyone is still wished, by email and privately on the feed."}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </DataPanel>
  );
}
