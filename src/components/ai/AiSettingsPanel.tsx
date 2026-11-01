"use client";

import { CheckCircle2, KeyRound, Loader2, PlugZap, Sparkles, Trash2, XCircle } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DataPanel } from "@/components/common/DataPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { ApiError, del, post, put } from "@/lib/api";

import {
  type AiFeature,
  type AiProviderKey,
  type AiSettings,
  type AiTestResult,
  useAiStatus,
} from "./aiStatus";

const FEATURE_LABEL: Record<AiFeature, string> = {
  companion: "Ask Mira chat",
  assistant: "Policy assistant",
  recognition_drafts: "Shoutout drafting",
  survey_topics: "Survey comment themes",
  analytics_questions: "Questions in Reports",
  hiring_drafts: "Job descriptions and resume reading",
};

/** Where each provider processes what it is sent, in a line an admin can judge. */
const WHERE: Record<AiProviderKey, string> = {
  anthropic: "Anthropic processes requests in the United States.",
  openai: "OpenAI processes requests in the United States.",
  gemini: "Google does not pin a region for the Gemini API.",
  ollama: "Requests go only to your Ollama server, wherever you run it.",
};

const DEFAULT = "default";

/**
 * Settings → Company → AI.
 *
 * Who answers (Anthropic, OpenAI, Gemini or your own Ollama server), with which
 * model and whose key, and what the AI features may do. Off until an admin turns
 * it on; each feature then still needs the person's own consent where the data
 * is theirs. Keys are stored encrypted and never shown again.
 */
