"use client";

import { ExternalLink, Loader2, Save } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { humanize } from "@/components/hiring/labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, put } from "@/lib/api";
import type { CareersConfig } from "@/lib/types/hiring";

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const COLOUR = /^#[0-9A-Fa-f]{6}$/;

interface FormState {
  slug: string;
  is_published: boolean;
  hero_heading: string;
  hero_subheading: string;
  about_html: string;
  logo_url: string;
  hero_image_url: string;
  primary_colour: string;
  accent_colour: string;
  culture_enabled: boolean;
  allow_apply_without_account: boolean;
  privacy_notice_html: string;
  privacy_notice_version: string;
  resume_retention_days: string;
  seo_title: string;
  seo_description: string;
}

type FieldKey = keyof FormState;
type Errors = Partial<Record<FieldKey, string>>;

interface SaveResult {
  slug: string;
  is_published: boolean;
  changed: string[];
}

/** The saved config as form values. A missing config starts from the API's own defaults. */
function toForm(config: CareersConfig): FormState {
  return {
    slug: config.slug ?? "",
    is_published: config.is_published ?? false,
    hero_heading: config.hero_heading ?? "",
    hero_subheading: config.hero_subheading ?? "",
    about_html: config.about_html ?? "",
    logo_url: config.logo_url ?? "",
    hero_image_url: config.hero_image_url ?? "",
    primary_colour: config.primary_colour ?? "",
    accent_colour: config.accent_colour ?? "",
    culture_enabled: config.culture_enabled ?? true,
    allow_apply_without_account: config.allow_apply_without_account ?? true,
    privacy_notice_html: config.privacy_notice_html ?? "",
    privacy_notice_version: config.privacy_notice_version ?? "1",
    resume_retention_days:
      config.resume_retention_days !== null ? String(config.resume_retention_days) : "730",
    seo_title: config.seo_title ?? "",
    seo_description: config.seo_description ?? "",
  };
}

