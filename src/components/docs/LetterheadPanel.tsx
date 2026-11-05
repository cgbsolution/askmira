"use client";

import { Eye, ImageIcon, Loader2, PenLine, Save, Trash2, Upload } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { PdfPreview } from "@/components/docs/PdfPreview";
import { apiMessage } from "@/components/people/labels";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ColorPicker } from "@/components/ui/color-picker";
import { HiddenFileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useApiQuery } from "@/hooks/useApiQuery";
import { del, fetchFile, post, put } from "@/lib/api";
import {
  LETTERHEAD_PRESETS,
  type Letterhead,
  type LetterheadDesign,
  type LetterheadSettings,
} from "@/lib/types/docs";
import { cn } from "@/lib/utils";
import { useUploadLimit } from "@/hooks/useUploadLimit";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DESIGNS: { value: LetterheadDesign; label: string; hint: string }[] = [
  {
    value: "wave",
    label: "Bands",
    hint: "Coloured bands top and bottom, logo, dots, address in the footer.",
  },
  { value: "classic", label: "Classic", hint: "A thin colour bar, logo left, details right." },
  { value: "none", label: "Plain paper", hint: "Nothing printed — for pre-printed stationery." },
];

const COLOURS: { key: keyof LetterheadSettings; label: string; hint: string }[] = [
  { key: "primary_colour", label: "Main colour", hint: "The deep end of the bands." },
  { key: "secondary_colour", label: "Light colour", hint: "The light end of the bands." },
  { key: "accent_colour", label: "Lines and footer", hint: "Rules and the footer text." },
  { key: "highlight_colour", label: "Annexure totals", hint: "Gross, totals and take-home." },
];

function toSettings(letterhead: Letterhead): LetterheadSettings {
  return {
    design: letterhead.design,
    primary_colour: letterhead.primary_colour,
    secondary_colour: letterhead.secondary_colour,
    accent_colour: letterhead.accent_colour,
    highlight_colour: letterhead.highlight_colour,
    company_name: letterhead.company_name,
    address: letterhead.address,
    phone: letterhead.phone,
    email: letterhead.email,
    website: letterhead.website,
    signatory_name: letterhead.signatory_name,
    signatory_title: letterhead.signatory_title,
    show_logo: letterhead.show_logo,
    show_reference: letterhead.show_reference,
  };
}

/** An image the API serves behind sign-in, as an object URL for an <img>. */
function useStoredImage(path: string | null, version: number) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    setMissing(false);
    if (!path) {
      setUrl(null);
      return;
    }
    let made: string | null = null;
    let cancelled = false;
    fetchFile(path)
      .then(({ blob }) => {
        if (cancelled) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .catch(() => {
        if (cancelled) return;
        setUrl(null);
        setMissing(true);
      });
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [path, version]);
  return { url, missing };
}

/**
 * Documents → Letterhead: the paper every letter is printed on.
 *
 * Colours, logo, contact lines and the signatory's signature. The preview on
 * the right is a sample letter rendered by the same code that renders real
 * letters, from the choices on screen before they are saved.
 */
