import type { CompanionCard } from "@/components/companion/types";

/** A showcase link as the platform console lists it (backend ShowcaseLinkRead). */
export interface ShowcaseLink {
  id: string;
  label: string;
  url: string;
  code: string;
  status: "live" | "scheduled" | "ended" | "off";
  brand_tenant_id: string | null;
  company: string;
  client_name: string;
  role_title: string;
  headcount: number;
  months: number;
  order_value: string;
  team_budget: string;
  margin_floor: string;
  laptop_price: string;
  payment_days: number;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
  visits: number;
  last_visit_at: string | null;
  created_at: string;
  updated_at: string;
}

/** The connected products a story moves through, by key. */
export type SystemKey =
  | "saleinx"
  | "hrms"
  | "anytimehire"
  | "procureflow"
  | "helpdesk"
  | "expensegenie"
  | "accounts";

/** What a scanned link says before a story starts. */
export interface ShowcaseDescription {
  status: "live" | "scheduled" | "ended" | "off";
  company: string;
  logo_url: string | null;
  message?: string;
  starts_at?: string;
  ends_at?: string;
  client?: string;
  role?: string;
  headcount?: number;
  months?: number;
  order_value?: string;
}

export interface ShowcaseMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  systems: SystemKey[];
  cards: CompanionCard[];
  /** The story's day, e.g. "Fri 13 Nov". */
  when: string;
  /** A time skip shown before this message: "Next morning", "Two days later". */
  elapsed: string | null;
}

export interface ShowcaseChapter {
  key: string;
  title: string;
  blurb: string;
  systems: SystemKey[];
  state: "done" | "current" | "next";
  prompt: string;
}

export interface CashMonth {
  label: string;
  inflow: string;
  outflow: string;
  net: string;
  cumulative: string;
}

export interface ShowcaseBoard {
  order: { booked: boolean; po: string; value: string };
  budget: {
    total: string;
    original: string;
    raised: boolean;
    committed: string | null;
    headroom: string | null;
    per_head: string;
  };
  margin: { floor: string; now: string; basis: "budget" | "offers" };
  funnel: { key: string; label: string; count: number | null }[];
  joining: string;
  equipment: {
    ordered: boolean;
    count: number;
    total: string | null;
    vendor: string | null;
    po: string | null;
    tickets: number;
  };
  travel: { shown: boolean; total: string; pending: number };
  pnl: {
    revenue: string;
    team: string;
    laptops: string;
    travel: string;
    net: string;
    net_pct: string;
    gross_pct: string;
    basis: "budget" | "offers";
  };
  cash: {
    months: CashMonth[];
    lowest: string;
    lowest_at: string | null;
    positive_from: string | null;
    final: string;
    basis: "budget" | "offers";
    lag_months: number;
  };
  activity: { when: string; system: SystemKey; text: string }[];
}

/** One visitor's story: what the page draws after every step. */
export interface ShowcaseRun {
  run_id: string;
  /** Only on the response that started the story: the page keeps it to carry on. */
  key?: string;
  company: string;
  logo_url: string | null;
  ends_at: string;
  turns_left: number;
  scenario: {
    company: string;
    client: string;
    role: string;
    headcount: number;
    months: number;
    order_value: string;
    team_budget: string;
    payment_days: number;
  };
  systems: Record<SystemKey, string>;
  chapters: ShowcaseChapter[];
  messages: ShowcaseMessage[];
  suggestions: string[];
  autoplay: { say: string } | { decide: string; confirm: boolean } | null;
  finished: boolean;
  board: ShowcaseBoard;
}
