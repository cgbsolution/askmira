"use client";

import { Loader2, Sparkles } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ApiError, put } from "@/lib/api";

import { type AiFeature, useAiStatus } from "./aiStatus";

const FEATURE_LABEL: Record<AiFeature, string> = {
  companion: "Ask Mira chat",
  assistant: "Policy assistant",
  recognition_drafts: "Shoutout drafting",
  survey_topics: "Survey comment themes",
  analytics_questions: "Questions in Reports",
  hiring_drafts: "Job descriptions and resume reading",
};

/**
 * Settings → Company → AI.
 *
 * Off until an admin turns it on: with it on, the parts of a question each
 * feature needs are sent to the model provider, outside India. Each feature
 * then still needs the person's own consent where the data is theirs.
 */
export function AiSettingsPanel() {
  const { data, error, isLoading, reload } = useAiStatus();
  const [draft, setDraft] = useState<Record<string, boolean> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setDraft({ ...data.settings });
  }, [data]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await put("/admin/ai-settings", draft);
      toast.success(draft.enabled ? "AI features saved." : "AI features are off.");
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DataPanel
      title="AI features"
      description="What the AI features may do in this workspace. Off until you turn it on."
      isLoading={isLoading}
      error={error?.detail}
      onRetry={reload}
      actions={
        <Button onClick={save} disabled={saving || !draft}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Save
        </Button>
      }
    >
      {data && draft ? (
        <div className="grid gap-5">
          {!data.configured ? (
            <Alert>
              <Sparkles />
              <AlertTitle>No AI provider is configured on this server</AlertTitle>
              <AlertDescription>
                The switches below are saved, but nothing can be sent until the server has an API key
                for the model provider.
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-muted-foreground">
              Model <Badge variant="outline">{data.model}</Badge> from {data.sub_processor}, which
              processes data outside India. Every request is logged with what was sent, under
              Compliance → Privacy.
            </p>
          )}

          <div className="flex items-center justify-between gap-4 rounded-md border p-4">
            <div className="grid gap-1">
              <Label htmlFor="ai-enabled">AI features for this workspace</Label>
              <p className="text-sm text-muted-foreground">
                Off means no request of any kind goes to the model provider.
              </p>
            </div>
            <Switch
              id="ai-enabled"
              checked={draft.enabled}
              onCheckedChange={(checked) => setDraft({ ...draft, enabled: checked })}
            />
          </div>

          <div className="grid gap-3">
            {(Object.keys(FEATURE_LABEL) as AiFeature[]).map((feature) => (
              <div key={feature} className="flex items-center justify-between gap-4">
                <div className="grid gap-0.5">
                  <Label htmlFor={`ai-${feature}`}>{FEATURE_LABEL[feature]}</Label>
                  <p className="text-sm text-muted-foreground">{data.feature_descriptions[feature]}</p>
                </div>
                <Switch
                  id={`ai-${feature}`}
                  checked={Boolean(draft[feature])}
                  disabled={!draft.enabled}
                  onCheckedChange={(checked) => setDraft({ ...draft, [feature]: checked })}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </DataPanel>
  );
}
