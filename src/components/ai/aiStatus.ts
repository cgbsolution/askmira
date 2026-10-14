"use client";

import { useApiQuery } from "@/hooks/useApiQuery";

export type AiFeature =
  | "assistant"
  | "recognition_drafts"
  | "survey_topics"
  | "analytics_questions"
  | "hiring_drafts";

export interface AiStatus {
  /** The server has a model provider at all. */
  configured: boolean;
  /** The workspace has switched AI on. */
  enabled: boolean;
  features: Record<AiFeature, boolean>;
  feature_descriptions: Record<AiFeature, string>;
  settings: Record<string, boolean>;
  model: string | null;
  sub_processor: string;
  /** The caller's own consent to the AI assistance purpose. */
  my_consent: boolean;
}

/** Whether AI is on here, which features, and whether the caller agreed. */
export function useAiStatus() {
  return useApiQuery<AiStatus>("/ai/status");
}

/** A feature can be offered: the server has a provider and the workspace turned it on. */
export function aiAvailable(status: AiStatus | null, feature: AiFeature): boolean {
  return Boolean(status?.configured && status.features[feature]);
}
