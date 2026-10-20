"use client";

import { Loader2, Sparkles } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { FormField } from "@/components/common/FormField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ApiError, put } from "@/lib/api";

import type { CompanionConfig, CompanionSettings } from "./types";

const GROUP_LABEL: Record<string, string> = {
  policy: "Company policy",
  own_record: "A person's own record",
  people: "People directory",
  who_is_out: "Who is on leave",
  attendance: "Attendance (HR only)",
  org: "Departments and locations",
  reports: "Reports",
  products: "Linked products",
};

/**
 * Settings → Company → AI → Ask Mira.
 *
 * Each workspace's own companion: its name, greeting and notes, which tools
 * it may use, and how much it may be used. None of this widens what it can
 * read — every tool still runs as the person asking.
 */
export function CompanionSettingsPanel() {
  const { data, error, isLoading, reload } = useApiQuery<CompanionSettings>("/companion/settings");
  const [draft, setDraft] = useState<CompanionConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setDraft({ ...data.config, tools: { ...data.config.tools } });
  }, [data]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await put("/companion/settings", draft);
      toast.success("Ask Mira settings saved.");
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof CompanionConfig>(key: K, value: CompanionConfig[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  return (
    <DataPanel
      title="Ask Mira"
      description="Your workspace's own AI companion. It answers each person with their own access; these settings shape who it is and what it may do."
      isLoading={isLoading}
      error={error?.detail}
      onRetry={reload}
      actions={
        <Button onClick={save} disabled={saving || !draft}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Save
        </Button>
      }
    >
      {data && draft ? (
        <div className="grid gap-6">
          {!data.ai_enabled ? (
            <Alert>
              <AlertTitle>Ask Mira is off</AlertTitle>
              <AlertDescription>
                Turn on AI features and “Ask Mira chat” above. The settings here apply once it is on.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{data.usage.replies_this_month} replies this month</Badge>
            <Badge variant="outline">{data.usage.tokens_this_month.toLocaleString("en-IN")} model tokens this month</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Name" htmlFor="companion-name" hint="Up to three words. What people see in the chat.">
              <Input
                id="companion-name"
                value={draft.name}
                maxLength={32}
                onChange={(event) => set("name", event.target.value)}
              />
            </FormField>
            <FormField label="Greeting" htmlFor="companion-greeting" optional hint="Shown when a conversation starts.">
              <Input
                id="companion-greeting"
                value={draft.greeting}
                maxLength={300}
                placeholder={`Hi! I'm ${draft.name || "Mira"}. Ask me anything about work.`}
                onChange={(event) => set("greeting", event.target.value)}
              />
            </FormField>
          </div>

          <FormField
            label="About the company"
            htmlFor="companion-notes"
            optional
            hint="What it should know: tone, who to contact for what, terms your company uses. It cannot change what the companion is allowed to do."
          >
            <Textarea
              id="companion-notes"
              value={draft.company_notes}
              rows={4}
              maxLength={2000}
              onChange={(event) => set("company_notes", event.target.value)}
            />
          </FormField>

          <div className="grid gap-3">
            <p className="text-sm font-medium">What it may do</p>
            <p className="text-xs text-muted-foreground">
              A tool is offered to a person only if it is on here and their role may use it; attendance, for
              example, is HR&apos;s whatever is switched on.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {data.groups.map((group) => {
                const on = draft.tools[group.key] ?? true;
                return (
                  <div key={group.key} className="flex items-start gap-3 rounded-lg border p-3">
                    <Switch
                      id={`companion-tool-${group.key}`}
                      checked={on}
                      onCheckedChange={(checked) => set("tools", { ...draft.tools, [group.key]: checked })}
                    />
                    <div className="grid gap-0.5">
                      <Label htmlFor={`companion-tool-${group.key}`}>{GROUP_LABEL[group.key] ?? group.key}</Label>
                      <p className="text-xs text-muted-foreground">{group.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Messages per person per day"
              htmlFor="companion-daily"
              hint="Between 5 and 1,000. The count starts again at midnight, India time."
            >
              <Input
                id="companion-daily"
                type="number"
                min={5}
                max={1000}
                value={draft.daily_messages_per_person}
                onChange={(event) => set("daily_messages_per_person", Number(event.target.value))}
              />
            </FormField>
            <FormField
              label="Model tokens per month, whole workspace"
              htmlFor="companion-budget"
              hint="0 means no cap. Counts Ask Mira, the policy assistant and report questions."
            >
              <Input
                id="companion-budget"
                type="number"
                min={0}
                step={100000}
                value={draft.monthly_token_budget}
                onChange={(event) => set("monthly_token_budget", Number(event.target.value))}
              />
            </FormField>
          </div>
        </div>
      ) : null}
    </DataPanel>
  );
}
