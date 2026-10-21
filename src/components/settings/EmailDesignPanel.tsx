"use client";

import { Loader2, Save, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { post, put } from "@/lib/api";
import {
  DEFAULT_EMAIL_ACCENT,
  type EmailDesign,
  type EmailDesignInput,
  type EmailTestResult,
} from "@/lib/types/notifications";

import { CompanyLogoCard } from "./CompanyLogoCard";
import { EmailPreviewFrame } from "./EmailPreviewFrame";
import { errorDetail } from "./settingsShared";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** What the design preview shows: an approval email, so the buttons show too. */
const SAMPLE = {
  eventKey: "leave.approval.requested",
  subject: "Leave approval needed",
  body: "{employee_name} has requested {leave_type} from {start_date} to {end_date}.\n\nReason: family wedding in Kochi.",
};

function toInput(design: EmailDesign): EmailDesignInput {
  return {
    accent_colour: design.accent_colour,
    show_logo: design.show_logo,
    sign_off: design.sign_off,
    footer_text: design.footer_text,
    approve_from_email: design.approve_from_email,
  };
}

/**
 * Settings → Notifications → Email design.
 *
 * Every email the workspace sends goes out in this design: the company logo,
 * its colour, its sign-off and footer. A small "Powered by AskMira" line sits
 * at the very bottom of every email and is not a setting.
 */
export function EmailDesignPanel() {
  const saved = useApiQuery<EmailDesign>("/notifications/admin/email-design");
  const [draft, setDraft] = useState<EmailDesignInput | null>(null);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);

  useEffect(() => {
    if (saved.data) setDraft(toInput(saved.data));
  }, [saved.data]);

  if (saved.isLoading || !draft) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (saved.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{saved.error.detail}</AlertDescription>
      </Alert>
    );
  }

  const colourOk = HEX.test(draft.accent_colour);
  const dirty = saved.data ? JSON.stringify(toInput(saved.data)) !== JSON.stringify(draft) : false;
  const set = <K extends keyof EmailDesignInput>(key: K, value: EmailDesignInput[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  const save = async () => {
    setBusy("save");
    try {
      await put("/notifications/admin/email-design", draft);
      toast.success("Email design saved. Every email from now on uses it.");
      saved.reload();
    } catch (caught) {
      toast.error(errorDetail(caught, "Could not save the email design."));
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async () => {
    setBusy("test");
    try {
      const result = await post<EmailTestResult>("/notifications/admin/emails/test", {
        event_key: SAMPLE.eventKey,
        subject: SAMPLE.subject,
        body: SAMPLE.body,
        branding: draft,
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

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-4">
        <CompanyLogoCard />
        <Card tier="tier1">
          <CardHeader>
            <CardTitle>Email design</CardTitle>
            <CardDescription>
              How every email from {saved.data?.company_name || "your company"} looks: payslips,
              approvals, reminders, candidate messages, all of them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="email-show-logo">Show the company logo</Label>
                <p className="text-xs text-muted-foreground">
                  {saved.data?.has_logo
                    ? "The logo above heads every email."
                    : "Upload a logo above; until then the company name heads every email."}
                </p>
              </div>
              <Switch
                id="email-show-logo"
                checked={draft.show_logo}
                onCheckedChange={(checked) => set("show_logo", checked)}
              />
            </div>

            <FormField
              htmlFor="email-accent"
              label="Brand colour"
              hint="Buttons, links and the line across the top of the card."
              error={colourOk ? null : "A colour like #14595C."}
            >
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  aria-label="Pick the brand colour"
                  value={colourOk ? draft.accent_colour : DEFAULT_EMAIL_ACCENT}
                  onChange={(event) => set("accent_colour", event.target.value.toUpperCase())}
                  className="h-9 w-14 cursor-pointer p-1"
                />
                <Input
                  id="email-accent"
                  value={draft.accent_colour}
                  maxLength={7}
                  onChange={(event) => set("accent_colour", event.target.value.trim())}
                  className="w-32 font-mono"
                />
              </div>
            </FormField>

            <FormField
              htmlFor="email-sign-off"
              label="Sign-off"
              optional
              hint="Closes every email, for example “Regards, People team”."
            >
              <Textarea
                id="email-sign-off"
                rows={2}
                maxLength={300}
                value={draft.sign_off}
                onChange={(event) => set("sign_off", event.target.value)}
              />
            </FormField>

            <FormField
              htmlFor="email-footer"
              label="Footer"
              optional
              hint="Small print under every email: registered address, HR contact, a disclaimer."
            >
              <Textarea
                id="email-footer"
                rows={3}
                maxLength={800}
                value={draft.footer_text}
                onChange={(event) => set("footer_text", event.target.value)}
              />
            </FormField>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="email-approve">Approve or reject from the email</Label>
                <p className="text-xs text-muted-foreground">
                  Approval emails carry Approve and Reject buttons. The approver adds a comment and
                  confirms on a secure page; it is recorded as their decision, from email. Not
                  offered to anyone your policy requires two-step sign-in of.
                </p>
              </div>
              <Switch
                id="email-approve"
                checked={draft.approve_from_email}
                onCheckedChange={(checked) => set("approve_from_email", checked)}
              />
            </div>

            <Alert>
              <AlertTitle>Powered by AskMira</AlertTitle>
              <AlertDescription>
                A small “Sent by {saved.data?.company_name || "your company"} · Powered by AskMira”
                line closes every email. It is part of the AskMira service and cannot be removed.
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void save()} disabled={busy !== null || !colourOk || !dirty}>
                {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} Save design
              </Button>
              <Button variant="outline" onClick={() => void sendTest()} disabled={busy !== null || !colourOk}>
                {busy === "test" ? <Loader2 className="animate-spin" /> : <Send />} Send me a test
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card tier="tier1">
        <CardContent className="pt-6">
          <EmailPreviewFrame
            eventKey={SAMPLE.eventKey}
            subject={SAMPLE.subject}
            body={SAMPLE.body}
            branding={colourOk ? draft : { ...draft, accent_colour: saved.data?.accent_colour ?? DEFAULT_EMAIL_ACCENT }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
