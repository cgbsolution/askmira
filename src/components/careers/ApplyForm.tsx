"use client";

import { Check, CheckCircle2, Copy, Loader2 } from "lucide-react";
import React, { useState } from "react";

import { PrivacyNotice } from "@/components/careers/PrivacyNotice";
import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, post } from "@/lib/api";
import type { ApplyResult } from "@/lib/types/hiring";
import { formatDate } from "@/lib/utils";

type Fields = {
  full_name: string;
  email: string;
  phone: string;
  current_company: string;
  total_experience_years: string;
  notice_period_days: string;
  expected_ctc: string;
  website: string;
};

const EMPTY: Fields = {
  full_name: "",
  email: "",
  phone: "",
  current_company: "",
  total_experience_years: "",
  notice_period_days: "",
  expected_ctc: "",
  website: "",
};

type Errors = Partial<Record<keyof Fields | "resume" | "consent", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DECIMAL = /^\d+(\.\d{1,2})?$/;

/** The candidate's application form for one job, with explicit, separate consents. */
export function ApplyForm({
  slug,
  code,
  organisation,
  noticeVersion,
  privacyParagraphs,
  retentionDays,
  resumeMaxMb,
}: {
  slug: string;
  code: string;
  organisation: string;
  noticeVersion: string;
  privacyParagraphs: string[];
  retentionDays: number;
  resumeMaxMb: number;
}) {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [resume, setResume] = useState<File | null>(null);
  const [consentProcessing, setConsentProcessing] = useState(false);
  const [consentPool, setConsentPool] = useState(false);
  const [consentWhatsApp, setConsentWhatsApp] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ApplyResult | null>(null);

  function set<K extends keyof Fields>(key: K, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function checkResume(file: File | null): string | undefined {
    if (!file) return undefined;
    const isPdf = file.name.toLowerCase().endsWith(".pdf") && (file.type === "" || file.type === "application/pdf");
    if (!isPdf) return "The resume must be a PDF file.";
    if (file.size > resumeMaxMb * 1024 * 1024) return `The resume must be ${resumeMaxMb} MB or smaller.`;
    if (file.size === 0) return "The resume file is empty.";
    return undefined;
  }

  function validate(): Errors {
    const next: Errors = {};
    if (!fields.full_name.trim()) next.full_name = "Enter your full name.";
    if (!EMAIL.test(fields.email.trim())) next.email = "Enter a valid email address.";
    if (fields.total_experience_years && !DECIMAL.test(fields.total_experience_years.trim())) {
      next.total_experience_years = "Enter a number of years, e.g. 4 or 4.5.";
    }
    const notice = fields.notice_period_days.trim();
    if (notice && (!/^\d+$/.test(notice) || Number(notice) > 365)) {
      next.notice_period_days = "Enter a whole number of days, up to 365.";
    }
    if (fields.expected_ctc && !DECIMAL.test(fields.expected_ctc.trim())) {
      next.expected_ctc = "Enter an amount in rupees, digits only.";
    }
    const resumeError = checkResume(resume);
    if (resumeError) next.resume = resumeError;
    if (!consentProcessing) next.consent = "Consent is required to process your application.";
    return next;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const form = new FormData();
    form.append("full_name", fields.full_name.trim());
    form.append("email", fields.email.trim());
    const optional: (keyof Fields)[] = [
      "phone",
      "current_company",
      "total_experience_years",
      "notice_period_days",
      "expected_ctc",
    ];
    for (const key of optional) {
      const value = fields[key].trim();
      if (value) form.append(key, value);
    }
    form.append("consent_application_processing", consentProcessing ? "true" : "false");
    form.append("consent_talent_pool", consentPool ? "true" : "false");
    form.append("consent_whatsapp", consentWhatsApp && fields.phone.trim() ? "true" : "false");
    form.append("notice_version", noticeVersion);
    form.append("website", fields.website);
    if (resume) form.append("resume", resume);

    setPending(true);
    try {
      const response = await post<ApplyResult>(
        `/public/careers/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(code)}/apply`,
        form,
        { skipAuthRedirect: true },
      );
      setResult(response);
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.detail : "Your application could not be sent. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  if (result) return <ApplyConfirmation result={result} />;

  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle>Apply for this role</CardTitle>
        <CardDescription>Fields marked * are required.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="apply-name" label="Full name *" error={errors.full_name}>
              <Input
                id="apply-name"
                autoComplete="name"
                maxLength={255}
                value={fields.full_name}
                aria-invalid={Boolean(errors.full_name)}
                onChange={(event) => set("full_name", event.target.value)}
              />
            </FormField>
            <FormField htmlFor="apply-email" label="Email *" error={errors.email}>
              <Input
                id="apply-email"
                type="email"
                autoComplete="email"
                maxLength={320}
                value={fields.email}
                aria-invalid={Boolean(errors.email)}
                onChange={(event) => set("email", event.target.value)}
              />
            </FormField>
            <FormField htmlFor="apply-phone" label="Phone" optional>
              <Input
                id="apply-phone"
                type="tel"
                autoComplete="tel"
                maxLength={32}
                value={fields.phone}
                onChange={(event) => set("phone", event.target.value)}
              />
            </FormField>
            <FormField htmlFor="apply-company" label="Current company" optional>
              <Input
                id="apply-company"
                autoComplete="organization"
                maxLength={255}
                value={fields.current_company}
                onChange={(event) => set("current_company", event.target.value)}
              />
            </FormField>
            <FormField
              htmlFor="apply-experience"
              label="Total experience (years)"
              optional
              error={errors.total_experience_years}
            >
              <Input
                id="apply-experience"
                inputMode="decimal"
                maxLength={8}
                value={fields.total_experience_years}
                aria-invalid={Boolean(errors.total_experience_years)}
                onChange={(event) => set("total_experience_years", event.target.value)}
              />
            </FormField>
            <FormField
              htmlFor="apply-notice"
              label="Notice period (days)"
              optional
              error={errors.notice_period_days}
            >
              <Input
                id="apply-notice"
                inputMode="numeric"
                value={fields.notice_period_days}
                aria-invalid={Boolean(errors.notice_period_days)}
                onChange={(event) => set("notice_period_days", event.target.value)}
              />
            </FormField>
            <FormField
              htmlFor="apply-ctc"
              label="Expected annual CTC (₹)"
              optional
              error={errors.expected_ctc}
            >
              <Input
                id="apply-ctc"
                inputMode="decimal"
                maxLength={16}
                value={fields.expected_ctc}
                aria-invalid={Boolean(errors.expected_ctc)}
                onChange={(event) => set("expected_ctc", event.target.value)}
              />
            </FormField>
            <FormField
              htmlFor="apply-resume"
              label="Resume (PDF)"
              optional
              hint={`PDF only, up to ${resumeMaxMb} MB.`}
              error={errors.resume}
            >
              <Input
                id="apply-resume"
                type="file"
                accept="application/pdf,.pdf"
                aria-invalid={Boolean(errors.resume)}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setResume(file);
                  setErrors((current) => ({ ...current, resume: checkResume(file) }));
                }}
              />
            </FormField>
          </div>

          {/* Honeypot: invisible to people, left empty by them; bots fill it in. */}
          <div className="hidden" aria-hidden="true">
            <Label htmlFor="apply-website">Website</Label>
            <Input
              id="apply-website"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={fields.website}
              onChange={(event) => set("website", event.target.value)}
            />
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-sm font-medium text-foreground">Privacy notice</p>
            <PrivacyNotice
              paragraphs={privacyParagraphs}
              retentionDays={retentionDays}
              version={noticeVersion}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="apply-consent-processing"
                checked={consentProcessing}
                aria-invalid={Boolean(errors.consent)}
                onCheckedChange={(value) => setConsentProcessing(value === true)}
                className="mt-0.5"
              />
              <Label htmlFor="apply-consent-processing" className="font-normal leading-snug">
                I explicitly consent to {organisation} processing the personal data in this
                application to assess me for this role, and to keeping it for {retentionDays} days. *
              </Label>
            </div>
            {errors.consent && (
              <p role="alert" className="text-xs text-destructive">
                {errors.consent}
              </p>
            )}
            <div className="flex items-start gap-3">
              <Checkbox
                id="apply-consent-pool"
                checked={consentPool}
                onCheckedChange={(value) => setConsentPool(value === true)}
                className="mt-0.5"
              />
              <Label htmlFor="apply-consent-pool" className="font-normal leading-snug">
                Optional: keep my details in {organisation}&apos;s talent pool and contact me about
                other suitable roles.
              </Label>
            </div>
            {fields.phone.trim() && (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="apply-consent-whatsapp"
                  checked={consentWhatsApp}
                  onCheckedChange={(value) => setConsentWhatsApp(value === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="apply-consent-whatsapp" className="font-normal leading-snug">
                  Optional: also send me updates about this application on WhatsApp, to the phone
                  number above. I can turn this off from my application link.
                </Label>
              </div>
            )}
          </div>

          {serverError && (
            <Alert variant="destructive">
              <AlertTitle>Application not sent</AlertTitle>
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" variant="accent" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Submit application
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** Shown once after a successful application: the message and the one-time portal link. */
function ApplyConfirmation({ result }: { result: ApplyResult }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/candidate/${result.portal_token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card tier="tier2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-success" /> Application received
        </CardTitle>
        <CardDescription>{result.message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <FormField
          htmlFor="portal-link"
          label="Your application portal link"
          hint={`This link is shown only once. Save it now — it expires on ${formatDate(result.portal_expires_at)}.`}
        >
          <div className="flex gap-2">
            <Input id="portal-link" readOnly value={link} onFocus={(event) => event.target.select()} />
            <Button type="button" variant="outline" onClick={copy}>
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </FormField>
        {!result.resume_stored && (
          <p className="text-sm text-muted-foreground">No resume was stored with this application.</p>
        )}
      </CardContent>
    </Card>
  );
}
