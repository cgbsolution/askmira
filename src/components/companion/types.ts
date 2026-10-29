import type { ReportResult } from "@/lib/types/reports";

/** What the chat screen needs before it shows anything. */
export interface CompanionStatus {
  available: boolean;
  /** "ai": a model plans each turn. "direct": words are matched to a lookup here; nothing leaves AskMira. */
  mode: "ai" | "direct";
  /** Why a model is not planning, in direct mode. */
  reason: "not_configured" | "disabled" | "no_consent" | null;
  /** What this workspace calls its companion. */
  name: string;
  greeting: string;
  tools: { key: string; title: string }[];
  /** Questions this person can ask, one per tool they have. */
  examples: string[];
  daily_limit: number;
  sent_today: number;
  can_configure: boolean;
}

export interface Citation {
  number: number;
  id: string;
  source: string;
  label: string;
  href: string | null;
}

/**
 * What AskMira looked up and showed, as the person. The model reads a trimmed
 * view of a card only where the DPDP register allows it; the card itself is
 * the record behind every figure Mira states.
 */
export type CompanionCard =
  | { type: "notice"; tone: "info" | "warning"; text: string }
  | {
      type: "table";
      title: string;
      caption: string;
      columns: string[];
      rows: unknown[][];
      /** The linked product the rows were read from, when they came from one. */
      source?: string;
      /** Where to open that product: the portal's launch page. */
      open?: string;
      /** Per row: where to open that row in the product (a job's candidates, with résumés). */
      links?: (string | null)[];
      /** One page of a longer list on a portal page: which page, its size and the rows in all. */
      page?: { number: number; size: number; total: number };
    }
  | {
      type: "policy";
      outcome: "answered" | "partially_answered" | "refused" | "withheld";
      answer: string;
      citations: Citation[];
      confidence_band: string | null;
      answered_from: "policy" | "your_record";
      open?: string;
    }
  | {
      type: "report";
      interpretation: string;
      confidence_band: string;
      chart: "number" | "bar" | "line" | "table";
      answered: boolean;
      result: ReportResult | null;
      problem: string | null;
    }
  | { type: "own_record"; text: string; open: string }
  | {
      /** One person's record (salary, leave, profile…) or the headcount: figures, then a table. */
      type: "record";
      title: string;
      subtitle: string;
      heading: string;
      figures: { label: string; value: string }[];
      table?: { columns: string[]; rows: unknown[][] };
      note: string;
      open?: string;
      open_label?: string;
    }
  | {
      /** Several people match: each option, clicked, asks again for that one person. */
      type: "choices";
      title: string;
      caption: string;
      options: CompanionPick[];
    }
  | { type: "launch"; product: string; name: string; href: string }
  | CompanionChartCard
  | CompanionProposal;

/** A month-by-month series: one value per month on `x`, per series. */
export interface CompanionChartCard {
  type: "chart";
  title: string;
  caption: string;
  chart: "line" | "bar";
  /** "inr" (rupees), "count" or "percent". */
  unit: string;
  x: string[];
  series: { name: string; values: string[] }[];
}

/** Something Mira offered to do. Nothing happens until the person confirms. */
export interface CompanionProposal {
  type: "proposal";
  action_id: string;
  kind: string;
  status: "proposed" | "done" | "cancelled" | "failed" | "expired";
  expires_at: string;
  title: string;
  figures: { label: string; value: string }[];
  notes: string[];
  confirm_label: string;
  question: string;
  result: { text?: string; open?: string; error?: boolean } | null;
}

/** A choice on an answer: what it says when sent, and the lookup it runs. */
export interface CompanionPick {
  label: string;
  detail: string;
  text: string;
  tool: string;
  inputs: Record<string, string>;
}

export interface CompanionMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  tool: string | null;
  tool_title: string | null;
  arguments: Record<string, unknown> | null;
  /** The tools a reply used, in order. */
  steps?: { tool: string; title: string }[];
  cards: CompanionCard[];
  created_at: string | null;
}

/** An offer confirmed or declined with its button: its new state, and Mira's note of it. */
export interface OfferDecision {
  action: CompanionProposal;
  message: CompanionMessage;
}

export interface Conversation {
  id: string;
  title: string;
  last_message_at: string;
  created_at: string | null;
}

export interface ConversationDetail extends Conversation {
  messages: CompanionMessage[];
}

/** One turn's answer: the person's message as saved, and the reply. */
export interface Turn {
  conversation: Conversation;
  messages: [CompanionMessage, CompanionMessage];
}

export interface CompanionConfig {
  name: string;
  greeting: string;
  company_notes: string;
  tools: Record<string, boolean>;
  daily_messages_per_person: number;
  monthly_token_budget: number;
  /** Whether Mira reads what its lookups find (within what the DPDP register allows). */
  ai_reads_results: boolean;
}

export interface CompanionSettings {
  config: CompanionConfig;
  groups: { key: string; description: string; on: boolean }[];
  ai_enabled: boolean;
  usage: { replies_this_month: number; tokens_this_month: number };
}
