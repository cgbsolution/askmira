/**
 * The notification engine, as the API exposes it.
 *
 * Mirrors `app/api/v1/routers/notifications.py` and
 * `app/services/notifications/admin.py`.
 */

export type Channel = "email" | "push" | "in_app" | "whatsapp";
export type DigestMode = "immediate" | "daily_digest" | "off";

/**
 * Whether a channel actually delivers here.
 *
 * `not_delivered` is the honest state for a channel whose adapter writes to a
 * log instead of sending — a workspace that believes email is going out when
 * it is not is worse off than one that is told.
 */
export type ChannelState = "live" | "not_delivered" | "unverified";

export interface ChannelStatus {
  channel: Channel;
  state: ChannelState;
  summary: string;
}

export interface NotificationEvent {
  event_key: string;
  /** Urgent events bypass quiet hours and the rate cap. */
  urgent: boolean;
  defaults: Partial<Record<Channel, DigestMode>>;
}

export interface NotificationPolicy {
  /** False when the workspace has never saved one and these are the shipped defaults. */
  configured: boolean;
  quiet_hours_enabled: boolean;
  /** "HH:MM". */
  quiet_start: string;
  quiet_end: string;
  timezone: string;
  rate_limit_per_hour: number;
  max_attempts: number;
  urgent_events: string[];
}

export interface SmtpSettings {
  configured: boolean;
  /** Whether the platform itself has a relay to fall back on. */
  platform_relay_configured: boolean;
  enabled?: boolean;
  host?: string;
  port?: number;
  username?: string | null;
  /** The password itself is never returned — only whether one is stored. */
  has_password?: boolean;
  use_starttls?: boolean;
  use_ssl?: boolean;
  from_address?: string;
  from_name?: string | null;
  last_test_at?: string | null;
  last_test_ok?: boolean | null;
  last_test_error?: string | null;
}

export interface NotificationTemplate {
  id: string;
  event_key: string;
  channel: Channel;
  locale: string;
  subject: string | null;
  body: string;
  /** Saving writes the next version and retires this one; nothing is overwritten. */
  version: number;
  active: boolean;
  updated_at: string | null;
}

/** A workspace's own active version of one message on one channel. */
export interface CustomWording {
  subject: string | null;
  body: string;
  version: number;
  updated_at: string | null;
}

/** One email AskMira can send, with its built-in wording and the workspace's own. */
export interface EmailCatalogueItem {
  event_key: string;
  group: string;
  audience: "employee" | "candidate";
  urgent: boolean;
  /** The approver's copy carries Approve / Reject buttons. */
  approval_buttons: boolean;
  default_subject: string;
  default_body: string;
  placeholders: string[];
  custom: Partial<Record<"email" | "in_app" | "push", CustomWording>>;
}

/** Settings → Notifications → Email design. The logo is the company logo. */
export interface EmailDesign {
  accent_colour: string;
  show_logo: boolean;
  sign_off: string;
  footer_text: string;
  approve_from_email: boolean;
  company_name: string;
  has_logo: boolean;
}

export type EmailDesignInput = Omit<EmailDesign, "company_name" | "has_logo">;

/** The brand colour emails use until a workspace picks one (the server's default). */
export const DEFAULT_EMAIL_ACCENT = "#EB061D";

/** Quick picks for the email brand colour: the AskMira kit first, then common brand hues. */
export const EMAIL_ACCENT_PRESETS = [
  "#EB061D", "#F8A01A", "#271E1C", "#B8650A", "#C2185B", "#7B1FA2",
  "#3949AB", "#1E88E5", "#00897B", "#43A047", "#6D4C41", "#546E7A",
] as const;

export interface EmailPreview {
  subject: string;
  html: string;
  text: string;
}

export interface EmailTestResult {
  ok: boolean;
  error: string | null;
  sent_to: string | null;
  /** False when no mail relay is set up: the test went to the server log. */
  delivered: boolean;
  relay: string;
}

export interface NotificationPreference {
  event_key: string;
  channel: Channel;
  enabled: boolean;
  digest_mode: DigestMode;
}

export type NotificationStatus =
  | "queued"
  | "deferred"
  | "sent"
  | "delivered"
  | "failed"
  | "read"
  | "digested"
  | "dead_letter";

export interface NotificationItem {
  id: string;
  event_key: string;
  channel: Channel;
  rendered_subject: string | null;
  rendered_body: string;
  status: NotificationStatus;
  is_urgent: boolean;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
}

export interface WhatsAppConsent {
  opted_in: boolean;
  opted_in_at: string | null;
  opted_out_at: string | null;
  source: string | null;
}