export function AiSettingsPanel() {
  const { data, error, isLoading, reload } = useAiStatus();
  const [draft, setDraft] = useState<AiSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState<AiTestResult | null>(null);

  useEffect(() => {
    if (data) setDraft({ ...data.settings });
  }, [data]);

  const providers = data?.providers ?? [];
  const chosenKey: AiProviderKey = (draft?.provider || data?.provider || "anthropic") as AiProviderKey;
  const chosen = providers.find((p) => p.key === chosenKey);
  const dirty = useMemo(
    () => Boolean(data && draft && JSON.stringify(data.settings) !== JSON.stringify(draft)),
    [data, draft],
  );

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await put("/admin/ai-settings", { ...draft, model: draft.model.trim(), base_url: draft.base_url.trim() });
      toast.success(draft.enabled ? "AI settings saved." : "AI features are off.");
      setTested(null);
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const saveKey = async () => {
    const key = keyInput.trim();
    if (key.length < 8 || /\s/.test(key)) {
      toast.error("Paste the whole key, without spaces.");
      return;
    }
    setKeyBusy(true);
    try {
      await put(`/admin/ai-keys/${chosenKey}`, { api_key: key });
      setKeyInput("");
      setTested(null);
      toast.success(`${chosen?.label ?? "Provider"} key saved. It will not be shown again.`);
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not save the key.");
    } finally {
      setKeyBusy(false);
    }
  };

  const removeKey = async () => {
    setKeyBusy(true);
    try {
      await del(`/admin/ai-keys/${chosenKey}`);
      setTested(null);
      toast.success("Key removed.");
      reload();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not remove the key.");
    } finally {
      setKeyBusy(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTested(null);
    try {
      setTested(await post<AiTestResult>("/admin/ai-test"));
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Could not test the connection.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <DataPanel
      title="AI features"
      description="Which AI answers, and what it may do in this workspace. Off until you turn it on."
      isLoading={isLoading}
      error={error?.detail}
      onRetry={reload}
      actions={
        <Button onClick={save} disabled={saving || !draft || !dirty}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Save
        </Button>
      }
    >
      {data && draft ? (
        <div className="grid gap-6 p-4 sm:p-6">
          <FieldSet className="grid gap-4 rounded-md border p-4">
            <FieldLegend className="px-1 text-sm font-medium">Who answers</FieldLegend>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="ai-provider">AI provider</Label>
                <Select
                  value={draft.provider || DEFAULT}
                  onValueChange={(value) =>
                    setDraft({
                      ...draft,
                      provider: value === DEFAULT ? "" : (value as AiProviderKey),
                      model: "",
                      base_url: value === "ollama" ? draft.base_url : "",
                    })
                  }
                >
                  <SelectTrigger id="ai-provider" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT}>
                      Server default ({providers.find((p) => p.key === data.provider)?.label ?? data.provider_label})
                    </SelectItem>
                    {providers.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                        {option.workspace_key || option.server_ready ? "" : " — needs a key"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{WHERE[chosenKey]}</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ai-model">Model</Label>
                <Input
                  id="ai-model"
                  value={draft.model}
                  maxLength={100}
                  placeholder={chosen?.default_model ?? "The provider's default"}
                  onChange={(event) =>
                    setDraft({ ...draft, model: event.target.value.replace(/[^A-Za-z0-9._:/-]/g, "") })
                  }
                />
                {chosen?.suggested_models.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {chosen.suggested_models.map((model) => (
                      <Button
                        key={model}
                        type="button"
                        size="sm"
                        variant={draft.model === model ? "secondary" : "outline"}
                        className="h-7 px-2 text-xs"
                        onClick={() => setDraft({ ...draft, model })}
                      >
                        {model}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {chosenKey === "ollama" ? (
              <div className="grid gap-2">
                <Label htmlFor="ai-base-url">Ollama server address</Label>
                <Input
                  id="ai-base-url"
                  value={draft.base_url}
                  maxLength={300}
                  inputMode="url"
                  placeholder="https://ollama.example.com"
                  onChange={(event) => setDraft({ ...draft, base_url: event.target.value.trim() })}
                />
                <p className="text-xs text-muted-foreground">
                  {chosen?.server_address
                    ? "Leave empty to use the Ollama server AskMira runs on. "
                    : "Your Ollama server's public https address. "}
                  Private and local addresses are refused.
                </p>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="ai-key">
                {chosen?.label ?? "Provider"} API key{chosen && !chosen.needs_key ? " (only if your server asks for one)" : ""}
              </Label>
              {chosen?.workspace_key ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline" className="gap-1">
                    <KeyRound className="size-3.5" /> Your key {chosen.workspace_key}
                  </Badge>
                  <Button type="button" variant="ghost" size="sm" disabled={keyBusy} onClick={removeKey}>
                    <Trash2 /> Remove
                  </Button>
                </div>
              ) : chosen?.server_ready ? (
                <p className="text-sm text-muted-foreground">
                  AskMira&apos;s server already has {chosen.needs_key ? "a key" : "an address"} for{" "}
                  {chosen.label}. Add your own key to use your organisation&apos;s account instead.
                </p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="ai-key"
                  type="password"
                  autoComplete="off"
                  value={keyInput}
                  maxLength={400}
                  placeholder={chosen?.workspace_key ? "Paste a new key to replace it" : "Paste the key"}
                  onChange={(event) => setKeyInput(event.target.value.replace(/\s/g, ""))}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={keyBusy || keyInput.trim().length < 8 || dirty}
                  onClick={saveKey}
                >
                  {keyBusy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound />}
                  Save key
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {chosen?.key_help ? `Get one at ${chosen.key_help}. ` : ""}
                Stored encrypted; nobody can read it back, including you.
                {dirty ? " Save the provider choice first." : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t pt-4">
              <Button type="button" variant="outline" disabled={testing || dirty} onClick={test}>
                {testing ? <Loader2 className="size-4 animate-spin" /> : <PlugZap />}
                Test connection
              </Button>
              <p className="text-sm text-muted-foreground">
                {dirty
                  ? "Save first, then test."
                  : data.configured
                    ? `Answers come from ${data.provider_label}, model ${data.model}, with ${
                        data.key_source === "workspace" ? "your" : "AskMira's"
                      } ${data.provider === "ollama" ? "server" : "key"}.`
                    : `${data.provider_label} has no key here yet.`}
              </p>
            </div>
            {tested ? (
              <Alert variant={tested.ok ? "default" : "destructive"}>
                {tested.ok ? <CheckCircle2 /> : <XCircle />}
                <AlertTitle>{tested.ok ? "Connected" : "Not working yet"}</AlertTitle>
                <AlertDescription>
                  {tested.message}
                  {tested.ok ? ` Model: ${tested.model}.` : ""}
                </AlertDescription>
              </Alert>
            ) : null}
            {chosenKey !== "anthropic" ? (
              <p className="text-xs text-muted-foreground">
                People agree to AI help from &quot;our AI provider&quot;; the privacy notice lists every
                provider you can choose. If you switch, your DPO may want to tell people which one
                you now use.
              </p>
            ) : null}
          </FieldSet>

          {!data.configured ? (
            <Alert>
              <Sparkles />
              <AlertTitle>{data.provider_label} is not set up yet</AlertTitle>
              <AlertDescription>
                The switches below are saved, but nothing can be sent until the provider has a key
                {data.provider === "ollama" ? " or a server address" : ""}.
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-muted-foreground">
              Every request is logged with what was sent, under Compliance → Privacy. The AI reads
              figures only for groups of five or more people; smaller groups stay on the person&apos;s
              screen.
            </p>
          )}

          <div className="flex items-center justify-between gap-4 rounded-md border p-4">
            <div className="grid gap-1">
              <Label htmlFor="ai-enabled">AI features for this workspace</Label>
              <p className="text-sm text-muted-foreground">
                Off means no request of any kind goes to the AI provider.
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