function validate(form: FormState): Errors {
  const errors: Errors = {};
  const slug = form.slug.trim();
  if (!slug) errors.slug = "A slug is required.";
  else if (slug.length < 2 || slug.length > 64 || !SLUG.test(slug)) {
    errors.slug = "2–64 characters: lowercase letters, digits and hyphens, not starting with a hyphen.";
  }
  for (const key of ["logo_url", "hero_image_url"] as const) {
    const value = form[key].trim();
    if (value && !value.startsWith("https://")) errors[key] = "Must be an https:// address.";
  }
  for (const key of ["primary_colour", "accent_colour"] as const) {
    const value = form[key].trim();
    if (value && !COLOUR.test(value)) errors[key] = "Use the form #RRGGBB.";
  }
  if (form.is_published && !form.privacy_notice_html.trim()) {
    errors.privacy_notice_html = "A published page needs a privacy notice.";
  }
  if (!form.privacy_notice_version.trim()) {
    errors.privacy_notice_version = "Give the notice a version.";
  }
  const days = form.resume_retention_days.trim();
  if (!/^\d+$/.test(days) || Number(days) < 1 || Number(days) > 3650) {
    errors.resume_retention_days = "Whole days from 1 to 3650.";
  }
  return errors;
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** A labelled on/off setting row. */
function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2.5">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * The careers site settings (admin). Checked here before saving so the admin
 * sees problems next to the field; the server applies the same rules.
 */
export function CareersSiteForm({
  config,
  onSaved,
}: {
  config: CareersConfig;
  onSaved: (result: SaveResult) => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(config));
  const [errors, setErrors] = useState<Errors>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm(toForm(config));
    setErrors({});
  }, [config]);

  const set = <K extends FieldKey>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const text = (key: Exclude<FieldKey, "is_published" | "culture_enabled" | "allow_apply_without_account">) => ({
    id: `careers-${key}`,
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key, event.target.value),
    "aria-invalid": errors[key] ? true : undefined,
  });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Fix the highlighted fields before saving.");
      return;
    }
    setIsSaving(true);
    try {
      const result = await put<SaveResult>("/careers/config", {
        slug: form.slug.trim(),
        is_published: form.is_published,
        hero_heading: nullable(form.hero_heading),
        hero_subheading: nullable(form.hero_subheading),
        about_html: nullable(form.about_html),
        logo_url: nullable(form.logo_url),
        hero_image_url: nullable(form.hero_image_url),
        primary_colour: nullable(form.primary_colour),
        accent_colour: nullable(form.accent_colour),
        culture_enabled: form.culture_enabled,
        allow_apply_without_account: form.allow_apply_without_account,
        privacy_notice_html: nullable(form.privacy_notice_html),
        privacy_notice_version: form.privacy_notice_version.trim(),
        resume_retention_days: Number(form.resume_retention_days.trim()),
        seo_title: nullable(form.seo_title),
        seo_description: nullable(form.seo_description),
      });
      toast.success("Careers site saved", {
        description:
          result.changed.length > 0
            ? `Changed: ${result.changed.map((field) => humanize(field)).join(", ")}.`
            : "Nothing had changed.",
      });
      onSaved(result);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Could not save the careers site.");
    } finally {
      setIsSaving(false);
    }
  };

  const savedSlug = config.exists ? config.slug : null;
  const previewHref = savedSlug && config.is_published ? `/careers/${savedSlug}` : null;

  return (
    <form onSubmit={(event) => void save(event)} noValidate>
      <Card tier="tier1">
        <CardHeader>
          <CardTitle>Careers page</CardTitle>
          <CardDescription>
            {config.exists
              ? config.is_published
                ? "Published. Changes go live when you save."
                : "Saved but not published. Nobody outside can see it yet."
              : "Not set up yet. Save to create it."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <section className="grid gap-4 md:grid-cols-2">
            <FormField
              htmlFor="careers-slug"
              label="Address slug"
              hint={`Lowercase letters, digits and hyphens. The page lives at /careers/${form.slug.trim() || "your-slug"}.`}
              error={errors.slug}
            >
              <Input {...text("slug")} maxLength={64} required autoComplete="off" />
            </FormField>
            <div className="grid content-end gap-3">
              <SwitchRow
                id="careers-published"
                label="Published"
                hint="Anyone with the link can see open roles and apply."
                checked={form.is_published}
                onChange={(value) => set("is_published", value)}
              />
            </div>
          </section>

          <section className="grid gap-4">
            <p className="text-sm font-medium text-foreground">Page content</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField htmlFor="careers-hero_heading" label="Hero heading" optional error={errors.hero_heading}>
                <Input {...text("hero_heading")} maxLength={255} />
              </FormField>
              <FormField
                htmlFor="careers-hero_subheading"
                label="Hero subheading"
                optional
                error={errors.hero_subheading}
              >
                <Input {...text("hero_subheading")} maxLength={2000} />
              </FormField>
            </div>
            <FormField
              htmlFor="careers-about_html"
              label="About the company"
              optional
              hint="Shown on the public page as plain text paragraphs: each line becomes a paragraph, and any HTML tags are removed."
            >
              <Textarea {...text("about_html")} rows={6} maxLength={20000} />
            </FormField>
          </section>

          <section className="grid gap-4">
            <p className="text-sm font-medium text-foreground">Branding</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField htmlFor="careers-logo_url" label="Logo URL" optional hint="https:// only." error={errors.logo_url}>
                <Input {...text("logo_url")} type="url" maxLength={1024} placeholder="https://" />
              </FormField>
              <FormField
                htmlFor="careers-hero_image_url"
                label="Hero image URL"
                optional
                hint="https:// only."
                error={errors.hero_image_url}
              >
                <Input {...text("hero_image_url")} type="url" maxLength={1024} placeholder="https://" />
              </FormField>
              <FormField
                htmlFor="careers-primary_colour"
                label="Primary colour"
                optional
                hint="Hex, as #RRGGBB."
                error={errors.primary_colour}
              >
                <Input {...text("primary_colour")} maxLength={7} className="font-mono" autoComplete="off" />
              </FormField>
              <FormField
                htmlFor="careers-accent_colour"
                label="Accent colour"
                optional
                hint="Hex, as #RRGGBB."
                error={errors.accent_colour}
              >
                <Input {...text("accent_colour")} maxLength={7} className="font-mono" autoComplete="off" />
              </FormField>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <SwitchRow
              id="careers-culture"
              label="Show culture highlights"
              hint="Public shout-outs and clubs appear on the page."
              checked={form.culture_enabled}
              onChange={(value) => set("culture_enabled", value)}
            />
            <SwitchRow
              id="careers-apply-anon"
              label="Allow applying without an account"
              hint="Applicants can apply with just the form."
              checked={form.allow_apply_without_account}
              onChange={(value) => set("allow_apply_without_account", value)}
            />
          </section>

          <section className="grid gap-4">
            <p className="text-sm font-medium text-foreground">Privacy and retention</p>
            <FormField
              htmlFor="careers-privacy_notice_html"
              label="Privacy notice"
              optional={!form.is_published}
              hint="Required once the page is published. Shown to applicants as plain text paragraphs."
              error={errors.privacy_notice_html}
            >
              <Textarea {...text("privacy_notice_html")} rows={6} maxLength={40000} />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                htmlFor="careers-privacy_notice_version"
                label="Notice version"
                hint="Recorded with each applicant's consent. Change it when the notice changes."
                error={errors.privacy_notice_version}
              >
                <Input {...text("privacy_notice_version")} maxLength={32} required />
              </FormField>
              <FormField
                htmlFor="careers-resume_retention_days"
                label="Keep applicant resumes for (days)"
                hint="1 to 3650. Applies to new applications."
                error={errors.resume_retention_days}
              >
                <Input
                  {...text("resume_retention_days")}
                  type="number"
                  min={1}
                  max={3650}
                  className="tabular-nums"
                  required
                />
              </FormField>
            </div>
          </section>

          <section className="grid gap-4">
            <p className="text-sm font-medium text-foreground">Search engines</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField htmlFor="careers-seo_title" label="SEO title" optional>
                <Input {...text("seo_title")} maxLength={255} />
              </FormField>
              <FormField htmlFor="careers-seo_description" label="SEO description" optional>
                <Textarea {...text("seo_description")} rows={2} maxLength={1000} />
              </FormField>
            </div>
          </section>
        </CardContent>
        <CardFooter className="flex flex-wrap justify-end gap-2 border-t border-border">
          {previewHref && (
            <Button variant="outline" asChild>
              <Link href={previewHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Open careers page
              </Link>
            </Button>
          )}
          <Button type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
            Save
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
