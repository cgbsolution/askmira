import { post } from "@/lib/api";
import type { ProductKey } from "@/lib/types";

/** Platform → Tools: the platform's key for one of our products. */
export interface PlatformTool {
  key: ProductKey;
  brand: string;
  name: string;
  what: string;
  api_url: string | null;
  app_url: string | null;
  key_set: boolean;
  /** "platform": set here; "env": from the server's settings. */
  key_source: "platform" | "env" | null;
  last_checked_at: string | null;
  last_check_ok: boolean | null;
  last_check_message: string | null;
  /** The platform can set workspaces up in it (key and address known). */
  ready: boolean;
  /** Only right after "Generate": the new key, shown once. */
  generated?: string | null;
}

export interface SyncSummary {
  sent: number;
  created: number;
  updated: number;
  deactivated: number;
  skipped: { email: string; reason: string }[];
}

/** One workspace in one product, as the console sees it. */
export interface WorkspaceTool {
  key: ProductKey;
  brand: string;
  name: string;
  what: string;
  ready: boolean;
  connected: boolean;
  via: "platform" | "connectors" | "server" | null;
  organization: string | null;
  external_ref: string | null;
  last_synced_at: string | null;
  last_sync: SyncSummary | null;
  last_error: string | null;
}

export interface ProductOrganization {
  ref: string;
  name: string;
  admins: string[];
  /** The AskMiraa workspace it is connected to already, if any. */
  connected_to: string | null;
}

export type ProvisionResult =
  | {
      outcome: "connected";
      created: boolean;
      admin_created: boolean;
      admin_email: string;
      /** What became of the organisation's admin there, in a sentence. */
      admin_note: string;
      app_url: string;
      tool: WorkspaceTool;
    }
  | {
      outcome: "existing";
      message: string;
      organizations: ProductOrganization[];
    };

/** What became of one tool ticked when the organisation was created. */
export interface ToolOutcome {
  key: ProductKey;
  brand: string;
  status: "connected" | "existing" | "failed";
  message: string;
}

export function provision(
  workspaceId: string,
  product: ProductKey,
  body: { organization_ref?: string; create_new?: boolean } = {},
) {
  return post<ProvisionResult>(
    `/platform/workspaces/${workspaceId}/products/${product}`,
    body,
  );
}

export const VIA_LABEL: Record<NonNullable<WorkspaceTool["via"]>, string> = {
  platform: "Set up by the platform",
  connectors: "Connected by the workspace admin",
  server: "Linked with server settings",
};
