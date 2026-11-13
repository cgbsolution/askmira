import type { CompanionMessage, CompanionStatus } from "@/components/companion/types";

/** What a scanned code says before the chat opens. */
export interface ShowcaseDescription {
  status: "live" | "scheduled" | "ended" | "off";
  company: string;
  logo_url: string | null;
  message?: string;
  starts_at?: string;
  ends_at?: string;
  /** The stand types a PIN before the chat opens. */
  needs_pin?: boolean;
}

/** A visitor's chat: the workspace's Ask Miraa, answering as the link's admin. */
export interface ShowcaseChat {
  run_id: string;
  company: string;
  logo_url: string | null;
  ends_at: string;
  acting_name: string;
  status: CompanionStatus;
  messages?: CompanionMessage[];
  /** Only when the chat starts: the key this browser keeps to carry on with it. */
  key?: string;
}

/** A showcase link as the super admin sees it (Platform → Showcase links). */
export interface ShowcaseLink {
  id: string;
  label: string;
  url: string;
  code: string;
  status: "live" | "scheduled" | "ended" | "off";
  workspace_id: string;
  company: string;
  acting_user_id: string;
  acting_name: string;
  acting_email: string;
  pin: string | null;
  daily_messages: number;
  messages_today: number;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
  visits: number;
  last_visit_at: string | null;
  created_at: string;
  updated_at: string;
}