export function LetterheadPanel() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("admin");
  const limit = useUploadLimit();
  const { data, error, isLoading, reload } = useApiQuery<Letterhead>("/letterhead");
  const [values, setValues] = useState<LetterheadSettings | null>(null);
  const [imageVersion, setImageVersion] = useState(0);
  const [preview, setPreview] = useState<Blob | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [busyImage, setBusyImage] = useState<"logo" | "signature" | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const signatureInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data) setValues(toSettings(data));
  }, [data]);

  const { url: logoUrl, missing: logoMissing } = useStoredImage(
    data && (data.has_own_logo || data.has_workspace_logo) ? "/letterhead/logo" : null,
    imageVersion,
  );
  const { url: signatureUrl } = useStoredImage(
    data?.has_signature ? "/letterhead/signature" : null,
    imageVersion,
  );

  const emailProblem = values?.email && !EMAIL.test(values.email) ? "Enter an email address like hr@company.com." : null;

  const runPreview = useCallback(async (settings: LetterheadSettings) => {
    setIsPreviewing(true);
    setPreviewError(null);
    try {
      const { blob } = await fetchFile("/letterhead/preview", { method: "POST", body: settings });
      setPreview(blob);
    } catch (caught) {
      setPreviewError(apiMessage(caught, "The preview could not be rendered."));
    } finally {
      setIsPreviewing(false);
    }
  }, []);

  // Re-render the sample a moment after the last change.
  useEffect(() => {
    if (!values || emailProblem) return;
    const timer = setTimeout(() => void runPreview(values), 700);
    return () => clearTimeout(timer);
  }, [values, emailProblem, runPreview, imageVersion]);

  const set = <K extends keyof LetterheadSettings>(key: K, value: LetterheadSettings[K]) =>
    setValues((current) => (current ? { ...current, [key]: value } : current));

  const dirty = Boolean(data && values && JSON.stringify(toSettings(data)) !== JSON.stringify(values));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!values || isSaving) return;
    if (emailProblem) return;
    setIsSaving(true);
    try {
      await put<Letterhead>("/letterhead", values);
      toast.success("Letterhead saved. New letters are printed on it.");
      reload();
    } catch (caught) {
      toast.error(apiMessage(caught, "The letterhead could not be saved."));
    } finally {
      setIsSaving(false);
    }
  };

  const upload = async (kind: "logo" | "signature", file: File | undefined) => {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error(`The ${kind} has to be a PNG or JPEG image.`);
      return;
    }
    // The size was checked as the file was picked (the workspace's upload limit).
    setBusyImage(kind);
    try {
      const form = new FormData();
      form.set("file", file);
      await post<Letterhead>(`/letterhead/${kind}`, form);
      toast.success(kind === "logo" ? "Logo uploaded." : "Signature uploaded.");
      setImageVersion((v) => v + 1);
      reload();
    } catch (caught) {
      toast.error(apiMessage(caught, `The ${kind} could not be uploaded.`));
    } finally {
      setBusyImage(null);
      if (logoInput.current) logoInput.current.value = "";
      if (signatureInput.current) signatureInput.current.value = "";
    }
  };

  const remove = async (kind: "logo" | "signature") => {
    setBusyImage(kind);
    try {
      await del<Letterhead>(`/letterhead/${kind}`);
      toast.success(kind === "logo" ? "Letter logo removed." : "Signature removed.");
      setImageVersion((v) => v + 1);
      reload();
    } catch (caught) {
      toast.error(apiMessage(caught, `The ${kind} could not be removed.`));
    } finally {
      setBusyImage(null);
    }
  };

  if (isLoading || !values) {
    return error ? (
      <Alert variant="destructive">
        <AlertDescription>{error.detail}</AlertDescription>
      </Alert>
    ) : (
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[36rem] w-full" />
        <Skeleton className="h-[36rem] w-full" />
      </div>
    );
  }

  const disabled = !canEdit || isSaving;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form onSubmit={save} className="grid gap-6" noValidate>
        {!canEdit && (
          <Alert>
            <AlertDescription>Only an admin can change the letterhead. You can see how it looks.</AlertDescription>
          </Alert>
        )}

        <Card tier="tier1">
          <CardHeader>
            <CardTitle>Design and colours</CardTitle>
            <CardDescription>The same layout for every letter; change the colours to your brand.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Letterhead design">
              {DESIGNS.map((design) => {
                const chosen = values.design === design.value;
                return (
                  <Button
                    key={design.value}
                    type="button"
                    variant="outline"
                    role="radio"
                    aria-checked={chosen}
                    disabled={disabled}
                    onClick={() => set("design", design.value)}
                    className={cn(
                      "h-auto flex-col items-start gap-1 whitespace-normal p-3 text-left",
                      chosen && "border-primary bg-primary/5 ring-2 ring-primary/30",
                    )}
                  >
                    <span className="text-sm font-semibold">{design.label}</span>
                    <span className="text-xs font-normal text-muted-foreground">{design.hint}</span>
                  </Button>
                );
              })}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {COLOURS.map((colour) => (
                <div key={colour.key} className="flex items-center gap-3">
                  <ColorPicker
                    value={String(values[colour.key])}
                    onChange={(value) => set(colour.key, value as never)}
                    presets={LETTERHEAD_PRESETS}
                    disabled={disabled}
                    aria-label={colour.label}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{colour.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {colour.hint} <span className="font-mono">{String(values[colour.key])}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card tier="tier1">
          <CardHeader>
            <CardTitle>Logo</CardTitle>
            <CardDescription>
              Printed at the top left. Without a letter logo, the workspace logo is used.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex h-16 w-full shrink-0 items-center justify-center rounded-lg border border-border bg-logo-plate p-2 sm:w-44">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Letter logo" className="max-h-full max-w-full object-contain" />
                ) : (
                  <ImageIcon className="size-6 text-muted-foreground" aria-hidden />
                )}
              </div>
              <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                {logoMissing
                  ? "The logo file could not be found in storage, so the company name is printed instead. Upload the logo again."
                  : data?.has_own_logo
                    ? "A logo uploaded for letters."
                    : data?.has_workspace_logo
                      ? "Using the workspace logo. Upload one to use a different logo on letters."
                      : "No logo yet: the company name is printed instead."}{" "}
                PNG or JPEG, up to {limit.label}; a large image is scaled down to print size. A wide logo
                on a white or clear background prints best.
              </p>
              <div className="flex shrink-0 gap-2">
                <HiddenFileInput
                  ref={logoInput}
                  accept="image/png,image/jpeg"
                  onChange={(event) => void upload("logo", event.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canEdit || busyImage !== null}
                  onClick={() => logoInput.current?.click()}
                >
                  {busyImage === "logo" ? <Loader2 className="animate-spin" /> : <Upload />}
                  {data?.has_own_logo ? "Replace" : "Upload"}
                </Button>
                {data?.has_own_logo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Remove letter logo"
                    disabled={!canEdit || busyImage !== null}
                    onClick={() => void remove("logo")}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="lh-show-logo">Print the logo</Label>
              <Switch
                id="lh-show-logo"
                checked={values.show_logo}
                disabled={disabled}
                onCheckedChange={(checked) => set("show_logo", checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card tier="tier1">
          <CardHeader>
            <CardTitle>Company details</CardTitle>
            <CardDescription>
              Printed in the footer, and available to letters as company fields. Leave a line empty
              to leave it off.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="lh-name" label="Company name" className="sm:col-span-2">
              <Input
                id="lh-name"
                value={values.company_name}
                maxLength={200}
                disabled={disabled}
                onChange={(e) => set("company_name", e.target.value)}
              />
            </FormField>
            <FormField htmlFor="lh-address" label="Address" optional className="sm:col-span-2">
              <Textarea
                id="lh-address"
                rows={3}
                value={values.address}
                maxLength={400}
                disabled={disabled}
                onChange={(e) => set("address", e.target.value)}
              />
            </FormField>
            <FormField htmlFor="lh-phone" label="Phone" optional>
              <Input
                id="lh-phone"
                value={values.phone}
                maxLength={60}
                inputMode="tel"
                disabled={disabled}
                onChange={(e) => set("phone", e.target.value)}
              />
            </FormField>
            <FormField htmlFor="lh-email" label="Email" optional error={emailProblem}>
              <Input
                id="lh-email"
                value={values.email}
                maxLength={120}
                inputMode="email"
                disabled={disabled}
                onChange={(e) => set("email", e.target.value.trim())}
              />
            </FormField>
            <FormField htmlFor="lh-website" label="Website" optional className="sm:col-span-2">
              <Input
                id="lh-website"
                value={values.website}
                maxLength={120}
                disabled={disabled}
                onChange={(e) => set("website", e.target.value)}
              />
            </FormField>
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <div>
                <Label htmlFor="lh-reference">Print the reference number and page number</Label>
                <p className="text-xs text-muted-foreground">A small line above the footer: Ref. … | Page 1 of 2.</p>
              </div>
              <Switch
                id="lh-reference"
                checked={values.show_reference}
                disabled={disabled}
                onCheckedChange={(checked) => set("show_reference", checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card tier="tier1">
          <CardHeader>
            <CardTitle>Signatory</CardTitle>
            <CardDescription>
              Who signs the letters. The signature image is printed where a letter says
              &ldquo;Signature&rdquo;; without one, space is left to sign by hand.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="lh-sig-title" label="Title" hint="Printed under the signature, e.g. Human Resource.">
              <Input
                id="lh-sig-title"
                value={values.signatory_title}
                maxLength={120}
                disabled={disabled}
                onChange={(e) => set("signatory_title", e.target.value)}
              />
            </FormField>
            <FormField htmlFor="lh-sig-name" label="Name" optional hint="Available to letters as Signatory name.">
              <Input
                id="lh-sig-name"
                value={values.signatory_name}
                maxLength={120}
                disabled={disabled}
                onChange={(e) => set("signatory_name", e.target.value)}
              />
            </FormField>
            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
              <div className="flex h-16 w-full shrink-0 items-center justify-center rounded-lg border border-border bg-background p-2 sm:w-44">
                {signatureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                ) : (
                  <PenLine className="size-6 text-muted-foreground" aria-hidden />
                )}
              </div>
              <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                A scan of the signature on white, PNG or JPEG, up to {limit.label}. Letters already issued keep
                the signature they were printed with.
              </p>
              <div className="flex shrink-0 gap-2">
                <HiddenFileInput
                  ref={signatureInput}
                  accept="image/png,image/jpeg"
                  onChange={(event) => void upload("signature", event.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canEdit || busyImage !== null}
                  onClick={() => signatureInput.current?.click()}
                >
                  {busyImage === "signature" ? <Loader2 className="animate-spin" /> : <Upload />}
                  {data?.has_signature ? "Replace" : "Upload"}
                </Button>
                {data?.has_signature && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Remove signature"
                    disabled={!canEdit || busyImage !== null}
                    onClick={() => void remove("signature")}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {canEdit && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {dirty && <p className="mr-auto text-xs text-muted-foreground">Unsaved changes</p>}
            <Button
              type="button"
              variant="outline"
              disabled={!dirty || isSaving}
              onClick={() => data && setValues(toSettings(data))}
            >
              Discard
            </Button>
            <Button type="submit" variant="accent" disabled={!dirty || isSaving || Boolean(emailProblem)}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
              Save letterhead
            </Button>
          </div>
        )}
      </form>

      <Card tier="tier1" className="xl:sticky xl:top-4">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Preview</CardTitle>
            <CardDescription>A sample letter on these choices. Nothing here is a real letter.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPreviewing || Boolean(emailProblem)}
            onClick={() => void runPreview(values)}
          >
            {isPreviewing ? <Loader2 className="animate-spin" /> : <Eye />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          {previewError && (
            <Alert variant="destructive">
              <AlertDescription>{previewError}</AlertDescription>
            </Alert>
          )}
          <PdfPreview blob={preview} isLoading={isPreviewing} title="Letterhead preview" className="h-[75vh]" />
        </CardContent>
      </Card>
    </div>
  );
}
