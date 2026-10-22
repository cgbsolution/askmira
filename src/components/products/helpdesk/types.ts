/** CGB Helpdesk records, as AskMira reads them live for the signed-in person. */

export interface HelpdeskOptions {
  source: string;
  categories: { name: string; sub_categories: string[] }[];
  priorities: string[];
  /** The person's phone number in the helpdesk, to prefill Contact. */
  contact: string | null;
  /** Assets assigned to the person now, for "which device is it about?". */
  assets: { id: string; code: string; type: string; model: string | null }[];
}

export interface HelpdeskTicket {
  id: string;
  ref: string;
  subject: string;
  description: string | null;
  category: string | null;
  sub_category: string | null;
  priority: string | null;
  status: string | null;
  location: string | null;
  link: string | null;
  requester: string;
  /** The person raised it. */
  mine: boolean;
  assignee: string | null;
  created_at: string;
  assigned_at: string | null;
  closed_comment: string | null;
  hold_comment: string | null;
  hold_until: string | null;
  sla_response_at: string | null;
  sla_resolution_at: string | null;
  sla_breached: boolean;
  can_reply: boolean;
  asset: { asset_code: string; asset_type: string; model: string | null } | null;
  attachments: { name: string; size: number | null }[];
}

export interface HelpdeskMessage {
  id: string;
  from: string;
  side: "support" | "requester";
  /** Written by the person reading. */
  mine: boolean;
  text: string;
  at: string;
}

export interface HelpdeskTicketPage {
  source: string;
  ticket: HelpdeskTicket;
  messages: HelpdeskMessage[];
  activity: { action: string; by: string | null; at: string }[];
  /** The ticket in the helpdesk itself, through AskMira's sign-in. */
  open: string;
}

export const TICKET_STATUS_LABEL: Record<string, string> = {
  new: "New",
  open: "Open",
  in_progress: "In progress",
  hold: "On hold",
  closed: "Closed",
};

export const PRIORITY_LABEL: Record<string, string> = { low: "Low", medium: "Medium", high: "High" };
