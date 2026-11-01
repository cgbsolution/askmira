"use client";

import { useApiQuery } from "@/hooks/useApiQuery";

export type AiFeature =
  | "companion"
  | "assistant"
  | "recognition_drafts"
  | "survey_topics"
  | "analytics_questions"
  | "hiring_drafts";

export type AiProviderKey = "anthropic" | "openai" | "gemini" | "ollama";

/** What the workspace saved: the switches, and which provider and model answer. */
export interface AiSettings extends Record<AiFeature, boolean> {
  enabled: boolean;
  /** "" = the server's default provider. */
  provider: AiProviderKey | "";
  /** "" = the provider's default model on this server. */
  model: string;
  /** Ollama only: the workspace's own server address. */
  base_url: string;
}

/** One provider an admin can choose (admins only). */
export interface AiProviderOption {
  key: AiProviderKey;
  label: string;
  needs_key: boolean;
  suggested_models: string[];
  default_model: string;
  key_help: string;
  /** This server already holds a key (or, for Ollama, an address) for it. */
  server_ready: boolean;
  /** "…abcd" when the workspace saved its own key; "" otherwise. */
  workspace_key: string;
  /** Ollama: the server has its own Ollama address. */
  server_address: boolean;
  sub_processor: string;
}

export interface AiStatus {
  /** A model can be called for this workspace: its provider has a key (or address). */
  configured: boolean;
  /** The workspace has switched AI on. */
  enabled: boolean;
  features: Record<AiFeature, boolean>;
  feature_descriptions: Record<AiFeature, string>;
  settings: AiSettings;
  provider: AiProviderKey;
  provider_label: string;
  model: string | null;
  /** Whose key answers: the workspace's own, or the server's. */
  key_source: "workspace" | "server" | null;
  sub_processor: string;
  /** The caller's own consent to the AI assistance purpose. */
  my_consent: boolean;
  /** Admins only. */
  providers?: AiProviderOption[];
}

export interface AiTestResult {
  ok: boolean;
  provider: AiProviderKey;
  label: string;
  model: string;
  message: string;
  seconds?: number;
}

/** Whether AI is on here, which features, and whether the caller agreed. */
export function useAiStatus() {
  return useApiQuery<AiStatus>("/ai/status");
}

/** A feature can be offered: the server has a provider and the workspace turned it on. */
export function aiAvailable(status: AiStatus | null, feature: AiFeature): boolean {
  return Boolean(status?.configured && status.features[feature]);
}
